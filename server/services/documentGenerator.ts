import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from "docx";
import * as fs from "fs";
import * as path from "path";
import htmlPdf from "html-pdf-node";

interface RftSection {
  title: string;
  content: string;
  sectionId?: string;
}

interface GenerateDocOptions {
  projectName: string;
  sections: RftSection[];
  outputPath: string;
}

export async function generateDocxDocument(options: GenerateDocOptions): Promise<string> {
  const { projectName, sections, outputPath } = options;

  // Create document sections
  const docSections = [];

  // Title page
  docSections.push(
    new Paragraph({
      text: projectName,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: "Request for Technology (RFT)",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    })
  );

  // Add each section
  for (const section of sections) {
    // Section title
    docSections.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Section content - split by paragraphs
    const paragraphs = section.content.split("\n\n");
    for (const para of paragraphs) {
      if (para.trim()) {
        docSections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
          })
        );
      }
    }

    // Add spacing after section
    docSections.push(
      new Paragraph({
        text: "",
        spacing: { after: 400 },
      })
    );
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: docSections,
      },
    ],
  });

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate buffer and write to file
  const { Packer } = await import("docx");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

// Helper function to escape HTML special characters
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

export async function generatePdfDocument(options: GenerateDocOptions): Promise<string> {
  const { projectName, sections, outputPath } = options;

  // Escape project name for safe HTML insertion
  const escapedProjectName = escapeHtml(projectName);
  const escapedDate = escapeHtml(new Date().toLocaleDateString());

  // Build HTML content
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        .title-page {
          text-align: center;
          margin-bottom: 60px;
        }
        .title-page h1 {
          font-size: 32px;
          margin-bottom: 10px;
          color: #1a1a1a;
        }
        .title-page h2 {
          font-size: 24px;
          margin-bottom: 20px;
          color: #444;
          font-weight: normal;
        }
        .title-page .date {
          font-size: 14px;
          color: #666;
          margin-top: 20px;
        }
        .section {
          margin-bottom: 40px;
          page-break-inside: avoid;
        }
        .section h2 {
          font-size: 20px;
          color: #1a1a1a;
          border-bottom: 2px solid #333;
          padding-bottom: 8px;
          margin-bottom: 20px;
        }
        .section p {
          margin-bottom: 15px;
          text-align: justify;
          white-space: pre-wrap;
        }
        @media print {
          .title-page {
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="title-page">
        <h1>${escapedProjectName}</h1>
        <h2>Request for Technology (RFT)</h2>
        <p class="date">Generated: ${escapedDate}</p>
      </div>
  `;

  // Add sections with proper HTML escaping
  for (const section of sections) {
    const escapedTitle = escapeHtml(section.title);
    html += `
      <div class="section">
        <h2>${escapedTitle}</h2>
    `;

    const paragraphs = section.content.split("\n\n");
    for (const para of paragraphs) {
      if (para.trim()) {
        const escapedPara = escapeHtml(para.trim());
        html += `<p>${escapedPara}</p>`;
      }
    }

    html += `</div>`;
  }

  html += `
    </body>
    </html>
  `;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate PDF
  const file = { content: html };
  const pdfOptions = {
    format: "A4",
    margin: {
      top: "20mm",
      right: "20mm",
      bottom: "20mm",
      left: "20mm",
    },
  };

  try {
    const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions) as unknown as Buffer;
    if (!pdfBuffer) {
      throw new Error("PDF buffer is empty");
    }
    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF document");
  }
}

// Helper to clean up old document files
export function cleanupDocumentFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
