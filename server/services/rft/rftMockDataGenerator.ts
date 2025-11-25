import { storage } from "../../storage";
import { azureBlobStorageService } from "../azure/azureBlobStorage";
import { generateQuestionnaireQuestions, QUESTIONNAIRE_COUNTS } from "./smartRftService";
import { generateAllQuestionnaires } from "./excelGenerator";
import { generateDocxDocument, generatePdfDocument } from "./documentGenerator";
import { generateVendorProposal, formatProposalAsDocument } from "./vendorProposalGenerator";
import { normalizeVendorName, deduplicateVendors } from "./vendorUtils";
import { getOpenAIClient } from "../ai/aiAnalysis";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

/**
 * Recursively search for objective-like fields in extractedData
 * Looks for keys containing 'objective', 'goal', 'overview', 'description', etc.
 */
function extractBusinessObjectiveFromData(data: any, depth: number = 0): string {
  if (!data || depth > 5) return ""; // Limit recursion depth
  
  // If it's a string, check if it looks like an objective (non-empty, reasonable length)
  const trimmed = typeof data === 'string' ? data.trim() : '';
  if (trimmed.length > 10 && trimmed.length < 2000) {
    return trimmed;
  }
  
  // If it's an array, try all elements (not just first)
  if (Array.isArray(data) && data.length > 0) {
    for (const item of data) {
      if (typeof item === 'string' && item.trim().length > 10 && item.trim().length < 2000) {
        return item.trim();
      }
      const result = extractBusinessObjectiveFromData(item, depth + 1);
      if (result && result.length > 10) return result;
    }
    return "";
  }
  
  // If it's an object, search for objective-like keys
  if (typeof data === 'object' && data !== null) {
    // Priority keys to check first - comprehensive list covering various structures
    const priorityKeys = [
      'businessObjective', 'objective', 'objectives', 'goal', 'goals',
      'projectObjective', 'projectDescription', 'description',
      'overview', 'projectOverview', 'summary', 'synopsis',
      'projectSummary', 'businessSummary', 'summarySection',
      'businessNeed', 'need', 'needs', 'mission', 'purpose', 'vision',
      'initiative', 'initiativeDescription', 'scope', 'projectScope',
      'executiveSummary', 'content', 'text', 'body'
    ];
    
    // Check priority keys first
    for (const key of priorityKeys) {
      if (data[key]) {
        const result = extractBusinessObjectiveFromData(data[key], depth + 1);
        if (result && result.length > 10) return result;
      }
    }
    
    // Define keywords to match in key names
    const matchKeywords = [
      'objective', 'goal', 'overview', 'description', 'summary',
      'need', 'mission', 'purpose', 'vision', 'initiative', 'scope'
    ];
    
    // Then check nested objects with fuzzy matching
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      for (const keyword of matchKeywords) {
        if (keyLower.includes(keyword)) {
          const result = extractBusinessObjectiveFromData(value, depth + 1);
          if (result && result.length > 10) return result;
          break;
        }
      }
    }
  }
  
  return "";
}

/**
 * Fetch top 3 market-relevant vendors for a given business objective using AI
 * Reuses the vendor intelligence logic from /api/vendor-intel endpoint
 */
async function fetchTopVendorsForObjective(businessObjective: string): Promise<string[]> {
  // Generic enterprise technology vendors as fallback (not aviation-specific)
  const fallbackVendors = ["Oracle Corporation", "SAP SE", "Microsoft"];
  
  if (!businessObjective || businessObjective.length < 10) {
    console.log("Business objective too short, using generic enterprise vendors");
    return fallbackVendors;
  }
  
  try {
    const openai = await getOpenAIClient();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a procurement research analyst specializing in enterprise software and the aviation/airline industry. Your task is to identify real vendors that are market leaders for the given business requirement. Only include actual companies that exist - never make up fictional vendors.`
        },
        {
          role: "user",
          content: `For the following business objective, identify the TOP 3 market-leading vendors/companies that provide solutions:

"${businessObjective}"

Focus on established vendors with strong market presence. Prioritize:
1. Global market leaders with proven track record
2. Companies with enterprise-grade solutions
3. Vendors commonly seen in aviation/airline RFT responses

Return ONLY a JSON object with a "vendors" array containing exactly 3 company names (exact legal names):
{
  "vendors": ["Company Name 1", "Company Name 2", "Company Name 3"]
}

Only return real companies. If the objective is aviation-specific, include relevant airline technology vendors.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("No response from OpenAI for vendor lookup, using fallback vendors");
      return fallbackVendors;
    }

    const parsed = JSON.parse(content);
    const vendors = parsed.vendors || parsed.Vendors || [];
    
    if (Array.isArray(vendors) && vendors.length >= 3) {
      console.log(`✓ Fetched top 3 market vendors for objective: ${vendors.join(", ")}`);
      return vendors.slice(0, 3);
    }
    
    console.warn("Invalid vendor response from AI, using fallback vendors");
    return fallbackVendors;
  } catch (error) {
    console.error("Error fetching market vendors:", error);
    return fallbackVendors;
  }
}

// RFT topic configurations
const RFT_TOPICS = {
  "pss-upgrade": {
    title: "Passenger Service System Upgrade",
    description: "Modern PSS platform with NDC capabilities and mobile experience",
    portfolioName: "Passenger Services & CX",
    requirements: [
      "Cloud-native architecture with microservices",
      "NDC/ONE Order compliance",
      "Mobile-first passenger experience",
      "Real-time inventory management",
      "Advanced revenue management"
    ],
    vendors: ["Amadeus IT Group", "Sabre Corporation", "SITA"]
  },
  "loyalty-platform": {
    title: "Loyalty Platform Modernization",
    description: "Next-gen frequent flyer program with personalization",
    portfolioName: "Passenger Services & CX",
    requirements: [
      "Personalized offers engine",
      "Digital wallet integration",
      "Gamification features",
      "Partner ecosystem management",
      "Real-time points accrual"
    ],
    vendors: ["Loylogic", "Comarch", "IBS Software"]
  },
  "mobile-app": {
    title: "Mobile App Development",
    description: "iOS/Android app for booking and flight updates",
    portfolioName: "Digital & Technology",
    requirements: [
      "Native iOS and Android apps",
      "Real-time flight status",
      "Mobile check-in and boarding pass",
      "Push notifications",
      "Offline capability"
    ],
    vendors: ["Accenture", "Infosys", "TCS"]
  },
  "revenue-management": {
    title: "Revenue Management System",
    description: "AI-powered pricing and yield optimization",
    portfolioName: "Network Planning & Revenue",
    requirements: [
      "Machine learning price optimization",
      "Demand forecasting",
      "Competitive intelligence",
      "Dynamic pricing rules",
      "What-if scenario analysis"
    ],
    vendors: ["Sabre AirVision", "Amadeus Revenue Management", "IDeaS"]
  },
  "crew-management": {
    title: "Crew Management System",
    description: "Integrated crew scheduling and compliance",
    portfolioName: "Flight Operations",
    requirements: [
      "Automated crew scheduling",
      "Training management",
      "Fatigue risk management",
      "Regulatory compliance tracking",
      "Mobile crew app"
    ],
    vendors: ["Aims", "Lufthansa Systems NetLine", "IBS iFlight"]
  },
  "maintenance-tracking": {
    title: "Aircraft Maintenance Tracking",
    description: "Predictive maintenance and MRO management",
    portfolioName: "Aircraft Maintenance & Engineering",
    requirements: [
      "Predictive maintenance analytics",
      "Work order management",
      "Parts inventory tracking",
      "Airworthiness compliance",
      "Integration with aircraft systems"
    ],
    vendors: ["GE Digital", "Airbus Skywise", "Boeing Toolbox"]
  },
  "baggage-handling": {
    title: "Baggage Handling System",
    description: "RFID-enabled baggage tracking",
    portfolioName: "Ground Services & Cargo",
    requirements: [
      "RFID bag tracking",
      "Automated sorting",
      "Real-time passenger notifications",
      "Mishandled baggage resolution",
      "Integration with airport systems"
    ],
    vendors: ["SITA WorldTracer", "Rockwell Collins ARINC", "Amadeus Altéa"]
  },
  "ancillary-revenue": {
    title: "Ancillary Revenue Platform",
    description: "Dynamic pricing for ancillary services",
    portfolioName: "Network Planning & Revenue",
    requirements: [
      "Seat selection and upsell",
      "Meal pre-ordering",
      "Baggage pricing optimization",
      "Upgrade auctions",
      "Bundling and packages"
    ],
    vendors: ["Datalex", "Accelya", "IBS iFly Res"]
  },
  "data-analytics": {
    title: "Enterprise Data Analytics Platform",
    description: "Big data analytics for operational insights",
    portfolioName: "Digital & Technology",
    requirements: [
      "Real-time data processing",
      "Customer intelligence",
      "Operational dashboards",
      "Predictive analytics",
      "Self-service BI tools"
    ],
    vendors: ["Tableau", "Databricks", "Snowflake"]
  },
  "cybersecurity": {
    title: "Cybersecurity Operations Center",
    description: "24/7 SOC with threat intelligence",
    portfolioName: "Safety & Compliance",
    requirements: [
      "24/7 security monitoring",
      "Threat intelligence feeds",
      "Incident response automation",
      "Vulnerability management",
      "Compliance reporting"
    ],
    vendors: ["IBM Security", "CrowdStrike", "Palo Alto Networks"]
  }
};

export async function generateRft(topicId: string) {
  const topic = RFT_TOPICS[topicId as keyof typeof RFT_TOPICS];
  if (!topic) {
    throw new Error("Invalid topic ID");
  }

  // Get portfolio by name from topic
  const portfolios = await storage.getAllPortfolios();
  let portfolio = portfolios.find(p => p.name === topic.portfolioName);
  if (!portfolio) {
    // Create portfolio if it doesn't exist
    portfolio = await storage.createPortfolio({
      name: topic.portfolioName,
      description: `Portfolio for ${topic.portfolioName}`,
    });
  }

  // Create project
  const project = await storage.createProject({
    portfolioId: portfolio.id,
    name: topic.title,
    initiativeName: `Emirates Airlines ${topic.title} Initiative`,
    vendorList: topic.vendors,
    status: "draft",
  });

  // Create business case
  const businessCase = await storage.createBusinessCase({
    portfolioId: portfolio.id,
    name: topic.title,
    description: topic.description,
    fileName: `${topic.title}_BusinessCase.txt`,
    status: "approved",
    extractedData: { objectives: topic.requirements.join("\n") }
  });

  // Generate RFT sections
  const sections = topic.requirements.map((req, index) => ({
    id: `section-${index + 1}`,
    title: `Requirement ${index + 1}`,
    content: req,
    order: index + 1
  }));

  // Create generated RFT
  const generatedRft = await storage.createGeneratedRft({
    projectId: project.id,
    businessCaseId: businessCase.id,
    name: topic.title,
    templateId: "default",
    status: "published",
    sections: { sections },
  });

  return {
    rftId: generatedRft.id,
    projectId: project.id,
    portfolioId: portfolio.id,
    name: topic.title,
    vendorCount: topic.vendors.length,
  };
}

export async function generateRftPack(rftId: string) {
  const rfts = await storage.getAllGeneratedRfts();
  const rft = rfts.find(r => r.id === rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const businessCase = rft.businessCaseId ? await storage.getBusinessCase(rft.businessCaseId) : null;
  
  // Extract business case information for AI generation
  const businessCaseExtract = {
    projectName: rft.name,
    businessObjective: businessCase?.documentContent || `Modernize ${rft.name} for improved efficiency and customer experience`,
    scope: `Full implementation of ${rft.name} across all airline operations`,
    keyRequirements: (rft.sections as any)?.sections?.map((s: any) => s.content).filter(Boolean) || [
      "Cloud-native architecture",
      "Scalable and secure platform",
      "Industry compliance",
      "Vendor support"
    ],
    budget: "To be determined based on vendor proposals",
    timeline: "12-18 months",
    stakeholders: ["IT Department", "Operations Team", "Executive Leadership"],
    risks: ["Implementation delays", "Budget overruns", "Integration challenges"],
    successCriteria: ["On-time delivery", "Budget adherence", "User adoption"]
  };

  console.log(`Generating AI-powered questionnaires for: ${rft.name}`);

  // Generate all 5 questionnaires using AI with centralized counts
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions, procurementQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", QUESTIONNAIRE_COUNTS.product),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", QUESTIONNAIRE_COUNTS.nfr),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", QUESTIONNAIRE_COUNTS.cybersecurity),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", QUESTIONNAIRE_COUNTS.agile),
    generateQuestionnaireQuestions(businessCaseExtract, "procurement", QUESTIONNAIRE_COUNTS.procurement),
  ]);

  console.log("Generated questionnaires, creating Excel files...");

  // Generate Excel files
  const questionnairePaths = await generateAllQuestionnaires(project.id, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
    procurement: procurementQuestions,
  });

  console.log("Generating professional RFT document content using AI...");

  // Generate professional RFT sections using AI
  const { generateProfessionalRftSections } = await import("./smartRftService");
  const professionalSections = await generateProfessionalRftSections(businessCaseExtract);
  
  const rftSections = professionalSections.map((s, index) => ({
    sectionId: s.sectionId || `section-${index + 1}`,
    title: s.title || `Section ${index + 1}`,
    content: s.content || ""
  }));

  console.log(`Generated ${rftSections.length} professional RFT sections`);

  // Generate DOCX
  const docxFileName = `${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT_${Date.now()}.docx`;
  const docxPath = await generateDocxDocument({
    projectName: rft.name,
    sections: rftSections,
    outputPath: path.join(process.cwd(), 'uploads', docxFileName)
  });
  const docxBuffer = fs.readFileSync(docxPath);

  // Generate PDF
  const pdfFileName = `${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT_${Date.now()}.pdf`;
  const pdfPath = await generatePdfDocument({
    projectName: rft.name,
    sections: rftSections,
    outputPath: path.join(process.cwd(), 'uploads', pdfFileName)
  });
  const pdfBuffer = fs.readFileSync(pdfPath);

  console.log("Uploading individual files to Azure Blob Storage...");

  // Upload all files individually to Azure Blob Storage
  const uploadPromises = [
    // Upload RFT document (DOCX)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.docx`,
      docxBuffer
    ),
    // Upload RFT document (PDF)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.pdf`,
      pdfBuffer
    ),
    // Upload Product Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Product_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.productPath)
    ),
    // Upload NFR Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/NFR_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.nfrPath)
    ),
    // Upload Cybersecurity Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Cybersecurity_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.cybersecurityPath)
    ),
    // Upload Agile Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Agile_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.agilePath)
    ),
  ];
  
  // Upload Procurement Questionnaire if it exists
  if (questionnairePaths.procurementPath) {
    uploadPromises.push(
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/Procurement_Questionnaire.xlsx`,
        fs.readFileSync(questionnairePaths.procurementPath)
      )
    );
  }
  
  const uploadResults = await Promise.all(uploadPromises);
  
  console.log(`Uploaded ${uploadResults.length} files to Azure Blob Storage successfully`);

  // Clean up temporary files
  try {
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(questionnairePaths.productPath);
    fs.unlinkSync(questionnairePaths.nfrPath);
    fs.unlinkSync(questionnairePaths.cybersecurityPath);
    fs.unlinkSync(questionnairePaths.agilePath);
    if (questionnairePaths.procurementPath) {
      fs.unlinkSync(questionnairePaths.procurementPath);
    }
  } catch (error) {
    console.error("Error cleaning up temporary files:", error);
  }

  console.log("RFT Pack generation complete!");

  return {
    success: true,
    rftId: rft.id,
    filesCount: 6,
    folder: `project-${project.id}/RFT Generated`,
    files: [
      `${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.docx`,
      `${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT.pdf`,
      'Product_Questionnaire.xlsx',
      'NFR_Questionnaire.xlsx',
      'Cybersecurity_Questionnaire.xlsx',
      'Agile_Questionnaire.xlsx'
    ]
  };
}

export async function generateVendorResponses(rftId: string) {
  const rfts = await storage.getAllGeneratedRfts();
  const rft = rfts.find(r => r.id === rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // Get business objective from project or business case for vendor lookup
  let businessObjective = (project as any).businessObjective || "";
  
  // If no business objective in project, try to get it from business case
  if (!businessObjective && project.businessCaseId) {
    try {
      const businessCase = await storage.getBusinessCase(project.businessCaseId);
      if (businessCase) {
        // Use recursive extraction to find objective in any nested structure
        businessObjective = extractBusinessObjectiveFromData(businessCase.extractedData);
        
        // If still empty, try to extract from documentContent (first paragraph)
        if (!businessObjective && businessCase.documentContent) {
          // Get first paragraph or first 300 chars, whichever is shorter
          const firstNewline = businessCase.documentContent.indexOf('\n\n');
          const endIndex = firstNewline > 50 ? Math.min(firstNewline, 500) : 300;
          businessObjective = businessCase.documentContent.substring(0, endIndex).trim();
        }
      }
    } catch (err) {
      console.warn("Could not fetch business case for objective:", err);
    }
  }
  
  // Fallback to project name if still no objective
  if (!businessObjective || businessObjective.trim().length < 10) {
    businessObjective = `${project.name} - Enterprise solution for aviation industry`;
  }
  
  console.log(`Business objective for vendor lookup: "${businessObjective.substring(0, 100)}..."`)

  // Use project vendorList if available, otherwise fetch market-relevant vendors using AI
  let rawVendors: string[];
  if (project.vendorList && project.vendorList.length > 0) {
    rawVendors = project.vendorList.slice(0, 3);
    console.log(`Using project's predefined vendor list: ${rawVendors.join(", ")}`);
  } else {
    console.log(`Fetching top 3 market vendors for: "${businessObjective.substring(0, 100)}..."`);
    rawVendors = await fetchTopVendorsForObjective(businessObjective);
  }
  
  // CRITICAL: Normalize and deduplicate vendor names to prevent duplicate proposals
  const vendors = deduplicateVendors(rawVendors);
  
  console.log(`Generating vendor responses using actual RFT questionnaires for ${vendors.length} vendors:`, vendors);
  
  // Download original questionnaires from Azure Blob Storage with fallback to fresh generation
  // IMPORTANT: Use underscores instead of spaces to match upload paths
  const questionnairePaths = {
    product: `project-${project.id}/RFT_Generated/Product_Questionnaire.xlsx`,
    nfr: `project-${project.id}/RFT_Generated/NFR_Questionnaire.xlsx`,
    cybersecurity: `project-${project.id}/RFT_Generated/Cybersecurity_Questionnaire.xlsx`,
    agile: `project-${project.id}/RFT_Generated/Agile_Questionnaire.xlsx`,
    procurement: `project-${project.id}/RFT_Generated/Procurement_Questionnaire.xlsx`,
  };
  
  // Try to download questionnaires from Azure, fallback to generating fresh ones if not found
  let productBuffer: Buffer, nfrBuffer: Buffer, cybersecurityBuffer: Buffer, agileBuffer: Buffer, procurementBuffer: Buffer | null;
  
  try {
    console.log("Attempting to download questionnaires from Azure Blob Storage...");
    const downloadResults = await Promise.all([
      azureBlobStorageService.downloadDocument(questionnairePaths.product),
      azureBlobStorageService.downloadDocument(questionnairePaths.nfr),
      azureBlobStorageService.downloadDocument(questionnairePaths.cybersecurity),
      azureBlobStorageService.downloadDocument(questionnairePaths.agile),
      azureBlobStorageService.downloadDocument(questionnairePaths.procurement).catch(() => null), // Procurement optional
    ]);
    [productBuffer, nfrBuffer, cybersecurityBuffer, agileBuffer, procurementBuffer] = downloadResults;
    console.log("Successfully downloaded questionnaires from Azure Blob Storage");
  } catch (downloadError: any) {
    console.warn("Failed to download questionnaires from Azure Blob Storage, generating fresh ones:", downloadError.message);
    
    // Generate fresh questionnaires as fallback using the same logic as RFT pack generation
    console.log("Generating fresh questionnaires for fallback...");
    
    // Create business case extract from project data
    const businessCaseExtract = {
      projectName: project.name,
      businessObjective: project.businessObjective || "Deliver a comprehensive solution to meet organizational needs",
      scope: project.scope || "Complete implementation with all necessary features and integration",
      timeline: "12-18 months",
      stakeholders: ["IT Department", "Operations Team", "Executive Leadership"],
      risks: ["Implementation delays", "Budget overruns", "Integration challenges"],
      successCriteria: ["On-time delivery", "Budget adherence", "User adoption"]
    };
    
    const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions, procurementQuestions] = await Promise.all([
      generateQuestionnaireQuestions(businessCaseExtract, "product", QUESTIONNAIRE_COUNTS.product),
      generateQuestionnaireQuestions(businessCaseExtract, "nfr", QUESTIONNAIRE_COUNTS.nfr),
      generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", QUESTIONNAIRE_COUNTS.cybersecurity),
      generateQuestionnaireQuestions(businessCaseExtract, "agile", QUESTIONNAIRE_COUNTS.agile),
      generateQuestionnaireQuestions(businessCaseExtract, "procurement", QUESTIONNAIRE_COUNTS.procurement),
    ]);
    
    // Use the imported generateAllQuestionnaires from excelGenerator (top of file)
    const freshQuestionnairePaths = await generateAllQuestionnaires(project.id, {
      product: productQuestions,
      nfr: nfrQuestions,
      cybersecurity: cybersecurityQuestions,
      agile: agileQuestions,
      procurement: procurementQuestions,
    });
    
    // Read the freshly generated files
    productBuffer = fs.readFileSync(freshQuestionnairePaths.productPath);
    nfrBuffer = fs.readFileSync(freshQuestionnairePaths.nfrPath);
    cybersecurityBuffer = fs.readFileSync(freshQuestionnairePaths.cybersecurityPath);
    agileBuffer = fs.readFileSync(freshQuestionnairePaths.agilePath);
    procurementBuffer = freshQuestionnairePaths.procurementPath ? fs.readFileSync(freshQuestionnairePaths.procurementPath) : null;
    
    // Clean up temporary files
    try {
      fs.unlinkSync(freshQuestionnairePaths.productPath);
      fs.unlinkSync(freshQuestionnairePaths.nfrPath);
      fs.unlinkSync(freshQuestionnairePaths.cybersecurityPath);
      fs.unlinkSync(freshQuestionnairePaths.agilePath);
      if (freshQuestionnairePaths.procurementPath) {
        fs.unlinkSync(freshQuestionnairePaths.procurementPath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temporary questionnaire files:", cleanupError);
    }
    
    console.log("Successfully generated fresh questionnaires as fallback");
  }
  
  // Create vendor profiles with varied strengths
  const { createVendorProfiles, fillQuestionnaireWithScores, fillProcurementQuestionnaireWithCosts } = await import("./excelQuestionnaireHandler");
  const vendorProfiles = createVendorProfiles(vendors);
  
  // Fetch existing proposals once before the loop for efficiency
  const existingProposals = await storage.getProposalsByProject(project.id);
  
  // Generate responses for each vendor
  for (let i = 0; i < vendors.length; i++) {
    const vendorName = vendors[i];
    const profile = vendorProfiles[i];
    
    console.log(`Generating responses for ${vendorName} with profile: Product ${profile.productStrength}, NFR ${profile.nfrStrength}, Security ${profile.cybersecurityStrength}, Agile ${profile.agileStrength}, Procurement ${profile.procurementStrength}`);
    
    // Fill questionnaires with vendor-specific scores
    const fillPromises: Promise<Buffer>[] = [
      fillQuestionnaireWithScores(productBuffer, profile, "Product"),
      fillQuestionnaireWithScores(nfrBuffer, profile, "NFR"),
      fillQuestionnaireWithScores(cybersecurityBuffer, profile, "Cybersecurity"),
      fillQuestionnaireWithScores(agileBuffer, profile, "Agile"),
    ];
    
    const fillResults = await Promise.all(fillPromises);
    const [productResponse, nfrResponse, securityResponse, agileResponse] = fillResults;
    
    // Fill procurement questionnaire with cost data (separate handling for multi-sheet Excel)
    // Returns both buffer and cost summary for database storage
    let procurementResponse: Buffer | null = null;
    let procurementCostSummary: { 
      year1Total: number; year2Total: number; year3Total: number; 
      year4Total: number; year5Total: number; tcoTotal: number; 
      formatted: string; pricingTier: string 
    } | null = null;
    if (procurementBuffer) {
      const procurementResult = await fillProcurementQuestionnaireWithCosts(procurementBuffer, vendorName);
      procurementResponse = procurementResult.buffer;
      procurementCostSummary = procurementResult.costSummary;
      console.log(`  💰 Cost summary for ${vendorName}: ${procurementCostSummary.formatted}`);
    }

    // Upload filled questionnaires to Azure Blob Storage
    // Use underscores for consistency and avoid encoding issues
    // Scope responses to specific RFT to avoid mixing responses from different RFTs
    const vendorPathSafe = vendorName.replace(/[^a-zA-Z0-9]/g, '_');
    const uploadPromises = [
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${rftId}/${vendorPathSafe}/Product_Response.xlsx`,
        productResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${rftId}/${vendorPathSafe}/NFR_Response.xlsx`,
        nfrResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${rftId}/${vendorPathSafe}/Cybersecurity_Response.xlsx`,
        securityResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${rftId}/${vendorPathSafe}/Agile_Response.xlsx`,
        agileResponse
      ),
    ];
    
    // Upload procurement response if available
    if (procurementResponse) {
      uploadPromises.push(
        azureBlobStorageService.uploadDocument(
          `project-${project.id}/RFT_Responses/${rftId}/${vendorPathSafe}/Procurement_Response.xlsx`,
          procurementResponse
        )
      );
    }
    
    const uploadResults = await Promise.all(uploadPromises);
    const [productUpload, nfrUpload, securityUpload, agileUpload] = uploadResults;
    const procurementUpload = procurementResponse ? uploadResults[4] : null;
    
    // Create proposal database records for each questionnaire response
    // Check per documentType to avoid duplicate key errors but allow partial completion
    const existingVendorProposals = existingProposals.filter(p => p.vendorName === vendorName);
    
    const proposalConfigs = [
      {
        documentType: "product",
        fileName: "Product_Response.xlsx",
        blobUrl: productUpload.blobUrl,
        extractedData: { type: "product-questionnaire-response" },
      },
      {
        documentType: "nfr",
        fileName: "NFR_Response.xlsx",
        blobUrl: nfrUpload.blobUrl,
        extractedData: { type: "nfr-questionnaire-response" },
      },
      {
        documentType: "cybersecurity",
        fileName: "Cybersecurity_Response.xlsx",
        blobUrl: securityUpload.blobUrl,
        extractedData: { type: "cybersecurity-questionnaire-response" },
      },
      {
        documentType: "agile",
        fileName: "Agile_Response.xlsx",
        blobUrl: agileUpload.blobUrl,
        extractedData: { type: "agile-questionnaire-response" },
      },
    ];
    
    // Add procurement proposal if available - includes cost summary for Cost-Benefit Analysis
    if (procurementUpload) {
      proposalConfigs.push({
        documentType: "procurement",
        fileName: "Procurement_Response.xlsx",
        blobUrl: procurementUpload.blobUrl,
        extractedData: { 
          type: "procurement-questionnaire-response",
          costSummary: procurementCostSummary ? {
            year1Total: procurementCostSummary.year1Total,
            year2Total: procurementCostSummary.year2Total,
            year3Total: procurementCostSummary.year3Total,
            year4Total: procurementCostSummary.year4Total,
            year5Total: procurementCostSummary.year5Total,
            tcoTotal: procurementCostSummary.tcoTotal,
            formatted: procurementCostSummary.formatted,
            pricingTier: procurementCostSummary.pricingTier,
          } : undefined,
          // Also store formatted cost directly for easy access by evaluation
          costStructure: procurementCostSummary?.formatted || "Not specified",
        },
      });
    }
    
    // Update existing proposals or create new ones
    await Promise.all(
      proposalConfigs.map(async config => {
        const existing = existingVendorProposals.find(p => p.documentType === config.documentType);
        if (existing) {
          // Update existing proposal with fresh blob URL
          await storage.updateProposal(existing.id, {
            blobUrl: config.blobUrl,
            extractedData: config.extractedData,
            fileName: config.fileName,
          });
          console.log(`✓ Updated proposal for ${vendorName} - ${config.documentType} with fresh blob URL`);
        } else {
          // Create new proposal
          await storage.createProposal({
            projectId: project.id,
            vendorName,
            ...config,
          });
          console.log(`✓ Created new proposal for ${vendorName} - ${config.documentType}`);
        }
      })
    );
    
    console.log(`✓ Completed responses for ${vendorName} (uploaded + created DB records)`);
  }

  return {
    success: true,
    rftId: rft.id,
    vendorCount: vendors.length,
    folder: `project-${project.id}/RFT_Responses/${rftId}`
  };
}

export async function generateEvaluation(rftId: string) {
  const rfts = await storage.getAllGeneratedRfts();
  const rft = rfts.find(r => r.id === rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project || !project.vendorList) {
    throw new Error("Project or vendors not found");
  }

  // Create requirement
  const sections = (rft.sections as any)?.sections || [];
  const requirement = await storage.createRequirement({
    projectId: project.id,
    fileName: `${rft.name}_Requirements.pdf`,
    extractedData: {
      text: sections.map((s: any) => s.content).join("\n") || "",
      fileName: `${rft.name}_Requirements.pdf`,
    },
    evaluationCriteria: [
      { name: "Technical Fit", weight: 30, description: "Technical capabilities" },
      { name: "Delivery Risk", weight: 25, description: "Implementation risk" },
      { name: "Cost", weight: 20, description: "Total cost of ownership" },
      { name: "Compliance", weight: 15, description: "Regulatory compliance" },
      { name: "Support", weight: 10, description: "Vendor support quality" },
    ],
  });

  const vendors = project.vendorList.slice(0, 3);
  const proposals = [];

  // Create proposals and evaluations for each vendor
  for (let i = 0; i < vendors.length; i++) {
    const vendorName = vendors[i];
    const baseScore = 75 + (i * 5); // Varying scores

    console.log(`🎭 Generating AI-powered proposal for ${vendorName}...`);

    // Generate realistic, vendor-specific proposal using AI (has internal persona-aware fallback)
    const aiProposal = await generateVendorProposal({
      vendorName,
      rftTitle: rft.name,
      businessObjective: (rft.sections as any)?.businessCase?.businessObjective || "Enhance airline operations and digital capabilities",
      scope: (rft.sections as any)?.businessCase?.scope || "Digital transformation initiative",
      technicalRequirements: (rft.sections as any)?.businessCase?.functionalRequirements || 
        sections.filter((s: any) => s.stakeholder === "technical").map((s: any) => s.content).slice(0, 8) ||
        ["Cloud-native architecture", "API integration", "Security compliance"],
      nonFunctionalRequirements: (rft.sections as any)?.businessCase?.nonFunctionalRequirements ||
        ["99.9% uptime", "Scalability", "Performance"] 
    });

    const proposalContent = {
      vendorName,
      executiveSummary: aiProposal.executiveSummary,
      technicalApproach: aiProposal.technicalApproach,
      capabilities: aiProposal.productFeatures.split('\n').filter(Boolean).slice(0, 5),
      integrations: ["REST API", "GraphQL", "Webhooks"],
      security: "ISO 27001, SOC 2, GDPR compliant",
      support: aiProposal.implementationPlan.includes("24/7") ? "24/7 support" : "Business hours support",
      fullProposalText: formatProposalAsDocument(aiProposal)
    };

    console.log(`   ✅ Persona-aware proposal generated (${proposalContent.fullProposalText.length} chars)`);

    const proposal = await storage.createProposal({
      projectId: project.id,
      vendorName,
      documentType: "proposal",
      fileName: `${vendorName}_Proposal.pdf`,
      extractedData: proposalContent,
    });

    proposals.push(proposal);

    // Create evaluation
    const { evaluation: _mockEval } = await storage.createEvaluation({
      projectId: project.id,
      proposalId: proposal.id,
      overallScore: baseScore,
      technicalFit: baseScore - 5,
      deliveryRisk: baseScore,
      cost: `$${(baseScore * 1000).toLocaleString()}`,
      compliance: baseScore,
      roleInsights: {
        delivery: [
          `Strong delivery track record with ${vendorName}`,
          `Timeline feasibility is excellent for ${vendorName}`,
          `Resource requirements are clearly defined`
        ],
        product: [
          `${vendorName} offers comprehensive product features`,
          `Roadmap alignment matches requirements`,
          `User experience design is modern and intuitive`
        ],
        architecture: [
          `${vendorName} provides scalable architecture`,
          `Integration patterns follow industry standards`,
          `Technical documentation is comprehensive`
        ],
        engineering: [
          `Code quality and maintainability standards are high`,
          `${vendorName} SDK and APIs are well-designed`,
          `Testing and QA processes are mature`
        ],
        procurement: [
          `Pricing model is transparent and competitive`,
          `${vendorName} contract terms are favorable`,
          `Total cost of ownership is within budget`
        ],
        security: [
          `${vendorName} meets all security compliance requirements`,
          `Data encryption and access controls are robust`,
          `Security audit results are satisfactory`
        ],
      },
      status: "completed",
    });
  }

  // Generate evaluation report (simple text for now)
  const reportContent = `
Evaluation Report: ${rft.name}
Generated: ${new Date().toISOString()}

Total Proposals Evaluated: ${proposals.length}

Vendors:
${vendors.map((v: string, i: number) => `${i + 1}. ${v}`).join("\n")}

Summary:
This evaluation report covers ${proposals.length} vendor proposals for ${rft.name}.
All vendors have been assessed across technical fit, delivery risk, cost, compliance, and support.
  `.trim();

  const reportBuffer = Buffer.from(reportContent, "utf-8");

  // Upload to Azure Blob Storage under project-specific folder
  await azureBlobStorageService.uploadDocument(
    `project-${project.id}/RFT Evaluation/Evaluation_Report.txt`,
    reportBuffer,
    { rftId: rft.id, projectId: project.id, type: "evaluation-report" }
  );

  return {
    success: true,
    rftId: rft.id,
    proposalsCount: proposals.length,
    folder: `project-${project.id}/RFT Evaluation`
  };
}

/**
 * Generate vendor stage tracking data for projects
 * Uses actual vendor names from existing proposals and creates stage tracking records
 */
export async function generateVendorStages(projectId?: string) {
  // Stage distribution across the 10-stage workflow
  const possibleStages = [2, 3, 5, 7, 8]; // Different stages for variety
  
  let targetProjects: any[] = [];
  
  if (projectId) {
    // Generate for specific project
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    targetProjects = [project];
  } else {
    // Generate for all projects (increased limit to ensure we find projects needing vendor stages)
    const allProjects = await storage.getAllProjects();
    targetProjects = allProjects.slice(0, Math.min(50, allProjects.length));
  }
  
  let totalCreated = 0;
  let projectsWithVendors = 0;
  
  for (const project of targetProjects) {
    // Get actual vendor names from proposals for this project
    const proposals = await storage.getProposalsByProject(project.id);
    
    if (proposals.length === 0) {
      // Skip projects with no proposals
      continue;
    }
    
    // Extract unique vendor names from proposals
    const vendorNameSet = new Set(proposals.map(p => p.vendorName));
    const uniqueVendorNames = Array.from(vendorNameSet);
    
    // Get existing vendor stages for this project
    const existingStages = await storage.getVendorStagesByProject(project.id);
    const existingVendorNames = new Set(existingStages.map((s: any) => s.vendorName));
    
    // Find vendors that don't already have stage tracking
    const vendorsToCreate = uniqueVendorNames.filter(name => !existingVendorNames.has(name));
    
    if (vendorsToCreate.length === 0) {
      // All vendors already have stage tracking
      continue;
    }
    
    // Determine appropriate stage based on project progress
    // Check if project has evaluations completed
    const evaluations = await storage.getEvaluationsByProject(project.id);
    let baseStage = 5; // Default: RFT Response Received (stage 5)
    
    if (evaluations.length > 0) {
      // If evaluations exist, vendors should be at stage 7 (RFT Evaluation Completed)
      baseStage = 7;
    }
    
    projectsWithVendors++;
    
    // Create vendor stage records for each vendor
    for (let i = 0; i < vendorsToCreate.length; i++) {
      const vendorName = vendorsToCreate[i];
      
      // Add slight variation (+/- 1 stage) for realism while respecting project state
      const stageVariation = [-1, 0, 0, 1][i % 4]; // Most at base, some at base-1 or base+1
      const currentStage = Math.max(2, Math.min(10, baseStage + stageVariation));
      
      // Create stage status object with proper format: { status: string, date: string | null }
      const stageStatuses: Record<string, any> = {};
      for (let stage = 1; stage <= 10; stage++) {
        stageStatuses[stage.toString()] = {
          status: currentStage >= stage ? 'completed' : (currentStage === stage ? 'in_progress' : 'pending'),
          date: currentStage >= stage ? new Date().toISOString() : null
        };
      }
      
      await storage.createVendorStage({
        projectId: project.id,
        vendorName,
        currentStage,
        stageStatuses
      });
      totalCreated++;
    }
  }
  
  return {
    success: true,
    projectsCount: targetProjects.length,
    projectsWithVendors,
    vendorsCreated: totalCreated,
    message: `Created ${totalCreated} vendor stage records for ${projectsWithVendors} projects (using actual vendor names from proposals)`
  };
}

// Helper functions for vendor responses
// Note: Vendor response generation now uses actual RFT questionnaires
// See excelQuestionnaireHandler.ts for the implementation
