import { type InsertGeneratedRft, type RftTemplate, type BusinessCase } from "@shared/schema";
import { OpenAI } from "openai";
import { storage } from "../storage";
import { generateAllQuestionnaires, type QuestionnaireQuestion } from "./excelGenerator";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface RftSection {
  sectionId: string;
  title: string;
  content: string;
  subsections?: RftSection[];
}

interface BusinessCaseExtract {
  projectName: string;
  businessObjective: string;
  scope: string;
  stakeholders: string[];
  budget: string;
  timeline: string;
  keyRequirements: string[];
  risks: string[];
  successCriteria: string[];
}

/**
 * Generate comprehensive RFT document sections following professional standards
 */
export async function generateProfessionalRftSections(
  businessCaseExtract: BusinessCaseExtract
): Promise<RftSection[]> {
  const prompt = `You are creating a professional Request for Tender (RFT) document for ${businessCaseExtract.projectName}.

Business Context:
- Project: ${businessCaseExtract.projectName}
- Objective: ${businessCaseExtract.businessObjective}
- Scope: ${businessCaseExtract.scope}
- Timeline: ${businessCaseExtract.timeline}
- Budget: ${businessCaseExtract.budget}
- Key Requirements: ${businessCaseExtract.keyRequirements.join(', ')}

Generate a comprehensive RFT document with the following 10 sections. Each section should be detailed, professional, and specific to this aviation/airline project:

1. **Introduction & Overview** - Purpose, background, objectives, tendering process summary
2. **Scope of Work / Requirements** - Detailed requirements, functional/technical specs, deliverables, milestones, timelines
3. **Instructions to Tenderers** - Eligibility criteria, submission process, deadlines, clarification protocol
4. **Evaluation Criteria** - Evaluation methodology, weightings, scoring, mandatory vs desirable criteria
5. **Commercial Terms & Conditions** - Pricing structure, payment terms, taxes, warranty, maintenance
6. **Contractual Requirements** - Contract terms, IP rights, confidentiality, liability, insurance, dispute resolution
7. **Non-Functional Requirements (NFRs)** - Security, compliance, availability, scalability, performance, SLAs
8. **Governance & Risk Management** - Project governance, reporting, risk mitigation, change control
9. **Response Templates / Schedules** - Vendor response templates, mandatory documentation, declarations
10. **Appendices** - Glossary, standards, reference documents, regulatory attachments

Return a JSON array with this structure:
[
  {
    "sectionId": "section-1",
    "title": "Introduction & Overview",
    "content": "Detailed multi-paragraph content for this section..."
  },
  ...
]

Make the content:
- Professional and formal in tone
- Specific to airline/aviation industry
- Detailed with 3-5 paragraphs per section
- Include realistic requirements, timelines, and evaluation criteria
- Reference industry standards (IATA, ISO, etc.) where appropriate

Return ONLY valid JSON array, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert procurement specialist with 20+ years of experience in airline industry RFT/RFP creation. You understand aviation regulations, IATA standards, and airline operational requirements.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);
    // Handle both array and object with sections array
    const sections = Array.isArray(result) ? result : (result.sections || []);
    
    return sections as RftSection[];
  } catch (error) {
    console.error("Error generating RFT sections:", error);
    throw new Error("Failed to generate professional RFT sections");
  }
}

/**
 * Extract structured information from a business case document
 */
export async function extractBusinessCaseInfo(
  businessCaseContent: string
): Promise<BusinessCaseExtract> {
  const prompt = `You are analyzing a Lean Business Case document for an airline procurement project.
Extract the following information in JSON format:

{
  "projectName": "Name of the project or initiative",
  "businessObjective": "Main business objective or goal",
  "scope": "Project scope description",
  "stakeholders": ["List", "of", "key", "stakeholders"],
  "budget": "Budget information or constraints",
  "timeline": "Timeline or delivery expectations",
  "keyRequirements": ["Key", "business", "requirements"],
  "risks": ["Identified", "risks", "or", "challenges"],
  "successCriteria": ["Success", "metrics", "or", "criteria"]
}

Business Case Document:
${businessCaseContent.substring(0, 8000)}

Return ONLY valid JSON, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert business analyst specializing in aviation and airline procurement processes.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as BusinessCaseExtract;
  } catch (error) {
    console.error("Error extracting business case info:", error);
    throw new Error("Failed to extract business case information");
  }
}

/**
 * Generate questionnaire questions using AI based on business case
 */
export async function generateQuestionnaireQuestions(
  businessCaseExtract: BusinessCaseExtract,
  questionnaireType: "product" | "nfr" | "cybersecurity" | "agile",
  count: number
): Promise<QuestionnaireQuestion[]> {
  const questionnairePrompts = {
    product: `Generate ${count} detailed product capability questions for evaluating vendor solutions.
Focus on:
- Core product features and functionality
- User experience and interface
- Integration capabilities
- Scalability and performance
- Product roadmap and innovation
- Vendor support and training

Each question should be specific, measurable, and relevant to ${businessCaseExtract.projectName}.`,
    
    nfr: `Generate ${count} comprehensive Non-Functional Requirements (NFR) questions for vendor evaluation.
Focus on:
- Performance (response time, throughput, load handling)
- Reliability and availability (uptime, failover, disaster recovery)
- Scalability (horizontal/vertical scaling, multi-tenancy)
- Security (authentication, authorization, encryption, data protection)
- Maintainability (monitoring, logging, troubleshooting)
- Usability (accessibility, user training, documentation)
- Compatibility (browser support, mobile, integrations)
- Compliance (data privacy, regulatory requirements)

Each question should be specific and measurable for ${businessCaseExtract.projectName}.`,
    
    cybersecurity: `Generate ${count} detailed cybersecurity and compliance questions for vendor evaluation.
Focus on:
- Data encryption (at rest, in transit)
- Access control and authentication (SSO, MFA, RBAC)
- Vulnerability management and penetration testing
- Incident response and security monitoring
- Compliance certifications (ISO 27001, SOC 2, GDPR, PCI-DSS)
- Data backup and recovery
- Third-party security audits
- Security training for staff

Each question should address airline industry security standards for ${businessCaseExtract.projectName}.`,
    
    agile: `Generate ${count} detailed agile project delivery questions for vendor evaluation.
Focus on:
- Development methodology (Scrum, Kanban, SAFe)
- Sprint planning and execution
- Collaboration tools and practices
- CI/CD pipeline and deployment frequency
- Quality assurance and testing approach
- Change management process
- Communication and reporting
- Team structure and expertise
- Risk management approach

Each question should evaluate vendor's agile maturity for ${businessCaseExtract.projectName}.`
  };

  const prompt = `You are creating a vendor evaluation questionnaire for ${businessCaseExtract.projectName}.

Business Context:
- Objective: ${businessCaseExtract.businessObjective}
- Scope: ${businessCaseExtract.scope}
- Key Requirements: ${businessCaseExtract.keyRequirements.join(", ")}

${questionnairePrompts[questionnaireType]}

Return a JSON array of exactly ${count} questions in this format:
[
  {
    "number": 1,
    "question": "Detailed question text here?",
    "category": "Category name"
  }
]

Requirements:
- Each question must be clear, specific, and measurable
- Questions should require detailed vendor responses
- Avoid yes/no questions - ask for capabilities, processes, or evidence
- Use aviation industry context where relevant
- Number questions sequentially from 1 to ${count}

Return ONLY valid JSON array, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert procurement specialist for airline industry, creating comprehensive vendor evaluation questionnaires.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    
    return questions.slice(0, count) as QuestionnaireQuestion[];
  } catch (error) {
    console.error(`Error generating ${questionnaireType} questionnaire:`, error);
    
    // Fallback: generate generic questions
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      question: `[AI generation failed] Please provide details about ${questionnaireType} aspect ${i + 1}.`,
      category: questionnaireType.toUpperCase()
    }));
  }
}

/**
 * Generate a specific RFT section using AI
 */
async function generateRftSection(
  sectionConfig: any,
  businessCaseExtract: BusinessCaseExtract,
  businessCaseContent: string
): Promise<RftSection> {
  const { id, title, prompt_template, subsections } = sectionConfig;

  // Build the prompt
  const prompt = `You are creating a Request for Tender (RFT) document for ${businessCaseExtract.projectName}.

Business Context:
- Objective: ${businessCaseExtract.businessObjective}
- Scope: ${businessCaseExtract.scope}
- Budget: ${businessCaseExtract.budget}
- Timeline: ${businessCaseExtract.timeline}

Generate the "${title}" section of the RFT document.

${prompt_template || ''}

Requirements:
- Be specific and measurable
- Use aviation industry standards (IATA, ICAO, etc.) where applicable
- Include acceptance criteria
- Format in clear markdown with bullet points and tables where appropriate
- Be comprehensive but concise

Generate ONLY the content for this section, well-formatted in markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert RFT author specializing in airline procurement, with deep knowledge of aviation industry standards and best practices.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "";

    const section: RftSection = {
      sectionId: id,
      title,
      content,
    };

    // Generate subsections if defined in template
    if (subsections && Array.isArray(subsections)) {
      section.subsections = [];
      for (const subConfig of subsections) {
        const subsection = await generateRftSection(
          subConfig,
          businessCaseExtract,
          businessCaseContent
        );
        section.subsections.push(subsection);
      }
    }

    return section;
  } catch (error) {
    console.error(`Error generating RFT section ${title}:`, error);
    return {
      sectionId: id,
      title,
      content: `Error generating this section. Please review and edit manually.`,
    };
  }
}

/**
 * Generate complete RFT document from business case using a template
 */
export async function generateRftFromBusinessCase(
  businessCaseId: string,
  templateId: string,
  projectId: string
): Promise<InsertGeneratedRft> {
  // Get business case
  const businessCase = await storage.getBusinessCase(businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  // Get template
  const template = await storage.getRftTemplate(templateId);
  if (!template) {
    throw new Error("RFT template not found");
  }

  console.log(`Generating RFT for business case: ${businessCase.name}`);

  // Extract business case information
  const businessCaseExtract = await extractBusinessCaseInfo(
    businessCase.documentContent || ""
  );

  console.log(`Extracted business case info for: ${businessCaseExtract.projectName}`);

  // Generate all sections from template
  const sections: RftSection[] = [];
  const templateSections = (template.sections as any)?.sections || [];

  for (const sectionConfig of templateSections) {
    console.log(`Generating section: ${sectionConfig.title}`);
    const section = await generateRftSection(
      sectionConfig,
      businessCaseExtract,
      businessCase.documentContent || ""
    );
    sections.push(section);
  }

  console.log(`Generated ${sections.length} RFT sections`);

  // Generate all 4 questionnaires using AI
  console.log("Generating questionnaires...");
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
  ]);

  console.log("Generated all questionnaire questions, creating Excel files...");

  // Generate Excel files
  const questionnairePaths = await generateAllQuestionnaires(projectId, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
  });

  console.log("Excel questionnaires created successfully");

  // Create generated RFT record with all deliverables
  const generatedRft: InsertGeneratedRft = {
    projectId,
    businessCaseId,
    templateId,
    name: `${businessCaseExtract.projectName} - RFT`,
    sections: { sections },
    productQuestionnairePath: questionnairePaths.productPath,
    nfrQuestionnairePath: questionnairePaths.nfrPath,
    cybersecurityQuestionnairePath: questionnairePaths.cybersecurityPath,
    agileQuestionnairePath: questionnairePaths.agilePath,
    status: "draft",
    version: 1,
    metadata: {
      generatedAt: new Date().toISOString(),
      model: "gpt-4o",
      templateName: template.name,
      businessCaseName: businessCase.name,
      questionnaireStats: {
        productQuestions: productQuestions.length,
        nfrQuestions: nfrQuestions.length,
        cybersecurityQuestions: cybersecurityQuestions.length,
        agileQuestions: agileQuestions.length,
      },
    },
  };

  return generatedRft;
}

/**
 * Regenerate a specific section of an RFT
 */
export async function regenerateRftSection(
  rftId: string,
  sectionId: string
): Promise<RftSection> {
  const rft = await storage.getGeneratedRft(rftId);
  if (!rft) {
    throw new Error("Generated RFT not found");
  }

  const businessCase = await storage.getBusinessCase(rft.businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  const template = await storage.getRftTemplate(rft.templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  // Find section config in template
  const templateSections = (template.sections as any)?.sections || [];
  const sectionConfig = templateSections.find((s: any) => s.id === sectionId);
  
  if (!sectionConfig) {
    throw new Error("Section not found in template");
  }

  // Extract business case info
  const businessCaseExtract = await extractBusinessCaseInfo(
    businessCase.documentContent || ""
  );

  // Regenerate the section
  const newSection = await generateRftSection(
    sectionConfig,
    businessCaseExtract,
    businessCase.documentContent || ""
  );

  return newSection;
}

/**
 * Generate all RFT files and upload to Azure Blob Storage
 * Follows the same pattern as mock data generation
 */
export async function publishRftFilesToAzure(rftId: string): Promise<{
  docxBlobUrl: string;
  pdfBlobUrl: string;
  productQuestionnaireBlobUrl: string;
  nfrQuestionnaireBlobUrl: string;
  cybersecurityQuestionnaireBlobUrl: string;
  agileQuestionnaireBlobUrl: string;
}> {
  const rft = await storage.getGeneratedRft(rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const businessCase = await storage.getBusinessCase(rft.businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  console.log(`📤 Publishing RFT files to Azure Blob Storage for: ${rft.name}`);

  // Import required services
  const fs = await import("fs");
  const path = await import("path");
  const { generateDocxDocument, generatePdfDocument } = await import("./documentGenerator");
  const { azureBlobStorageService } = await import("./azureBlobStorage");

  // Extract sections from RFT
  const sections = (rft.sections as any)?.sections || [];
  if (sections.length === 0) {
    throw new Error("No sections found in RFT");
  }

  // Extract business case information for questionnaire generation
  const businessCaseExtract: BusinessCaseExtract = {
    projectName: rft.name,
    businessObjective: businessCase.documentContent || `Modernize ${rft.name}`,
    scope: `Full implementation of ${rft.name}`,
    stakeholders: ["IT Department", "Operations Team", "Executive Leadership"],
    budget: "To be determined based on vendor proposals",
    timeline: "12-18 months",
    keyRequirements: sections.map((s: any) => s.title).filter(Boolean) || [
      "Cloud-native architecture",
      "Scalable and secure platform",
    ],
    risks: ["Implementation delays", "Budget overruns"],
    successCriteria: ["On-time delivery", "Budget adherence"],
  };

  // Generate questionnaires with AI (30, 50, 20, 20)
  console.log("Generating AI-powered questionnaires...");
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
  ]);

  // Generate Excel files
  console.log("Creating Excel questionnaires...");
  const questionnairePaths = await generateAllQuestionnaires(project.id, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
  });

  // Generate DOCX document
  console.log("Generating DOCX document...");
  const docxPath = path.join(process.cwd(), "uploads", "documents", `RFT_${rft.id}.docx`);
  await generateDocxDocument({
    projectName: rft.name,
    sections,
    outputPath: docxPath,
  });

  // Generate PDF document
  console.log("Generating PDF document...");
  const pdfPath = path.join(process.cwd(), "uploads", "documents", `RFT_${rft.id}.pdf`);
  await generatePdfDocument({
    projectName: rft.name,
    sections,
    outputPath: pdfPath,
  });

  // Read file contents into buffers
  const docxBuffer = fs.readFileSync(docxPath);
  const pdfBuffer = fs.readFileSync(pdfPath);

  console.log("Uploading files to Azure Blob Storage...");

  const sanitizedName = rft.name.replace(/[^a-zA-Z0-9]/g, '_');

  // Upload all files to Azure Blob Storage (following mock data pattern)
  const uploadResults = await Promise.all([
    // Upload RFT document (DOCX)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${sanitizedName}_RFT.docx`,
      docxBuffer
    ),
    // Upload RFT document (PDF)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${sanitizedName}_RFT.pdf`,
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
  ]);

  console.log(`✅ Uploaded ${uploadResults.length} files to Azure Blob Storage`);

  // Clean up temporary files
  try {
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(questionnairePaths.productPath);
    fs.unlinkSync(questionnairePaths.nfrPath);
    fs.unlinkSync(questionnairePaths.cybersecurityPath);
    fs.unlinkSync(questionnairePaths.agilePath);
  } catch (error) {
    console.error("Error cleaning up temporary files:", error);
  }

  // Return Azure blob URLs
  return {
    docxBlobUrl: uploadResults[0].blobUrl,
    pdfBlobUrl: uploadResults[1].blobUrl,
    productQuestionnaireBlobUrl: uploadResults[2].blobUrl,
    nfrQuestionnaireBlobUrl: uploadResults[3].blobUrl,
    cybersecurityQuestionnaireBlobUrl: uploadResults[4].blobUrl,
    agileQuestionnaireBlobUrl: uploadResults[5].blobUrl,
  };
}
