import { storage } from "../storage";
import { azureBlobStorageService } from "./azureBlobStorage";
import { generateQuestionnaireQuestions } from "./smartRftService";
import { generateAllQuestionnaires } from "./excelGenerator";
import { generateDocxDocument, generatePdfDocument } from "./documentGenerator";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

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
    initiativeName: `Nujum Air ${topic.title} Initiative`,
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

  // Generate all 4 questionnaires using AI with proper counts (30, 50, 20, 20)
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
  ]);

  console.log("Generated questionnaires, creating Excel files...");

  // Generate Excel files
  const questionnairePaths = await generateAllQuestionnaires(project.id, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
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
  const uploadResults = await Promise.all([
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
  ]);
  
  console.log(`Uploaded ${uploadResults.length} files to Azure Blob Storage successfully`);

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

  // Use project vendorList if available, otherwise use default vendor names
  const vendors = project.vendorList && project.vendorList.length > 0
    ? project.vendorList.slice(0, 3)
    : ["TechVendor Solutions", "GlobalSoft Systems", "InnovateTech Partners"];
  
  console.log(`Generating vendor responses using actual RFT questionnaires...`);
  
  // Download original questionnaires from Azure Blob Storage
  // IMPORTANT: Use underscores instead of spaces to match upload paths
  const questionnairePaths = {
    product: `project-${project.id}/RFT_Generated/Product_Questionnaire.xlsx`,
    nfr: `project-${project.id}/RFT_Generated/NFR_Questionnaire.xlsx`,
    cybersecurity: `project-${project.id}/RFT_Generated/Cybersecurity_Questionnaire.xlsx`,
    agile: `project-${project.id}/RFT_Generated/Agile_Questionnaire.xlsx`,
  };
  
  // Download all questionnaires
  const [productBuffer, nfrBuffer, cybersecurityBuffer, agileBuffer] = await Promise.all([
    azureBlobStorageService.downloadDocument(questionnairePaths.product),
    azureBlobStorageService.downloadDocument(questionnairePaths.nfr),
    azureBlobStorageService.downloadDocument(questionnairePaths.cybersecurity),
    azureBlobStorageService.downloadDocument(questionnairePaths.agile),
  ]);
  
  // Create vendor profiles with varied strengths
  const { createVendorProfiles, fillQuestionnaireWithScores } = await import("./excelQuestionnaireHandler");
  const vendorProfiles = createVendorProfiles(vendors);
  
  // Generate responses for each vendor
  for (let i = 0; i < vendors.length; i++) {
    const vendorName = vendors[i];
    const profile = vendorProfiles[i];
    
    console.log(`Generating responses for ${vendorName} with profile: Product ${profile.productStrength}, NFR ${profile.nfrStrength}, Security ${profile.cybersecurityStrength}, Agile ${profile.agileStrength}`);
    
    // Fill questionnaires with vendor-specific scores
    const [productResponse, nfrResponse, securityResponse, agileResponse] = await Promise.all([
      fillQuestionnaireWithScores(productBuffer, profile, "Product"),
      fillQuestionnaireWithScores(nfrBuffer, profile, "NFR"),
      fillQuestionnaireWithScores(cybersecurityBuffer, profile, "Cybersecurity"),
      fillQuestionnaireWithScores(agileBuffer, profile, "Agile"),
    ]);

    // Upload filled questionnaires to Azure Blob Storage
    // Use underscores for consistency and avoid encoding issues
    const vendorPathSafe = vendorName.replace(/[^a-zA-Z0-9]/g, '_');
    const [productUpload, nfrUpload, securityUpload, agileUpload] = await Promise.all([
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${vendorPathSafe}/Product_Response.xlsx`,
        productResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${vendorPathSafe}/NFR_Response.xlsx`,
        nfrResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${vendorPathSafe}/Cybersecurity_Response.xlsx`,
        securityResponse
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Responses/${vendorPathSafe}/Agile_Response.xlsx`,
        agileResponse
      ),
    ]);
    
    // Create proposal database records for each questionnaire response
    // This allows the UI to display and edit the questionnaires
    await Promise.all([
      storage.createProposal({
        projectId: project.id,
        vendorName,
        documentType: "Product Questionnaire",
        fileName: "Product_Response.xlsx",
        blobUrl: productUpload.blobUrl,
        extractedData: { type: "product-questionnaire-response" },
      }),
      storage.createProposal({
        projectId: project.id,
        vendorName,
        documentType: "NFR Questionnaire",
        fileName: "NFR_Response.xlsx",
        blobUrl: nfrUpload.blobUrl,
        extractedData: { type: "nfr-questionnaire-response" },
      }),
      storage.createProposal({
        projectId: project.id,
        vendorName,
        documentType: "Cybersecurity Questionnaire",
        fileName: "Cybersecurity_Response.xlsx",
        blobUrl: securityUpload.blobUrl,
        extractedData: { type: "cybersecurity-questionnaire-response" },
      }),
      storage.createProposal({
        projectId: project.id,
        vendorName,
        documentType: "Agile Questionnaire",
        fileName: "Agile_Response.xlsx",
        blobUrl: agileUpload.blobUrl,
        extractedData: { type: "agile-questionnaire-response" },
      }),
    ]);
    
    console.log(`✓ Completed responses for ${vendorName} (uploaded + created DB records)`);
  }

  return {
    success: true,
    rftId: rft.id,
    vendorCount: vendors.length,
    folder: `project-${project.id}/RFT Responses`
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

    const proposal = await storage.createProposal({
      projectId: project.id,
      vendorName,
      documentType: "proposal",
      fileName: `${vendorName}_Proposal.pdf`,
      extractedData: {
        vendorName,
        capabilities: [`Capability 1 for ${vendorName}`, `Capability 2 for ${vendorName}`],
        technicalApproach: `Technical approach by ${vendorName}`,
        integrations: ["REST API", "GraphQL"],
        security: "ISO 27001, SOC 2",
        support: "24/7 support",
      },
    });

    proposals.push(proposal);

    // Create evaluation
    await storage.createEvaluation({
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
    const uniqueVendorNames = [...new Set(proposals.map(p => p.vendorName))];
    
    // Get existing vendor stages for this project
    const existingStages = await storage.getVendorStagesByProject(project.id);
    const existingVendorNames = new Set(existingStages.map((s: any) => s.vendorName));
    
    // Find vendors that don't already have stage tracking
    const vendorsToCreate = uniqueVendorNames.filter(name => !existingVendorNames.has(name));
    
    if (vendorsToCreate.length === 0) {
      // All vendors already have stage tracking
      continue;
    }
    
    projectsWithVendors++;
    
    // Create vendor stage records for each vendor
    for (let i = 0; i < vendorsToCreate.length; i++) {
      const vendorName = vendorsToCreate[i];
      // Assign a stage based on index for variety
      const currentStage = possibleStages[i % possibleStages.length];
      
      // Create stage status object
      const stageStatuses: Record<string, string> = {};
      for (let stage = 1; stage <= 10; stage++) {
        stageStatuses[stage.toString()] = currentStage >= stage ? 'completed' : 'pending';
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
