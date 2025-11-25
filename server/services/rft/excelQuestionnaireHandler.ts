import ExcelJS from "exceljs";
import { getVendorPersona } from "./vendorPersonas";

// Compliance score options
export const COMPLIANCE_SCORES = ["Full", "Partial", "Not Applicable", "None"] as const;
export type ComplianceScore = typeof COMPLIANCE_SCORES[number];

// Vendor scoring profiles for realistic variation
export interface VendorProfile {
  name: string;
  productStrength: number; // 0-1, higher = better scores
  nfrStrength: number;
  cybersecurityStrength: number;
  agileStrength: number;
  procurementStrength: number; // 0-1, commercial competitiveness
}

// Define realistic vendor profiles with different strengths (using vendor personas)
export function createVendorProfiles(vendorNames: string[]): VendorProfile[] {
  const profiles: VendorProfile[] = [];
  
  for (const vendorName of vendorNames) {
    // Get vendor persona with realistic characteristics
    const persona = getVendorPersona(vendorName);
    
    profiles.push({
      name: vendorName,
      productStrength: persona.scoringProfile.productStrength,
      nfrStrength: persona.scoringProfile.nfrStrength,
      cybersecurityStrength: persona.scoringProfile.cybersecurityStrength,
      agileStrength: persona.scoringProfile.agileStrength,
      procurementStrength: persona.scoringProfile.procurementStrength,
    });
  }
  
  return profiles;
}

// Get compliance score based on vendor strength with enhanced variance for differentiation
// Handles full range from 0.0-1.0 with dynamic probability curves
// High-strength vendors (0.85+) get predominantly "Full" scores with rare gaps
// Mid-strength vendors (0.5-0.85) show realistic mix favoring their tier
// Low-strength vendors (0.0-0.5) show significant gaps and limitations
function getRandomComplianceScore(strength: number): ComplianceScore {
  const rand = Math.random();
  
  // Clamp strength to valid range [0.0, 1.0]
  const clampedStrength = Math.max(0.0, Math.min(1.0, strength));
  
  // Dynamic scoring curves based on strength - full 0.0 to 1.0 range
  if (clampedStrength >= 0.90) {
    // Elite vendors (0.90-1.0) - 80-85% Full, 12-18% Partial, 2-5% None/NA
    if (rand < 0.82) return "Full";
    else if (rand < 0.97) return "Partial";
    else if (rand < 0.99) return "None";
    else return "Not Applicable";
  }
  else if (clampedStrength >= 0.80) {
    // High-strength vendors (0.80-0.90) - 65-75% Full, 18-25% Partial, 5-10% None/NA
    if (rand < 0.70) return "Full";
    else if (rand < 0.92) return "Partial";
    else if (rand < 0.98) return "None";
    else return "Not Applicable";
  } 
  else if (clampedStrength >= 0.70) {
    // Mid-high strength vendors (0.70-0.80) - 50-60% Full, 25-35% Partial, 10-15% None/NA
    if (rand < 0.55) return "Full";
    else if (rand < 0.85) return "Partial";
    else if (rand < 0.97) return "None";
    else return "Not Applicable";
  } 
  else if (clampedStrength >= 0.60) {
    // Mid strength vendors (0.60-0.70) - 35-45% Full, 35-45% Partial, 15-20% None/NA
    if (rand < 0.40) return "Full";
    else if (rand < 0.75) return "Partial";
    else if (rand < 0.96) return "None";
    else return "Not Applicable";
  } 
  else if (clampedStrength >= 0.50) {
    // Mid-low strength vendors (0.50-0.60) - 25-35% Full, 35-45% Partial, 25-30% None/NA
    if (rand < 0.30) return "Full";
    else if (rand < 0.65) return "Partial";
    else if (rand < 0.94) return "None";
    else return "Not Applicable";
  }
  else if (clampedStrength >= 0.40) {
    // Low strength vendors (0.40-0.50) - 15-25% Full, 30-40% Partial, 40-50% None/NA
    if (rand < 0.20) return "Full";
    else if (rand < 0.50) return "Partial";
    else if (rand < 0.92) return "None";
    else return "Not Applicable";
  }
  else if (clampedStrength >= 0.30) {
    // Very low strength vendors (0.30-0.40) - 8-15% Full, 25-35% Partial, 55-65% None/NA
    if (rand < 0.12) return "Full";
    else if (rand < 0.40) return "Partial";
    else if (rand < 0.90) return "None";
    else return "Not Applicable";
  }
  else {
    // Weak vendors (0.0-0.30) - 2-8% Full, 15-25% Partial, 70-80% None/NA
    if (rand < 0.05) return "Full";
    else if (rand < 0.25) return "Partial";
    else if (rand < 0.88) return "None";
    else return "Not Applicable";
  }
}

// Generate realistic, vendor-specific remarks based on compliance score and persona
// Enhanced version with richer, more diverse responses leveraging full persona data
function generateRemark(
  compliance: ComplianceScore, 
  questionText: string, 
  vendorName: string
): string {
  const persona = getVendorPersona(vendorName);
  
  // Extract key topics from question for context-aware responses
  const questionLower = questionText.toLowerCase();
  const isSecurityQuestion = questionLower.includes('security') || questionLower.includes('encrypt') || 
                              questionLower.includes('auth') || questionLower.includes('compliance');
  const isScalabilityQuestion = questionLower.includes('scale') || questionLower.includes('performance') || 
                                 questionLower.includes('throughput');
  const isIntegrationQuestion = questionLower.includes('integrate') || questionLower.includes('api') || 
                                 questionLower.includes('interface');
  
  // Build rich, vendor-specific remarks pool
  const vendorRemarks: string[] = [];
  
  if (compliance === "Full") {
    // Leverage technical approach
    vendorRemarks.push(`Fully supported via our ${persona.technicalApproach.architecture.toLowerCase()}`);
    
    // Reference specific domain strengths
    if (persona.strengths.domain.length > 0) {
      const randomStrength = persona.strengths.domain[Math.floor(Math.random() * persona.strengths.domain.length)];
      vendorRemarks.push(`Complete coverage through ${randomStrength.toLowerCase()}`);
    }
    
    // Add technical capability highlights
    if (persona.strengths.technical.length > 0) {
      const randomTech = persona.strengths.technical[Math.floor(Math.random() * persona.strengths.technical.length)];
      vendorRemarks.push(`${randomTech} - fully addresses this requirement`);
    }
    
    // Market position influences response
    if (persona.marketPosition === "market_leader") {
      vendorRemarks.push("Industry-leading implementation proven at scale across 200+ deployments");
      vendorRemarks.push("Exceeds requirements with enterprise-grade capabilities");
    } else if (persona.marketPosition === "challenger") {
      vendorRemarks.push("Modern implementation leveraging latest industry best practices");
      vendorRemarks.push("Competitive feature set with innovative approach");
    } else if (persona.marketPosition === "specialist") {
      vendorRemarks.push("Deep specialization in this exact domain - comprehensive solution");
    }
    
    // Innovation level adds flavor
    if (persona.technicalApproach.innovationLevel === "cutting_edge") {
      vendorRemarks.push("Advanced implementation using AI/ML and latest industry standards");
      vendorRemarks.push("Next-generation capabilities with continuous innovation pipeline");
    } else if (persona.technicalApproach.innovationLevel === "modern") {
      vendorRemarks.push("Contemporary architecture with proven stability");
    }
    
    // Documentation quality affects detail
    if (persona.responseStyle.documentationQuality === "excellent") {
      vendorRemarks.push("Comprehensive documentation, SDKs, and reference implementations available");
      vendorRemarks.push("Extensive API documentation with code samples and tutorials");
    } else if (persona.responseStyle.documentationQuality === "good") {
      vendorRemarks.push("Detailed technical documentation and implementation guides provided");
    }
    
    // Business strengths
    if (persona.strengths.business.length > 0) {
      const randomBusiness = persona.strengths.business[Math.floor(Math.random() * persona.strengths.business.length)];
      vendorRemarks.push(`${randomBusiness} ensuring successful deployment`);
    }
    
    // Context-aware responses
    if (isSecurityQuestion) {
      vendorRemarks.push("Meets all security requirements with SOC 2, ISO 27001 compliance and encryption at rest/transit");
    }
    if (isScalabilityQuestion) {
      vendorRemarks.push("Proven scalability handling millions of transactions with auto-scaling architecture");
    }
    if (isIntegrationQuestion) {
      vendorRemarks.push("RESTful APIs with comprehensive SDK support and pre-built connectors");
    }
  } 
  else if (compliance === "Partial") {
    // Reference technical gaps
    if (persona.gaps.technical.length > 0) {
      const randomGap = persona.gaps.technical[Math.floor(Math.random() * persona.gaps.technical.length)];
      vendorRemarks.push(`Partial coverage - ${randomGap.toLowerCase()} may require workaround`);
      vendorRemarks.push(`Core functionality available, though ${randomGap.toLowerCase()}`);
    }
    
    // Business constraints
    if (persona.gaps.business.length > 0) {
      const randomBusinessGap = persona.gaps.business[Math.floor(Math.random() * persona.gaps.business.length)];
      vendorRemarks.push(`Meets 70-80% of requirements - ${randomBusinessGap.toLowerCase()} is a consideration`);
    }
    
    // Integration complexity impacts partial responses
    if (persona.technicalApproach.integrationComplexity === "high") {
      vendorRemarks.push("Requires custom integration development to fully meet requirement (4-6 weeks estimated)");
    } else if (persona.technicalApproach.integrationComplexity === "medium") {
      vendorRemarks.push("Standard configuration needed to fully address requirement (2-3 weeks)");
    }
    
    // Compliance approach affects response
    if (persona.responseStyle.complianceApproach === "proactive") {
      vendorRemarks.push("On product roadmap for Q2 2025 - interim workaround available");
      vendorRemarks.push("Partial native support + custom module can achieve full compliance");
    } else if (persona.responseStyle.complianceApproach === "selective") {
      vendorRemarks.push("Alternative approach recommended - will discuss in detail during evaluation");
    }
    
    // Generic partial remarks
    vendorRemarks.push("Meets most requirements, requires configuration for full compliance");
    vendorRemarks.push("Core functionality present, some gaps require customization");
  } 
  else if (compliance === "None") {
    // Reference specific gaps
    if (persona.gaps.technical.length > 0) {
      const randomGap = persona.gaps.technical[Math.floor(Math.random() * persona.gaps.technical.length)];
      vendorRemarks.push(`Not currently supported - ${randomGap.toLowerCase()} limits this capability`);
    }
    
    // Market position affects "None" responses
    if (persona.marketPosition === "specialist") {
      vendorRemarks.push("Outside our core specialization area - not part of current product scope");
    } else if (persona.marketPosition === "emerging") {
      vendorRemarks.push("Not yet available in current version - evaluating for future roadmap");
    }
    
    // Documentation gaps
    if (persona.gaps.documentation.length > 0) {
      vendorRemarks.push("Significant customization required - limited documentation for this use case");
    }
    
    // Alternative solutions
    vendorRemarks.push("Would require third-party integration or custom development (6-12 month effort)");
    vendorRemarks.push("Not supported natively - alternative approach using partner ecosystem proposed");
    vendorRemarks.push("Outside current product capabilities - recommend alternative solution");
  } 
  else if (compliance === "Not Applicable") {
    // Architecture-driven N/A
    vendorRemarks.push(`N/A - our ${persona.technicalApproach.architecture.toLowerCase()} uses different approach`);
    vendorRemarks.push("Not applicable to our solution architecture");
    vendorRemarks.push("Different architectural paradigm - requirement not relevant");
  }
  
  // Adjust remark frequency and detail based on response style
  const detailMultiplier = {
    comprehensive: 1.0,
    detailed: 0.85,
    summary: 0.70,
    brief: 0.50,
  }[persona.responseStyle.detailLevel] || 0.70;
  
  const remarkProbability = {
    excellent: 0.95,
    good: 0.85,
    adequate: 0.70,
    sparse: 0.55,
  }[persona.responseStyle.documentationQuality] || 0.70;
  
  const shouldAddRemark = Math.random() < (remarkProbability * detailMultiplier);
  
  if (!shouldAddRemark && compliance === "Full") {
    return ""; // Sometimes skip remarks for Full compliance (varies by vendor style)
  }
  
  if (vendorRemarks.length === 0) {
    return "";
  }
  
  return vendorRemarks[Math.floor(Math.random() * vendorRemarks.length)];
}

// Fill questionnaire with compliance scores
export async function fillQuestionnaireWithScores(
  originalBuffer: Buffer,
  vendorProfile: VendorProfile,
  questionnaireType: "Product" | "NFR" | "Cybersecurity" | "Agile" | "Procurement"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Worksheet not found in questionnaire");
  }
  
  // Determine strength based on questionnaire type
  let strength: number;
  switch (questionnaireType) {
    case "Product":
      strength = vendorProfile.productStrength;
      break;
    case "NFR":
      strength = vendorProfile.nfrStrength;
      break;
    case "Cybersecurity":
      strength = vendorProfile.cybersecurityStrength;
      break;
    case "Agile":
      strength = vendorProfile.agileStrength;
      break;
    case "Procurement":
      strength = vendorProfile.procurementStrength;
      break;
  }
  
  // Find the header row (usually row 1)
  const headerRow = worksheet.getRow(1);
  let complianceCol = -1;
  let remarksCol = -1;
  let questionCol = -1;
  
  headerRow.eachCell((cell, colNumber) => {
    const cellValue = cell.value?.toString().toLowerCase() || "";
    if (cellValue.includes("compliance")) {
      complianceCol = colNumber;
    } else if (cellValue.includes("remark")) {
      remarksCol = colNumber;
    } else if (cellValue.includes("question") || cellValue.includes("#")) {
      questionCol = colNumber;
    }
  });
  
  if (complianceCol === -1) {
    console.warn("Compliance column not found, creating default responses");
    return originalBuffer; // Return original if structure is unexpected
  }
  
  // Iterate through rows starting from row 2 (skip header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    // Check if this row has a question
    const questionCell = questionCol > 0 ? row.getCell(questionCol) : null;
    if (!questionCell || !questionCell.value) return; // Skip empty rows
    
    const questionText = questionCell.value.toString();
    
    // Generate compliance score
    const complianceScore = getRandomComplianceScore(strength);
    const complianceCell = row.getCell(complianceCol);
    complianceCell.value = complianceScore;
    
    // Generate and add remark if column exists
    if (remarksCol > 0) {
      const remark = generateRemark(complianceScore, questionText, vendorProfile.name);
      const remarkCell = row.getCell(remarksCol);
      remarkCell.value = remark;
    }
  });
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Parse Excel file to JSON for frontend editing
export interface QuestionnaireRow {
  rowNumber: number;
  question: string;
  compliance: ComplianceScore | string;
  remarks: string;
  [key: string]: any; // Allow for additional columns
}

export async function parseQuestionnaireToJSON(buffer: Buffer): Promise<{
  headers: string[];
  rows: QuestionnaireRow[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Worksheet not found");
  }
  
  // Get headers
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  const headerMap: { [key: string]: number } = {};
  
  headerRow.eachCell((cell, colNumber) => {
    const headerValue = cell.value?.toString() || `Column ${colNumber}`;
    headers.push(headerValue);
    headerMap[headerValue.toLowerCase()] = colNumber;
  });
  
  // Parse rows
  const rows: QuestionnaireRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const rowData: any = { rowNumber };
    
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      rowData[header] = cell.value?.toString() || "";
    });
    
    // Ensure required fields
    if (rowData.question || rowData.Question || rowData["#"]) {
      rows.push({
        rowNumber,
        question: rowData.question || rowData.Question || rowData["#"] || "",
        compliance: rowData.compliance || rowData.Compliance || "",
        remarks: rowData.remarks || rowData.Remarks || "",
        ...rowData,
      });
    }
  });
  
  return { headers, rows };
}

// Update Excel file with edited data
export async function updateQuestionnaireFromJSON(
  originalBuffer: Buffer,
  updatedRows: QuestionnaireRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(originalBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Worksheet not found");
  }
  
  // Find column indices
  const headerRow = worksheet.getRow(1);
  let complianceCol = -1;
  let remarksCol = -1;
  
  headerRow.eachCell((cell, colNumber) => {
    const cellValue = cell.value?.toString().toLowerCase() || "";
    if (cellValue.includes("compliance")) {
      complianceCol = colNumber;
    } else if (cellValue.includes("remark")) {
      remarksCol = colNumber;
    }
  });
  
  // Update rows
  updatedRows.forEach((updatedRow) => {
    const row = worksheet.getRow(updatedRow.rowNumber);
    
    if (complianceCol > 0) {
      row.getCell(complianceCol).value = updatedRow.compliance;
    }
    
    if (remarksCol > 0) {
      row.getCell(remarksCol).value = updatedRow.remarks;
    }
  });
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}

// Simple interface for frontend editing
export interface QuestionnaireQuestion {
  section: string;
  question: string;
  complianceScore: string;
  remarks: string;
}

// Parse Excel to simple question array for frontend
export async function parseExcelQuestionnaire(buffer: Buffer): Promise<QuestionnaireQuestion[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Worksheet not found");
  }
  
  // Find column indices
  const headerRow = worksheet.getRow(1);
  let sectionCol = -1;
  let questionCol = -1;
  let complianceCol = -1;
  let remarksCol = -1;
  
  headerRow.eachCell((cell, colNumber) => {
    const cellValue = cell.value?.toString().toLowerCase() || "";
    if (cellValue.includes("section") || cellValue.includes("category")) {
      sectionCol = colNumber;
    } else if (cellValue.includes("question") || cellValue === "#") {
      questionCol = colNumber;
    } else if (cellValue.includes("compliance")) {
      complianceCol = colNumber;
    } else if (cellValue.includes("remark")) {
      remarksCol = colNumber;
    }
  });
  
  const questions: QuestionnaireQuestion[] = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    const questionCell = questionCol > 0 ? row.getCell(questionCol) : null;
    if (!questionCell || !questionCell.value) return; // Skip empty rows
    
    questions.push({
      section: sectionCol > 0 ? (row.getCell(sectionCol).value?.toString() || "General") : "General",
      question: questionCell.value.toString(),
      complianceScore: complianceCol > 0 ? (row.getCell(complianceCol).value?.toString() || "") : "",
      remarks: remarksCol > 0 ? (row.getCell(remarksCol).value?.toString() || "") : "",
    });
  });
  
  return questions;
}

// Create Excel from question array
export async function createExcelQuestionnaire(
  name: string,
  questions: QuestionnaireQuestion[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(name);
  
  // Add header row
  worksheet.columns = [
    { header: "Section", key: "section", width: 20 },
    { header: "Question", key: "question", width: 50 },
    { header: "Compliance Score", key: "complianceScore", width: 20 },
    { header: "Remarks", key: "remarks", width: 40 },
  ];
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  
  // Add data rows
  questions.forEach((q) => {
    worksheet.addRow({
      section: q.section,
      question: q.question,
      complianceScore: q.complianceScore,
      remarks: q.remarks,
    });
  });
  
  // Add data validation for compliance scores
  const complianceColumn = worksheet.getColumn(3);
  complianceColumn.eachCell((cell, rowNumber) => {
    if (rowNumber > 1) { // Skip header
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Full,Partial,Not Applicable,None"'],
      };
    }
  });
  
  return await workbook.xlsx.writeBuffer() as Buffer;
}
