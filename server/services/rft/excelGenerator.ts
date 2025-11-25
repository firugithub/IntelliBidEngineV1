import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export interface QuestionnaireQuestion {
  number: number;
  question: string;
  category?: string;
}

export interface QuestionnaireConfig {
  title: string;
  questions: QuestionnaireQuestion[];
  filename: string;
}

export interface ProcurementCostItem {
  number: number;
  costCategory: string;
  description: string;
  unit: string;
}

export interface ProcurementQuestionnaireConfig {
  title: string;
  questions: QuestionnaireQuestion[];
  costItems: ProcurementCostItem[];
  filename: string;
}

const COMPLIANCE_OPTIONS = [
  '100%-Fully Met',
  '50%-Partially Met',
  '25%-Not Compliant',
  '0%-Not Applicable'
];

const LICENSING_MODEL_OPTIONS = [
  'Perpetual License',
  'Annual Subscription',
  'Per-User/Seat License',
  'Enterprise License',
  'Usage-Based/Pay-as-you-go',
  'Hybrid Model'
];

const PAYMENT_TERMS_OPTIONS = [
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90',
  'Milestone-based',
  'Annual Upfront',
  'Quarterly'
];

const DEFAULT_PROCUREMENT_COST_ITEMS: ProcurementCostItem[] = [
  { number: 1, costCategory: 'Software Licensing', description: 'Base software license cost (Year 1)', unit: 'USD' },
  { number: 2, costCategory: 'Software Licensing', description: 'Annual license renewal cost (Years 2-5)', unit: 'USD/year' },
  { number: 3, costCategory: 'Implementation', description: 'Implementation & configuration services', unit: 'USD' },
  { number: 4, costCategory: 'Implementation', description: 'Data migration services', unit: 'USD' },
  { number: 5, costCategory: 'Implementation', description: 'System integration costs', unit: 'USD' },
  { number: 6, costCategory: 'Training', description: 'End-user training (per batch)', unit: 'USD' },
  { number: 7, costCategory: 'Training', description: 'Administrator/technical training', unit: 'USD' },
  { number: 8, costCategory: 'Support & Maintenance', description: 'Annual support & maintenance fee', unit: 'USD/year' },
  { number: 9, costCategory: 'Support & Maintenance', description: 'Premium support upgrade (24/7)', unit: 'USD/year' },
  { number: 10, costCategory: 'Infrastructure', description: 'Cloud hosting/infrastructure (annual)', unit: 'USD/year' },
  { number: 11, costCategory: 'Infrastructure', description: 'Additional storage (per TB)', unit: 'USD/TB/year' },
  { number: 12, costCategory: 'Professional Services', description: 'Custom development (per day rate)', unit: 'USD/day' },
  { number: 13, costCategory: 'Professional Services', description: 'Consulting services (per day rate)', unit: 'USD/day' },
  { number: 14, costCategory: 'Hidden Costs', description: 'Change request/modification fees', unit: 'USD/request' },
  { number: 15, costCategory: 'Hidden Costs', description: 'Additional user licenses (per user)', unit: 'USD/user' },
];

/**
 * Generates an Excel questionnaire with dropdown validation
 */
export async function generateQuestionnaire(config: QuestionnaireConfig): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(config.title);

  // Set column widths
  worksheet.columns = [
    { header: 'No.', key: 'number', width: 8 },
    { header: 'Question', key: 'question', width: 60 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Compliance Score', key: 'compliance', width: 25 },
    { header: 'Remarks', key: 'remarks', width: 40 }
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4788' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add questions
  config.questions.forEach((q, index) => {
    const rowNumber = index + 2; // +2 because of header row
    const row = worksheet.addRow({
      number: q.number,
      question: q.question,
      category: q.category || '',
      compliance: '',
      remarks: ''
    });

    // Style data rows
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 30;

    // Add dropdown validation for Compliance Score column
    const complianceCell = worksheet.getCell(`D${rowNumber}`);
    complianceCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${COMPLIANCE_OPTIONS.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'error',
      errorTitle: 'Invalid Selection',
      error: 'Please select a valid compliance score'
    };

    // Add light gray background for alternating rows
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }
        };
      });
    }
  });

  // Add borders to all cells
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  // Freeze header row
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1 }
  ];

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads', 'questionnaires');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Save file
  const filePath = path.join(uploadsDir, config.filename);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

/**
 * Generates a specialized Procurement & Commercial questionnaire with cost/pricing sheets
 * Sheet 1: Commercial Terms Questions (with compliance dropdowns)
 * Sheet 2: Cost Breakdown (with pricing input fields)
 * Sheet 3: TCO Summary (auto-calculated formulas)
 */
export async function generateProcurementQuestionnaire(config: ProcurementQuestionnaireConfig): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  
  // ==========================================
  // SHEET 1: Commercial Terms Questions
  // ==========================================
  const termsSheet = workbook.addWorksheet('Commercial Terms');
  
  termsSheet.columns = [
    { header: 'No.', key: 'number', width: 8 },
    { header: 'Question', key: 'question', width: 55 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Compliance Score', key: 'compliance', width: 22 },
    { header: 'Licensing Model', key: 'licensing', width: 25 },
    { header: 'Payment Terms', key: 'payment', width: 18 },
    { header: 'Remarks/Details', key: 'remarks', width: 40 }
  ];

  // Style header row
  const termsHeader = termsSheet.getRow(1);
  termsHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  termsHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4788' }
  };
  termsHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  termsHeader.height = 28;

  // Add questions with dropdowns
  config.questions.forEach((q, index) => {
    const rowNumber = index + 2;
    const row = termsSheet.addRow({
      number: q.number,
      question: q.question,
      category: q.category || 'Commercial',
      compliance: '',
      licensing: '',
      payment: '',
      remarks: ''
    });

    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 35;

    // Compliance dropdown
    termsSheet.getCell(`D${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${COMPLIANCE_OPTIONS.join(',')}"`]
    };

    // Licensing model dropdown
    termsSheet.getCell(`E${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${LICENSING_MODEL_OPTIONS.join(',')}"`]
    };

    // Payment terms dropdown
    termsSheet.getCell(`F${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${PAYMENT_TERMS_OPTIONS.join(',')}"`]
    };

    // Alternating row colors
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      });
    }
  });

  // Add borders
  termsSheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  termsSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ==========================================
  // SHEET 2: Cost Breakdown (Pricing Input)
  // ==========================================
  const costSheet = workbook.addWorksheet('Cost Breakdown');
  
  costSheet.columns = [
    { header: 'No.', key: 'number', width: 6 },
    { header: 'Cost Category', key: 'category', width: 22 },
    { header: 'Cost Item Description', key: 'description', width: 45 },
    { header: 'Unit', key: 'unit', width: 15 },
    { header: 'Unit Price (USD)', key: 'unitPrice', width: 18 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Year 1 Cost', key: 'year1', width: 15 },
    { header: 'Year 2 Cost', key: 'year2', width: 15 },
    { header: 'Year 3 Cost', key: 'year3', width: 15 },
    { header: 'Year 4 Cost', key: 'year4', width: 15 },
    { header: 'Year 5 Cost', key: 'year5', width: 15 },
    { header: '5-Year Total', key: 'total', width: 16 },
    { header: 'Notes', key: 'notes', width: 30 }
  ];

  // Style header row with green color for cost sheet
  const costHeader = costSheet.getRow(1);
  costHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  costHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2E7D32' } // Green for financial data
  };
  costHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  costHeader.height = 35;

  // Use provided cost items or defaults
  const costItems = config.costItems.length > 0 ? config.costItems : DEFAULT_PROCUREMENT_COST_ITEMS;
  
  costItems.forEach((item, index) => {
    const rowNumber = index + 2;
    const row = costSheet.addRow({
      number: item.number,
      category: item.costCategory,
      description: item.description,
      unit: item.unit,
      unitPrice: '',
      quantity: 1,
      year1: '',
      year2: '',
      year3: '',
      year4: '',
      year5: '',
      total: '',
      notes: ''
    });

    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = 28;

    // Format currency columns
    ['E', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(col => {
      const cell = costSheet.getCell(`${col}${rowNumber}`);
      cell.numFmt = '"$"#,##0.00';
    });

    // Add formula for 5-Year Total (sum of Year 1-5)
    costSheet.getCell(`L${rowNumber}`).value = {
      formula: `SUM(G${rowNumber}:K${rowNumber})`
    };

    // Alternating row colors (light yellow for cost items)
    if (index % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
      });
    }
  });

  // Add borders to cost sheet
  costSheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  costSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ==========================================
  // SHEET 3: TCO Summary (Total Cost of Ownership)
  // ==========================================
  const tcoSheet = workbook.addWorksheet('TCO Summary');
  
  // Vendor Information Section
  tcoSheet.mergeCells('A1:D1');
  tcoSheet.getCell('A1').value = 'VENDOR COST SUMMARY';
  tcoSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  tcoSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
  tcoSheet.getCell('A1').alignment = { horizontal: 'center' };
  tcoSheet.getRow(1).height = 30;

  // Add summary rows
  const summaryRows = [
    { label: 'Vendor Name:', value: '', formula: null },
    { label: 'Solution Name:', value: '', formula: null },
    { label: '', value: '', formula: null },
    { label: 'COST CATEGORY', value: '5-YEAR TOTAL (USD)', formula: null },
    { label: 'Software Licensing', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Software Licensing",'Cost Breakdown'!L:L)` },
    { label: 'Implementation', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Implementation",'Cost Breakdown'!L:L)` },
    { label: 'Training', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Training",'Cost Breakdown'!L:L)` },
    { label: 'Support & Maintenance', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Support & Maintenance",'Cost Breakdown'!L:L)` },
    { label: 'Infrastructure', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Infrastructure",'Cost Breakdown'!L:L)` },
    { label: 'Professional Services', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Professional Services",'Cost Breakdown'!L:L)` },
    { label: 'Hidden Costs', value: '', formula: `SUMIF('Cost Breakdown'!B:B,"Hidden Costs",'Cost Breakdown'!L:L)` },
    { label: '', value: '', formula: null },
    { label: 'TOTAL COST OF OWNERSHIP (5-Year)', value: '', formula: `SUM(B6:B12)` },
    { label: 'Average Annual Cost', value: '', formula: `B14/5` },
  ];

  tcoSheet.columns = [
    { key: 'label', width: 35 },
    { key: 'value', width: 25 },
    { key: 'empty1', width: 5 },
    { key: 'notes', width: 40 }
  ];

  summaryRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const excelRow = tcoSheet.addRow({ label: row.label, value: row.value });
    
    if (row.formula) {
      tcoSheet.getCell(`B${rowNumber}`).value = { formula: row.formula };
    }

    // Style category header row
    if (row.label === 'COST CATEGORY') {
      excelRow.font = { bold: true };
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    }

    // Style total row
    if (row.label === 'TOTAL COST OF OWNERSHIP (5-Year)') {
      excelRow.font = { bold: true, size: 12 };
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
      tcoSheet.getCell(`B${rowNumber}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      tcoSheet.getCell(`A${rowNumber}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    }

    // Format currency cells
    if (rowNumber >= 6) {
      tcoSheet.getCell(`B${rowNumber}`).numFmt = '"$"#,##0.00';
    }
  });

  // Add borders to TCO sheet
  tcoSheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });
  });

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads', 'questionnaires');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Save file
  const filePath = path.join(uploadsDir, config.filename);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

/**
 * Generate all 5 RFT questionnaires (including Procurement with cost breakdown)
 */
export async function generateAllQuestionnaires(
  projectId: string,
  questions: {
    product: QuestionnaireQuestion[];
    nfr: QuestionnaireQuestion[];
    cybersecurity: QuestionnaireQuestion[];
    agile: QuestionnaireQuestion[];
    procurement?: QuestionnaireQuestion[];
  }
): Promise<{
  productPath: string;
  nfrPath: string;
  cybersecurityPath: string;
  agilePath: string;
  procurementPath?: string;
}> {
  const timestamp = Date.now();

  const [productPath, nfrPath, cybersecurityPath, agilePath] = await Promise.all([
    generateQuestionnaire({
      title: 'Product Questionnaire',
      questions: questions.product,
      filename: `${projectId}_product_${timestamp}.xlsx`
    }),
    generateQuestionnaire({
      title: 'NFR Questionnaire',
      questions: questions.nfr,
      filename: `${projectId}_nfr_${timestamp}.xlsx`
    }),
    generateQuestionnaire({
      title: 'Cybersecurity Questionnaire',
      questions: questions.cybersecurity,
      filename: `${projectId}_cybersecurity_${timestamp}.xlsx`
    }),
    generateQuestionnaire({
      title: 'Agile Delivery Questionnaire',
      questions: questions.agile,
      filename: `${projectId}_agile_${timestamp}.xlsx`
    })
  ]);

  // Generate Procurement questionnaire with cost breakdown sheets if questions provided
  let procurementPath: string | undefined;
  if (questions.procurement && questions.procurement.length > 0) {
    procurementPath = await generateProcurementQuestionnaire({
      title: 'Procurement & Commercial Questionnaire',
      questions: questions.procurement,
      costItems: DEFAULT_PROCUREMENT_COST_ITEMS,
      filename: `${projectId}_procurement_${timestamp}.xlsx`
    });
  }

  return {
    productPath,
    nfrPath,
    cybersecurityPath,
    agilePath,
    procurementPath
  };
}
