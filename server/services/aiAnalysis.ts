import OpenAI from "openai";
import { evaluateProposalMultiAgent } from "./multiAgentEvaluator";
import { storage } from "../storage";
import type { SystemConfig } from "@shared/schema";

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (openaiClient) {
    return openaiClient;
  }

  // Try to get config from database first
  try {
    const configs = await storage.getAllSystemConfig();
    const endpoint = configs.find((c: SystemConfig) => c.key === "AGENTS_OPENAI_ENDPOINT")?.value;
    const apiKey = configs.find((c: SystemConfig) => c.key === "AGENTS_OPENAI_API_KEY")?.value;

    if (endpoint && apiKey) {
      console.log("Using OpenAI config from database for agents");
      openaiClient = new OpenAI({
        apiKey,
        baseURL: endpoint,
      });
      return openaiClient;
    }
  } catch (error) {
    console.warn("Failed to load OpenAI config from database, falling back to environment variables:", error);
  }

  // Fall back to environment variables
  console.log("Using OpenAI config from environment variables for agents");
  openaiClient = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return openaiClient;
}

// Legacy compatibility: Create a default client for immediate use
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Feature flag for multiagent evaluation
const USE_MULTIAGENT = process.env.USE_MULTIAGENT !== "false"; // Enabled by default

export interface RequirementAnalysis {
  scope: string;
  technicalRequirements: string[];
  evaluationCriteria: {
    name: string;
    weight: number;
    description: string;
  }[];
  successMetrics: string[];
}

export interface ProposalAnalysis {
  vendorName: string;
  capabilities: string[];
  technicalApproach: string;
  integrations: string[];
  security: string;
  support: string;
  costStructure: string;
  timeline: string;
}

export interface VendorEvaluation {
  overallScore: number;
  functionalFit: number;
  technicalFit: number;
  deliveryRisk: number;
  cost: string;
  compliance: number;
  status: "recommended" | "under-review" | "risk-flagged";
  rationale: string;
  roleInsights: {
    delivery: string[];
    product: string[];
    architecture: string[];
    engineering: string[];
    procurement: string[];
    security: string[];
  };
  detailedScores: {
    integration: number;
    support: number;
    scalability: number;
    documentation: number;
  };
  sectionCompliance?: {
    sectionId: string;
    sectionName: string;
    score: number;
    findings: string;
  }[];
}

export interface StandardSection {
  id: string;
  name: string;
  description?: string;
}

export interface StandardData {
  id: string;
  name: string;
  sections: StandardSection[];
  taggedSectionIds: string[];
}

export async function extractComplianceSections(documentText: string, standardName: string): Promise<StandardSection[]> {
  const prompt = `Analyze the following compliance/standards document and extract its main sections.

Document Name: ${standardName}

Document Content:
${documentText.substring(0, 15000)} 

Please identify and extract the main compliance sections from this document. Each section should represent a distinct compliance area or requirement category.

Return your analysis in JSON format with the following structure:
{
  "sections": [
    {
      "id": "unique-section-id",
      "name": "Section Name",
      "description": "Brief description of what this section covers"
    }
  ]
}

Examples of sections might include:
- Data Security & Encryption
- Access Control & Authentication
- Audit & Logging
- Data Privacy & GDPR
- Network Security
- Incident Response
- Business Continuity
etc.`;

  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert compliance analyst specializing in extracting and structuring compliance requirements from standards documents. Extract meaningful sections that represent distinct compliance areas.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const result = JSON.parse(content) as { sections: StandardSection[] };
  return result.sections || [];
}

export async function analyzeRequirements(documentText: string): Promise<RequirementAnalysis> {
  const prompt = `Analyze the following requirements document and extract key information.
  
Document:
${documentText}

Please provide a structured analysis including:
1. Project scope and objectives
2. Technical requirements (NFRs, tech stack, capabilities needed)
3. Evaluation criteria with weights (technical fit, delivery risk, cost, compliance, etc.)
4. Success metrics

Return your analysis in JSON format with the following structure:
{
  "scope": "Brief project scope",
  "technicalRequirements": ["requirement 1", "requirement 2"],
  "evaluationCriteria": [
    {"name": "Technical Fit", "weight": 30, "description": "How well the solution meets technical needs"},
    {"name": "Delivery Risk", "weight": 25, "description": "Risk factors in implementation"}
  ],
  "successMetrics": ["metric 1", "metric 2"]
}`;

  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert requirements analyst for enterprise procurement. Extract and structure requirement information from documents.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as RequirementAnalysis;
}

export async function analyzeProposal(documentText: string, fileName: string): Promise<ProposalAnalysis> {
  const prompt = `Analyze the following vendor proposal document and extract key information.

Document:
${documentText}

Please provide a structured analysis including:
1. Vendor name (extract from document or use filename)
2. Key capabilities and features offered
3. Technical approach and architecture
4. Integration capabilities
5. Security and compliance features
6. Support model
7. Cost structure
8. Estimated timeline

Return your analysis in JSON format with the following structure:
{
  "vendorName": "Vendor Name",
  "capabilities": ["capability 1", "capability 2"],
  "technicalApproach": "Description of technical approach",
  "integrations": ["integration 1", "integration 2"],
  "security": "Security features and compliance",
  "support": "Support model description",
  "costStructure": "Pricing model",
  "timeline": "Implementation timeline"
}`;

  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert at analyzing vendor proposals. Extract and structure key information from proposal documents.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const analysis = JSON.parse(content) as ProposalAnalysis;
  
  // If vendor name not found, extract from filename
  if (!analysis.vendorName || analysis.vendorName === "Unknown" || analysis.vendorName === "Vendor Name") {
    analysis.vendorName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  return analysis;
}

// Legacy single-agent evaluation (fallback)
async function evaluateProposalSingleAgent(
  requirementAnalysis: RequirementAnalysis,
  proposalAnalysis: ProposalAnalysis,
  standardData?: StandardData
): Promise<VendorEvaluation> {
  let standardSection = '';
  let standardInstructions = '';
  
  if (standardData && standardData.taggedSectionIds.length > 0) {
    const taggedSections = standardData.sections.filter(s => 
      standardData.taggedSectionIds.includes(s.id)
    );
    
    standardSection = `

Compliance Standard: ${standardData.name}
Tagged Sections:
${taggedSections.map(s => `- ${s.name}${s.description ? ': ' + s.description : ''}`).join('\n')}`;

    standardInstructions = `
10. Section-specific compliance scores (0-100) for each tagged section with detailed findings
   Add "sectionCompliance" array with: sectionId, sectionName, score, findings`;
  }

  const prompt = `You are an expert procurement evaluation system. Evaluate how well this vendor proposal meets the requirements.

Requirements:
${JSON.stringify(requirementAnalysis, null, 2)}

Vendor Proposal:
${JSON.stringify(proposalAnalysis, null, 2)}${standardSection}

Provide a comprehensive evaluation with:
1. Overall fit score (0-100)
2. Technical fit score (0-100) - how well capabilities match requirements
3. Delivery risk score (0-100) - higher means more risk
4. Cost estimate range
5. Compliance score (0-100) - security, standards adherence${standardData ? ' (factor in section compliance)' : ''}
6. Status: "recommended" (score >80), "under-review" (60-80), or "risk-flagged" (<60)
7. AI rationale explaining the scores
8. Role-specific insights for: delivery, product, architecture, engineering, procurement, security/QA teams
9. Detailed scores for: integration complexity, support quality, scalability, documentation${standardInstructions}

Return JSON with this structure:
{
  "overallScore": 85,
  "technicalFit": 90,
  "deliveryRisk": 25,
  "cost": "$150K - $180K",
  "compliance": 95,
  "status": "recommended",
  "rationale": "Detailed explanation of scores and recommendation",
  "roleInsights": {
    "delivery": ["insight 1", "insight 2"],
    "product": ["insight 1"],
    "architecture": ["insight 1"],
    "engineering": ["insight 1"],
    "procurement": ["insight 1"],
    "security": ["insight 1"]
  },
  "detailedScores": {
    "integration": 90,
    "support": 85,
    "scalability": 88,
    "documentation": 92
  }${standardData && standardData.taggedSectionIds.length > 0 ? `,
  "sectionCompliance": [
    {"sectionId": "section-id", "sectionName": "Section Name", "score": 85, "findings": "Detailed findings"}
  ]` : ''}
}`;

  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert procurement evaluation system that provides objective, unbiased assessments of vendor proposals against requirements.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  return JSON.parse(content) as VendorEvaluation;
}

// Main evaluation function with multiagent support
export async function evaluateProposal(
  requirementAnalysis: RequirementAnalysis,
  proposalAnalysis: ProposalAnalysis,
  standardData?: StandardData
): Promise<{ evaluation: VendorEvaluation; diagnostics?: any }> {
  // Try multiagent evaluation first
  if (USE_MULTIAGENT) {
    try {
      console.log("🚀 Using multiagent evaluation system");
      // Pass organization standards to all agents for evaluation
      const result = await evaluateProposalMultiAgent(requirementAnalysis, proposalAnalysis, standardData);
      
      // Generate section-level compliance if standard data is provided
      if (standardData && standardData.taggedSectionIds.length > 0) {
        const taggedSections = standardData.sections.filter(s => 
          standardData.taggedSectionIds.includes(s.id)
        );
        
        // Create section compliance array based on aggregated multi-agent evaluation
        const sectionCompliance = taggedSections.map(section => ({
          sectionId: section.id,
          sectionName: section.name,
          score: result.evaluation.compliance,
          findings: `Multi-agent evaluation (${result.evaluation.compliance}/100). All 6 specialized agents evaluated vendor compliance against "${section.name}". See role-specific insights for detailed findings.`
        }));
        
        result.evaluation.sectionCompliance = sectionCompliance;
      }
      
      return result;
    } catch (error) {
      console.error("⚠️  Multiagent evaluation failed, falling back to single-agent:", error);
      // Fall through to single-agent
    }
  }
  
  // Fallback to single-agent evaluation
  console.log("Using single-agent evaluation system");
  const evaluation = await evaluateProposalSingleAgent(requirementAnalysis, proposalAnalysis, standardData);
  return { evaluation };
}
