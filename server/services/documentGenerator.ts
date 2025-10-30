import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from "docx";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";

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

export async function generatePdfDocument(options: GenerateDocOptions): Promise<string> {
  const { projectName, sections, outputPath } = options;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
        bufferPages: true,
      });

      // Pipe to file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title page
      doc.fontSize(24).font('Helvetica-Bold').text(projectName, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).font('Helvetica').text('Request for Technology (RFT)', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(3);

      // Add sections
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        // Add page break before section (except first one)
        if (i > 0) {
          doc.addPage();
        }

        // Section title
        doc.fontSize(16).font('Helvetica-Bold').text(section.title);
        doc.moveDown(0.5);
        
        // Add underline
        const titleY = doc.y;
        doc.moveTo(72, titleY).lineTo(doc.page.width - 72, titleY).stroke();
        doc.moveDown(1);

        // Section content - split by paragraphs
        const paragraphs = section.content.split("\n\n");
        doc.fontSize(11).font('Helvetica');
        
        for (const para of paragraphs) {
          if (para.trim()) {
            doc.text(para.trim(), {
              align: 'justify',
              lineGap: 5,
            });
            doc.moveDown(0.8);
          }
        }
      }

      // Finalize PDF
      doc.end();

      // Wait for stream to finish
      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        console.error("Error writing PDF:", error);
        reject(new Error("Failed to write PDF document"));
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      reject(new Error("Failed to generate PDF document"));
    }
  });
}

// Helper to clean up old document files
export function cleanupDocumentFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
