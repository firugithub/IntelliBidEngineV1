import ExcelJS from "exceljs";

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

// Define realistic vendor profiles with different strengths
export function createVendorProfiles(vendorNames: string[]): VendorProfile[] {
  const profiles: VendorProfile[] = [];
  
  for (let i = 0; i < vendorNames.length; i++) {
    // Create varied profiles
    if (i === 0) {
      // First vendor: Strong in product, weak in agile
      profiles.push({
        name: vendorNames[i],
        productStrength: 0.85,
        nfrStrength: 0.70,
        cybersecurityStrength: 0.75,
        agileStrength: 0.60,
      });
    } else if (i === 1) {
      // Second vendor: Balanced across all areas
      profiles.push({
        name: vendorNames[i],
        productStrength: 0.75,
        nfrStrength: 0.80,
        cybersecurityStrength: 0.85,
        agileStrength: 0.70,
      });
    } else {
      // Third vendor: Strong in agile/cybersecurity, weak in product
      profiles.push({
        name: vendorNames[i],
        productStrength: 0.65,
        nfrStrength: 0.75,
        cybersecurityStrength: 0.90,
        agileStrength: 0.85,
      });
    }
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

// Generate realistic remarks based on compliance score
function generateRemark(compliance: ComplianceScore, questionText: string): string {
  const remarks = {
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
  
  const options = remarks[compliance];
  const shouldAddRemark = Math.random() < 0.7; // 70% chance of adding a remark
  
  if (!shouldAddRemark && compliance === "Full") {
    return ""; // Don't always add remarks for Full compliance
  }
  
  return options[Math.floor(Math.random() * options.length)];
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
      const remark = generateRemark(complianceScore, questionText);
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
