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

const COMPLIANCE_OPTIONS = [
  '100%-Fully Met',
  '50%-Partially Met',
  '25%-Not Compliant',
  '0%-Not Applicable'
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
 * Generate all 4 RFT questionnaires
 */
export async function generateAllQuestionnaires(
  projectId: string,
  questions: {
    product: QuestionnaireQuestion[];
    nfr: QuestionnaireQuestion[];
    cybersecurity: QuestionnaireQuestion[];
    agile: QuestionnaireQuestion[];
  }
): Promise<{
  productPath: string;
  nfrPath: string;
  cybersecurityPath: string;
  agilePath: string;
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

  return {
    productPath,
    nfrPath,
    cybersecurityPath,
    agilePath
  };
}
