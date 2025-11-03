import { storage } from "../storage";
import { azureBlobStorageService } from "./azureBlobStorage";
import archiver from "archiver";
import ExcelJS from "exceljs";

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

  // Generate DOCX and PDF (placeholder content for now)
  const docContent = `${rft.name}\n\n${JSON.stringify(rft.sections, null, 2)}`;
  const docBuffer = Buffer.from(docContent, "utf-8");
  const pdfBuffer = Buffer.from(docContent, "utf-8");

  // Generate questionnaires (Excel files)
  const productExcel = await generateQuestionnaireExcel("Product");
  const nfrExcel = await generateQuestionnaireExcel("NFR");
  const securityExcel = await generateQuestionnaireExcel("Security");
  const agileExcel = await generateQuestionnaireExcel("Agile");

  // Create ZIP
  const zipBuffer = await createZipArchive({
    [`${rft.name}.docx`]: docBuffer,
    [`${rft.name}.pdf`]: pdfBuffer,
    [`Product_Questionnaire.xlsx`]: productExcel,
    [`NFR_Questionnaire.xlsx`]: nfrExcel,
    [`Security_Questionnaire.xlsx`]: securityExcel,
    [`Agile_Questionnaire.xlsx`]: agileExcel,
  });

  // Upload to Azure Blob Storage under project-specific folder
  await azureBlobStorageService.uploadDocument(
    `project-${project.id}/RFT Generated/RFT_Package.zip`,
    zipBuffer,
    { rftId: rft.id, projectId: project.id, type: "rft-package" }
  );

  return {
    success: true,
    rftId: rft.id,
    filesCount: 6,
    folder: `project-${project.id}/RFT Generated`
  };
}

export async function generateVendorResponses(rftId: string) {
  const rfts = await storage.getAllGeneratedRfts();
  const rft = rfts.find(r => r.id === rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project || !project.vendorList) {
    throw new Error("Project or vendors not found");
  }

  const vendors = project.vendorList.slice(0, 3); // Get first 3 vendors

  for (const vendorName of vendors) {
    // Generate responses for each questionnaire
    const productResponse = await generateQuestionnaireResponse("Product", vendorName);
    const nfrResponse = await generateQuestionnaireResponse("NFR", vendorName);
    const securityResponse = await generateQuestionnaireResponse("Security", vendorName);
    const agileResponse = await generateQuestionnaireResponse("Agile", vendorName);

    // Upload to Azure Blob Storage under project-specific folder
    await azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT Responses/${vendorName}/Product_Response.xlsx`,
      productResponse,
      { rftId: rft.id, vendorName, type: "product-response" }
    );

    await azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT Responses/${vendorName}/NFR_Response.xlsx`,
      nfrResponse,
      { rftId: rft.id, vendorName, type: "nfr-response" }
    );

    await azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT Responses/${vendorName}/Security_Response.xlsx`,
      securityResponse,
      { rftId: rft.id, vendorName, type: "security-response" }
    );

    await azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT Responses/${vendorName}/Agile_Response.xlsx`,
      agileResponse,
      { rftId: rft.id, vendorName, type: "agile-response" }
    );
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

// Helper functions
async function generateQuestionnaireExcel(type: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${type} Questionnaire`);

  // Add headers
  worksheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Response", key: "response", width: 40 },
    { header: "Compliance", key: "compliance", width: 15 },
    { header: "Remarks", key: "remarks", width: 30 },
  ];

  // Add sample questions
  const questions = [
    `${type} Question 1: Please describe your approach`,
    `${type} Question 2: What are your key capabilities?`,
    `${type} Question 3: How do you ensure quality?`,
    `${type} Question 4: What is your implementation timeline?`,
    `${type} Question 5: What support do you provide?`,
  ];

  questions.forEach((q) => {
    worksheet.addRow({ question: q, response: "", compliance: "", remarks: "" });
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  return await workbook.xlsx.writeBuffer() as Buffer;
}

async function generateQuestionnaireResponse(type: string, vendorName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`${type} Response`);

  // Add headers
  worksheet.columns = [
    { header: "Question", key: "question", width: 60 },
    { header: "Response", key: "response", width: 40 },
    { header: "Compliance", key: "compliance", width: 15 },
    { header: "Remarks", key: "remarks", width: 30 },
  ];

  // Add sample responses
  const responses = [
    {
      question: `${type} Question 1: Please describe your approach`,
      response: `${vendorName} approach to ${type}`,
      compliance: "Compliant",
      remarks: "Meets requirements"
    },
    {
      question: `${type} Question 2: What are your key capabilities?`,
      response: `${vendorName} has extensive capabilities in ${type}`,
      compliance: "Compliant",
      remarks: "Strong capability"
    },
    {
      question: `${type} Question 3: How do you ensure quality?`,
      response: `${vendorName} follows ISO standards`,
      compliance: "Compliant",
      remarks: "Certified processes"
    },
    {
      question: `${type} Question 4: What is your implementation timeline?`,
      response: "6-12 months",
      compliance: "Partial",
      remarks: "Within acceptable range"
    },
    {
      question: `${type} Question 5: What support do you provide?`,
      response: "24/7 support with regional hubs",
      compliance: "Compliant",
      remarks: "Excellent support model"
    },
  ];

  responses.forEach((r) => {
    worksheet.addRow(r);
  });

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  return await workbook.xlsx.writeBuffer() as Buffer;
}

async function createZipArchive(files: Record<string, Buffer>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    Object.entries(files).forEach(([filename, content]) => {
      archive.append(content, { name: filename });
    });

    archive.finalize();
  });
}
