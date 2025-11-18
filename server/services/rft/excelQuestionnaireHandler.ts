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
    });
  }
  
  return profiles;
}

// Get compliance score based on vendor strength
function getRandomComplianceScore(strength: number): ComplianceScore {
  const rand = Math.random();
  
  if (rand < strength * 0.7) {
    return "Full";
  } else if (rand < strength * 0.9) {
    return "Partial";
  } else if (rand < 0.95) {
    return "None";
  } else {
    return "Not Applicable";
  }
}

// Generate realistic, vendor-specific remarks based on compliance score and persona
function generateRemark(
  compliance: ComplianceScore, 
  questionText: string, 
  vendorName: string
): string {
  const persona = getVendorPersona(vendorName);
  
  // Base remarks for each compliance level
  const baseRemarks = {
    Full: [
      "Fully compliant with all requirements",
      "Meets all specified criteria",
      "Complete implementation available",
      "Exceeds requirements",
      "Comprehensive coverage provided",
    ],
    Partial: [
      "Partially meets requirements - customization needed",
      "Meets most requirements, some gaps identified",
      "Requires additional configuration",
      "Implementation in progress",
      "Roadmap item for full compliance",
    ],
    None: [
      "Does not meet this requirement",
      "Not currently supported",
      "Would require significant customization",
      "Outside current product scope",
      "Alternative approach proposed",
    ],
    "Not Applicable": [
      "Not applicable to our solution",
      "N/A - different architecture",
      "Not relevant for this implementation",
    ],
  };
  
  // Add vendor-specific flavor based on persona characteristics
  const vendorSpecificRemarks = {
    Full: [] as string[],
    Partial: [] as string[],
    None: [] as string[],
    "Not Applicable": [] as string[]
  };
  
  // Add persona-specific remarks for Full compliance
  if (compliance === "Full") {
    if (persona.strengths.domain.length > 0) {
      vendorSpecificRemarks.Full.push(`Supported via ${persona.strengths.domain[0].split(' ')[0]} capabilities`);
    }
    if (persona.technicalApproach.innovationLevel === "cutting_edge") {
      vendorSpecificRemarks.Full.push("Advanced implementation using latest industry standards");
    }
    if (persona.responseStyle.documentationQuality === "excellent") {
      vendorSpecificRemarks.Full.push("Comprehensive documentation and examples available");
    }
  }
  
  // Add persona-specific remarks for Partial compliance
  if (compliance === "Partial") {
    if (persona.gaps.technical.length > 0) {
      vendorSpecificRemarks.Partial.push(`Partial coverage - ${persona.gaps.technical[0].toLowerCase()}`);
    }
    if (persona.technicalApproach.integrationComplexity === "high") {
      vendorSpecificRemarks.Partial.push("Requires integration effort to fully meet requirement");
    }
  }
  
  // Add persona-specific remarks for None compliance
  if (compliance === "None") {
    if (persona.gaps.technical.length > 1) {
      vendorSpecificRemarks.None.push(`Not supported due to ${persona.gaps.technical[0].toLowerCase()}`);
    }
    if (persona.marketPosition === "specialist") {
      vendorSpecificRemarks.None.push("Outside our core domain specialization");
    }
  }
  
  // Combine base and vendor-specific remarks
  const allRemarks = [...baseRemarks[compliance], ...vendorSpecificRemarks[compliance]];
  
  // Adjust remark frequency based on documentation quality
  const remarkProbability = {
    excellent: 0.85,
    good: 0.75,
    adequate: 0.65,
    sparse: 0.50,
  }[persona.responseStyle.documentationQuality] || 0.70;
  
  const shouldAddRemark = Math.random() < remarkProbability;
  
  if (!shouldAddRemark && compliance === "Full") {
    return ""; // Don't always add remarks for Full compliance
  }
  
  if (allRemarks.length === 0) {
    return "";
  }
  
  return allRemarks[Math.floor(Math.random() * allRemarks.length)];
}

// Fill questionnaire with compliance scores
export async function fillQuestionnaireWithScores(
  originalBuffer: Buffer,
  vendorProfile: VendorProfile,
  questionnaireType: "Product" | "NFR" | "Cybersecurity" | "Agile"
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
