import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseDocument } from "./services/knowledgebase/documentParser";
import { analyzeRequirements, analyzeProposal, evaluateProposal, getOpenAIClient } from "./services/ai/aiAnalysis";
import { seedSampleData, seedPortfolios, seedAllMockData, wipeAllData, wipeAzureOnly, seedRftTemplates } from "./services/core/sampleData";
import { generateRftFromBusinessCase, regenerateRftSection, generateProfessionalRftSections, extractBusinessCaseInfo } from "./services/rft/smartRftService";
import { generateAllQuestionnaires } from "./services/rft/excelGenerator";
import { generateRft, generateRftPack, generateVendorResponses, generateEvaluation, generateVendorStages } from "./services/rft/rftMockDataGenerator";
import { templateService } from "./services/rft/templateService";
import { templateMergeService } from "./services/rft/templateMergeService";
import { getStakeholderRole } from "./services/rft/stakeholderConfig";
import { azureEmbeddingService } from "./services/azure/azureEmbedding";
import { azureAISearchService } from "./services/azure/azureAISearch";
import { azureBlobStorageService } from "./services/azure/azureBlobStorage";
import { azureSearchSkillsetService } from "./services/azure/azureSearchSkillset";
import { evaluationProgressService } from "./services/core/evaluationProgress";
import { lookup as dnsLookup } from "dns";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import archiver from "archiver";

const lookupAsync = promisify(dnsLookup);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper function to extract text from DOCX with paragraph breaks preserved
function extractTextWithFormatting(zip: any): string {
  try {
    const documentXml = zip.file("word/document.xml")?.asText();
    if (!documentXml) {
      return "";
    }

    // Extract text and preserve paragraph breaks
    // Parse XML and add double line breaks between paragraphs (<w:p> tags)
    const paragraphs: string[] = [];
    
    // Match all paragraph tags (avoid 's' flag - not supported in older TS targets)
    const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    const matches = documentXml.matchAll(paragraphRegex);
    
    for (const match of matches) {
      const paragraphContent = match[1];
      
      // Extract text from <w:t> tags within this paragraph
      const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
      const textMatches = paragraphContent.matchAll(textRegex);
      
      let paragraphText = "";
      for (const textMatch of textMatches) {
        // Decode XML entities
        const text = textMatch[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        paragraphText += text;
      }
      
      // Handle line breaks within paragraphs
      const lineBreakCount = (paragraphContent.match(/<w:br\s*\/?>/g) || []).length;
      if (lineBreakCount > 0) {
        // Add explicit line breaks where Word has them
        paragraphText = paragraphText.replace(/\s+/g, ' ') + '\n'.repeat(lineBreakCount);
      }
      
      if (paragraphText.trim()) {
        paragraphs.push(paragraphText);
      }
    }
    
    // Join paragraphs with double line breaks
    return paragraphs.join('\n\n');
  } catch (error) {
    console.error("Error extracting formatted text:", error);
    // Fallback to simple text extraction
    try {
      const documentXml = zip.file("word/document.xml")?.asText();
      if (documentXml) {
        return documentXml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (fallbackError) {
      console.error("Fallback text extraction also failed:", fallbackError);
    }
    return "";
  }
}

// Helper function to extract section-specific content from merged text
function extractSectionContent(
  mergedText: string,
  sectionTitle: string,
  allSectionTitles: string[]
): { content: string; confidence: "high" | "low"; method: string } {
  try {
    // Clean section title for matching (remove extra newlines and trim)
    const cleanTitle = sectionTitle.replace(/\n.*$/gm, '').trim().toUpperCase();
    
    // Find where this section starts
    const sectionStartPattern = new RegExp(`\\d+\\.?\\s*${cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const match = mergedText.match(sectionStartPattern);
    
    if (!match) {
      console.warn(`⚠️ Could not find section heading: "${sectionTitle}" - using full document`);
      return {
        content: mergedText,
        confidence: "low",
        method: "fallback_full_document"
      };
    }
    
    const sectionStart = match.index!;
    
    // Find where the NEXT section starts
    let nextSectionStart = mergedText.length; // Default to end of document
    
    for (const nextTitle of allSectionTitles) {
      if (nextTitle === sectionTitle) continue; // Skip current section
      
      const cleanNextTitle = nextTitle.replace(/\n.*$/gm, '').trim().toUpperCase();
      const nextPattern = new RegExp(`\\d+\\.?\\s*${cleanNextTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const nextMatch = mergedText.match(nextPattern);
      
      if (nextMatch && nextMatch.index! > sectionStart && nextMatch.index! < nextSectionStart) {
        nextSectionStart = nextMatch.index!;
      }
    }
    
    // Extract content between this section and the next
    const extractedContent = mergedText.substring(sectionStart, nextSectionStart).trim();
    
    if (extractedContent.length < 50) {
      console.warn(`⚠️ Section "${sectionTitle}" extracted content is very short (${extractedContent.length} chars) - may be incomplete`);
      return {
        content: extractedContent,
        confidence: "low",
        method: "heading_extraction_short"
      };
    }
    
    console.log(`✅ Extracted ${extractedContent.length} chars for section "${sectionTitle.substring(0, 40)}..."`);
    return {
      content: extractedContent,
      confidence: "high",
      method: "heading_extraction"
    };
  } catch (error) {
    console.error(`Error extracting section "${sectionTitle}":`, error);
    return {
      content: mergedText,
      confidence: "low",
      method: "fallback_error"
    };
  }
}

// Helper functions for stakeholder inference
function inferStakeholderFromHeading(heading: string): string {
  const h = heading.toUpperCase();
  
  if (h.includes("EXECUTIVE") || h.includes("SUMMARY")) return "product_owner";
  if (h.includes("SCOPE") || h.includes("WORK")) return "product_owner";
  if (h.includes("BACKGROUND") || h.includes("CONTEXT")) return "technical_pm";
  if (h.includes("TECHNICAL") || h.includes("ARCHITECTURE")) return "solution_architect";
  if (h.includes("SECURITY") || h.includes("COMPLIANCE") || h.includes("CYBERSECURITY")) return "cybersecurity_analyst";
  if (h.includes("EVALUATION") || h.includes("CRITERIA")) return "procurement_lead";
  if (h.includes("SUBMISSION") || h.includes("REQUIREMENT")) return "procurement_lead";
  if (h.includes("TERMS") || h.includes("CONDITIONS") || h.includes("LEGAL")) return "legal_counsel";
  if (h.includes("CONTACT") || h.includes("INFORMATION")) return "procurement_lead";
  
  return "technical_pm"; // Default
}

function inferCategoryFromHeading(heading: string): "technical" | "security" | "business" | "procurement" | "other" {
  const h = heading.toUpperCase();
  
  if (h.includes("EXECUTIVE") || h.includes("BACKGROUND")) return "business";
  if (h.includes("TECHNICAL") || h.includes("ARCHITECTURE") || h.includes("SCOPE")) return "technical";
  if (h.includes("SECURITY") || h.includes("COMPLIANCE")) return "security";
  if (h.includes("EVALUATION") || h.includes("SUBMISSION") || h.includes("TERMS")) return "procurement";
  
  return "other"; // Default
}

// Helper: Strip common Markdown syntax and visual artifacts from AI-generated content
function stripMarkdownFormatting(text: string): string {
  let cleaned = text;
  
  // Remove heading markers (###, ##, #)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  
  // Remove horizontal rules (---, ___, ***) - standalone or with surrounding whitespace
  cleaned = cleaned.replace(/^\s*[-_*]{3,}\s*$/gm, '');
  // Also remove inline horizontal separators (e.g., "--- CONTENT ---")
  cleaned = cleaned.replace(/\s*[-]{3,}\s*/g, ' ');
  
  // Remove bold markers (**text** or __text__)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  
  // Remove italic markers (*text* or _text_) - but preserve single * for bullets
  cleaned = cleaned.replace(/\*([^*\n]+)\*/g, '$1');
  cleaned = cleaned.replace(/_([^_\n]+)_/g, '$1');
  
  // Remove strikethrough markers (~~text~~)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');
  
  // Remove code block markers (```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
  });
  
  // Remove inline code markers (`text`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // Remove emojis using surrogate pairs (compatible approach)
  cleaned = cleaned.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|\uD83D[\uDE00-\uDE4F]|\uD83D[\uDE80-\uDEFF]|[\u2600-\u26FF]|[\u2700-\u27BF])/g, '');
  
  // Clean up multiple consecutive blank lines (more than 2)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  return cleaned;
}

// AI Enhancement for template-merged 
async function enhanceSectionWithAI(
  sectionTitle: string,
  extractedContent: string,
  businessCaseData: any,
  options: {
    enabled?: boolean;
    maxTokens?: number;
    category?: string;
  } = {}
): Promise<{ content: string; enhanced: boolean; status: string }> {
  // Default options
  const { 
    enabled = true, 
    maxTokens = 3500,
    category = "other"
  } = options;
  
  // Skip enhancement if disabled
  if (!enabled) {
    return {
      content: extractedContent,
      enhanced: false,
      status: "skipped_disabled"
    };
  }
  
  // Skip enhancement only for purely administrative/boilerplate sections
  // All dynamic content sections should be enhanced (Executive Summary, Background, Scope, Requirements, etc.)
  const titleUpper = sectionTitle.toUpperCase();
  const isAdministrativeSection = 
    titleUpper.includes("CONTACT") ||
    titleUpper.includes("TERMS") && titleUpper.includes("CONDITION") ||
    titleUpper.includes("LEGAL") && titleUpper.includes("NOTICE");
  
  if (isAdministrativeSection) {
    // Skip administrative/boilerplate sections
    return {
      content: extractedContent,
      enhanced: false,
      status: "skipped_administrative_section"
    };
  }
  
  // Check if this is a requirements/technical section that needs structured requirements
  const needsStructuredRequirements = 
    titleUpper.includes("SCOPE") || 
    titleUpper.includes("WORK") ||
    titleUpper.includes("REQUIREMENT") ||
    titleUpper.includes("TECHNICAL") ||
    titleUpper.includes("SECURITY") ||
    titleUpper.includes("COMPLIANCE") ||
    category === "technical" ||
    category === "security";
  
  // Truncate input content to prevent token overflow (estimate ~4 chars per token)
  const maxInputChars = 2000; // ~500 tokens for input
  const truncatedContent = extractedContent.length > maxInputChars 
    ? extractedContent.substring(0, maxInputChars) + "\n\n[Content truncated for AI processing...]"
    : extractedContent;
  
  console.log(`🤖 AI enhancing section: ${sectionTitle} (input: ${truncatedContent.length} chars, max output: ${maxTokens} tokens)`);
  
  // Create adaptive prompt based on section type
  let enhancementPrompt: string;
  
  if (needsStructuredRequirements) {
    // Prompt for requirements/technical sections - structured with acceptance criteria
    enhancementPrompt = `You are enhancing a "${sectionTitle}" section from an RFT template.

ORIGINAL TEMPLATE CONTENT:
${truncatedContent}

BUSINESS CASE CONTEXT:
Project: ${businessCaseData.name || "N/A"}
Description: ${(businessCaseData.description || "N/A").substring(0, 500)}
Budget: ${businessCaseData.extractedData?.budget || "TBD"}
Timeline: ${businessCaseData.extractedData?.timeline || "TBD"}
Functional Requirements: ${(businessCaseData.extractedData?.functionalRequirements || "").substring(0, 400)}
Non-functional Requirements: ${(businessCaseData.extractedData?.nonFunctionalRequirements || "").substring(0, 400)}
Industry: Aviation/Airline (Emirates Airlines)

TASK: Expand this section into comprehensive, detailed requirements with MINIMUM 20 specific requirements.

For each requirement, provide:
- Requirement ID and Title (REQ-001, REQ-002, etc.)
- Detailed description
- Technical specifications
- Expected deliverables
- Clear acceptance criteria (3+ measurable, testable conditions)
- Dependencies
- Priority level (Critical/High/Medium/Low)

Organize into relevant categories (e.g., Functional, Technical, Integration, Data Migration, Security, Compliance, Training, Documentation).

CRITICAL FORMATTING RULES - PLAIN TEXT ONLY:
- DO NOT use Markdown syntax (no # for headings, no ** for bold, no * for italics)
- DO NOT use hashtags (#, ##, ###) for headings
- DO NOT wrap text in asterisks or underscores for emphasis
- Use UPPERCASE for category headings (e.g., "FUNCTIONAL REQUIREMENTS")
- Use simple numbered lists (1., 2., 3.) or bullet points with hyphens (-)
- Use line breaks and indentation for structure
- Format each requirement exactly as shown below with plain text

FORMAT EACH REQUIREMENT AS PLAIN TEXT:
REQ-[ID]: [Title]
Description: [What needs to be delivered]
Technical Specs: [Specific technical details]
Deliverables: [Concrete outputs]
Acceptance Criteria:
  - [Measurable criterion 1]
  - [Measurable criterion 2]
  - [Measurable criterion 3]
Dependencies: [Other requirements or systems]
Priority: [Critical/High/Medium/Low]

Include a timeline table mapping requirements to project phases (use plain text table format with dashes and pipes).

Generate the enhanced section content now using ONLY plain text formatting (no Markdown):`;
  } else {
    // Prompt for narrative sections (Executive Summary, Background, Evaluation Criteria, etc.)
    enhancementPrompt = `You are enhancing a "${sectionTitle}" section from an RFT template.

ORIGINAL TEMPLATE CONTENT:
${truncatedContent}

BUSINESS CASE CONTEXT:
Project: ${businessCaseData.name || "N/A"}
Description: ${(businessCaseData.description || "N/A").substring(0, 500)}
Budget: ${businessCaseData.extractedData?.budget || "TBD"}
Timeline: ${businessCaseData.extractedData?.timeline || "TBD"}
Functional Requirements: ${(businessCaseData.extractedData?.functionalRequirements || "").substring(0, 400)}
Non-functional Requirements: ${(businessCaseData.extractedData?.nonFunctionalRequirements || "").substring(0, 400)}
Industry: Aviation/Airline (Emirates Airlines)

TASK: Expand this section into comprehensive, professional content that provides detailed context and clarity.

Guidelines:
- Maintain a professional, authoritative tone suitable for airline industry RFTs
- Expand the original template content with specific details from the business case
- Include relevant aviation industry context and standards where appropriate
- Make the content substantial and informative (aim for 300-500 words minimum)
- Use clear structure with paragraphs and simple lists
- Be specific and concrete - avoid generic statements
- Ensure all information aligns with the project context and requirements

CRITICAL FORMATTING RULES - PLAIN TEXT ONLY:
- DO NOT use Markdown syntax (no # for headings, no ** for bold, no * for italics)
- DO NOT use hashtags (#, ##, ###) for headings
- DO NOT wrap text in asterisks or underscores for emphasis
- Use UPPERCASE for section headings when needed (e.g., "PROJECT TIMELINE" or "STRATEGIC IMPORTANCE")
- Use simple numbered lists (1., 2., 3., 4.) for ordered items
- Use simple bullet points with hyphens (-) for unordered items
- Use blank lines to separate paragraphs
- Use line breaks for clear structure

Generate the enhanced section content now using ONLY plain text formatting (no Markdown):`;
  }

  try {
    const client = await getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert RFT/RFP writer specializing in detailed requirement specifications with clear acceptance criteria for aviation and airline industry projects."
        },
        {
          role: "user",
          content: enhancementPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    });

    const rawContent = response.choices[0]?.message?.content || extractedContent;
    
    // Sanitize: Strip any Markdown formatting that AI may have included despite instructions
    const enhancedContent = stripMarkdownFormatting(rawContent);
    
    // Log warning if Markdown was detected and stripped
    if (rawContent !== enhancedContent) {
      console.warn(`⚠️  Stripped Markdown formatting from AI response for ${sectionTitle} (${rawContent.length} → ${enhancedContent.length} chars)`);
    }
    
    console.log(`✅ AI enhancement complete for ${sectionTitle} (${enhancedContent.length} chars, ${response.usage?.total_tokens || 0} tokens)`);
    
    return {
      content: enhancedContent,
      enhanced: true,
      status: "success"
    };
  } catch (error) {
    console.error(`❌ AI enhancement failed for ${sectionTitle}:`, error);
    // Fallback to original content if AI fails
    return {
      content: extractedContent,
      enhanced: false,
      status: `error: ${error instanceof Error ? error.message : "unknown"}`
    };
  }
}

// Middleware to protect development-only endpoints
const requireDevelopment = (req: any, res: any, next: any) => {
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (!isDevelopment) {
    return res.status(403).json({ 
      error: "This endpoint is only available in development mode" 
    });
  }
  
  next();
};

// Helper function to validate if an IP address is public (not private, loopback, or link-local)
function isPublicIP(ip: string): boolean {
  // Check for IPv4
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map(Number);
    
    // Validate each octet is 0-255
    if (parts.some(p => p > 255)) {
      return false;
    }
    
    // Block loopback (127.0.0.0/8)
    if (parts[0] === 127) return false;
    
    // Block private ranges
    if (parts[0] === 10) return false; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return false; // 192.168.0.0/16
    
    // Block link-local (169.254.0.0/16)
    if (parts[0] === 169 && parts[1] === 254) return false;
    
    // Block 0.0.0.0/8
    if (parts[0] === 0) return false;
    
    // Block broadcast (255.255.255.255)
    if (parts.every(p => p === 255)) return false;
    
    return true;
  }
  
  // Check for IPv6
  const ipLower = ip.toLowerCase().trim();
  
  // Normalize IPv6 address by removing brackets
  const normalizedIP = ipLower.replace(/^\[|\]$/g, '');
  
  // Block loopback addresses (::1 and variations like 0:0:0:0:0:0:0:1)
  if (normalizedIP === '::1' || normalizedIP === '0:0:0:0:0:0:0:1' || 
      normalizedIP.match(/^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:1$/)) {
    return false;
  }
  
  // Block IPv4-mapped IPv6 addresses pointing to private ranges
  if (normalizedIP.startsWith('::ffff:127.') || normalizedIP.startsWith('::ffff:10.') || 
      normalizedIP.startsWith('::ffff:172.') || normalizedIP.startsWith('::ffff:192.168.') ||
      normalizedIP.startsWith('0:0:0:0:0:ffff:7f') || // ::ffff:127.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:a') || // ::ffff:10.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:ac1') || // ::ffff:172.16-31.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:c0a8')) { // ::ffff:192.168.x in hex
    return false;
  }
  
  // Block link-local (fe80::/10)
  if (normalizedIP.startsWith('fe8') || normalizedIP.startsWith('fe9') || 
      normalizedIP.startsWith('fea') || normalizedIP.startsWith('feb')) {
    return false;
  }
  
  // Block unique local addresses (fc00::/7)
  if (normalizedIP.startsWith('fc') || normalizedIP.startsWith('fd')) {
    return false;
  }
  
  // Block localhost variations
  if (normalizedIP === '::' || normalizedIP === '0:0:0:0:0:0:0:0') {
    return false;
  }
  
  return true;
}

// Helper function to validate URL and resolve DNS to check for private IPs
async function validateUrlSecurity(url: string): Promise<{ valid: boolean; error?: string }> {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  
  // Check direct hostname blocks
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254',
    '[::1]',
    '::1',
  ];
  
  if (blockedHosts.includes(hostname)) {
    return { valid: false, error: "Access to local or internal URLs is not allowed" };
  }

  // If hostname is already an IP, validate it
  if (hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/) || hostname.includes(':')) {
    if (!isPublicIP(hostname)) {
      return { valid: false, error: "Access to private IP addresses is not allowed" };
    }
  } else {
    // Resolve DNS to check the actual IP addresses (both IPv4 and IPv6)
    try {
      // Use dns.lookup to get all addresses (IPv4 and IPv6)
      const result = await lookupAsync(hostname, { all: true }) as { address: string; family: number }[];
      const addresses = result.map(r => r.address);
      
      // Validate all resolved addresses
      for (const address of addresses) {
        if (!isPublicIP(address)) {
          return { valid: false, error: `Domain resolves to a private IP address: ${address}` };
        }
      }
    } catch (error) {
      // DNS resolution failed - could be temporary or invalid domain
      return { valid: false, error: "Failed to resolve domain name" };
    }
  }

  return { valid: true };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed portfolios endpoint
  app.post("/api/seed-portfolios", async (req, res) => {
    try {
      const portfolios = await seedPortfolios();
      res.json({ portfolios, message: "Portfolios seeded successfully" });
    } catch (error) {
      console.error("Error seeding portfolios:", error);
      res.status(500).json({ error: "Failed to seed portfolios" });
    }
  });

  // Seed sample data endpoint (development only - legacy support)
  app.post("/api/seed-sample", requireDevelopment, async (req, res) => {
    try {
      const projectId = await seedSampleData();
      res.json({ projectId, message: "Sample data seeded successfully" });
    } catch (error) {
      console.error("Error seeding sample data:", error);
      res.status(500).json({ error: "Failed to seed sample data" });
    }
  });

  // Generate all mock data endpoint
  app.post("/api/generate-mock-data", async (req, res) => {
    try {
      const result = await seedAllMockData();
      res.json(result);
    } catch (error) {
      console.error("Error generating mock data:", error);
      res.status(500).json({ error: "Failed to generate mock data" });
    }
  });

  // Wipe all data endpoint (development only - DESTRUCTIVE)
  app.post("/api/wipe-data", requireDevelopment, async (req, res) => {
    try {
      const result = await wipeAllData();
      res.json(result);
    } catch (error) {
      console.error("Error wiping data:", error);
      res.status(500).json({ error: "Failed to wipe data" });
    }
  });

  // Wipe Azure resources endpoint (development only - DESTRUCTIVE)
  app.post("/api/wipe-azure", requireDevelopment, async (req, res) => {
    try {
      const result = await wipeAzureOnly();
      res.json(result);
    } catch (error) {
      console.error("Error wiping Azure resources:", error);
      res.status(500).json({ error: "Failed to wipe Azure resources" });
    }
  });

  // Generate RFT from topic
  app.post("/api/mock-data/generate-rft", async (req, res) => {
    try {
      const { topicId } = req.body;
      if (!topicId) {
        return res.status(400).json({ error: "Topic ID is required" });
      }
      const result = await generateRft(topicId);
      res.json(result);
    } catch (error) {
      console.error("Error generating RFT:", error);
      res.status(500).json({ error: "Failed to generate RFT" });
    }
  });

  // Generate RFT Pack
  app.post("/api/mock-data/generate-pack", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateRftPack(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating RFT pack:", error);
      res.status(500).json({ error: "Failed to generate RFT pack" });
    }
  });

  // Generate Vendor Responses
  app.post("/api/mock-data/generate-responses", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateVendorResponses(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating vendor responses:", error);
      res.status(500).json({ error: "Failed to generate vendor responses" });
    }
  });

  // Generate Evaluation
  app.post("/api/mock-data/generate-evaluation", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateEvaluation(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating evaluation:", error);
      res.status(500).json({ error: "Failed to generate evaluation" });
    }
  });

  // Generate Vendor Stage Tracking Data
  app.post("/api/mock-data/generate-vendor-stages", async (req, res) => {
    try {
      const { projectId } = req.body;
      const result = await generateVendorStages(projectId);
      res.json(result);
    } catch (error) {
      console.error("Error generating vendor stages:", error);
      res.status(500).json({ error: "Failed to generate vendor stages" });
    }
  });

  // Download vendor responses as ZIP
  app.get("/api/mock-data/download-responses/:rftId", async (req, res) => {
    try {
      const { rftId } = req.params;
      
      // Get RFT and project info
      const rft = await storage.getGeneratedRft(rftId);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }
      
      const projectId = rft.projectId;

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      const zipFilename = `VendorResponses_${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Pipe archive to response
      archive.pipe(res);

      // Download only vendor responses folder
      const folder = { prefix: `project-${projectId}/RFT_Responses`, name: 'Vendor Responses' };

      try {
        const blobNames = await azureBlobStorageService.listDocuments(folder.prefix);
        
        console.log(`📦 Packaging ${blobNames.length} vendor response files into ZIP...`);
        
        for (const blobName of blobNames) {
          try {
            const buffer = await azureBlobStorageService.downloadDocument(blobName);
            
            // Extract the path relative to the folder prefix to preserve vendor folder structure
            // For example: "project-123/RFT_Responses/VendorA/file.xlsx" -> "VendorA/file.xlsx"
            const relativePath = blobName.replace(folder.prefix + '/', '');
            
            // Organize files in ZIP preserving vendor folder structure
            archive.append(buffer, { name: relativePath });
          } catch (err) {
            console.error(`Error adding file ${blobName}:`, err);
          }
        }
      } catch (err) {
        console.error(`Error listing vendor responses folder:`, err);
        throw new Error('No vendor responses found');
      }

      // Finalize archive
      await archive.finalize();
      
      console.log(`✅ Vendor responses ZIP download initiated: ${zipFilename}`);
      
    } catch (error) {
      console.error("Error downloading vendor responses:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download vendor responses" });
      }
    }
  });

  // Download all mock data files as ZIP
  app.get("/api/mock-data/download-all/:rftId", async (req, res) => {
    try {
      const { rftId } = req.params;
      
      // Get RFT and project info
      const rft = await storage.getGeneratedRft(rftId);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }
      
      // Note: Project might not exist for RFTs created through Smart RFT Builder
      // We'll use the projectId from the RFT regardless
      const projectId = rft.projectId;

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      const zipFilename = `MockData_${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Pipe archive to response
      archive.pipe(res);

      // Define folders to download
      // IMPORTANT: Use underscores to match Azure Blob Storage paths
      const folders = [
        { prefix: `project-${projectId}/RFT_Generated`, name: 'RFT Generated' },
        { prefix: `project-${projectId}/RFT_Responses`, name: 'RFT Responses' },
        { prefix: `project-${projectId}/RFT Evaluation`, name: 'RFT Evaluation' }
      ];

      // Add files from each folder
      for (const folder of folders) {
        try {
          const blobNames = await azureBlobStorageService.listDocuments(folder.prefix);
          
          for (const blobName of blobNames) {
            try {
              const buffer = await azureBlobStorageService.downloadDocument(blobName);
              
              // Extract the path relative to the folder prefix to preserve vendor folder structure
              // For example: "project-123/RFT_Responses/VendorA/file.xlsx" -> "VendorA/file.xlsx"
              const relativePath = blobName.replace(folder.prefix + '/', '');
              
              // Organize files in ZIP preserving the full folder structure
              archive.append(buffer, { name: `${folder.name}/${relativePath}` });
            } catch (err) {
              console.error(`Error adding file ${blobName}:`, err);
            }
          }
        } catch (err) {
          console.error(`Error listing folder ${folder.prefix}:`, err);
        }
      }

      // Finalize archive
      await archive.finalize();
      
    } catch (error) {
      console.error("Error downloading mock data:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download mock data" });
      }
    }
  });

  // Get all portfolios
  app.get("/api/portfolios", async (req, res) => {
    try {
      const portfolios = await storage.getAllPortfolios();
      res.json(portfolios);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  // Get portfolio by ID
  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  // Get projects by portfolio (only projects WITH vendor responses - for RFT Evaluation tab)
  app.get("/api/portfolios/:id/projects", async (req, res) => {
    try {
      const allProjects = await storage.getProjectsByPortfolio(req.params.id);
      
      // Filter to show ONLY projects that have at least one vendor proposal (for Evaluation tab)
      const projectsForEvaluationTab = [];
      
      for (const project of allProjects) {
        // Check if this project has any vendor proposals
        const proposals = await storage.getProposalsByProject(project.id);
        
        // Only show projects with vendor responses uploaded
        if (proposals.length > 0) {
          projectsForEvaluationTab.push(project);
        }
      }
      
      res.json(projectsForEvaluationTab);
    } catch (error) {
      console.error("Error fetching portfolio projects:", error);
      res.status(500).json({ error: "Failed to fetch portfolio projects" });
    }
  });

  // Get RFTs by portfolio (only published RFTs WITHOUT vendor responses - for RFT Creation tab)
  app.get("/api/portfolios/:id/rfts", async (req, res) => {
    try {
      const allRfts = await storage.getGeneratedRftsByPortfolio(req.params.id);
      
      // Filter to show ONLY published RFTs that don't have any vendor responses yet
      const rftsForCreationTab = [];
      
      for (const rft of allRfts) {
        // Only show published RFTs
        if (rft.status !== "published") {
          continue;
        }
        
        // Check if this RFT's project has any vendor proposals
        const proposals = await storage.getProposalsByProject(rft.projectId);
        
        // If no proposals exist, show in RFT Creation tab (waiting for vendor responses)
        if (proposals.length === 0) {
          rftsForCreationTab.push(rft);
        }
      }
      
      res.json(rftsForCreationTab);
    } catch (error) {
      console.error("Error fetching portfolio RFTs:", error);
      res.status(500).json({ error: "Failed to fetch portfolio RFTs" });
    }
  });

  // Get portfolio RFT statistics
  app.get("/api/portfolios/:id/rft-stats", async (req, res) => {
    try {
      const stats = await storage.getPortfolioRftStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching portfolio RFT stats:", error);
      res.status(500).json({ error: "Failed to fetch portfolio RFT stats" });
    }
  });

  // Standards routes
  app.get("/api/standards", async (req, res) => {
    try {
      const standards = await storage.getAllStandards();
      res.json(standards);
    } catch (error) {
      console.error("Error fetching standards:", error);
      res.status(500).json({ error: "Failed to fetch standards" });
    }
  });

  app.get("/api/standards/active", async (req, res) => {
    try {
      const standards = await storage.getActiveStandards();
      res.json(standards);
    } catch (error) {
      console.error("Error fetching active standards:", error);
      res.status(500).json({ error: "Failed to fetch active standards" });
    }
  });

  app.get("/api/standards/:id", async (req, res) => {
    try {
      const standard = await storage.getStandard(req.params.id);
      if (!standard) {
        return res.status(404).json({ error: "Standard not found" });
      }
      res.json(standard);
    } catch (error) {
      console.error("Error fetching standard:", error);
      res.status(500).json({ error: "Failed to fetch standard" });
    }
  });

  app.post("/api/standards", async (req, res) => {
    try {
      const { name, description, category, sections } = req.body;
      const standard = await storage.createStandard({
        name,
        description,
        category: category || "general",
        sections,
        isActive: "true",
      });
      res.json(standard);
    } catch (error) {
      console.error("Error creating standard:", error);
      res.status(500).json({ error: "Failed to create standard" });
    }
  });

  // Helper function to process a single document (file or URL)
  async function processDocument(params: {
    file?: Express.Multer.File;
    url?: string;
    name: string;
    description?: string;
    category?: string;
    tags?: any[];
  }) {
    const { file, url: docUrl, name, description, category, tags } = params;
    let fileName = file?.originalname || 'document';
    let documentBuffer: Buffer | null = null;

    try {
      let parsedDocument;

      // PHASE 1: Fetch and validate document
      if (docUrl) {
        // Validate URL to prevent SSRF attacks (includes DNS resolution)
        const validation = await validateUrlSecurity(docUrl);
        if (!validation.valid) {
          throw new Error(validation.error || "URL validation failed");
        }

        const parsedUrl = new URL(docUrl);

        // Fetch with timeout, size limit, and no redirects
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
          const response = await fetch(docUrl, {
            signal: controller.signal,
            redirect: 'manual', // Disable automatic redirects to prevent redirect-based SSRF
            headers: {
              'User-Agent': 'IntelliBid-Document-Fetcher/1.0',
            },
          });

          // Check if response is a redirect
          if (response.status >= 300 && response.status < 400) {
            throw new Error("Redirects are not allowed. Please provide a direct URL to the document.");
          }

          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || '';
          
          // Validate content type
          const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ];
          
          const isAllowedType = allowedTypes.some(type => contentType.includes(type)) || 
                                contentType.includes('text/');

          if (!isAllowedType && contentType) {
            throw new Error(`Unsupported content type: ${contentType}. Please provide a PDF, text, or document file.`);
          }

          // Limit file size to 10MB
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
            throw new Error("Document size exceeds 10MB limit");
          }

          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
            throw new Error("Document size exceeds 10MB limit");
          }

          documentBuffer = Buffer.from(arrayBuffer);
          
          // Extract filename from URL
          const urlPath = parsedUrl.pathname;
          fileName = urlPath.split('/').pop() || 'document';

          parsedDocument = await parseDocument(documentBuffer, fileName);
        } finally {
          clearTimeout(timeout);
        }
      } else if (file) {
        // Parse the uploaded file
        fileName = file.originalname;
        documentBuffer = file.buffer;
        parsedDocument = await parseDocument(file.buffer, fileName);
      } else {
        throw new Error("No file or URL provided");
      }

      // Safety check
      if (!parsedDocument) {
        throw new Error("Failed to parse document");
      }

      // PHASE 2: Extract sections using AI
      const { extractComplianceSections } = await import("./services/ai/aiAnalysis");
      const sections = await extractComplianceSections(parsedDocument.text, name);

      // Validate and narrow category type
      const validCategories = ["delivery", "product", "architecture", "engineering", "procurement", "security", "shared"] as const;
      const validCategory = validCategories.includes(category as any) ? category as typeof validCategories[number] : "shared";

      // Create the standard with extracted sections
      const standard = await storage.createStandard({
        name,
        description: description || null,
        category: validCategory,
        sections: sections,
        tags: tags && tags.length > 0 ? tags : null,
        fileName: fileName,
        documentContent: parsedDocument.text,
        isActive: "true",
      });

      // PHASE 3: Ingest document into RAG system (Azure Blob + AI Search)
      try {
        const { documentIngestionService } = await import("./services/knowledgebase/documentIngestion");
        
        if (!documentBuffer) {
          throw new Error("No document buffer available for RAG ingestion");
        }

        // Ingest into RAG system with category-based folder organization
        const ragResult = await documentIngestionService.ingestDocument({
          sourceType: "standard",
          sourceId: standard.id,
          category: (category as "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security" | "shared") || "shared",
          fileName: fileName,
          content: documentBuffer,
          textContent: parsedDocument.text,
          metadata: {
            tags: tags || [],
            sectionTitle: name,
          },
        });

        // Update standard with RAG document ID
        if (ragResult.status === "success") {
          await storage.updateStandard(standard.id, {
            ragDocumentId: ragResult.documentId,
          });
          console.log(`[RAG] Standard "${name}" linked to RAG document: ${ragResult.documentId}`);
        } else {
          console.warn(`[RAG] Failed to ingest standard "${name}" into RAG system:`, ragResult.error);
        }
      } catch (ragError) {
        // Log RAG ingestion failure but don't fail the standard creation
        console.error(`[RAG] RAG ingestion failed for standard "${name}":`, ragError);
      }

      // Return the final standard
      const updatedStandard = await storage.getStandard(standard.id);
      return {
        fileName,
        status: "success" as const,
        standard: updatedStandard || standard,
        error: null,
      };
    } catch (error) {
      console.error(`Error processing document "${fileName}":`, error);
      return {
        fileName,
        status: "error" as const,
        standard: null,
        error: error instanceof Error ? error.message : "Failed to process document",
      };
    }
  }

  app.post("/api/standards/upload", upload.array("files", 10), async (req, res) => {
    try {
      const { name, description, category, tags, url } = req.body;
      const files = req.files as Express.Multer.File[];
      
      // Check if either files or URL is provided
      if ((!files || files.length === 0) && !url) {
        return res.status(400).json({ error: "Either file upload or URL is required" });
      }

      // Parse tags from JSON string once
      const parsedTags = tags ? JSON.parse(tags) : [];

      // Build list of documents to process
      const documentsToProcess: Array<{
        file?: Express.Multer.File;
        url?: string;
        name: string;
        description?: string;
        category?: string;
        tags?: any[];
      }> = [];

      if (url) {
        // Single URL upload
        documentsToProcess.push({
          url,
          name: name || 'Imported Document',
          description,
          category,
          tags: parsedTags,
        });
      } else if (files && files.length > 0) {
        // Multiple file uploads
        files.forEach((file, index) => {
          // Generate unique name for each file
          const fileBaseName = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
          const documentName = files.length === 1 
            ? (name || fileBaseName) 
            : (name ? `${name} - ${fileBaseName}` : fileBaseName);

          documentsToProcess.push({
            file,
            name: documentName,
            description,
            category,
            tags: parsedTags,
          });
        });
      }

      // Process all documents in parallel using Promise.allSettled
      console.log(`Processing ${documentsToProcess.length} document(s) in parallel...`);
      const results = await Promise.allSettled(
        documentsToProcess.map(doc => processDocument(doc))
      );

      // Transform results into response format
      const processedResults = results.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          // Handle rejected promises
          return {
            fileName: 'unknown',
            status: 'error' as const,
            standard: null,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          };
        }
      });

      // Calculate statistics
      const successCount = processedResults.filter(r => r.status === 'success').length;
      const errorCount = processedResults.filter(r => r.status === 'error').length;

      // Return batch response
      res.json({
        results: processedResults,
        totalFiles: documentsToProcess.length,
        successCount,
        errorCount,
      });
    } catch (error) {
      console.error("Error in batch standard upload:", error);
      res.status(500).json({ error: "Failed to process batch upload" });
    }
  });

  app.patch("/api/standards/:id", async (req, res) => {
    try {
      const { name, description, category, sections } = req.body;
      await storage.updateStandard(req.params.id, {
        name,
        description,
        category,
        sections,
      });
      const updated = await storage.getStandard(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating standard:", error);
      res.status(500).json({ error: "Failed to update standard" });
    }
  });

  app.delete("/api/standards/:id", async (req, res) => {
    try {
      await storage.deactivateStandard(req.params.id);
      res.json({ message: "Standard deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating standard:", error);
      res.status(500).json({ error: "Failed to deactivate standard" });
    }
  });

  // MCP Connectors
  app.get("/api/mcp-connectors", async (req, res) => {
    try {
      const connectors = await storage.getAllMcpConnectors();
      // Redact API keys for security
      const redactedConnectors = connectors.map(c => ({
        ...c,
        apiKey: c.apiKey ? "••••••••" : null,
      }));
      res.json(redactedConnectors);
    } catch (error) {
      console.error("Error fetching MCP connectors:", error);
      res.status(500).json({ error: "Failed to fetch MCP connectors" });
    }
  });

  app.get("/api/mcp-connectors/active", async (req, res) => {
    try {
      const connectors = await storage.getActiveMcpConnectors();
      // Redact API keys for security
      const redactedConnectors = connectors.map(c => ({
        ...c,
        apiKey: c.apiKey ? "••••••••" : null,
      }));
      res.json(redactedConnectors);
    } catch (error) {
      console.error("Error fetching active MCP connectors:", error);
      res.status(500).json({ error: "Failed to fetch active MCP connectors" });
    }
  });

  app.get("/api/mcp-connectors/:id", async (req, res) => {
    try {
      const connector = await storage.getMcpConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "MCP connector not found" });
      }
      // Redact API key for security
      res.json({
        ...connector,
        apiKey: connector.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error fetching MCP connector:", error);
      res.status(500).json({ error: "Failed to fetch MCP connector" });
    }
  });

  app.post("/api/mcp-connectors", async (req, res) => {
    try {
      const { name, description, serverUrl, apiKey, connectorType, authType, roleMapping, config } = req.body;
      const connector = await storage.createMcpConnector({
        name,
        description,
        serverUrl,
        apiKey,
        connectorType,
        authType,
        roleMapping,
        config,
        isActive: "true",
      });
      // Redact API key in response for security
      res.json({
        ...connector,
        apiKey: connector.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error creating MCP connector:", error);
      res.status(500).json({ error: "Failed to create MCP connector" });
    }
  });

  app.patch("/api/mcp-connectors/:id", async (req, res) => {
    try {
      const { name, description, serverUrl, apiKey, connectorType, authType, roleMapping, config, isActive } = req.body;
      await storage.updateMcpConnector(req.params.id, {
        name,
        description,
        serverUrl,
        apiKey,
        connectorType,
        authType,
        roleMapping,
        config,
        isActive,
      });
      const updated = await storage.getMcpConnector(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "MCP connector not found" });
      }
      // Redact API key in response for security
      res.json({
        ...updated,
        apiKey: updated.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error updating MCP connector:", error);
      res.status(500).json({ error: "Failed to update MCP connector" });
    }
  });

  app.delete("/api/mcp-connectors/:id", async (req, res) => {
    try {
      await storage.deleteMcpConnector(req.params.id);
      res.json({ message: "MCP connector deleted successfully" });
    } catch (error) {
      console.error("Error deleting MCP connector:", error);
      res.status(500).json({ error: "Failed to delete MCP connector" });
    }
  });

  // Test MCP connector
  app.post("/api/mcp-connectors/:id/test", async (req, res) => {
    try {
      const { mcpConnectorService } = await import("./services/knowledgebase/mcpConnectorService");
      const { query } = req.body;
      
      console.log(`🧪 [MCP TEST] Testing connector ${req.params.id} with query: "${query}"`);
      
      // Bypass cache for test calls to always get fresh data
      const payload = await mcpConnectorService.fetchConnectorData(
        req.params.id, 
        {
          projectName: "Test Query",
          proposalSummary: query || "test",
        },
        { bypassCache: true }
      );
      
      if (!payload) {
        return res.json({
          success: false,
          message: "No data returned from connector",
          rawData: null,
        });
      }
      
      res.json({
        success: true,
        message: "Connector test successful",
        rawData: payload.rawData,
        roleContext: payload.roleContext,
        metadata: payload.metadata,
      });
    } catch (error: any) {
      console.error("Error testing MCP connector:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to test MCP connector",
        details: error.message || String(error),
      });
    }
  });

  // System Configuration endpoints
  app.get("/api/system-config", async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      // Redact encrypted values
      const sanitized = configs.map(c => ({
        ...c,
        value: c.isEncrypted === "true" ? "••••••••" : c.value,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.get("/api/system-config/category/:category", async (req, res) => {
    try {
      const configs = await storage.getSystemConfigByCategory(req.params.category);
      const sanitized = configs.map(c => ({
        ...c,
        value: c.isEncrypted === "true" ? "••••••••" : c.value,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching system config by category:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.post("/api/system-config", async (req, res) => {
    try {
      const { category, key, value, isEncrypted, description } = req.body;
      const config = await storage.upsertSystemConfig({
        category,
        key,
        value,
        isEncrypted: isEncrypted || "false",
        description,
      });
      // Redact encrypted values in response
      res.json({
        ...config,
        value: config.isEncrypted === "true" ? "••••••••" : config.value,
      });
    } catch (error) {
      console.error("Error upserting system config:", error);
      res.status(500).json({ error: "Failed to save system configuration" });
    }
  });

  app.delete("/api/system-config/:key", async (req, res) => {
    try {
      await storage.deleteSystemConfig(req.params.key);
      res.json({ message: "Configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting system config:", error);
      res.status(500).json({ error: "Failed to delete configuration" });
    }
  });

  // Test Azure connectivity
  app.post("/api/test-azure-connectivity", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      azureOpenAI: { configured: false, working: false, error: null, details: null },
      azureSearch: { configured: false, working: false, error: null, details: null },
      azureStorage: { configured: false, working: false, error: null, details: null },
    };

    // Test Azure OpenAI Embeddings (optional - gracefully handle missing credentials)
    try {
      // Check if required credentials are present before testing
      const hasAzureOpenAI = process.env.AZURE_OPENAI_ENDPOINT && 
                             process.env.AZURE_OPENAI_KEY && 
                             process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
      
      if (!hasAzureOpenAI) {
        console.log("[Test] Azure OpenAI not configured (optional) - skipping test");
        results.azureOpenAI.error = "Azure OpenAI credentials not configured (optional for embeddings)";
      } else {
        console.log("[Test] Initializing Azure OpenAI embedding service...");
        await azureEmbeddingService.initialize();
        results.azureOpenAI.configured = true;

        console.log("[Test] Testing embedding generation...");
        const testResult = await azureEmbeddingService.generateEmbedding("test");
        
        results.azureOpenAI.working = true;
        results.azureOpenAI.details = {
          embeddingDimensions: testResult.embedding.length,
          tokenCount: testResult.tokenCount,
          testText: "test",
        };
        console.log("[Test] Azure OpenAI test successful!");
      }
    } catch (error: any) {
      console.error("[Test] Azure OpenAI test failed unexpectedly:", error);
      results.azureOpenAI.error = error.message || String(error);
    }

    // Test Azure AI Search
    try {
      console.log("[Test] Initializing Azure AI Search service...");
      await azureAISearchService.initialize();
      results.azureSearch.configured = true;

      console.log("[Test] Getting index statistics...");
      const stats = await azureAISearchService.getIndexStats();
      
      results.azureSearch.working = true;
      results.azureSearch.details = {
        indexName: "intellibid-rag",
        documentCount: stats.documentCount,
        storageSize: stats.storageSize,
      };
      console.log("[Test] Azure AI Search test successful!");
    } catch (error: any) {
      console.error("[Test] Azure AI Search test failed:", error);
      results.azureSearch.error = error.message || String(error);
    }

    // Test Azure Blob Storage
    try {
      console.log("[Test] Initializing Azure Blob Storage service...");
      await azureBlobStorageService.initialize();
      results.azureStorage.configured = true;

      console.log("[Test] Listing documents in storage...");
      const documents = await azureBlobStorageService.listDocuments();
      
      results.azureStorage.working = true;
      results.azureStorage.details = {
        containerName: "intellibid-documents",
        documentCount: documents.length,
        sampleDocuments: documents.slice(0, 3),
      };
      console.log("[Test] Azure Blob Storage test successful!");
    } catch (error: any) {
      console.error("[Test] Azure Blob Storage test failed:", error);
      results.azureStorage.error = error.message || String(error);
    }

    // Determine overall status
    const allWorking = results.azureOpenAI.working && results.azureSearch.working && results.azureStorage.working;
    const someWorking = results.azureOpenAI.working || results.azureSearch.working || results.azureStorage.working;

    res.json({
      success: allWorking,
      partialSuccess: someWorking && !allWorking,
      results,
      message: allWorking 
        ? "All Azure services are configured and working correctly!" 
        : someWorking 
          ? "Some Azure services are working, but not all. Check the details below."
          : "Azure services are not configured or not working. Please check your configuration.",
    });
  });

  // Azure AI Search Skillset and Indexer routes
  // Initialize skillset and indexer with OCR capabilities
  app.post("/api/skillset/initialize", async (req, res) => {
    try {
      console.log("[Skillset API] Initializing skillset and indexer...");
      
      // Check if OCR is enabled before attempting initialization
      const ocrConfig = await storage.getSystemConfigByKey("ocr_enabled");
      const ocrEnabled = ocrConfig?.value === "true";
      
      if (!ocrEnabled) {
        return res.json({
          success: true,
          ocrDisabled: true,
          message: "OCR is currently disabled. Knowledge base is using direct text embedding mode without OCR skillset. Enable OCR in the toggle above to initialize skillset.",
        });
      }
      
      await azureSearchSkillsetService.initialize();
      res.json({ 
        success: true, 
        message: "Skillset and indexer initialized successfully with OCR capabilities",
        details: {
          index: "intellibid-blob-ocr",
          dataSource: "intellibid-blob-datasource",
          skillset: "intellibid-ocr-skillset",
          indexer: "intellibid-ocr-indexer"
        }
      });
    } catch (error: any) {
      console.error("[Skillset API] Failed to initialize skillset:", error);
      
      // Determine appropriate HTTP status code
      let statusCode = 500;
      if (error.statusCode) {
        statusCode = error.statusCode;
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        statusCode = 504; // Gateway Timeout for network issues
      } else if (error.message?.includes('missing') || error.message?.includes('not configured')) {
        statusCode = 400; // Bad Request for configuration errors
      }

      // Build detailed error response
      const errorResponse: any = {
        success: false,
        message: error.message || "Failed to initialize skillset",
        errorType: error.name || "Unknown",
      };

      // Add Azure-specific error details
      if (error.code) {
        errorResponse.errorCode = error.code;
      }

      if (error.statusCode) {
        errorResponse.httpStatus = error.statusCode;
      }

      // Add helpful troubleshooting hints based on error type
      if (error.statusCode === 401) {
        errorResponse.hint = "Authentication failed. Check your AZURE_SEARCH_KEY environment variable.";
      } else if (error.statusCode === 403) {
        errorResponse.hint = "Permission denied. Ensure you're using an Admin key (not query key) for Azure AI Search.";
      } else if (error.statusCode === 404) {
        errorResponse.hint = "Resource not found. Verify your AZURE_SEARCH_ENDPOINT is correct.";
      } else if (error.statusCode === 504 || statusCode === 504) {
        errorResponse.hint = "Network timeout. Check if Azure AI Search has firewall restrictions or requires VNet integration.";
        errorResponse.troubleshooting = [
          "Enable VNet Integration on your App Service",
          "Add App Service IPs to AI Search firewall allowlist",
          "Change AI Search networking to 'All networks' for testing"
        ];
      } else if (error.message?.includes('missing') || error.message?.includes('not configured')) {
        errorResponse.hint = "Configuration error. Check your Azure environment variables.";
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        errorResponse.hint = "Cannot reach Azure AI Search service. Check network connectivity.";
      }

      res.status(statusCode).json(errorResponse);
    }
  });

  // Run indexer manually to process documents
  app.post("/api/skillset/run", async (req, res) => {
    try {
      console.log("[Skillset API] Running indexer...");
      await azureSearchSkillsetService.runIndexer();
      res.json({ 
        success: true, 
        message: "Indexer started successfully. OCR processing initiated for documents with images." 
      });
    } catch (error: any) {
      console.error("[Skillset API] Failed to run indexer:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to run indexer"
      });
    }
  });

  // Get indexer status
  app.get("/api/skillset/status", async (req, res) => {
    try {
      console.log("[Skillset API] Getting indexer status...");
      const status = await azureSearchSkillsetService.getIndexerStatus();
      res.json({ 
        success: true, 
        status 
      });
    } catch (error: any) {
      console.error("[Skillset API] Failed to get indexer status:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to get indexer status"
      });
    }
  });

  // Reset indexer (reprocess all documents)
  app.post("/api/skillset/reset", async (req, res) => {
    try {
      console.log("[Skillset API] Resetting indexer...");
      await azureSearchSkillsetService.resetIndexer();
      res.json({ 
        success: true, 
        message: "Indexer reset successfully. All documents will be reprocessed on next run." 
      });
    } catch (error: any) {
      console.error("[Skillset API] Failed to reset indexer:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to reset indexer"
      });
    }
  });

  // Configuration routes - OCR Settings
  // Get OCR enabled/disabled state
  app.get("/api/config/ocr-enabled", async (req, res) => {
    try {
      const config = await storage.getSystemConfigByKey("ocr_enabled");
      const enabled = config?.value === "true";
      res.json({ 
        success: true, 
        enabled 
      });
    } catch (error: any) {
      console.error("[Config API] Failed to get OCR setting:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to get OCR setting"
      });
    }
  });

  // Update OCR enabled/disabled state
  app.post("/api/config/ocr-enabled", async (req, res) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Invalid request: 'enabled' must be a boolean"
        });
      }

      await storage.upsertSystemConfig({
        category: "rag_settings",
        key: "ocr_enabled",
        value: enabled ? "true" : "false",
        isEncrypted: "false",
        description: "Enable or disable OCR skillset for knowledge base document processing",
      });

      console.log(`[Config API] OCR ${enabled ? 'enabled' : 'disabled'} successfully`);
      res.json({ 
        success: true, 
        enabled,
        message: `OCR ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error: any) {
      console.error("[Config API] Failed to update OCR setting:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to update OCR setting"
      });
    }
  });

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const { portfolioId, name, initiativeName, vendorList, status, businessCaseId } = req.body;
      const project = await storage.createProject({
        portfolioId,
        name,
        initiativeName: initiativeName || null,
        vendorList: vendorList || null,
        status: status || "analyzing",
        businessCaseId: businessCaseId || null,
      });
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get project by ID
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Upload and analyze requirements
  app.post("/api/projects/:id/requirements", upload.array("files"), async (req, res) => {
    try {
      const projectId = req.params.id;
      const files = req.files as Express.Multer.File[];
      const documentType = req.body.documentType || "RFT";
      const standardId = req.body.standardId;
      const taggedSections = req.body.taggedSections ? JSON.parse(req.body.taggedSections) : null;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const requirements = [];
      for (const file of files) {
        const parsed = await parseDocument(file.buffer, file.originalname);
        const analysis = await analyzeRequirements(parsed.text);

        const requirement = await storage.createRequirement({
          projectId,
          documentType,
          fileName: file.originalname,
          extractedData: parsed,
          evaluationCriteria: analysis.evaluationCriteria,
          standardId,
          taggedSections,
        });

        requirements.push({ ...requirement, analysis });
      }

      res.json(requirements);
    } catch (error) {
      console.error("Error processing requirements:", error);
      res.status(500).json({ error: "Failed to process requirements" });
    }
  });

  // Upload and analyze proposals
  app.post("/api/projects/:id/proposals", upload.array("files"), async (req, res) => {
    try {
      const projectId = req.params.id;
      const files = req.files as Express.Multer.File[];
      const vendorName = req.body.vendorName;
      const documentType = req.body.documentType || "SOW";
      const standardId = req.body.standardId;
      const taggedSections = req.body.taggedSections ? JSON.parse(req.body.taggedSections) : null;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      if (!vendorName) {
        return res.status(400).json({ error: "Vendor name is required" });
      }

      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      
      const proposals = [];
      for (const file of files) {
        const parsed = await parseDocument(file.buffer, file.originalname);
        const analysis = await analyzeProposal(parsed.text, file.originalname);

        // Upload file to Azure Blob Storage
        let blobUrl: string | undefined;
        try {
          const uploadResult = await azureBlobStorageService.uploadDocument(
            file.originalname,
            file.buffer,
            { documentType, vendorName }
          );
          blobUrl = uploadResult.blobUrl;
        } catch (error) {
          console.error("Failed to upload to Azure Blob Storage:", error);
          // Continue without blob URL if upload fails
        }

        const proposal = await storage.createProposal({
          projectId,
          vendorName,
          documentType,
          fileName: file.originalname,
          blobUrl,
          extractedData: { ...parsed, aiAnalysis: analysis },
          standardId,
          taggedSections,
        });

        proposals.push({ ...proposal, analysis });
      }

      res.json(proposals);
    } catch (error) {
      console.error("Error processing proposals:", error);
      res.status(500).json({ error: "Failed to process proposals" });
    }
  });

  // Analyze project and generate evaluations
  app.post("/api/projects/:id/analyze", async (req, res) => {
    try {
      const projectId = req.params.id;

      // Get requirements and proposals
      const requirements = await storage.getRequirementsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      if (proposals.length === 0) {
        return res.status(400).json({ error: "No proposals found for project" });
      }

      // Use first requirement for evaluation criteria
      const requirementAnalysis = requirements[0].extractedData as any;

      // Check if there's a standard associated with requirements
      let requirementStandardData = null;
      const requirement = requirements[0];
      if (requirement.standardId) {
        const standard = await storage.getStandard(requirement.standardId);
        if (standard && standard.isActive === "true") {
          requirementStandardData = {
            id: standard.id,
            name: standard.name,
            sections: (standard.sections || []) as any,
            taggedSectionIds: (requirement.taggedSections || []) as any,
          };
        }
      }

      // Evaluate each proposal
      const evaluations = [];
      for (const proposal of proposals) {
        // Check if evaluation already exists for this proposal to prevent duplicates
        const existingEvaluation = await storage.getEvaluationByProposal(proposal.id);
        if (existingEvaluation) {
          console.log(`   ⚠️  Evaluation already exists for vendor ${proposal.vendorName}, skipping duplicate creation`);
          evaluations.push({
            ...existingEvaluation,
            vendorName: proposal.vendorName,
          });
          continue;
        }
        
        const proposalAnalysis = proposal.extractedData as any;
        
        // Determine which standard to use for this proposal
        let proposalStandardData = null;
        
        if (proposal.standardId) {
          // Proposal has its own standard reference
          if (requirementStandardData && proposal.standardId === requirementStandardData.id) {
            // Use requirement standard with proposal's tagged sections
            proposalStandardData = {
              ...requirementStandardData,
              taggedSectionIds: proposal.taggedSections || requirementStandardData.taggedSectionIds,
            };
          } else {
            // Fetch proposal's standard independently
            const proposalStandard = await storage.getStandard(proposal.standardId);
            if (proposalStandard && proposalStandard.isActive === "true") {
              proposalStandardData = {
                id: proposalStandard.id,
                name: proposalStandard.name,
                sections: (proposalStandard.sections || []) as any,
                taggedSectionIds: (proposal.taggedSections || []) as any,
              };
            }
          }
        } else if (requirementStandardData) {
          // Fall back to requirement standard
          proposalStandardData = requirementStandardData;
        }
        
        const { evaluation, diagnostics } = await evaluateProposal(
          requirementAnalysis, 
          proposalAnalysis,
          proposalStandardData || undefined
        );

        const { evaluation: savedEvaluation } = await storage.createEvaluation({
          projectId,
          proposalId: proposal.id,
          overallScore: evaluation.overallScore,
          functionalFit: evaluation.functionalFit,
          technicalFit: evaluation.technicalFit,
          deliveryRisk: evaluation.deliveryRisk,
          cost: evaluation.cost,
          compliance: evaluation.compliance,
          status: evaluation.status,
          aiRationale: evaluation.rationale,
          roleInsights: evaluation.roleInsights,
          detailedScores: evaluation.detailedScores,
          sectionCompliance: evaluation.sectionCompliance || null,
          agentDiagnostics: diagnostics || null,
        });

        evaluations.push({
          ...savedEvaluation,
          vendorName: proposal.vendorName,
        });
      }

      // Update project status
      await storage.updateProjectStatus(projectId, "completed");

      res.json(evaluations);
    } catch (error) {
      console.error("Error analyzing project:", error);
      res.status(500).json({ error: "Failed to analyze project" });
    }
  });

  // Generate PDF evaluation report for a project
  app.get("/api/projects/:id/evaluation-report.pdf", async (req, res) => {
    try {
      const projectId = req.params.id;
      const { generateEvaluationReportPdf } = await import("./services/features/evaluationReportPdf");
      
      const pdfBuffer = await generateEvaluationReportPdf(projectId, storage);
      
      const project = await storage.getProject(projectId);
      const filename = `${project?.name.replace(/[^a-zA-Z0-9]/g, '_')}_Evaluation_Report.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating evaluation report PDF:", error);
      res.status(500).json({ error: "Failed to generate evaluation report" });
    }
  });

  // Get evaluations for a project
  app.get("/api/projects/:id/evaluations", async (req, res) => {
    try {
      const projectId = req.params.id;
      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      // Get unique vendor names from proposals
      const vendorNames = Array.from(new Set(proposals.map(p => p.vendorName)));
      
      // Import score calculator
      const { calculateExcelScoresForVendor, calculateHybridScore, mapExcelScoresToEvaluation } = 
        await import("./services/rft/excelScoreCalculator");
      
      // Create enriched results for all vendors (with or without evaluations)
      const enrichedEvaluations = await Promise.all(vendorNames.map(async (vendorName) => {
        // Find evaluation for this vendor (may not exist)
        const evaluation = evaluations.find((e) => {
          const proposal = proposals.find((p) => p.id === e.proposalId);
          return proposal?.vendorName === vendorName;
        });
        
        // Get all documents for this vendor IN THIS PROJECT ONLY
        const vendorDocuments = proposals
          .filter((p) => p.vendorName === vendorName && p.projectId === projectId)
          .map((p) => {
            // Extract blob name from URL (everything after container name)
            let blobName = p.fileName;
            if (p.blobUrl) {
              try {
                const url = new URL(p.blobUrl);
                const pathParts = url.pathname.split('/').filter(part => part.length > 0);
                // Skip container name (first part) and join the rest
                blobName = pathParts.slice(1).join('/');
              } catch (error) {
                console.error(`Failed to parse blobUrl for ${p.fileName}:`, error);
              }
            }
            
            return {
              id: p.id,
              documentType: p.documentType,
              fileName: p.fileName,
              blobUrl: p.blobUrl || "",
              blobName,
              createdAt: p.createdAt,
            };
          });

        // Calculate Excel-based scores
        let excelScores = null;
        let hybridScores = null;
        try {
          excelScores = await calculateExcelScoresForVendor(vendorDocuments);
          
          // Calculate hybrid scores if evaluation exists
          if (evaluation) {
            const excelEvaluationScores = mapExcelScoresToEvaluation(excelScores);
            
            const detailedScores = evaluation.detailedScores as Record<string, number> | null | undefined;
            hybridScores = {
              overallScore: calculateHybridScore(evaluation.overallScore, excelScores.averageScore),
              technicalFit: calculateHybridScore(evaluation.technicalFit, excelEvaluationScores.technicalFit),
              deliveryRisk: calculateHybridScore(evaluation.deliveryRisk, excelEvaluationScores.deliveryRisk),
              compliance: calculateHybridScore(evaluation.compliance, excelEvaluationScores.compliance),
              integration: calculateHybridScore(
                detailedScores?.integration || 0, 
                excelEvaluationScores.integration
              ),
            };
          }
        } catch (error) {
          console.error(`Failed to calculate Excel scores for ${vendorName}:`, error);
        }

        // If evaluation exists, return it enriched with documents and scores
        if (evaluation) {
          return {
            ...evaluation,
            vendorName,
            documents: vendorDocuments,
            excelScores,
            hybridScores,
          };
        }
        
        // Otherwise, create a placeholder evaluation for vendors with proposals but no evaluation yet
        return {
          id: `placeholder-${vendorName}`,
          proposalId: vendorDocuments[0]?.id || `placeholder-proposal-${vendorName}`,
          vendorName,
          overallScore: 0,
          technicalFit: 0,
          deliveryRisk: 0,
          cost: "Not evaluated",
          compliance: 0,
          status: "under-review" as const,
          aiRationale: "Evaluation pending",
          roleInsights: {},
          detailedScores: {},
          documents: vendorDocuments,
          excelScores,
          hybridScores: null,
        };
      }));

      res.json(enrichedEvaluations);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      res.status(500).json({ error: "Failed to fetch evaluations" });
    }
  });

  // Get evaluation criteria for an evaluation
  app.get("/api/evaluations/:id/criteria", async (req, res) => {
    try {
      const evaluationId = req.params.id;
      const role = req.query.role as string | undefined;
      const criteria = await storage.getEvaluationCriteriaByEvaluation(evaluationId, role);
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching evaluation criteria:", error);
      res.status(500).json({ error: "Failed to fetch evaluation criteria" });
    }
  });

  // Update evaluation criteria score
  app.patch("/api/evaluation-criteria/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const { score, scoreLabel } = req.body;
      
      // Update the criterion
      await storage.updateEvaluationCriteria(id, { score, scoreLabel });
      
      // Get the updated criterion to find its evaluation
      const updatedCriterion = await storage.getEvaluationCriterion(id);
      
      if (updatedCriterion) {
        // Get all criteria for this evaluation to recalculate scores
        const evaluationCriteria = await storage.getEvaluationCriteriaByEvaluation(updatedCriterion.evaluationId);
        
        // Guard against empty criteria (unlikely but possible)
        if (evaluationCriteria.length === 0) {
          console.warn(`[Evaluation Recalculation] No criteria found for evaluation ${updatedCriterion.evaluationId}`);
          res.json({ success: true });
          return;
        }
        
        // Calculate average score from all criteria
        const totalScore = evaluationCriteria.reduce((sum, c) => sum + c.score, 0);
        const avgScore = Math.round(totalScore / evaluationCriteria.length);
        
        // Group by role to calculate dimension scores
        const roleGroups = evaluationCriteria.reduce((groups, c) => {
          if (!groups[c.role]) groups[c.role] = [];
          groups[c.role].push(c);
          return groups;
        }, {} as Record<string, typeof evaluationCriteria>);
        
        // Calculate dimension scores (simplified - using role averages)
        const roles = Object.keys(roleGroups);
        const technicalFit = roles.length > 0 ? Math.round(
          Object.values(roleGroups).reduce((sum, group) => 
            sum + group.reduce((s, c) => s + c.score, 0) / group.length, 0
          ) / roles.length
        ) : avgScore;
        
        // For simplicity, use overall score for other dimensions
        // In a real system, you'd have specific criteria mapped to each dimension
        const deliveryRisk = avgScore;
        const compliance = avgScore;
        
        // Determine status based on overall score
        let status: "recommended" | "under-review" | "risk-flagged";
        if (avgScore >= 70) {
          status = "recommended";
        } else if (avgScore >= 50) {
          status = "under-review";
        } else {
          status = "risk-flagged";
        }
        
        // Update the evaluation with recalculated values
        await storage.updateEvaluation(updatedCriterion.evaluationId, {
          overallScore: avgScore,
          technicalFit,
          deliveryRisk,
          compliance,
          status,
        });
        
        console.log(`[Evaluation Recalculated] ID: ${updatedCriterion.evaluationId}, Score: ${avgScore}, Status: ${status}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating evaluation criteria:", error);
      res.status(500).json({ error: "Failed to update evaluation criteria" });
    }
  });

  // Excel questionnaire parsing and saving endpoints
  app.get("/api/proposals/:proposalId/parse-excel", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.getProposal(proposalId);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Check if this is an Excel file
      if (!proposal.fileName.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ error: "File is not an Excel file" });
      }

      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      const { parseExcelQuestionnaire } = await import("./services/rft/excelQuestionnaireHandler");

      // Download Excel file from Azure
      if (!proposal.blobUrl) {
        return res.status(400).json({ error: "No blob URL available" });
      }
      
      // Extract blob name from full URL, stripping SAS token query parameters and URL decoding
      // URL format: https://intellibidstorage.blob.core.windows.net/intellibid-documents/project-xxx/RFT_Responses/rftId/Vendor%20Name/Product_Response.xlsx?sv=...&se=...
      // We need (decoded): project-xxx/RFT_Responses/rftId/Vendor Name/Product_Response.xlsx
      const url = new URL(proposal.blobUrl);
      const pathname = decodeURIComponent(url.pathname); // Decode %20 → space, etc.
      const containerPath = '/intellibid-documents/';
      const containerIndex = pathname.toLowerCase().indexOf(containerPath.toLowerCase());
      if (containerIndex === -1) {
        throw new Error('Invalid blob URL format - missing container path');
      }
      const blobName = pathname.substring(containerIndex + containerPath.length);
      
      const excelBuffer = await azureBlobStorageService.downloadDocument(blobName);
      
      // Parse Excel to JSON
      const questions = await parseExcelQuestionnaire(excelBuffer);

      res.json({
        fileName: proposal.fileName,
        documentType: proposal.documentType,
        questions,
      });
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      res.status(500).json({ error: "Failed to parse Excel file" });
    }
  });

  app.post("/api/proposals/:proposalId/save-excel", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const { questions } = req.body;

      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "Invalid questions data" });
      }

      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      const { createExcelQuestionnaire } = await import("./services/rft/excelQuestionnaireHandler");

      // Create updated Excel file
      const updatedExcelBuffer = await createExcelQuestionnaire(
        proposal.fileName.replace('.xlsx', ''),
        questions
      );

      // Upload updated file to Azure (replace existing file by name)
      if (!proposal.blobUrl) {
        return res.status(400).json({ error: "No blob URL available" });
      }
      
      // Extract blob name from URL, stripping SAS token query parameters and URL decoding
      const url = new URL(proposal.blobUrl);
      const pathname = decodeURIComponent(url.pathname); // Decode %20 → space, etc.
      const containerPath = '/intellibid-documents/';
      const containerIndex = pathname.toLowerCase().indexOf(containerPath.toLowerCase());
      if (containerIndex === -1) {
        throw new Error('Invalid blob URL format - missing container path');
      }
      const blobName = pathname.substring(containerIndex + containerPath.length);
      
      // Delete the old file and upload the updated one
      await azureBlobStorageService.deleteDocument(blobName);
      const uploadResult = await azureBlobStorageService.uploadDocument(
        blobName, // Use same path to replace the file
        updatedExcelBuffer,
        { proposalId, documentType: proposal.documentType }
      );

      // Update proposal blob URL (note: we use a simpler storage interface)
      // Since we don't have updateProposal, we'll just confirm success
      console.log(`[Excel Update] Proposal ${proposalId} updated successfully`);

      res.json({ 
        success: true,
        message: "Questionnaire updated successfully",
        blobUrl: uploadResult.blobUrl,
      });
    } catch (error) {
      console.error("Error saving Excel file:", error);
      res.status(500).json({ error: "Failed to save Excel file" });
    }
  });

  // RAG Document Management
  // Note: These endpoints are for future use when RAG system is fully integrated
  app.get("/api/rag/documents", async (req, res) => {
    try {
      const documents = await storage.getAllRagDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching RAG documents:", error);
      res.status(500).json({ error: "Failed to fetch RAG documents" });
    }
  });

  app.get("/api/rag/documents/:id", async (req, res) => {
    try {
      const document = await storage.getRagDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching RAG document:", error);
      res.status(500).json({ error: "Failed to fetch RAG document" });
    }
  });

  app.delete("/api/rag/documents/:id", async (req, res) => {
    try {
      // Import at runtime to avoid circular dependencies
      const { documentIngestionService } = await import("./services/knowledgebase/documentIngestion");
      await documentIngestionService.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RAG document:", error);
      res.status(500).json({ error: "Failed to delete RAG document" });
    }
  });

  app.post("/api/rag/documents/:id/reindex", async (req, res) => {
    try {
      const ragDoc = await storage.getRagDocument(req.params.id);
      if (!ragDoc) {
        return res.status(404).json({ error: "RAG document not found" });
      }

      // Import at runtime to avoid circular dependencies
      const { documentIngestionService } = await import("./services/knowledgebase/documentIngestion");
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      
      // Download the document from blob storage
      if (!ragDoc.blobName) {
        return res.status(400).json({ error: "Document has no blob reference" });
      }

      const buffer = await azureBlobStorageService.downloadDocument(ragDoc.blobName);
      const textContent = buffer.toString('utf-8');
      
      // Clear existing chunks and search index entries (preserve parent document)
      await documentIngestionService.clearDocumentChunksAndIndex(req.params.id);
      
      // Re-ingest the document using the same ID
      await documentIngestionService.ingestDocument({
        sourceType: ragDoc.sourceType as any,
        sourceId: ragDoc.sourceId || undefined,
        fileName: ragDoc.fileName,
        content: buffer,
        textContent,
        metadata: ragDoc.metadata as any,
        documentId: req.params.id, // Reuse the same document ID
      });

      // Get updated document
      const updatedDoc = await storage.getRagDocument(req.params.id);
      res.json(updatedDoc);
    } catch (error) {
      console.error("Error re-indexing RAG document:", error);
      res.status(500).json({ error: "Failed to re-index RAG document" });
    }
  });

  // ==================================================================
  // AI FEATURES ROUTES
  // ==================================================================

  // Compliance Gap Analysis
  app.post("/api/projects/:projectId/proposals/:proposalId/analyze-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/features/complianceGapService");
      const { projectId, proposalId } = req.params;

      // Get proposal and requirements
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Analyze compliance gaps
      const gaps = await complianceGapService.analyzeComplianceGaps({
        projectId,
        proposalId,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposal: JSON.stringify(proposal.extractedData),
        vendorName: proposal.vendorName
      });

      res.json({ gaps, summary: await complianceGapService.getGapSummary(projectId) });
    } catch (error) {
      console.error("Error analyzing compliance gaps:", error);
      res.status(500).json({ error: "Failed to analyze compliance gaps" });
    }
  });

  app.get("/api/projects/:projectId/compliance-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/features/complianceGapService");
      const gaps = await complianceGapService.getProjectComplianceGaps(req.params.projectId);
      const summary = await complianceGapService.getGapSummary(req.params.projectId);
      res.json({ gaps, summary });
    } catch (error) {
      console.error("Error fetching compliance gaps:", error);
      res.status(500).json({ error: "Failed to fetch compliance gaps" });
    }
  });

  app.get("/api/proposals/:proposalId/compliance-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/features/complianceGapService");
      const gaps = await complianceGapService.getProposalComplianceGaps(req.params.proposalId);
      res.json(gaps);
    } catch (error) {
      console.error("Error fetching proposal gaps:", error);
      res.status(500).json({ error: "Failed to fetch proposal gaps" });
    }
  });

  app.patch("/api/compliance-gaps/:id/resolve", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/features/complianceGapService");
      await complianceGapService.resolveComplianceGap(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error resolving gap:", error);
      res.status(500).json({ error: "Failed to resolve gap" });
    }
  });

  // Follow-up Question Generation
  app.post("/api/projects/:projectId/proposals/:proposalId/generate-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/features/followupQuestionService");
      const { projectId, proposalId } = req.params;

      // Get proposal and requirements
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Generate follow-up questions
      const questions = await followupQuestionService.generateFollowupQuestions({
        projectId,
        proposalId,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposal: JSON.stringify(proposal.extractedData),
        vendorName: proposal.vendorName
      });

      res.json({ questions, summary: await followupQuestionService.getQuestionSummary(projectId) });
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      res.status(500).json({ error: "Failed to generate follow-up questions" });
    }
  });

  app.get("/api/projects/:projectId/followup-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/features/followupQuestionService");
      const questions = await followupQuestionService.getProjectFollowupQuestions(req.params.projectId);
      const summary = await followupQuestionService.getQuestionSummary(req.params.projectId);
      res.json({ questions, summary });
    } catch (error) {
      console.error("Error fetching follow-up questions:", error);
      res.status(500).json({ error: "Failed to fetch follow-up questions" });
    }
  });

  app.get("/api/proposals/:proposalId/followup-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/features/followupQuestionService");
      const questions = await followupQuestionService.getProposalFollowupQuestions(req.params.proposalId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching proposal questions:", error);
      res.status(500).json({ error: "Failed to fetch proposal questions" });
    }
  });

  app.patch("/api/followup-questions/:id/answer", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/features/followupQuestionService");
      const { answer } = req.body;
      if (!answer) {
        return res.status(400).json({ error: "Answer is required" });
      }
      await followupQuestionService.answerFollowupQuestion(req.params.id, answer);
      res.json({ success: true });
    } catch (error) {
      console.error("Error answering question:", error);
      res.status(500).json({ error: "Failed to answer question" });
    }
  });

  // Vendor Comparison Matrix
  app.post("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/features/vendorComparisonService");
      const { projectId } = req.params;
      const { proposalIds, comparisonFocus } = req.body;

      if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length < 2) {
        return res.status(400).json({ error: "At least 2 proposal IDs required for comparison" });
      }

      // Get requirements
      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Get all proposals
      const proposals = [];
      for (const proposalId of proposalIds) {
        const proposal = await storage.getProposal(proposalId);
        if (proposal) {
          proposals.push({
            vendorName: proposal.vendorName,
            content: JSON.stringify(proposal.extractedData)
          });
        }
      }

      // Generate comparison
      const comparison = await vendorComparisonService.generateVendorComparison({
        projectId,
        proposalIds,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposals,
        comparisonFocus
      });

      res.json(comparison);
    } catch (error) {
      console.error("Error generating comparison:", error);
      res.status(500).json({ error: "Failed to generate comparison" });
    }
  });

  app.get("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/features/vendorComparisonService");
      const comparisons = await vendorComparisonService.getProjectComparisons(req.params.projectId);
      res.json(comparisons);
    } catch (error) {
      console.error("Error fetching comparisons:", error);
      res.status(500).json({ error: "Failed to fetch comparisons" });
    }
  });

  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/features/vendorComparisonService");
      const comparison = await vendorComparisonService.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }
      res.json(comparison);
    } catch (error) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  app.delete("/api/comparisons/:id", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/features/vendorComparisonService");
      await vendorComparisonService.deleteComparison(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comparison:", error);
      res.status(500).json({ error: "Failed to delete comparison" });
    }
  });

  app.get("/api/comparisons/:id/export/:format", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/features/vendorComparisonService");
      const { id, format } = req.params;
      
      const comparison = await vendorComparisonService.getComparison(id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      const exportData = vendorComparisonService.exportComparisonData(
        comparison,
        format as "json" | "csv"
      );

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=comparison-${id}.csv`);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=comparison-${id}.json`);
      }

      res.send(exportData);
    } catch (error) {
      console.error("Error exporting comparison:", error);
      res.status(500).json({ error: "Failed to export comparison" });
    }
  });

  // Executive Briefing
  app.post("/api/projects/:projectId/briefings", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/features/executiveBriefingService");
      const { projectId } = req.params;
      const { stakeholderRole } = req.body;

      if (!stakeholderRole) {
        return res.status(400).json({ error: "Stakeholder role is required" });
      }

      // Get project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get evaluations and proposals
      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      const briefing = await executiveBriefingService.generateExecutiveBriefing({
        projectId,
        projectName: project.name,
        stakeholderRole,
        evaluations: JSON.stringify(evaluations),
        proposals: JSON.stringify(proposals)
      });

      res.json(briefing);
    } catch (error) {
      console.error("Error generating briefing:", error);
      res.status(500).json({ error: "Failed to generate briefing" });
    }
  });

  app.get("/api/projects/:projectId/briefings", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/features/executiveBriefingService");
      const { role } = req.query;
      
      let briefings;
      if (role) {
        briefings = await executiveBriefingService.getBriefingsByRole(req.params.projectId, role as string);
      } else {
        briefings = await executiveBriefingService.getProjectBriefings(req.params.projectId);
      }
      
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching briefings:", error);
      res.status(500).json({ error: "Failed to fetch briefings" });
    }
  });

  app.get("/api/briefings/:id", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/features/executiveBriefingService");
      const briefing = await executiveBriefingService.getBriefing(req.params.id);
      if (!briefing) {
        return res.status(404).json({ error: "Briefing not found" });
      }
      res.json(briefing);
    } catch (error) {
      console.error("Error fetching briefing:", error);
      res.status(500).json({ error: "Failed to fetch briefing" });
    }
  });

  app.delete("/api/briefings/:id", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/features/executiveBriefingService");
      await executiveBriefingService.deleteBriefing(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting briefing:", error);
      res.status(500).json({ error: "Failed to delete briefing" });
    }
  });

  app.get("/api/briefings/:id/markdown", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/features/executiveBriefingService");
      const briefing = await executiveBriefingService.getBriefing(req.params.id);
      if (!briefing) {
        return res.status(404).json({ error: "Briefing not found" });
      }
      
      const markdown = executiveBriefingService.formatBriefingAsMarkdown(briefing);
      res.setHeader("Content-Type", "text/markdown");
      res.send(markdown);
    } catch (error) {
      console.error("Error formatting briefing:", error);
      res.status(500).json({ error: "Failed to format briefing" });
    }
  });

  // Conversational AI Assistant
  app.post("/api/projects/:projectId/chat/sessions", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const { projectId } = req.params;

      const session = await conversationalAIService.createChatSession(projectId);
      res.json(session);
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  app.get("/api/projects/:projectId/chat/sessions", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const sessions = await conversationalAIService.getProjectChatSessions(req.params.projectId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      res.status(500).json({ error: "Failed to fetch chat sessions" });
    }
  });

  app.get("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const session = await conversationalAIService.getChatSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching chat session:", error);
      res.status(500).json({ error: "Failed to fetch chat session" });
    }
  });

  app.get("/api/chat/sessions/:sessionId/messages", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const messages = await conversationalAIService.getSessionMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.patch("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      await conversationalAIService.updateSessionTitle(req.params.sessionId, title);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      await conversationalAIService.deleteChatSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat session:", error);
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  app.post("/api/chat/sessions/:sessionId/messages", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const { sessionId } = req.params;
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await conversationalAIService.generateChatResponse(
        sessionId,
        message,
        context || {}
      );

      res.json(response);
    } catch (error) {
      console.error("Error generating chat response:", error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

  app.post("/api/chat/sessions/:sessionId/messages/stream", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/ai/conversationalAIService");
      const { sessionId } = req.params;
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream the response
      const stream = conversationalAIService.generateStreamingChatResponse(
        sessionId,
        message,
        context || {}
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in streaming chat:", error);
      res.status(500).json({ error: "Failed to stream chat response" });
    }
  });

  // ============================================
  // KNOWLEDGE BASE CHATBOT ROUTES
  // ============================================

  // Check chatbot readiness (RAG + MCP status)
  app.get("/api/kb-chatbot/status", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgebase/knowledgeBaseChatbotService");
      const status = await knowledgeBaseChatbotService.isReady();
      res.json(status);
    } catch (error) {
      console.error("Error checking chatbot status:", error);
      res.status(500).json({ error: "Failed to check chatbot status" });
    }
  });

  // Query knowledge base chatbot (non-streaming)
  app.post("/api/kb-chatbot/query", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgebase/knowledgeBaseChatbotService");
      const { query, conversationHistory } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const response = await knowledgeBaseChatbotService.generateResponse(
        query,
        conversationHistory || []
      );

      res.json(response);
    } catch (error) {
      console.error("Error querying chatbot:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to query chatbot";
      
      // Return 400 for configuration errors, 500 for runtime errors
      if (errorMessage.includes("not configured") || errorMessage.includes("API key")) {
        return res.status(400).json({ error: errorMessage, type: "configuration" });
      }
      
      res.status(500).json({ error: errorMessage, type: "runtime" });
    }
  });

  // Query knowledge base chatbot (streaming)
  app.post("/api/kb-chatbot/query/stream", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgebase/knowledgeBaseChatbotService");
      const { query, conversationHistory } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = knowledgeBaseChatbotService.generateStreamingResponse(
        query,
        conversationHistory || []
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error("Error in streaming chatbot:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to stream chatbot response";
      
      // Return 400 for configuration errors, 500 for runtime errors
      if (errorMessage.includes("not configured") || errorMessage.includes("API key")) {
        return res.status(400).json({ error: errorMessage, type: "configuration" });
      }
      
      res.status(500).json({ error: errorMessage, type: "runtime" });
    }
  });

  // ============================================
  // SMART RFT CREATION ROUTES
  // ============================================

  // Seed RFT templates
  app.post("/api/seed-rft-templates", async (req, res) => {
    try {
      const result = await seedRftTemplates();
      res.json(result);
    } catch (error) {
      console.error("Error seeding RFT templates:", error);
      res.status(500).json({ error: "Failed to seed RFT templates" });
    }
  });

  // Get all RFT templates
  app.get("/api/rft-templates", async (req, res) => {
    try {
      const templates = await storage.getAllRftTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching RFT templates:", error);
      res.status(500).json({ error: "Failed to fetch RFT templates" });
    }
  });

  // Get active RFT templates
  app.get("/api/rft-templates/active", async (req, res) => {
    try {
      const templates = await storage.getActiveRftTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching active RFT templates:", error);
      res.status(500).json({ error: "Failed to fetch active RFT templates" });
    }
  });

  // Get RFT template by ID
  app.get("/api/rft-templates/:id", async (req, res) => {
    try {
      const template = await storage.getRftTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "RFT template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching RFT template:", error);
      res.status(500).json({ error: "Failed to fetch RFT template" });
    }
  });

  // ========== Organization Template Management Routes ==========

  // Upload organization template (DOCX only)
  app.post("/api/templates/upload", upload.single("template"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name, description, category, createdBy } = req.body;

      if (!name || !category) {
        return res.status(400).json({ error: "Template name and category are required" });
      }

      // Validate DOCX-only at controller level (return 400, not 500)
      if (!req.file.originalname.toLowerCase().endsWith(".docx")) {
        return res.status(400).json({ 
          error: "Only DOCX files are supported in this release. " +
                 "XLSX support requires SheetJS integration and will be added in a future update. " +
                 "Please upload a DOCX template with {{TOKEN}} placeholders."
        });
      }

      const fileExtension = "docx";

      const result = await templateService.uploadTemplate(
        req.file.buffer,
        req.file.originalname,
        {
          name,
          description,
          category,
          templateType: fileExtension,
          createdBy: createdBy || "system",
        }
      );

      res.json({
        template: result.template,
        placeholders: result.placeholders,
        message: "Template uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading organization template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload template";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get all organization templates
  app.get("/api/templates", async (req, res) => {
    try {
      const { category, isActive } = req.query;
      
      const filters: any = {};
      if (category) filters.category = String(category);
      if (isActive !== undefined) filters.isActive = isActive === "true";

      const templates = await templateService.getAllTemplates(filters);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching organization templates:", error);
      res.status(500).json({ error: "Failed to fetch organization templates" });
    }
  });

  // Get organization template by ID
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await templateService.getTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching organization template:", error);
      res.status(500).json({ error: "Failed to fetch organization template" });
    }
  });

  // Configure section mappings for organization template
  app.patch("/api/templates/:id/sections", async (req, res) => {
    try {
      const { sectionMappings } = req.body;

      if (!sectionMappings || !Array.isArray(sectionMappings)) {
        return res.status(400).json({ 
          error: "sectionMappings array is required" 
        });
      }

      const updatedTemplate = await templateService.configureSectionMappings(
        req.params.id,
        sectionMappings
      );

      res.json({
        template: updatedTemplate,
        message: "Section mappings configured successfully",
      });
    } catch (error) {
      console.error("Error configuring section mappings:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to configure section mappings";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Set default template
  app.patch("/api/templates/:id/set-default", async (req, res) => {
    try {
      const updatedTemplate = await templateService.setDefaultTemplate(req.params.id);
      res.json({
        template: updatedTemplate,
        message: "Template set as default successfully",
      });
    } catch (error) {
      console.error("Error setting default template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to set default template";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Deactivate organization template
  app.patch("/api/templates/:id/deactivate", async (req, res) => {
    try {
      const updatedTemplate = await templateService.deactivateTemplate(req.params.id);
      res.json({
        template: updatedTemplate,
        message: "Template deactivated successfully",
      });
    } catch (error) {
      console.error("Error deactivating template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to deactivate template";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Download organization template
  app.get("/api/templates/:id/download", async (req, res) => {
    try {
      const { buffer, fileName } = await templateService.downloadTemplate(req.params.id);
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download template";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Delete organization template
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      await templateService.deleteTemplate(req.params.id);
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete template";
      res.status(500).json({ error: errorMessage });
    }
  });

  // ========== Agent-Driven RFT Generation ==========

  // Generate RFT using 6 specialized AI agents (Product, Architecture, Engineering, Security, Procurement, Delivery)
  app.post("/api/rft/generate-with-agents", async (req, res) => {
    try {
      const { businessCaseId, templateId, projectId } = req.body;

      if (!businessCaseId) {
        return res.status(400).json({
          error: "businessCaseId is required",
        });
      }

      // Fetch business case from database
      const businessCase = await storage.getBusinessCase(businessCaseId);
      if (!businessCase) {
        return res.status(404).json({
          error: "Business case not found",
        });
      }

      // Extract project information from business case
      const projectName = businessCase.name;
      // Use documentContent or extractedData for business objective and scope
      const extractedData = businessCase.extractedData as any;
      const businessObjective = extractedData?.objective || businessCase.description || "";
      const scope = extractedData?.scope || extractedData?.projectScope || "";
      const targetSystems = "Various airline systems (PSS, loyalty, mobile, etc.)"; // Can be enhanced if needed

      console.log(`🤖 Starting agent-driven RFT generation for: ${projectName}`);

      // Step 1: Generate RFT content using all 6 specialized agents
      const { generateAgentDrivenRft, compileAgentRftToMarkdown } = await import("./services/ai/rftAgentOrchestrator");
      
      const agentRft = await generateAgentDrivenRft({
        projectName,
        businessObjective,
        scope,
        targetSystems
      });

      // Step 2: Compile to markdown and prepare sections
      const markdownContent = compileAgentRftToMarkdown(agentRft);
      
      // Convert agent sections to document format
      const documentSections = agentRft.sections.map(section => ({
        title: section.sectionTitle,
        content: section.content
      }));

      // Step 3: Generate DOCX and PDF documents to temp files
      const { generateDocxDocument, generatePdfDocument } = await import("./services/rft/documentGenerator");
      const path = await import("path");
      const fs = await import("fs");
      
      const docxFileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.docx`;
      const pdfFileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.pdf`;
      const docxPath = path.join(process.cwd(), 'uploads', docxFileName);
      const pdfPath = path.join(process.cwd(), 'uploads', pdfFileName);

      await generateDocxDocument({
        projectName,
        sections: documentSections,
        outputPath: docxPath
      });
      
      await generatePdfDocument({
        projectName,
        sections: documentSections,
        outputPath: pdfPath
      });

      // Read the generated files as buffers
      const docxBuffer = fs.readFileSync(docxPath);
      const pdfBuffer = fs.readFileSync(pdfPath);

      // Determine project ID and folder structure (must be before using it)
      const effectiveProjectId = projectId || `temp-${Date.now()}`;
      const folderPath = `project-${effectiveProjectId}/RFT_Generated`;

      // Step 4: Generate Excel questionnaires (extract questions from agent sections)
      const { generateAllQuestionnaires } = await import("./services/rft/excelGenerator");
      
      // Extract questions from ALL agent sections for questionnaire generation
      const productSection = agentRft.sections.find(s => s.agentRole === "product");
      const architectureSection = agentRft.sections.find(s => s.agentRole === "architecture");
      const engineeringSection = agentRft.sections.find(s => s.agentRole === "engineering");
      const securitySection = agentRft.sections.find(s => s.agentRole === "security");
      const procurementSection = agentRft.sections.find(s => s.agentRole === "procurement");
      const deliverySection = agentRft.sections.find(s => s.agentRole === "delivery");

      // Convert question strings to questionnaire format
      const convertToQuestions = (questions: string[]): any[] => {
        return questions.map((q, i) => ({
          id: `q${i + 1}`,
          question: q,
          type: "text" as const,
          required: true,
          maxScore: 10
        }));
      };

      // Combine questions from all agents into 5 questionnaire categories
      // Product questionnaire: Product questions
      // NFR questionnaire: Architecture + Engineering questions  
      // Cybersecurity questionnaire: Security questions
      // Agile questionnaire: Delivery questions
      // Procurement questionnaire: Procurement questions (commercial/pricing)
      const questionnairePaths = await generateAllQuestionnaires(
        effectiveProjectId,
        {
          product: convertToQuestions(productSection?.questionsForVendors || []),
          nfr: convertToQuestions([
            ...(architectureSection?.questionsForVendors || []),
            ...(engineeringSection?.questionsForVendors || [])
          ]),
          cybersecurity: convertToQuestions(securitySection?.questionsForVendors || []),
          agile: convertToQuestions(deliverySection?.questionsForVendors || []),
          procurement: convertToQuestions(procurementSection?.questionsForVendors || [])
        }
      );

      // Read questionnaire files as buffers
      const productBuffer = fs.readFileSync(questionnairePaths.productPath);
      const nfrBuffer = fs.readFileSync(questionnairePaths.nfrPath);
      const cybersecurityBuffer = fs.readFileSync(questionnairePaths.cybersecurityPath);
      const agileBuffer = fs.readFileSync(questionnairePaths.agilePath);
      const procurementBuffer = fs.readFileSync(questionnairePaths.procurementPath);

      // Generate Product Technical Questionnaire with context diagram (if business case exists)
      let productTechnicalBuffer: Buffer | null = null;
      let productTechnicalPath: string | null = null;
      let contextDiagramBuffer: Buffer | null = null;
      
      // Construct business case narrative from available sources
      const businessCaseNarrative = businessCase.documentContent || 
                                   (extractedData?.DESCRIPTION || extractedData?.description) ||
                                   documentSections.map(s => s.content).join('\n\n');
      
      if (businessCaseNarrative?.trim().length > 0) {
        try {
          console.log(`[Agent RFT] Generating Product Technical Questionnaire with context diagram...`);
          
          // Generate context diagram PNG
          const { generateContextDiagram } = await import("./services/architecture/contextDiagramGenerator");
          const { generateProductTechnicalQuestionnaire } = await import("./services/architecture/productQuestionnaireGenerator");
          
          const contextDiagramPngPath = path.join(process.cwd(), 'uploads', `context_diagram_${Date.now()}.png`);
          const { pngPath } = await generateContextDiagram(businessCaseNarrative, contextDiagramPngPath);
          
          // Generate Product Technical Questionnaire DOCX with embedded diagram
          const productTechnicalFileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Product_Technical_Questionnaire.docx`;
          productTechnicalPath = await generateProductTechnicalQuestionnaire({
            projectName,
            contextDiagramPngPath: pngPath,
            outputPath: path.join(process.cwd(), 'uploads', productTechnicalFileName)
          });
          
          productTechnicalBuffer = fs.readFileSync(productTechnicalPath);
          
          // Keep diagram PNG as separate file for full-quality access
          contextDiagramBuffer = fs.readFileSync(pngPath);
          
          // Clean up temp diagram file after reading
          fs.unlinkSync(pngPath);
          
          console.log(`[Agent RFT] Product Technical Questionnaire and context diagram generated successfully`);
        } catch (error) {
          console.error(`[Agent RFT] Failed to generate Product Technical Questionnaire:`, error);
          // Continue without this file if generation fails
        }
      }

      // Step 5: Upload all files to Azure Blob Storage
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");

      // Upload base files (now includes 5 questionnaires)
      const [docxUpload, pdfUpload, productQuestUpload, nfrUpload, cybersecurityUpload, agileUpload, procurementUpload] = await Promise.all([
        azureBlobStorageService.uploadDocument(
          `${folderPath}/${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.docx`,
          docxBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.pdf`,
          pdfBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/Product_Questionnaire.xlsx`,
          productBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/NFR_Questionnaire.xlsx`,
          nfrBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/Cybersecurity_Questionnaire.xlsx`,
          cybersecurityBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/Agile_Questionnaire.xlsx`,
          agileBuffer
        ),
        azureBlobStorageService.uploadDocument(
          `${folderPath}/Procurement_Questionnaire.xlsx`,
          procurementBuffer
        )
      ]);
      
      // Upload Product Technical Questionnaire if generated
      let productTechnicalUpload = null;
      if (productTechnicalBuffer) {
        productTechnicalUpload = await azureBlobStorageService.uploadDocument(
          `${folderPath}/Product_Technical_Questionnaire.docx`,
          productTechnicalBuffer
        );
        console.log(`[Agent RFT] Product Technical Questionnaire uploaded: ${productTechnicalUpload.blobUrl}`);
      }
      
      // Upload Context Diagram PNG if generated (full quality separate file)
      let contextDiagramUpload = null;
      if (contextDiagramBuffer) {
        contextDiagramUpload = await azureBlobStorageService.uploadDocument(
          `${folderPath}/Context_Architecture_Diagram.png`,
          contextDiagramBuffer
        );
        console.log(`[Agent RFT] Context Diagram PNG uploaded: ${contextDiagramUpload.blobUrl}`);
      }
      
      // Build upload results array explicitly to avoid index confusion
      // Order: DOCX, PDF, [ProductTechnical?], ProductQuest, NFR, Cyber, Agile, Procurement, [ContextDiagram?]
      let uploadResults = [docxUpload, pdfUpload];
      
      if (productTechnicalUpload) {
        uploadResults.push(productTechnicalUpload);
      }
      
      uploadResults.push(productQuestUpload, nfrUpload, cybersecurityUpload, agileUpload, procurementUpload);
      
      if (contextDiagramUpload) {
        uploadResults.push(contextDiagramUpload);
      }

      // Step 6: Create RFT record and draft with pack metadata in database (if projectId provided)
      let rftRecord = null;
      let draft = null;
      if (projectId) {
        // Questionnaires always start after DOCX, PDF, and optional ProductTechnical
        const questStartIndex = productTechnicalUpload ? 3 : 2;
        rftRecord = await storage.createGeneratedRft({
          projectId,
          businessCaseId,
          name: projectName,
          sections: {
            sections: agentRft.sections.map(section => ({
              id: section.agentRole,
              title: section.sectionTitle,
              content: section.content,
              agentRole: section.agentRole,
              questionsForVendors: section.questionsForVendors,
              evaluationCriteria: section.evaluationCriteria
            }))
          },
          templateId: templateId || "",
          status: "published",
          productQuestionnairePath: uploadResults[questStartIndex].blobUrl,
          nfrQuestionnairePath: uploadResults[questStartIndex + 1].blobUrl,
          cybersecurityQuestionnairePath: uploadResults[questStartIndex + 2].blobUrl,
          agileQuestionnairePath: uploadResults[questStartIndex + 3].blobUrl
        });

        // Create draft with pack metadata for ZIP download functionality
        draft = await storage.createRftGenerationDraft({
          projectId,
          businessCaseId,
          templateId: templateId || null,
          generationMode: "agent",
          generatedSections: agentRft.sections.map(section => ({
            id: section.agentRole,
            title: section.sectionTitle,
            content: section.content,
            agentRole: section.agentRole,
            stakeholders: [],
            approvalStatus: "approved"
          })) as any,
          status: "finalized",
          approvalProgress: {
            totalSections: agentRft.sections.length,
            approvedSections: agentRft.sections.length,
            pendingSections: 0,
            rejectedSections: 0
          },
          metadata: {
            pack: {
              status: "completed",
              // Legacy format for backward compatibility
              docxBlobUrl: docxUpload.blobUrl,
              pdfBlobUrl: pdfUpload.blobUrl,
              productQuestionnaireBlobUrl: uploadResults[questStartIndex].blobUrl,
              nfrQuestionnaireBlobUrl: uploadResults[questStartIndex + 1].blobUrl,
              cybersecurityQuestionnaireBlobUrl: uploadResults[questStartIndex + 2].blobUrl,
              agileQuestionnaireBlobUrl: uploadResults[questStartIndex + 3].blobUrl,
              procurementQuestionnaireBlobUrl: uploadResults[questStartIndex + 4].blobUrl,
              ...(productTechnicalUpload && { productTechnicalQuestionnaireBlobUrl: productTechnicalUpload.blobUrl }),
              ...(contextDiagramUpload && { contextDiagramBlobUrl: contextDiagramUpload.blobUrl }),
              // New nested structure expected by frontend
              files: {
                docx: { url: docxUpload.blobUrl },
                pdf: { url: pdfUpload.blobUrl },
                ...(productTechnicalUpload && { productTechnical: { url: productTechnicalUpload.blobUrl } }),
                ...(contextDiagramUpload && { contextDiagram: { url: contextDiagramUpload.blobUrl } }),
                questionnaires: {
                  product: { url: uploadResults[questStartIndex].blobUrl },
                  nfr: { url: uploadResults[questStartIndex + 1].blobUrl },
                  cybersecurity: { url: uploadResults[questStartIndex + 2].blobUrl },
                  agile: { url: uploadResults[questStartIndex + 3].blobUrl },
                  procurement: { url: uploadResults[questStartIndex + 4].blobUrl }
                }
              },
              generatedAt: new Date().toISOString()
            }
          }
        });
        console.log(`[Agent RFT] Created draft with pack metadata: ${draft.id}`);
      }

      // Clean up temp files
      try {
        fs.unlinkSync(docxPath);
        fs.unlinkSync(pdfPath);
        fs.unlinkSync(questionnairePaths.productPath);
        fs.unlinkSync(questionnairePaths.nfrPath);
        fs.unlinkSync(questionnairePaths.cybersecurityPath);
        fs.unlinkSync(questionnairePaths.agilePath);
        fs.unlinkSync(questionnairePaths.procurementPath);
        if (productTechnicalPath) {
          fs.unlinkSync(productTechnicalPath);
        }
      } catch (cleanupError) {
        console.warn("Error cleaning up temp files:", cleanupError);
      }

      console.log(`✅ Agent-driven RFT generation complete for: ${projectName}`);

      res.json({
        success: true,
        rftId: rftRecord?.id,
        draftId: draft?.id,
        projectName,
        filesGenerated: contextDiagramBuffer ? 9 : (productTechnicalBuffer ? 8 : 7),
        uploadedFiles: uploadResults.map(r => r.blobUrl),
        productTechnicalQuestionnaireBlobUrl: productTechnicalUpload?.blobUrl || null,
        contextDiagramBlobUrl: contextDiagramUpload?.blobUrl || null,
        sections: agentRft.sections.map(s => ({
          agentRole: s.agentRole,
          title: s.sectionTitle,
          questionCount: s.questionsForVendors.length,
          criteriaCount: s.evaluationCriteria.length
        })),
        message: "RFT generated successfully using 6 specialized AI agents"
      });
    } catch (error) {
      console.error("❌ Error in agent-driven RFT generation:", error);
      
      // Cleanup on error - remove any temp files that may have been created
      const path = await import("path");
      const fs = await import("fs");
      const safeName = req.body.projectName ? req.body.projectName.replace(/[^a-zA-Z0-9]/g, '_') : 'temp';
      const filesToCleanup = [
        path.join(process.cwd(), 'uploads', `${safeName}_RFT.docx`),
        path.join(process.cwd(), 'uploads', `${safeName}_RFT.pdf`),
      ];
      
      for (const file of filesToCleanup) {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (cleanupError) {
          console.warn(`Failed to cleanup temp file ${file}:`, cleanupError);
        }
      }

      const errorMessage = error instanceof Error ? error.message : "Failed to generate RFT with agents";
      res.status(500).json({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // ========== Collaborative Draft Review Routes ==========

  // Generate new RFT draft with stakeholder assignments
  app.post("/api/rft/drafts", async (req, res) => {
    try {
      const { projectId, businessCaseId, templateId, generationMode } = req.body;

      if (!projectId || !businessCaseId || !generationMode) {
        return res.status(400).json({
          error: "projectId, businessCaseId, and generationMode are required",
        });
      }

      if (!["ai_generation", "template_merge"].includes(generationMode)) {
        return res.status(400).json({
          error: "generationMode must be 'ai_generation' or 'template_merge'",
        });
      }

      // If using template_merge mode, templateId is required
      if (generationMode === "template_merge" && !templateId) {
        return res.status(400).json({
          error: "templateId is required for template_merge mode",
        });
      }

      // For ai_generation mode, generate sections using smartRftService
      let generatedSections: any[] = [];
      let template: any = null;

      if (generationMode === "ai_generation") {
        // Get business case to generate RFT content
        const businessCase = await storage.getBusinessCase(businessCaseId);
        if (!businessCase) {
          return res.status(404).json({ error: "Business case not found" });
        }

        // If templateId provided, try to fetch template for stakeholder mappings
        // Template can be either an RFT template or organization template
        if (templateId) {
          try {
            // Try RFT template first (from AI Templates tab)
            template = await storage.getRftTemplate(templateId);
            
            if (!template) {
              // Try organization template (from Template Management)
              template = await templateService.getTemplateById(templateId);
              
              if (!template) {
                console.log(`Template ${templateId} not found in either RFT templates or organization templates, proceeding without stakeholder mappings`);
              }
            }
          } catch (error: any) {
            // Infrastructure/storage errors should fail the request
            console.error(`Error fetching template ${templateId}:`, error);
            return res.status(500).json({
              error: "Failed to fetch template",
              details: error.message || "Template storage service unavailable"
            });
          }
          
          // Template is optional for AI generation, continue with or without it (if null)
        }

        // Extract business case info first
        const businessCaseExtract = await extractBusinessCaseInfo(
          businessCase.documentContent || businessCase.description || ""
        );

        // Generate professional RFT sections using AI with template for stakeholder enrichment
        const sections = await generateProfessionalRftSections(businessCaseExtract, template);

        // Map sections to stakeholders based on enriched metadata
        // Sections now have suggestedAssignee and category from enrichment
        generatedSections = sections.map((section) => {
          // Get stakeholder name from role ID
          const stakeholderRole = section.suggestedAssignee 
            ? getStakeholderRole(section.suggestedAssignee)
            : null;
          
          const assignedTo = stakeholderRole?.name || "Technical PM";
          
          return {
            sectionId: section.sectionId,
            title: section.title,
            content: section.content,
            assignedTo,
            reviewStatus: "pending",
            approvedBy: null,
            approvedAt: null,
          };
        });
      } else {
        // template_merge mode - merge business case data with template
        
        // Fetch template
        template = await templateService.getTemplateById(templateId);
        if (!template) {
          return res.status(404).json({ error: "Template not found" });
        }

        // Fetch business case
        const businessCase = await storage.getBusinessCase(businessCaseId);
        if (!businessCase) {
          return res.status(404).json({ error: "Business case not found" });
        }

        // Download template from blob storage
        const { buffer: templateBuffer } = await templateService.downloadTemplate(templateId);

        // Prepare merge data from business case
        // Extract additional data from extractedData JSONB field if available
        const extractedData = businessCase.extractedData as any;
        
        // Helper function to decode HTML entities
        const decodeHTML = (str: string): string => {
          return str
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        };
        
        const mergeData: any = {
          PROJECT_NAME: decodeHTML(businessCase.name || "Untitled Project"),
          AIRLINE_NAME: decodeHTML(extractedData?.airline || "Emirates Airlines"),
          DESCRIPTION: decodeHTML(businessCase.description || extractedData?.projectObjective || extractedData?.description || ""),
          BUDGET: decodeHTML(extractedData?.budget || "TBD"),
          TIMELINE: decodeHTML(extractedData?.timeline || "TBD"),
          FUNCTIONAL_REQUIREMENTS: decodeHTML(extractedData?.functionalRequirements || extractedData?.keyRequirements || extractedData?.requirements || ""),
          NON_FUNCTIONAL_REQUIREMENTS: decodeHTML(extractedData?.nonFunctionalRequirements || ""),
          REQUIREMENTS: decodeHTML(extractedData?.requirements || 
            (extractedData?.functionalRequirements && extractedData?.nonFunctionalRequirements 
              ? `Functional Requirements:\n${extractedData.functionalRequirements}\n\nNon-functional Requirements:\n${extractedData.nonFunctionalRequirements}`
              : extractedData?.functionalRequirements || extractedData?.nonFunctionalRequirements || extractedData?.keyRequirements || "")),
          DEADLINE: decodeHTML(extractedData?.successCriteria || extractedData?.deadline || "TBD"),
        };

        console.log("🔄 Template merge data prepared:", {
          PROJECT_NAME: mergeData.PROJECT_NAME,
          AIRLINE_NAME: mergeData.AIRLINE_NAME,
          BUDGET: mergeData.BUDGET,
          TIMELINE: mergeData.TIMELINE,
        });

        // Normalize template placeholders before merging (fixes malformed {{{{VAR}}}} or {{VAR}}}} syntax)
        const PizZip = (await import("pizzip")).default;
        const Docxtemplater = (await import("docxtemplater")).default;
        
        let normalizedBuffer = templateBuffer;
        try {
          const zipForNormalization = new PizZip(templateBuffer);
          const xml = zipForNormalization.file("word/document.xml")?.asText();
          
          if (xml) {
            // Fix malformed placeholders: {{{{VAR}}}} -> {{VAR}}, {{VAR}}}} -> {{VAR}}
            let normalizedXml = xml.replace(/\{\{+/g, '{{').replace(/\}\}+/g, '}}');
            
            console.log(`✓ Normalized template placeholders before merge`);
            
            zipForNormalization.file("word/document.xml", normalizedXml);
            normalizedBuffer = zipForNormalization.generate({
              type: "nodebuffer",
              compression: "DEFLATE",
            });
          }
        } catch (normError) {
          console.warn("Could not normalize template - using original:", normError);
        }

        // Merge template with business case data using docxtemplater
        const zip = new PizZip(normalizedBuffer);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: '{{', end: '}}' },
          nullGetter: (part: any) => {
            console.warn(`Missing placeholder data for: ${part.value}`);
            return `[${part.value}]`;
          },
        });

        // Render template with merge data
        try {
          doc.render(mergeData);
          console.log(`✅ Template merged successfully with business case data`);
        } catch (docxError: any) {
          console.error("Docxtemplater merge error:", docxError);
          
          // Provide detailed error with placeholder context
          if (docxError.properties && docxError.properties.errors) {
            const errors = docxError.properties.errors.map((err: any) => {
              if (err.properties?.xtag) {
                return `Invalid placeholder "{{${err.properties.xtag}}}"`;
              }
              return err.message;
            }).join(', ');
            
            return res.status(400).json({
              error: "Template has syntax errors that prevent merging",
              hint: "Check for duplicate closing braces or malformed tags like '{{{{NAME}}}}' instead of '{{NAME}}'",
              details: errors,
            });
          }
          
          // Check if this is a common "duplicate tag" error from malformed Word placeholders
          if (docxError.message && docxError.message.includes("duplicate")) {
            return res.status(400).json({
              error: "Template contains malformed placeholders",
              details: "This template has formatting issues that prevent merge. Placeholders like {{AIRLINE_NAME}} may be split across formatting boundaries in Word. Please re-upload the template or ensure all placeholders are formatted consistently.",
              technicalDetails: docxError.message,
            });
          }
          
          // Generic docxtemplater error
          return res.status(500).json({
            error: "Failed to merge template with business case data",
            details: docxError.message || "Unknown template processing error",
          });
        }

        // Extract the complete merged text content with paragraph breaks preserved
        const mergedText = extractTextWithFormatting(zip);
        console.log(`📄 Extracted ${mergedText.length} characters of merged content (with formatting preserved)`);

        // Generate merged DOCX buffer for download/backup
        const mergedBuffer = doc.getZip().generate({
          type: "nodebuffer",
          compression: "DEFLATE",
        });

        // Save merged document to blob storage as backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const mergedFileName = `merged_template_${timestamp}.docx`;
        const blobPath = `projects/${projectId}/drafts/${mergedFileName}`;

        const { blobUrl } = await azureBlobStorageService.uploadDocument(blobPath, mergedBuffer, {
          projectId,
          templateId,
          businessCaseId,
          mergedAt: new Date().toISOString(),
        });

        console.log(`📥 Merged document backup saved to: ${blobUrl}`);

        // Create sections based on template configuration
        // If template has section mappings, use them; otherwise create a single default section
        const hasSectionMappings = template.sectionMappings && template.sectionMappings.length > 0;
        
        if (hasSectionMappings) {
          // Use configured section mappings with smart content extraction and AI enhancement
          const sectionMappings = template.sectionMappings as any[];
          const allSectionTitles = sectionMappings.map((m: any) => m.sectionTitle);
          
          // Check if AI enhancement is enabled (default: true for template merge)
          const enableAIEnhancement = req.body.enableAIEnhancement !== false;
          
          // Process sections in parallel with AI enhancement
          generatedSections = await Promise.all(
            sectionMappings.map(async (mapping: any, index: number) => {
              try {
                // Extract section-specific content from merged text
                const extraction = extractSectionContent(mergedText, mapping.sectionTitle, allSectionTitles);
                
                // AI Enhancement: Expand content with detailed requirements
                const enhancement = await enhanceSectionWithAI(
                  mapping.sectionTitle,
                  extraction.content,
                  businessCase,
                  {
                    enabled: enableAIEnhancement,
                    maxTokens: 3500,
                    category: mapping.category
                  }
                );
                
                // Build section content based on extraction confidence and enhancement status
                let sectionContent = "";
                
                if (extraction.confidence === "high") {
                  // High confidence - use extracted/enhanced section content directly
                  sectionContent = enhancement.content;
                } else {
                  // Low confidence - provide full merged document for manual extraction
                  sectionContent = `Could not auto-extract section "${mapping.sectionTitle}" from template.\n\n` +
                    `Please locate your section content in the merged document below and edit to keep only your section:\n\n` +
                    `${mergedText}`;
                }

                return {
                  sectionId: mapping.sectionId,
                  title: mapping.sectionTitle,
                  content: sectionContent,
                  assignedTo: mapping.defaultAssignee,
                  reviewStatus: "pending",
                  approvedBy: null,
                  approvedAt: null,
                  metadata: {
                    aiEnhanced: enhancement.enhanced,
                    enhancementStatus: enhancement.status,
                    extractionConfidence: extraction.confidence
                  }
                };
              } catch (error) {
                console.error(`Error processing section ${mapping.sectionTitle}:`, error);
                // Fallback to basic section on error
                return {
                  sectionId: mapping.sectionId,
                  title: mapping.sectionTitle,
                  content: `Error processing section. Please check server logs for details.\n\nSection: ${mapping.sectionTitle}`,
                  assignedTo: mapping.defaultAssignee,
                  reviewStatus: "pending",
                  approvedBy: null,
                  approvedAt: null,
                  metadata: {
                    aiEnhanced: false,
                    enhancementStatus: "error",
                    extractionConfidence: "low"
                  }
                };
              }
            })
          );
        } else {
          // Template has no section mappings - create a single default section
          console.warn(`Template ${templateId} has no section mappings - creating default single section`);
          
          generatedSections = [{
            sectionId: "section-complete-document",
            title: "Complete RFT Document",
            content: mergedText,
            assignedTo: "Technical PM",
            reviewStatus: "pending",
            approvedBy: null,
            approvedAt: null,
          }];
        }
      }

      // Create draft with metadata
      // For template merge, include the merged document URL
      const draftMetadata: any = {
        generatedAt: new Date().toISOString(),
        editHistory: {},
      };
      
      // Add merged document URL for template merge mode
      if (generationMode === "template_merge" && template) {
        // Extract blobUrl from the first section's content or use the stored value
        const mergedDocUrlMatch = generatedSections[0]?.content?.match(/📥 Download.*?: (https:\/\/[^\s\n]+)/);
        if (mergedDocUrlMatch) {
          draftMetadata.mergedDocumentUrl = mergedDocUrlMatch[1];
          draftMetadata.templateName = template.name;
          console.log(`✅ Stored merged document URL in metadata: ${draftMetadata.mergedDocumentUrl}`);
        }
      }

      const draft = await storage.createRftGenerationDraft({
        projectId,
        businessCaseId,
        templateId: templateId || null,
        generationMode,
        generatedSections: generatedSections as any,
        status: "draft",
        approvalProgress: {
          totalSections: generatedSections.length,
          approvedSections: 0,
          pendingSections: generatedSections.length,
        } as any,
        metadata: draftMetadata as any,
      });

      // Automatically generate RFT pack in background (DOCX, PDF, 4 Excel questionnaires)
      console.log(`🎯 Triggering automatic RFT pack generation for draft ${draft.id}...`);
      const {generateRftPackFromDraft} = await import("./services/rft/draftPackGenerator");
      generateRftPackFromDraft(draft.id).catch((error) => {
        console.error(`❌ Background RFT pack generation failed for draft ${draft.id}:`, error);
      });

      res.json({
        id: draft.id,
        draft,
        message: "Draft generated successfully with stakeholder assignments",
      });
    } catch (error) {
      console.error("Error generating draft:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate draft";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get draft by ID
  app.get("/api/rft/drafts/:id", async (req, res) => {
    try {
      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error) {
      console.error("Error fetching draft:", error);
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  });

  // List drafts with optional filters
  app.get("/api/rft/drafts", async (req, res) => {
    try {
      const { projectId, status, assignedTo } = req.query;

      // Get all drafts first
      let drafts = await storage.getAllRftGenerationDrafts();
      
      // Apply filters
      if (projectId) {
        drafts = drafts.filter((d) => d.projectId === projectId);
      }
      
      if (status) {
        drafts = drafts.filter((d) => d.status === status);
      }
      
      if (assignedTo) {
        drafts = drafts.filter((d) => {
          const sections = d.generatedSections as any[];
          return sections.some((s: any) => s.assignedTo === assignedTo);
        });
      }

      res.json(drafts);
    } catch (error) {
      console.error("Error listing drafts:", error);
      res.status(500).json({ error: "Failed to list drafts" });
    }
  });

  // Edit section content (with authorization check)
  app.patch("/api/rft/drafts/:id/sections/:sectionId", async (req, res) => {
    try {
      const { content, editedBy } = req.body;

      if (!content || !editedBy) {
        return res.status(400).json({ error: "content and editedBy are required" });
      }

      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const sections = draft.generatedSections as any[];
      const sectionIndex = sections.findIndex((s: any) => s.sectionId === req.params.sectionId);

      if (sectionIndex === -1) {
        return res.status(404).json({ error: "Section not found" });
      }

      const section = sections[sectionIndex];

      // Authorization: Check if editedBy matches assignedTo (or allow privileged roles)
      // For MVP, we'll log a warning but allow edits
      if (section.assignedTo && editedBy !== section.assignedTo) {
        console.warn(
          `⚠️  Section edit authorization warning: ${editedBy} editing section assigned to ${section.assignedTo}`
        );
      }

      // Update section content and reset approval
      section.content = content;
      section.reviewStatus = "pending";
      section.approvedBy = null;
      section.approvedAt = null;

      // Track edit history in metadata (ring buffer, max 10 entries per section)
      const metadata = (draft.metadata as any) || { editHistory: {} };
      metadata.editHistory = metadata.editHistory || {};
      metadata.editHistory[req.params.sectionId] = metadata.editHistory[req.params.sectionId] || [];
      
      metadata.editHistory[req.params.sectionId].push({
        editedBy,
        editedAt: new Date().toISOString(),
        previousContent: section.content,
      });

      // Keep only last 10 edits (ring buffer)
      if (metadata.editHistory[req.params.sectionId].length > 10) {
        metadata.editHistory[req.params.sectionId].shift();
      }

      // Update draft
      await storage.updateRftGenerationDraft(req.params.id, {
        generatedSections: sections as any,
        metadata: metadata as any,
      });

      res.json({
        section,
        message: "Section updated successfully",
      });
    } catch (error) {
      console.error("Error updating section:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update section";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Approve section (with authorization check)
  app.post("/api/rft/drafts/:id/sections/:sectionId/approve", async (req, res) => {
    try {
      const { approvedBy } = req.body;
      
      console.log("🔍 Approval request received:", {
        draftId: req.params.id,
        sectionId: req.params.sectionId,
        approvedBy,
        body: req.body
      });

      if (!approvedBy) {
        console.log("❌ Missing approvedBy in request");
        return res.status(400).json({ error: "approvedBy is required" });
      }

      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        console.log("❌ Draft not found:", req.params.id);
        return res.status(404).json({ error: "Draft not found" });
      }

      const sections = draft.generatedSections as any[];
      const sectionIndex = sections.findIndex((s: any) => s.sectionId === req.params.sectionId);

      if (sectionIndex === -1) {
        console.log("❌ Section not found:", req.params.sectionId);
        return res.status(404).json({ error: "Section not found" });
      }

      const section = sections[sectionIndex];
      
      console.log("📝 Section details:", {
        sectionTitle: section.sectionTitle,
        assignedTo: section.assignedTo,
        approvedBy,
        match: section.assignedTo === approvedBy
      });

      // Authorization: Check if approvedBy matches assignedTo
      if (section.assignedTo && approvedBy !== section.assignedTo) {
        console.log("❌ Authorization failed:", {
          assignedTo: section.assignedTo,
          approvedBy,
          error: `Only ${section.assignedTo} can approve this section`
        });
        return res.status(403).json({
          error: `Only ${section.assignedTo} can approve this section`,
        });
      }
      
      console.log("✅ Authorization passed, approving section");

      // Approve section
      section.reviewStatus = "approved";
      section.approvedBy = approvedBy;
      section.approvedAt = new Date().toISOString();

      // Update approval progress
      const approvalProgress = (draft.approvalProgress as any) || {
        totalSections: sections.length,
        approvedSections: 0,
        pendingSections: sections.length,
      };

      approvalProgress.approvedSections = sections.filter(
        (s: any) => s.reviewStatus === "approved"
      ).length;
      approvalProgress.pendingSections =
        approvalProgress.totalSections - approvalProgress.approvedSections;

      // Update draft status if all sections approved
      let newStatus = draft.status;
      if (approvalProgress.approvedSections === approvalProgress.totalSections) {
        newStatus = "approved";
      } else if (approvalProgress.approvedSections > 0) {
        newStatus = "in_review";
      }

      // Update draft
      await storage.updateRftGenerationDraft(req.params.id, {
        generatedSections: sections as any,
        approvalProgress: approvalProgress as any,
        status: newStatus,
      });

      res.json({
        section,
        approvalProgress,
        draftStatus: newStatus,
        message: "Section approved successfully",
      });
    } catch (error) {
      console.error("Error approving section:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to approve section";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Finalize draft and merge into template
  app.post("/api/rft/drafts/:id/finalize", async (req, res) => {
    try {
      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      // Verify template exists (with retry on blob failures)
      if (!draft.templateId) {
        return res.status(400).json({
          error: "Cannot finalize: Draft has no associated template",
          hint: "This draft was generated without a template and cannot be merged",
        });
      }

      let template;
      let retries = 3;
      while (retries > 0) {
        try {
          template = await templateService.getTemplateById(draft.templateId);
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.warn(`Template fetch failed, retrying... (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Merge content into template with retry on blob failures
      let mergeResult;
      retries = 3;
      while (retries > 0) {
        try {
          mergeResult = await templateMergeService.mergeTemplate(
            draft.templateId,
            req.params.id,
            draft.projectId
          );
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.warn(`Template merge failed, retrying... (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Update draft status to finalized
      await storage.updateRftGenerationDraft(req.params.id, {
        status: "finalized",
        metadata: {
          ...(draft.metadata as any),
          finalizedAt: new Date().toISOString(),
        } as any,
      });

      res.json({
        draft: {
          ...draft,
          status: "finalized",
        },
        mergedDocument: mergeResult,
        message: "Draft finalized successfully",
      });
    } catch (error) {
      console.error("Error finalizing draft:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to finalize draft";
      
      // Template syntax errors should return 400, not 500
      if (errorMessage.includes("Template has syntax errors") || 
          errorMessage.includes("Invalid placeholder syntax") ||
          errorMessage.includes("malformed placeholders")) {
        return res.status(400).json({ 
          error: errorMessage,
          hint: "The template file contains formatting issues. Please upload a corrected template or contact support."
        });
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  // Download all RFT pack documents as ZIP
  app.get("/api/drafts/:id/pack/download-all", async (req, res) => {
    try {
      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const metadata = (draft.metadata as any) || {};
      const pack = metadata.pack;

      if (!pack || pack.status !== "completed") {
        return res.status(400).json({
          error: "RFT pack is not ready for download",
          status: pack?.status || "pending",
        });
      }

      // Get all pack files from Azure Blob Storage (up to 9 files when context diagram is included)
      // New structure: pack.files.docx.url, pack.files.pdf.url, pack.files.questionnaires.product.url
      // Legacy structure: pack.docxBlobUrl, pack.pdfBlobUrl, pack.productQuestionnaireBlobUrl
      const packFiles = pack.files || {};
      const files = [
        { 
          blobUrl: packFiles.docx?.url || pack.docxBlobUrl, 
          name: "RFT_Document.docx" 
        },
        { 
          blobUrl: packFiles.pdf?.url || pack.pdfBlobUrl, 
          name: "RFT_Document.pdf" 
        },
        { 
          blobUrl: packFiles.questionnaires?.product?.url || pack.productQuestionnaireBlobUrl, 
          name: "Product_Questionnaire.xlsx" 
        },
        { 
          blobUrl: packFiles.questionnaires?.nfr?.url || pack.nfrQuestionnaireBlobUrl, 
          name: "NFR_Questionnaire.xlsx" 
        },
        { 
          blobUrl: packFiles.questionnaires?.cybersecurity?.url || pack.cybersecurityQuestionnaireBlobUrl, 
          name: "Cybersecurity_Questionnaire.xlsx" 
        },
        { 
          blobUrl: packFiles.questionnaires?.agile?.url || pack.agileQuestionnaireBlobUrl, 
          name: "Agile_Delivery_Questionnaire.xlsx" 
        },
        { 
          blobUrl: packFiles.questionnaires?.procurement?.url || pack.procurementQuestionnaireBlobUrl, 
          name: "Procurement_Questionnaire.xlsx" 
        },
        {
          blobUrl: packFiles.productTechnical?.url || pack.productTechnicalQuestionnaireBlobUrl,
          name: "Product_Technical_Questionnaire.docx"
        },
        {
          blobUrl: packFiles.contextDiagram?.url || pack.contextDiagramBlobUrl,
          name: "Context_Architecture_Diagram.png"
        },
      ];

      // Create ZIP archive
      const archiver = (await import("archiver")).default;
      const archive = archiver('zip', { zlib: { level: 9 } });

      const project = await storage.getProject(draft.projectId);
      const sanitizedName = project?.name.replace(/[^a-zA-Z0-9]/g, "_") || "RFT";
      res.attachment(`${sanitizedName}_Complete_RFT_Package.zip`);
      res.setHeader('Content-Type', 'application/zip');

      archive.on('error', (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create ZIP file" });
        }
      });

      archive.pipe(res);

      // Download and add each file to the archive
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      
      for (const file of files) {
        if (file.blobUrl) {
          try {
            // Extract blob name from URL
            // URL format: https://intellibidstorage.blob.core.windows.net/intellibid-documents/project-XXX/RFT_Generated/file.docx?sas
            const url = new URL(file.blobUrl.split('?')[0]); // Remove SAS token
            const pathname = url.pathname; // e.g., /intellibid-documents/project-XXX/RFT_Generated/file.docx
            const parts = pathname.split('/').filter(Boolean); // ['intellibid-documents', 'project-XXX', 'RFT_Generated', 'file.docx']
            
            // Skip container name, join the rest
            const blobName = parts.slice(1).join('/'); // project-XXX/RFT_Generated/file.docx
            
            console.log(`📥 Downloading ${file.name} from blob: ${blobName}`);
            
            // Download from Azure
            const buffer = await azureBlobStorageService.downloadDocument(blobName);
            
            // Add to archive
            archive.append(buffer, { name: file.name });
            console.log(`✓ Added ${file.name} to ZIP (${buffer.length} bytes)`);
          } catch (error) {
            console.warn(`Could not add ${file.name} to ZIP:`, error);
          }
        }
      }

      // Finalize archive
      await archive.finalize();
      console.log(`✓ ZIP package sent for draft ${req.params.id}`);

    } catch (error) {
      console.error("Error creating draft pack ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP file" });
      }
    }
  });

  // Publish RFT draft to portfolio (creates generatedRft from draft)
  app.post("/api/drafts/:id/publish", async (req, res) => {
    try {
      const draft = await storage.getRftGenerationDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const metadata = (draft.metadata as any) || {};
      const pack = metadata.pack;

      // Verify pack is completed
      if (!pack || pack.status !== "completed") {
        return res.status(400).json({
          error: "RFT pack must be completed before publishing",
          status: pack?.status || "pending",
        });
      }

      // Get business case for RFT name
      const businessCase = await storage.getBusinessCase(draft.businessCaseId);
      const rftName = businessCase?.name 
        ? `${businessCase.name} - RFT` 
        : `RFT ${new Date().toLocaleDateString()}`;

      // Transform draft sections to generatedRft format
      const sections = {
        sections: (draft.generatedSections as any[]).map((s: any) => ({
          sectionId: s.sectionId,
          sectionTitle: s.sectionTitle,
          content: s.content,
          category: s.category,
          assignedTo: s.assignedTo,
        }))
      };

      // Extract blob URLs from pack metadata
      // Pack structure: pack.files.docx.url, pack.files.pdf.url, pack.files.questionnaires.product.url
      const packFiles = pack.files || {};
      
      // Create generatedRft record
      const generatedRft = await storage.createGeneratedRft({
        projectId: draft.projectId,
        businessCaseId: draft.businessCaseId,
        templateId: draft.templateId || "draft-generated",
        name: rftName,
        status: "published",
        sections,
        // Copy all pack file URLs from draft (support both new and legacy structures)
        docxBlobUrl: packFiles.docx?.url || pack.docxBlobUrl,
        pdfBlobUrl: packFiles.pdf?.url || pack.pdfBlobUrl,
        productQuestionnaireBlobUrl: packFiles.questionnaires?.product?.url || pack.productQuestionnaireBlobUrl,
        nfrQuestionnaireBlobUrl: packFiles.questionnaires?.nfr?.url || pack.nfrQuestionnaireBlobUrl,
        cybersecurityQuestionnaireBlobUrl: packFiles.questionnaires?.cybersecurity?.url || pack.cybersecurityQuestionnaireBlobUrl,
        agileQuestionnaireBlobUrl: packFiles.questionnaires?.agile?.url || pack.agileQuestionnaireBlobUrl,
        publishedAt: new Date(),
      });

      console.log(`✅ Draft ${req.params.id} published to portfolio as RFT ${generatedRft.id}`);

      res.json({
        success: true,
        generatedRftId: generatedRft.id,
        portfolioId: (await storage.getProject(draft.projectId))?.portfolioId,
        message: "RFT published to portfolio successfully",
      });
    } catch (error) {
      console.error("Error publishing draft:", error);
      res.status(500).json({ error: "Failed to publish draft to portfolio" });
    }
  });

  // Generate business case with AI
  app.post("/api/business-cases/generate", async (req, res) => {
    try {
      const {
        portfolioId,
        name,
        description,
        projectObjective,
        projectScope,
        timeline,
        budget,
        functionalRequirements,
        nonFunctionalRequirements,
        keyRequirements, // Legacy field for backward compatibility
        successCriteria,
      } = req.body;

      if (!portfolioId || !name || !projectObjective) {
        return res.status(400).json({
          error: "Portfolio ID, name, and project objective are required",
        });
      }

      // Normalize requirements with backward compatibility
      // If new fields provided, use them; otherwise fall back to legacy keyRequirements
      const normalizedFunctionalReqs = functionalRequirements || keyRequirements || "";
      const normalizedNonFunctionalReqs = nonFunctionalRequirements || "";
      
      // Combined requirements for legacy consumers and AI generation
      const combinedRequirements = normalizedFunctionalReqs && normalizedNonFunctionalReqs
        ? `Functional Requirements:\n${normalizedFunctionalReqs}\n\nNon-functional Requirements:\n${normalizedNonFunctionalReqs}`
        : normalizedFunctionalReqs || normalizedNonFunctionalReqs || keyRequirements || "";

      // Generate lean business case with AI
      const { generateLeanBusinessCase } = await import("./services/rft/businessCaseGenerator");
      const generatedContent = await generateLeanBusinessCase({
        projectName: name,
        projectObjective,
        projectScope,
        timeline,
        budget,
        keyRequirements: combinedRequirements, // Pass combined requirements to generator
        successCriteria,
      });

      console.log("📝 Generated business case content length:", generatedContent?.length || 0);
      console.log("📝 Generated business case preview:", generatedContent?.substring(0, 300));

      // Create business case with AI-generated content and store form data in extractedData
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name,
        description: description || null,
        fileName: "AI Generated Business Case.txt",
        documentContent: generatedContent,
        extractedData: {
          projectObjective,
          projectScope,
          timeline,
          budget,
          functionalRequirements: normalizedFunctionalReqs,
          nonFunctionalRequirements: normalizedNonFunctionalReqs,
          requirements: combinedRequirements, // Combined for backward compatibility
          keyRequirements, // Keep legacy field if provided
          successCriteria,
        },
        ragDocumentId: null,
        status: "generated",
      });

      res.json(businessCase);
    } catch (error) {
      console.error("Error generating business case:", error);
      res.status(500).json({ error: "Failed to generate business case" });
    }
  });

  // Upload business case document
  app.post("/api/business-cases/upload", upload.single("document"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { portfolioId, name, description } = req.body;
      if (!portfolioId || !name) {
        return res.status(400).json({ error: "Portfolio ID and name are required" });
      }

      // Parse document
      const parsedDocument = await parseDocument(req.file.buffer, req.file.originalname);

      // Create business case
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name,
        description: description || null,
        fileName: req.file.originalname,
        documentContent: parsedDocument.text,
        extractedData: null,
        ragDocumentId: null,
        status: "uploaded",
      });

      res.json(businessCase);
    } catch (error) {
      console.error("Error uploading business case:", error);
      res.status(500).json({ error: "Failed to upload business case" });
    }
  });

  // Get all business cases
  app.get("/api/business-cases", async (req, res) => {
    try {
      const businessCases = await storage.getAllBusinessCases();
      res.json(businessCases);
    } catch (error) {
      console.error("Error fetching business cases:", error);
      res.status(500).json({ error: "Failed to fetch business cases" });
    }
  });

  // Get business cases by portfolio
  app.get("/api/portfolios/:portfolioId/business-cases", async (req, res) => {
    try {
      const businessCases = await storage.getBusinessCasesByPortfolio(req.params.portfolioId);
      res.json(businessCases);
    } catch (error) {
      console.error("Error fetching business cases:", error);
      res.status(500).json({ error: "Failed to fetch business cases" });
    }
  });

  // Get business case by ID
  app.get("/api/business-cases/:id", async (req, res) => {
    try {
      const businessCase = await storage.getBusinessCase(req.params.id);
      if (!businessCase) {
        return res.status(404).json({ error: "Business case not found" });
      }
      res.json(businessCase);
    } catch (error) {
      console.error("Error fetching business case:", error);
      res.status(500).json({ error: "Failed to fetch business case" });
    }
  });

  // Generate RFT from business case using comprehensive approach
  app.post("/api/generate-rft", async (req, res) => {
    try {
      const { businessCaseId, templateId, projectId } = req.body;

      if (!businessCaseId || !templateId || !projectId) {
        return res.status(400).json({ 
          error: "Business case ID, template ID, and project ID are required" 
        });
      }

      console.log(`🚀 Generating comprehensive RFT for project ${projectId}`);

      // Get business case
      const businessCase = await storage.getBusinessCase(businessCaseId);
      if (!businessCase) {
        return res.status(400).json({ error: "Business case not found" });
      }

      // Get template for metadata
      const template = await storage.getRftTemplate(templateId);
      if (!template) {
        return res.status(400).json({ error: "RFT template not found" });
      }

      // Step 1: Extract business case information
      console.log("📋 Extracting business case information...");
      console.log("📄 Business case document content length:", (businessCase.documentContent || "").length);
      console.log("📄 Business case content preview:", (businessCase.documentContent || "").substring(0, 300));
      const businessCaseExtract = await extractBusinessCaseInfo(
        businessCase.documentContent || ""
      );

      // Step 2: Generate comprehensive 10-section RFT document
      console.log("✍️  Generating comprehensive RFT sections (10 sections with 3-5 paragraphs each)...");
      console.log("📋 Business case extract:", {
        projectName: businessCaseExtract.projectName,
        hasRequirements: !!businessCaseExtract.keyRequirements && businessCaseExtract.keyRequirements.length > 0,
        hasObjectives: !!businessCaseExtract.businessObjective,
        requirementsCount: businessCaseExtract.keyRequirements?.length || 0,
      });
      const sections = await generateProfessionalRftSections(businessCaseExtract, null);
      console.log(`✅ Generated ${sections.length} comprehensive RFT sections`);
      
      // Log first section preview to verify content
      if (sections.length > 0) {
        const firstSection = sections[0];
        const content = Array.isArray(firstSection.content) ? firstSection.content : [];
        const firstParagraph = content.find((c: any) => c.type === 'paragraph')?.text || '';
        if (firstParagraph) {
          console.log(`📝 First section preview (${firstSection.title}):`, firstParagraph.substring(0, 200) + "...");
        }
      }

      // Step 3: Generate all 5 questionnaires with proper question counts
      console.log("📊 Generating questionnaires...");
      const { generateQuestionnaireQuestions, QUESTIONNAIRE_COUNTS } = await import("./services/rft/smartRftService");
      
      const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions, procurementQuestions] = await Promise.all([
        generateQuestionnaireQuestions(businessCaseExtract, "product", QUESTIONNAIRE_COUNTS.product),
        generateQuestionnaireQuestions(businessCaseExtract, "nfr", QUESTIONNAIRE_COUNTS.nfr),
        generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", QUESTIONNAIRE_COUNTS.cybersecurity),
        generateQuestionnaireQuestions(businessCaseExtract, "agile", QUESTIONNAIRE_COUNTS.agile),
        generateQuestionnaireQuestions(businessCaseExtract, "procurement", QUESTIONNAIRE_COUNTS.procurement),
      ]);

      console.log("📝 Creating Excel questionnaire files...");
      const questionnairePaths = await generateAllQuestionnaires(projectId, {
        product: productQuestions,
        nfr: nfrQuestions,
        cybersecurity: cybersecurityQuestions,
        agile: agileQuestions,
        procurement: procurementQuestions,
      });

      console.log("✅ Excel questionnaires created successfully");

      // Create generated RFT record with comprehensive sections
      const generatedRftData: typeof import("@shared/schema").insertGeneratedRftSchema._type = {
        projectId,
        businessCaseId,
        templateId,
        name: `${businessCaseExtract.projectName} - RFT`,
        sections: { sections },
        productQuestionnairePath: questionnairePaths.productPath,
        nfrQuestionnairePath: questionnairePaths.nfrPath,
        cybersecurityQuestionnairePath: questionnairePaths.cybersecurityPath,
        agileQuestionnairePath: questionnairePaths.agilePath,
        procurementQuestionnairePath: questionnairePaths.procurementPath,
        status: "draft",
        version: 1,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: "gpt-4o",
          templateName: template.name,
          businessCaseName: businessCase.name,
          sectionCount: sections.length,
          generationApproach: "comprehensive-professional",
          questionnaireStats: {
            productQuestions: productQuestions.length,
            nfrQuestions: nfrQuestions.length,
            cybersecurityQuestions: cybersecurityQuestions.length,
            agileQuestions: agileQuestions.length,
            procurementQuestions: procurementQuestions.length,
          },
        },
      };

      // Save to database
      const generatedRft = await storage.createGeneratedRft(generatedRftData);

      // Update project status
      await storage.updateProjectStatus(projectId, "rft_generated");

      console.log(`✅ RFT generation complete! Generated ${sections.length} sections with comprehensive content`);
      res.json(generatedRft);
    } catch (error) {
      console.error("Error generating RFT:", error);
      res.status(500).json({ error: "Failed to generate RFT" });
    }
  });

  // Get all generated RFTs
  app.get("/api/generated-rfts", async (req, res) => {
    try {
      const rfts = await storage.getAllGeneratedRfts();
      res.json(rfts);
    } catch (error) {
      console.error("Error fetching all generated RFTs:", error);
      res.status(500).json({ error: "Failed to fetch generated RFTs" });
    }
  });

  // Get generated RFTs by project
  app.get("/api/projects/:projectId/generated-rfts", async (req, res) => {
    try {
      const rfts = await storage.getGeneratedRftsByProject(req.params.projectId);
      res.json(rfts);
    } catch (error) {
      console.error("Error fetching generated RFTs:", error);
      res.status(500).json({ error: "Failed to fetch generated RFTs" });
    }
  });

  // Get generated RFT by ID
  app.get("/api/generated-rfts/:id", async (req, res) => {
    try {
      const rft = await storage.getGeneratedRft(req.params.id);
      if (!rft) {
        return res.status(404).json({ error: "Generated RFT not found" });
      }
      res.json(rft);
    } catch (error) {
      console.error("Error fetching generated RFT:", error);
      res.status(500).json({ error: "Failed to fetch generated RFT" });
    }
  });

  // Update generated RFT
  app.patch("/api/generated-rfts/:id", async (req, res) => {
    try {
      const { sections, status, name } = req.body;
      const updates: any = {};
      
      if (sections) updates.sections = sections;
      if (status) updates.status = status;
      if (name) updates.name = name;

      await storage.updateGeneratedRft(req.params.id, updates);
      
      const updatedRft = await storage.getGeneratedRft(req.params.id);
      res.json(updatedRft);
    } catch (error) {
      console.error("Error updating generated RFT:", error);
      res.status(500).json({ error: "Failed to update generated RFT" });
    }
  });

  // Publish RFT (convert to requirements AND upload files to Azure)
  app.post("/api/generated-rfts/:id/publish", async (req, res) => {
    try {
      const rft = await storage.getGeneratedRft(req.params.id);
      if (!rft) {
        return res.status(404).json({ error: "Generated RFT not found" });
      }

      console.log(`📤 Publishing RFT ${req.params.id} - uploading files to Azure...`);

      // Upload all files to Azure Blob Storage
      const { publishRftFilesToAzure } = await import("./services/rft/smartRftService");
      const azureUrls = await publishRftFilesToAzure(req.params.id);

      console.log(`✅ Files uploaded successfully to Azure Blob Storage`);

      // Update RFT status to published and store Azure blob URLs
      await storage.updateGeneratedRft(req.params.id, {
        status: "published",
        publishedAt: new Date(),
        docxBlobUrl: azureUrls.docxBlobUrl,
        pdfBlobUrl: azureUrls.pdfBlobUrl,
        productQuestionnaireBlobUrl: azureUrls.productQuestionnaireBlobUrl,
        nfrQuestionnaireBlobUrl: azureUrls.nfrQuestionnaireBlobUrl,
        cybersecurityQuestionnaireBlobUrl: azureUrls.cybersecurityQuestionnaireBlobUrl,
        agileQuestionnaireBlobUrl: azureUrls.agileQuestionnaireBlobUrl,
      });

      // Create requirements from RFT sections
      const sections = (rft.sections as any)?.sections || [];
      const allRequirements = [];

      for (const section of sections) {
        const requirement = await storage.createRequirement({
          projectId: rft.projectId,
          documentType: "RFT",
          fileName: `${rft.name} - ${section.title}`,
          extractedData: {
            sectionId: section.sectionId,
            title: section.title,
            content: section.content,
          },
          evaluationCriteria: null,
          standardId: null,
          taggedSections: null,
        });
        allRequirements.push(requirement);
      }

      // Update project status
      await storage.updateProjectStatus(rft.projectId, "published");

      res.json({
        success: true,
        rft: await storage.getGeneratedRft(req.params.id), // Return updated RFT with Azure URLs
        requirementsCreated: allRequirements.length,
        azureUrls, // Include Azure URLs in response
      });
    } catch (error) {
      console.error("Error publishing RFT:", error);
      res.status(500).json({ error: "Failed to publish RFT" });
    }
  });

  // Regenerate specific RFT section
  app.post("/api/generated-rfts/:rftId/sections/:sectionId/regenerate", async (req, res) => {
    try {
      const { rftId, sectionId } = req.params;

      const newSection = await regenerateRftSection(rftId, sectionId);

      // Update the RFT with the new section
      const rft = await storage.getGeneratedRft(rftId);
      if (rft) {
        const sections = (rft.sections as any)?.sections || [];
        const updatedSections = sections.map((s: any) =>
          s.sectionId === sectionId ? newSection : s
        );

        await storage.updateGeneratedRft(rftId, {
          sections: { sections: updatedSections },
        });
      }

      res.json(newSection);
    } catch (error) {
      console.error("Error regenerating RFT section:", error);
      res.status(500).json({ error: "Failed to regenerate section" });
    }
  });

  // Download questionnaire file
  app.get("/api/questionnaires/download/:rftId/:type", async (req, res) => {
    try {
      const { rftId, type } = req.params;
      
      const rft = await storage.getGeneratedRft(rftId);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // Check if Azure blob URL exists (for published RFTs)
      let blobUrl: string | null = null;
      let filePath: string | null = null;
      let fileName = "";
      
      switch (type) {
        case "product":
          blobUrl = rft.productQuestionnaireBlobUrl || null;
          filePath = rft.productQuestionnairePath || null;
          fileName = "Product_Questionnaire.xlsx";
          break;
        case "nfr":
          blobUrl = rft.nfrQuestionnaireBlobUrl || null;
          filePath = rft.nfrQuestionnairePath || null;
          fileName = "NFR_Questionnaire.xlsx";
          break;
        case "cybersecurity":
          blobUrl = rft.cybersecurityQuestionnaireBlobUrl || null;
          filePath = rft.cybersecurityQuestionnairePath || null;
          fileName = "Cybersecurity_Questionnaire.xlsx";
          break;
        case "agile":
          blobUrl = rft.agileQuestionnaireBlobUrl || null;
          filePath = rft.agileQuestionnairePath || null;
          fileName = "Agile_Delivery_Questionnaire.xlsx";
          break;
        default:
          return res.status(400).json({ error: "Invalid questionnaire type" });
      }

      // Serve from Azure if published
      if (blobUrl) {
        console.log(`📥 Serving ${type} questionnaire from Azure: ${blobUrl}`);
        return res.redirect(blobUrl);
      }

      // Otherwise, serve from local filesystem (for unpublished RFTs)
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Questionnaire file not found" });
      }

      console.log(`⚠️ Serving ${type} questionnaire from local file (RFT not yet published)`);

      // Send file
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("Error downloading questionnaire:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
      });
    } catch (error) {
      console.error("Error serving questionnaire:", error);
      res.status(500).json({ error: "Failed to serve questionnaire file" });
    }
  });

  // Download RFT as DOC
  app.get("/api/generated-rfts/:id/download/doc", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // If published, serve from Azure Blob Storage
      if (rft.docxBlobUrl) {
        console.log(`📥 Serving DOCX from Azure: ${rft.docxBlobUrl}`);
        return res.redirect(rft.docxBlobUrl);
      }

      // Otherwise, generate on-the-fly (for unpublished RFTs)
      const sections = (rft.sections as any)?.sections || [];
      if (sections.length === 0) {
        return res.status(400).json({ error: "No sections found in RFT" });
      }

      console.log(`⚠️ Generating DOCX on-the-fly (RFT not yet published)`);

      // Generate DOC file
      const { generateDocxDocument } = await import("./services/rft/documentGenerator");
      const outputPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}.docx`);
      
      await generateDocxDocument({
        projectName: rft.name,
        sections,
        outputPath,
      });

      // Send file and clean up after
      res.download(outputPath, `${rft.name.replace(/[^a-zA-Z0-9]/g, "_")}_RFT.docx`, (err) => {
        if (err) {
          console.error("Error downloading DOC:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error generating DOC:", error);
      res.status(500).json({ error: "Failed to generate DOC file" });
    }
  });

  // Download RFT as PDF
  app.get("/api/generated-rfts/:id/download/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // If published, serve from Azure Blob Storage
      if (rft.pdfBlobUrl) {
        console.log(`📥 Serving PDF from Azure: ${rft.pdfBlobUrl}`);
        return res.redirect(rft.pdfBlobUrl);
      }

      // Otherwise, generate on-the-fly (for unpublished RFTs)
      const sections = (rft.sections as any)?.sections || [];
      if (sections.length === 0) {
        return res.status(400).json({ error: "No sections found in RFT" });
      }

      console.log(`⚠️ Generating PDF on-the-fly (RFT not yet published)`);

      // Generate PDF file
      const { generatePdfDocument } = await import("./services/rft/documentGenerator");
      const outputPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}.pdf`);
      
      await generatePdfDocument({
        projectName: rft.name,
        sections,
        outputPath,
      });

      // Send file and clean up after
      res.download(outputPath, `${rft.name.replace(/[^a-zA-Z0-9]/g, "_")}_RFT.pdf`, (err) => {
        if (err) {
          console.error("Error downloading PDF:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF file" });
    }
  });

  // Download all RFT deliverables as ZIP
  app.get("/api/generated-rfts/:id/download/all", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      const archiver = (await import("archiver")).default;
      const archive = archiver('zip', { zlib: { level: 9 } });

      const sanitizedName = rft.name.replace(/[^a-zA-Z0-9]/g, "_");
      res.attachment(`${sanitizedName}_Complete_RFT_Package.zip`);
      res.setHeader('Content-Type', 'application/zip');

      archive.on('error', (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create ZIP file" });
        }
      });

      archive.pipe(res);

      // Check if RFT was published from draft (has Azure Blob URLs)
      const hasAzureFiles = rft.docxBlobUrl || rft.pdfBlobUrl;
      
      if (hasAzureFiles) {
        console.log(`📦 Downloading RFT files from Azure Blob Storage for: ${rft.name}`);
        
        // Import Azure Blob Storage service
        const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
        
        // Define all 6 files with their blob URLs
        const files = [
          { blobUrl: rft.docxBlobUrl, name: "RFT_Document.docx" },
          { blobUrl: rft.pdfBlobUrl, name: "RFT_Document.pdf" },
          { blobUrl: rft.productQuestionnaireBlobUrl, name: "Product_Questionnaire.xlsx" },
          { blobUrl: rft.nfrQuestionnaireBlobUrl, name: "NFR_Questionnaire.xlsx" },
          { blobUrl: rft.cybersecurityQuestionnaireBlobUrl, name: "Cybersecurity_Questionnaire.xlsx" },
          { blobUrl: rft.agileQuestionnaireBlobUrl, name: "Agile_Delivery_Questionnaire.xlsx" },
        ];
        
        // Download and add each file to the archive
        for (const file of files) {
          if (file.blobUrl) {
            try {
              // Extract blob name from URL
              // URL format: https://intellibidstorage.blob.core.windows.net/intellibid-documents/project-XXX/RFT_Generated/file.docx?sas
              const url = new URL(file.blobUrl.split('?')[0]); // Remove SAS token
              const pathname = url.pathname; // e.g., /intellibid-documents/project-XXX/RFT_Generated/file.docx
              const parts = pathname.split('/').filter(Boolean); // ['intellibid-documents', 'project-XXX', 'RFT_Generated', 'file.docx']
              
              // Skip container name, join the rest
              const blobName = parts.slice(1).join('/'); // project-XXX/RFT_Generated/file.docx
              
              console.log(`📥 Downloading ${file.name} from blob: ${blobName}`);
              
              // Download from Azure
              const buffer = await azureBlobStorageService.downloadDocument(blobName);
              
              // Add to archive
              archive.append(buffer, { name: file.name });
              console.log(`✓ Added ${file.name} to ZIP (${buffer.length} bytes)`);
            } catch (error) {
              console.warn(`⚠️ Could not add ${file.name} to ZIP:`, error);
            }
          }
        }
      } else {
        // Legacy path: Generate documents on-the-fly for RFTs not published from drafts
        console.log(`⚠️ RFT not from draft - generating documents on-the-fly`);
        
        const sections = (rft.sections as any)?.sections || [];
        const tempFiles: string[] = [];
        
        if (sections.length > 0) {
          const { generateDocxDocument, generatePdfDocument } = await import("./services/rft/documentGenerator");
          
          // Generate DOCX
          const docPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}_temp.docx`);
          console.log(`Generating DOCX at: ${docPath}`);
          await generateDocxDocument({
            projectName: rft.name,
            sections,
            outputPath: docPath,
          });
          
          // Verify file exists and has content before adding to archive
          if (fs.existsSync(docPath)) {
            const stats = fs.statSync(docPath);
            console.log(`DOCX file size: ${stats.size} bytes`);
            if (stats.size > 0) {
              archive.file(docPath, { name: `${sanitizedName}_RFT.docx` });
              tempFiles.push(docPath);
            } else {
              console.warn("DOCX file is empty!");
            }
          } else {
            console.warn("DOCX file was not created!");
          }

          // Generate PDF
          const pdfPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}_temp.pdf`);
          console.log(`Generating PDF at: ${pdfPath}`);
          await generatePdfDocument({
            projectName: rft.name,
            sections,
            outputPath: pdfPath,
          });
          
          // Verify file exists and has content before adding to archive
          if (fs.existsSync(pdfPath)) {
            const stats = fs.statSync(pdfPath);
            console.log(`PDF file size: ${stats.size} bytes`);
            if (stats.size > 0) {
              archive.file(pdfPath, { name: `${sanitizedName}_RFT.pdf` });
              tempFiles.push(pdfPath);
            } else {
              console.warn("PDF file is empty!");
            }
          } else {
            console.warn("PDF file was not created!");
          }
        }

        // Add questionnaires from local paths
        const questionnaires = [
          { path: rft.productQuestionnairePath, name: "Product_Questionnaire.xlsx" },
          { path: rft.nfrQuestionnairePath, name: "NFR_Questionnaire.xlsx" },
          { path: rft.cybersecurityQuestionnairePath, name: "Cybersecurity_Questionnaire.xlsx" },
          { path: rft.agileQuestionnairePath, name: "Agile_Delivery_Questionnaire.xlsx" },
        ];

        for (const q of questionnaires) {
          if (q.path && fs.existsSync(q.path)) {
            archive.file(q.path, { name: q.name });
          }
        }
        
        // Clean up temp files after a delay
        setTimeout(() => {
          for (const tempFile of tempFiles) {
            if (fs.existsSync(tempFile)) {
              fs.unlinkSync(tempFile);
            }
          }
        }, 2000);
      }

      // Finalize archive
      await archive.finalize();
      console.log(`✓ ZIP package sent for RFT ${id}`);

    } catch (error) {
      console.error("Error creating ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP file" });
      }
    }
  });

  // Download vendor responses (generates mock data and returns as ZIP)
  app.get("/api/generated-rfts/:id/download-vendor-responses", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      const project = await storage.getProject(rft.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Import Azure Blob Storage service
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      
      // Scope vendor responses to this specific RFT (not project-wide)
      const vendorResponsesPrefix = `project-${project.id}/RFT_Responses/${rft.id}`;
      let blobNames = await azureBlobStorageService.listDocuments(vendorResponsesPrefix);
      
      // If no vendor responses exist for this RFT, generate them
      if (blobNames.length === 0) {
        console.log(`No vendor responses found for RFT ${id}. Generating mock vendor responses...`);
        const { generateVendorResponses } = await import("./services/rft/rftMockDataGenerator");
        await generateVendorResponses(id);
        
        // List again after generation
        blobNames = await azureBlobStorageService.listDocuments(vendorResponsesPrefix);
        
        // Verify vendor responses were created
        if (blobNames.length === 0) {
          return res.status(500).json({ 
            error: "Failed to generate vendor responses. Please try again or contact support." 
          });
        }
        
        console.log(`✓ Generated ${blobNames.length} vendor response files for RFT ${id}`);
      } else {
        console.log(`Found ${blobNames.length} existing vendor response files for RFT ${id}`);
      }

      // Download all files first to verify they exist
      const files: { buffer: Buffer; relativePath: string }[] = [];
      for (const blobName of blobNames) {
        try {
          const buffer = await azureBlobStorageService.downloadDocument(blobName);
          
          // Extract the path relative to the folder prefix to preserve vendor folder structure
          // For example: "project-123/RFT_Responses/rft-456/VendorA/file.xlsx" -> "VendorA/file.xlsx"
          const relativePath = blobName.replace(vendorResponsesPrefix + '/', '');
          
          files.push({ buffer, relativePath });
          console.log(`✓ Downloaded ${relativePath} (${buffer.length} bytes)`);
        } catch (error) {
          console.error(`⚠️ Error downloading file ${blobName}:`, error);
          // Continue with other files instead of failing completely
        }
      }

      // Verify we have at least some files before creating archive
      if (files.length === 0) {
        console.error("No files could be downloaded for vendor responses");
        return res.status(500).json({ 
          error: "Failed to create vendor responses ZIP. No files could be retrieved." 
        });
      }

      // Create ZIP archive AFTER verifying files exist
      const archiver = (await import("archiver")).default;
      const archive = archiver('zip', { zlib: { level: 9 } });

      const sanitizedName = rft.name.replace(/[^a-zA-Z0-9]/g, "_");
      res.attachment(`${sanitizedName}_Vendor_Responses.zip`);
      res.setHeader('Content-Type', 'application/zip');

      // Handle archiver errors and warnings
      archive.on('error', (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create ZIP file" });
        } else {
          // Archive already piped, abort and destroy response
          archive.abort();
          res.destroy();
        }
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn("Archive warning (file not found):", err);
        } else {
          console.error("Archive warning (critical):", err);
          archive.abort();
          res.destroy();
        }
      });

      // Pipe archive to response AFTER setting headers and AFTER verifying files
      archive.pipe(res);
      
      // Add all downloaded files to the archive
      try {
        for (const file of files) {
          archive.append(file.buffer, { name: file.relativePath });
        }

        // Finalize archive
        await archive.finalize();
        console.log(`✓ Vendor responses ZIP package sent for RFT ${id} (${files.length} files)`);
      } catch (error) {
        console.error("Error appending files to archive:", error);
        archive.abort();
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create ZIP file" });
        } else {
          res.destroy();
        }
      }

    } catch (error) {
      console.error("Error creating vendor responses ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create vendor responses ZIP file" });
      }
    }
  });

  // Helper function to trigger project evaluation in the background
  async function triggerProjectEvaluation(projectId: string, rft: any) {
    try {
      console.log(`Starting evaluation for project ${projectId}...`);

      // Check if requirements exist, if not create them from RFT
      let requirements = await storage.getRequirementsByProject(projectId);
      
      if (requirements.length === 0) {
        console.log(`No requirements found, creating from RFT sections...`);
        const sections = (rft.sections as any)?.sections || [];
        const documentText = sections.map((s: any) => s.content).join("\n") || "";
        
        // Analyze the RFT document to extract proper requirement structure
        const requirementAnalysis = await analyzeRequirements(documentText);
        
        const requirement = await storage.createRequirement({
          projectId,
          fileName: `${rft.name}_Requirements.pdf`,
          extractedData: {
            ...requirementAnalysis,
            text: documentText,
            fileName: `${rft.name}_Requirements.pdf`,
          },
          evaluationCriteria: requirementAnalysis.evaluationCriteria.length > 0 
            ? requirementAnalysis.evaluationCriteria 
            : [
                { name: "Technical Fit", weight: 30, description: "Technical capabilities" },
                { name: "Delivery Risk", weight: 25, description: "Implementation risk" },
                { name: "Cost", weight: 20, description: "Total cost of ownership" },
                { name: "Compliance", weight: 15, description: "Regulatory compliance" },
                { name: "Support", weight: 10, description: "Vendor support quality" },
              ],
        });
        requirements = [requirement];
        console.log(`✓ Created requirement from RFT with ${requirementAnalysis.technicalRequirements.length} technical requirements`);
      }

      // Get proposals
      const proposals = await storage.getProposalsByProject(projectId);
      
      if (proposals.length === 0) {
        console.log(`No proposals found, skipping evaluation`);
        return;
      }

      console.log(`Found ${proposals.length} proposals to evaluate`);

      // Use first requirement for evaluation criteria
      const requirementAnalysis = requirements[0].extractedData as any;

      // Check if there's a standard associated with requirements
      let requirementStandardData = null;
      const requirement = requirements[0];
      if (requirement.standardId) {
        const standard = await storage.getStandard(requirement.standardId);
        if (standard && standard.isActive === "true") {
          requirementStandardData = {
            id: standard.id,
            name: standard.name,
            sections: (standard.sections || []) as any,
            taggedSectionIds: (requirement.taggedSections || []) as any,
          };
        }
      }

      // Track if we actually performed any evaluations (vs all being duplicates)
      let evaluationsPerformed = 0;
      
      // Calculate unique vendor count (since each vendor has 4 proposals)
      const uniqueVendors = Array.from(new Set(proposals.map(p => p.vendorName)));
      const totalVendors = uniqueVendors.length;
      
      console.log(`Found ${proposals.length} proposals from ${totalVendors} vendors`);
      
      // Evaluate each proposal
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        console.log(`Evaluating proposal for ${proposal.vendorName}...`);
        
        let proposalAnalysis = proposal.extractedData as any;
        
        // If extractedData is null, create a minimal proposal analysis from proposal metadata
        if (!proposalAnalysis) {
          console.log(`  ⚠️ No extractedData found for ${proposal.vendorName}, creating from metadata...`);
          proposalAnalysis = {
            vendorName: proposal.vendorName,
            technicalApproach: `Vendor response submitted via ${proposal.documentType} questionnaire (${proposal.fileName})`,
            capabilities: [`Submitted ${proposal.documentType} questionnaire`],
            costStructure: "To be determined from questionnaire responses",
            fileName: proposal.fileName,
            documentType: proposal.documentType,
          };
        }
        
        // Determine which standard to use for this proposal
        let proposalStandardData = null;
        
        if (proposal.standardId) {
          if (requirementStandardData && proposal.standardId === requirementStandardData.id) {
            proposalStandardData = {
              ...requirementStandardData,
              taggedSectionIds: proposal.taggedSections || requirementStandardData.taggedSectionIds,
            };
          } else {
            const proposalStandard = await storage.getStandard(proposal.standardId);
            if (proposalStandard && proposalStandard.isActive === "true") {
              proposalStandardData = {
                id: proposalStandard.id,
                name: proposalStandard.name,
                sections: (proposalStandard.sections || []) as any,
                taggedSectionIds: (proposal.taggedSections || []) as any,
              };
            }
          }
        } else if (requirementStandardData) {
          proposalStandardData = requirementStandardData;
        }
        
        // ✅ ATOMIC RACE-SAFE DUPLICATE PREVENTION:
        // Attempt to create placeholder evaluation - database enforces uniqueness on proposalId
        // If conflict detected, wasInserted=false and we skip AI execution
        const { evaluation: placeholderEvaluation, wasInserted } = await storage.createEvaluation({
          projectId,
          proposalId: proposal.id,
          overallScore: 0,
          functionalFit: 0,
          technicalFit: 0,
          deliveryRisk: 0,
          cost: "0",
          compliance: 0,
          status: "in_progress",
          aiRationale: null,
          roleInsights: null,
          detailedScores: null,
          sectionCompliance: null,
          agentDiagnostics: null,
        });
        
        if (!wasInserted) {
          // ✅ ATOMIC DUPLICATE PREVENTION: Evaluation already exists
          // Skip ALL existing evaluations to prevent duplicate AI execution
          // This handles: completed evaluations, concurrent in-progress evaluations, AND stuck evaluations
          // For stuck evaluations: User must use "Re-evaluate" button (Dashboard page)
          // which safely deletes all evaluations before re-triggering
          console.log(`   ⚠️  Evaluation already exists for ${proposal.vendorName} (ID: ${placeholderEvaluation.id}, status: ${placeholderEvaluation.status})`);
          console.log(`   ℹ️  To retry stuck/failed evaluations, use the "Re-evaluate" button on the Dashboard`);
          continue;
        }
        
        // Track that we're performing this evaluation
        evaluationsPerformed++;
        console.log(`   ✅ Created new evaluation ${placeholderEvaluation.id} for vendor ${proposal.vendorName}`);
        
        // Calculate vendor index based on unique vendor position (not proposal index)
        const vendorIndex = uniqueVendors.indexOf(proposal.vendorName);
        
        // Emit progress for this vendor with evaluation ID
        const vendorContext = {
          projectId,
          vendorName: proposal.vendorName,
          vendorIndex: vendorIndex,
          totalVendors: totalVendors,
          evaluationId: placeholderEvaluation.id,
        };
        
        const { evaluation, diagnostics } = await evaluateProposal(
          requirementAnalysis, 
          proposalAnalysis,
          proposalStandardData || undefined,
          vendorContext
        );

        // Update evaluation record with final results
        await storage.updateEvaluation(placeholderEvaluation.id, {
          overallScore: evaluation.overallScore,
          functionalFit: evaluation.functionalFit,
          technicalFit: evaluation.technicalFit,
          deliveryRisk: evaluation.deliveryRisk,
          cost: evaluation.cost,
          compliance: evaluation.compliance,
          status: evaluation.status,
          aiRationale: evaluation.rationale,
          roleInsights: evaluation.roleInsights,
          detailedScores: evaluation.detailedScores,
          sectionCompliance: evaluation.sectionCompliance || null,
          agentDiagnostics: diagnostics || null,
        });

        console.log(`✓ Completed evaluation for ${proposal.vendorName}`);
      }

      // Handle case where no new evaluations were performed (all duplicates)
      if (evaluationsPerformed === 0) {
        console.log(`⚠️  No new evaluations performed (all vendors already have evaluations)`);
        
        // Check if all evaluations are actually completed (terminal states)
        // This handles crash-recovery: evaluations exist but project status wasn't updated
        const allEvaluations = await storage.getEvaluationsByProject(projectId);
        const allCompleted = allEvaluations.length > 0 && allEvaluations.every(
          ev => (ev.status === "recommended" || ev.status === "risk-flagged") && ev.aiRationale != null
        );
        
        if (allCompleted) {
          // All evaluations are completed - update project status (crash recovery)
          console.log(`✓ All ${allEvaluations.length} evaluations are completed, updating project status (crash recovery)`);
          evaluationProgressService.clearProgress(projectId);
          await storage.updateProjectStatus(projectId, "completed");
          
          // Synchronize vendor shortlisting stages
          try {
            const { synchronizeVendorStages } = await import("./services/features/vendorStageService");
            const result = await synchronizeVendorStages(storage, projectId, { evaluatedStage: 7 });
            console.log(`✓ Vendor stages synchronized: ${result.created} created, ${result.updated} updated`);
          } catch (stageError) {
            console.error(`⚠️ Failed to synchronize vendor stages (non-critical):`, stageError);
          }
          
          return;
        } else {
          // Concurrent duplicate or stuck evaluations - exit without changing state
          console.log(`ℹ️  Evaluations are in-progress (concurrent trigger detected). Exiting to avoid interfering with active evaluation.`);
          console.log(`💡 TIP: If evaluations appear stuck, use the "Re-evaluate" button on the Dashboard`);
          return;
        }
      }
      
      // Clear progress for this project (only if we actually did work)
      evaluationProgressService.clearProgress(projectId);
      
      // Update project status to completed
      await storage.updateProjectStatus(projectId, "completed");
      console.log(`✓ Project evaluation completed (${evaluationsPerformed}/${proposals.length} vendors evaluated), status updated to completed`);

      // Synchronize vendor shortlisting stages after evaluations complete
      try {
        const { synchronizeVendorStages } = await import("./services/features/vendorStageService");
        const result = await synchronizeVendorStages(storage, projectId, { evaluatedStage: 7 });
        console.log(`✓ Vendor stages synchronized: ${result.created} created, ${result.updated} updated (${result.vendors.join(', ')})`);
      } catch (stageError) {
        // Log error but don't block evaluation completion
        console.error(`⚠️ Failed to synchronize vendor stages (non-critical):`, stageError);
      }

    } catch (error) {
      console.error(`Error in triggerProjectEvaluation:`, error);
      throw error;
    }
  }

  // Upload vendor responses (ZIP file with vendor folders)
  app.post("/api/generated-rfts/:id/upload-vendor-responses", upload.single("file"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Import adm-zip for extraction
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();

      // Extract vendor structure from ZIP
      // Expected structure: VendorName/questionnaire.xlsx
      const vendorFiles: Map<string, { files: any[] }> = new Map();

      console.log(`📦 Extracting ZIP with ${zipEntries.length} entries`);

      for (const entry of zipEntries) {
        console.log(`  Entry: ${entry.entryName} (isDirectory: ${entry.isDirectory})`);
        
        if (entry.isDirectory || entry.entryName.startsWith("__MACOSX") || entry.entryName.startsWith(".")) {
          console.log(`  Skipping: ${entry.entryName}`);
          continue;
        }
        
        const parts = entry.entryName.split("/").filter(p => p.length > 0);
        console.log(`  Parts after split: ${JSON.stringify(parts)}`);
        
        if (parts.length < 2) {
          console.log(`  Skipping root file: ${entry.entryName}`);
          continue; // Skip root files
        }
        
        // Support nested structures: use the second-to-last part as vendor name
        // This handles both "VendorName/file.xlsx" and "RFT Responses/VendorName/file.xlsx"
        // CRITICAL: Normalize vendor name to prevent duplicates (spaces vs underscores)
        const { normalizeVendorName } = await import("./services/rft/vendorUtils");
        const vendorName = normalizeVendorName(parts[parts.length - 2]);
        const fileName = parts[parts.length - 1];
        
        console.log(`  ✓ Vendor: ${vendorName}, File: ${fileName}`);
        
        if (!vendorFiles.has(vendorName)) {
          vendorFiles.set(vendorName, { files: [] });
        }
        
        vendorFiles.get(vendorName)!.files.push({
          name: fileName,
          data: entry.getData(),
          path: entry.entryName,
        });
      }

      console.log(`📊 Found ${vendorFiles.size} vendors:`);
      for (const [vendorName, { files }] of Array.from(vendorFiles.entries())) {
        console.log(`  - ${vendorName}: ${files.length} files`);
      }

      if (vendorFiles.size === 0) {
        return res.status(400).json({ error: "No vendor folders found in ZIP. Expected structure: VendorName/file.xlsx" });
      }

      // Upload files to Azure Blob Storage and create proposals
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      let uploadedVendorCount = 0;
      const failedUploads: string[] = [];

      for (const [vendorName, { files }] of Array.from(vendorFiles.entries())) {
        let vendorHasSuccessfulUpload = false;
        
        for (const file of files) {
          try {
            // Upload to Azure Blob Storage with project-scoped path
            const blobPath = `project-${rft.projectId}/RFT_Responses/${vendorName}/${file.name}`;
            const uploadResult = await azureBlobStorageService.uploadDocument(
              blobPath,
              file.data
            );

            // Determine document type from file extension
            const documentType = file.name.toLowerCase().includes('product') ? 'product' :
                                 file.name.toLowerCase().includes('nfr') ? 'nfr' :
                                 file.name.toLowerCase().includes('cyber') ? 'cybersecurity' :
                                 file.name.toLowerCase().includes('agile') ? 'agile' : 'other';

            // Create a proposal record for this vendor file
            await storage.createProposal({
              projectId: rft.projectId,
              vendorName,
              documentType,
              fileName: file.name,
              blobUrl: uploadResult.blobUrl,
            });
            
            vendorHasSuccessfulUpload = true;
          } catch (uploadError) {
            console.error(`Failed to upload ${file.name} for ${vendorName}:`, uploadError);
            failedUploads.push(`${vendorName}/${file.name}`);
            // Continue with other files even if one fails
          }
        }
        
        if (vendorHasSuccessfulUpload) {
          uploadedVendorCount++;
        }
      }

      // After successful upload, update project status and trigger evaluation
      if (uploadedVendorCount > 0) {
        // Update project status to eval_in_progress to show progress indicator
        await storage.updateProjectStatus(rft.projectId, "eval_in_progress");
        console.log(`✓ Project status updated to eval_in_progress`);

        // Trigger evaluation process in background (non-blocking)
        // This allows user to close the dialog while evaluation runs
        triggerProjectEvaluation(rft.projectId, rft).catch(async (evaluationError) => {
          console.error("Error during background evaluation:", evaluationError);
          
          // Revert status back to responses_received on failure so user can retry
          try {
            await storage.updateProjectStatus(rft.projectId, "responses_received");
            console.log(`✓ Reverted project status to responses_received after evaluation failure`);
          } catch (revertError) {
            console.error("Failed to revert project status:", revertError);
          }
        });

        console.log(`✓ Background evaluation started for project ${rft.projectId}`);
        
        // Return immediately so user can close dialog
        res.json({
          success: true,
          vendorCount: uploadedVendorCount,
          failedUploads,
          message: `Successfully uploaded responses for ${uploadedVendorCount} vendor(s). Evaluation started in background.`,
          evaluationInProgress: true,
        });
      } else {
        res.json({
          success: true,
          vendorCount: uploadedVendorCount,
          failedUploads,
          message: `Upload completed with ${failedUploads.length} failures.`,
        });
      }

    } catch (error) {
      console.error("Error uploading vendor responses:", error);
      res.status(500).json({ error: "Failed to upload vendor responses" });
    }
  });

  // Re-trigger evaluation for a project (useful after fixing bugs or updating evaluation logic)
  app.post("/api/projects/:id/re-evaluate", async (req, res) => {
    try {
      const projectId = req.params.id;
      
      // Get project and RFT
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get RFT for this project
      const rfts = await storage.getGeneratedRftsByProject(projectId);
      if (rfts.length === 0) {
        return res.status(400).json({ error: "No RFT found for this project" });
      }
      const rft = rfts[0];

      // Delete existing evaluations
      const evaluations = await storage.getEvaluationsByProject(projectId);
      console.log(`🗑️  Deleting ${evaluations.length} existing evaluations...`);
      
      for (const evaluation of evaluations) {
        await storage.deleteEvaluation(evaluation.id);
      }
      console.log(`✓ Deleted existing evaluations`);

      // Update project status to eval_in_progress to show persistent banner
      await storage.updateProjectStatus(projectId, "eval_in_progress");
      console.log(`✓ Project status updated to eval_in_progress`);

      // Trigger evaluation process in background
      triggerProjectEvaluation(projectId, rft).catch(async (evaluationError) => {
        console.error("Error during background re-evaluation:", evaluationError);
        
        // Revert status back to responses_received on failure
        try {
          await storage.updateProjectStatus(projectId, "responses_received");
          console.log(`✓ Reverted project status to responses_received after evaluation failure`);
        } catch (revertError) {
          console.error("Failed to revert project status:", revertError);
        }
      });

      console.log(`✓ Background re-evaluation started for project ${projectId}`);
      
      res.json({
        success: true,
        message: "Re-evaluation started in background. The page will auto-refresh when complete.",
      });

    } catch (error) {
      console.error("Error re-triggering evaluation:", error);
      res.status(500).json({ error: "Failed to re-trigger evaluation" });
    }
  });

  // Server-Sent Events endpoint for real-time evaluation progress
  app.get("/api/projects/:id/evaluation-progress", (req, res) => {
    const projectId = req.params.id;
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    
    console.log(`📡 SSE client connected for project ${projectId}`);
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', projectId })}\n\n`);
    
    // Subscribe to progress updates
    const unsubscribe = evaluationProgressService.subscribe(projectId, (update) => {
      const data = JSON.stringify({ type: 'progress', ...update });
      res.write(`data: ${data}\n\n`);
    });
    
    // Handle client disconnect
    req.on('close', () => {
      console.log(`📡 SSE client disconnected for project ${projectId}`);
      unsubscribe();
    });
  });

  // Executive Summary
  app.get("/api/executive-summary/stats", async (req, res) => {
    try {
      const { createExecutiveSummaryService } = await import("./services/features/executiveSummaryService");
      const executiveSummaryService = createExecutiveSummaryService(storage);
      const stats = await executiveSummaryService.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching executive summary stats:", error);
      res.status(500).json({ error: "Failed to fetch executive summary stats" });
    }
  });

  app.get("/api/executive-summary/stage-distribution", async (req, res) => {
    try {
      const { createExecutiveSummaryService } = await import("./services/features/executiveSummaryService");
      const executiveSummaryService = createExecutiveSummaryService(storage);
      const distribution = await executiveSummaryService.getStageDistribution();
      res.json(distribution);
    } catch (error) {
      console.error("Error fetching stage distribution:", error);
      res.status(500).json({ error: "Failed to fetch stage distribution" });
    }
  });

  app.get("/api/executive-summary/vendor-leaders", async (req, res) => {
    try {
      const { createExecutiveSummaryService } = await import("./services/features/executiveSummaryService");
      const executiveSummaryService = createExecutiveSummaryService(storage);
      const limit = parseInt(req.query.limit as string) || 5;
      const leaders = await executiveSummaryService.getVendorLeaders(limit);
      res.json(leaders);
    } catch (error) {
      console.error("Error fetching vendor leaders:", error);
      res.status(500).json({ error: "Failed to fetch vendor leaders" });
    }
  });

  app.get("/api/executive-summary/recent-activity", async (req, res) => {
    try {
      const { createExecutiveSummaryService } = await import("./services/features/executiveSummaryService");
      const executiveSummaryService = createExecutiveSummaryService(storage);
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await executiveSummaryService.getRecentActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ error: "Failed to fetch recent activity" });
    }
  });

  // Agent Metrics & Observability
  app.get("/api/agent-metrics/summary", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const summary = await agentMetricsService.getSummaryStats();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching agent metrics summary:", error);
      res.status(500).json({ error: "Failed to fetch agent metrics summary" });
    }
  });

  app.get("/api/agent-metrics/agents", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const stats = await agentMetricsService.getAllAgentStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent stats:", error);
      res.status(500).json({ error: "Failed to fetch agent stats" });
    }
  });

  app.get("/api/agent-metrics/agent/:role", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const { role } = req.params;
      const stats = await agentMetricsService.getAgentStats(role);
      if (!stats) {
        return res.status(404).json({ error: "No metrics found for this agent" });
      }
      res.json(stats);
    } catch (error) {
      console.error("Error fetching agent stats:", error);
      res.status(500).json({ error: "Failed to fetch agent stats" });
    }
  });

  app.get("/api/agent-metrics/failures", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const limit = parseInt(req.query.limit as string) || 10;
      const failures = await agentMetricsService.getRecentFailures(limit);
      res.json(failures);
    } catch (error) {
      console.error("Error fetching recent failures:", error);
      res.status(500).json({ error: "Failed to fetch recent failures" });
    }
  });

  app.get("/api/agent-metrics/timeseries", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const limit = parseInt(req.query.limit as string) || 50;
      const data = await agentMetricsService.getTimeSeriesData(limit);
      res.json(data);
    } catch (error) {
      console.error("Error fetching time series data:", error);
      res.status(500).json({ error: "Failed to fetch time series data" });
    }
  });

  app.get("/api/agent-metrics/evaluation/:evaluationId", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const { evaluationId } = req.params;
      const metrics = await agentMetricsService.getEvaluationMetrics(evaluationId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching evaluation metrics:", error);
      res.status(500).json({ error: "Failed to fetch evaluation metrics" });
    }
  });

  app.get("/api/agent-metrics/projects", async (req, res) => {
    try {
      const { agentMetricsService } = await import("./services/core/agentMetrics");
      const projectMetrics = await agentMetricsService.getProjectMetrics();
      res.json(projectMetrics);
    } catch (error) {
      console.error("Error fetching project metrics:", error);
      res.status(500).json({ error: "Failed to fetch project metrics" });
    }
  });

  // Vendor Shortlisting Stages
  app.get("/api/projects/:projectId/vendor-stages", async (req, res) => {
    try {
      const { projectId } = req.params;
      const stages = await storage.getVendorStagesByProject(projectId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching vendor stages:", error);
      res.status(500).json({ error: "Failed to fetch vendor stages" });
    }
  });

  app.post("/api/projects/:projectId/vendor-stages", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { insertVendorShortlistingStageSchema } = await import("@shared/schema");
      
      const validatedData = insertVendorShortlistingStageSchema.parse({
        ...req.body,
        projectId,
      });
      
      const stage = await storage.createVendorStage(validatedData);
      res.json(stage);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating vendor stage:", error);
      res.status(500).json({ error: "Failed to create vendor stage" });
    }
  });

  app.put("/api/vendor-stages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { insertVendorShortlistingStageSchema } = await import("@shared/schema");
      
      // Verify record exists first
      const allStages = await storage.getAllVendorStages();
      const existingStage = allStages.find(s => s.id === id);
      if (!existingStage) {
        return res.status(404).json({ error: "Vendor stage not found" });
      }
      
      // Validate updates with partial schema (exclude id, projectId, vendorName which cannot be changed)
      const updateSchema = insertVendorShortlistingStageSchema.partial().omit({
        projectId: true,
        vendorName: true,
      });
      
      const validatedUpdates = updateSchema.parse(req.body);
      
      await storage.updateVendorStage(id, validatedUpdates);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating vendor stage:", error);
      res.status(500).json({ error: "Failed to update vendor stage" });
    }
  });

  app.delete("/api/vendor-stages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify record exists first
      const allStages = await storage.getAllVendorStages();
      const existingStage = allStages.find(s => s.id === id);
      if (!existingStage) {
        return res.status(404).json({ error: "Vendor stage not found" });
      }
      
      await storage.deleteVendorStage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vendor stage:", error);
      res.status(500).json({ error: "Failed to delete vendor stage" });
    }
  });

  // Seed sample RFT for demonstration
  app.post("/api/seed-sample-rft", async (req, res) => {
    try {
      // Get first portfolio
      const portfolios = await storage.getAllPortfolios();
      if (portfolios.length === 0) {
        return res.status(400).json({ error: "No portfolios found. Please seed portfolios first." });
      }
      const portfolioId = portfolios[0].id;

      // Create a test project
      const project = await storage.createProject({
        portfolioId,
        name: "Sample Cloud Infrastructure Modernization",
        status: "rft_generated",
      });

      // Create a business case
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name: "Cloud Modernization Business Case",
        fileName: "business_case.txt",
        status: "generated",
        documentContent: `# Executive Summary\n\nThis business case outlines the strategic initiative to modernize our legacy infrastructure by migrating to cloud-native technologies.\n\n## Business Objectives\n\n- Reduce operational costs by 40%\n- Improve system reliability and uptime to 99.99%\n- Enable rapid scaling for seasonal demand`,
      });

      // Create generated RFT with markdown examples
      const generatedRft = await storage.createGeneratedRft({
        projectId: project.id,
        businessCaseId: businessCase.id,
        name: "Cloud Infrastructure Modernization RFT",
        templateId: "default-template",
        status: "draft",
        sections: {
          sections: [
            {
              id: "1",
              title: "Executive Summary",
              content: "This Request for Technology (RFT) seeks proposals from qualified vendors to support our cloud infrastructure modernization initiative. We are looking for a comprehensive solution that includes **migration strategy**, *security implementation*, and ongoing support.",
            },
            {
              id: "2",
              title: "Project Overview",
              content: "**Objective**: Modernize legacy infrastructure through cloud migration\n\n**Timeline**: 12-month implementation\n\n**Budget**: $2M - $3M\n\n### Key Deliverables\n\n- Complete infrastructure assessment\n- Migration roadmap and strategy\n- Implementation and deployment\n- Training and knowledge transfer",
            },
            {
              id: "3",
              title: "Technical Requirements",
              content: "## Infrastructure Requirements\n\n- Multi-region deployment capability\n- Auto-scaling and load balancing\n- Database migration tools and services\n- Monitoring and observability platform\n\n## Security Requirements\n\n1. ISO 27001 certification\n2. SOC 2 Type II compliance\n3. Encryption at rest and in transit\n4. Identity and access management (IAM)\n\n## Performance Requirements\n\n| Metric | Target | Measurement |\n|--------|--------|-------------|\n| Uptime | 99.99% | Monthly |\n| Response Time | < 1s | p95 |\n| Throughput | 10k req/s | Peak load |",
            },
          ],
        },
      });

      res.json({
        success: true,
        message: "Sample RFT created successfully",
        rft: generatedRft,
      });
    } catch (error) {
      console.error("Error creating sample RFT:", error);
      res.status(500).json({ error: "Failed to create sample RFT" });
    }
  });

  // Diagnostic endpoint for Azure Blob Storage connectivity
  app.get("/api/health/azure-storage", async (req, res) => {
    try {
      const { azureBlobStorageService } = await import("./services/azure/azureBlobStorage");
      
      // Test initialization
      await azureBlobStorageService.initialize();
      
      // Test listing documents (lightweight operation)
      const documents = await azureBlobStorageService.listDocuments();
      
      res.json({
        status: "connected",
        message: "Azure Blob Storage is properly configured and accessible",
        containerName: "intellibid-documents",
        documentCount: documents.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Azure Storage health check failed:", errorMessage);
      
      res.status(503).json({
        status: "error",
        message: "Azure Blob Storage connectivity failed",
        error: errorMessage,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          step1: "Verify AZURE_STORAGE_CONNECTION_STRING is set in environment variables or Admin Config",
          step2: "Check connection string format: DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=...",
          step3: "Verify storage account exists and key hasn't been rotated",
          step4: "Ensure storage account has proper permissions and isn't firewalled"
        }
      });
    }
  });

  // Health check endpoint for Azure App Service and Docker health checks
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development"
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
