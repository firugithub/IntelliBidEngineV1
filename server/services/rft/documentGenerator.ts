import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip, Table, TableCell, TableRow, WidthType, BorderStyle } from "docx";
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

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

interface ParsedContent {
  type: 'paragraph' | 'heading' | 'bulletList' | 'numberedList' | 'table';
  level?: number;
  segments?: TextSegment[];
  items?: ParsedContent[];
  rows?: string[][];
}

// Parse markdown text into structured content
function parseMarkdownContent(content: string): ParsedContent[] {
  const lines = content.split('\n');
  const parsed: ParsedContent[] = [];
  let currentBulletList: string[] = [];
  let currentNumberedList: string[] = [];
  let currentTable: string[][] = [];
  let inTable = false;

  const flushLists = () => {
    if (currentBulletList.length > 0) {
      parsed.push({
        type: 'bulletList',
        items: currentBulletList.map(text => ({
          type: 'paragraph',
          segments: parseInlineFormatting(text)
        }))
      });
      currentBulletList = [];
    }
    if (currentNumberedList.length > 0) {
      parsed.push({
        type: 'numberedList',
        items: currentNumberedList.map(text => ({
          type: 'paragraph',
          segments: parseInlineFormatting(text)
        }))
      });
      currentNumberedList = [];
    }
    if (currentTable.length > 0 && inTable) {
      parsed.push({
        type: 'table',
        rows: currentTable
      });
      currentTable = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) {
      flushLists();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushLists();
      parsed.push({
        type: 'heading',
        level: headerMatch[1].length,
        segments: parseInlineFormatting(headerMatch[2])
      });
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      
      // Skip separator lines (e.g., |---|---|)
      if (!cells.every(c => c.match(/^-+$/))) {
        if (!inTable) {
          flushLists();
          inTable = true;
        }
        currentTable.push(cells);
      }
      continue;
    } else if (inTable) {
      flushLists();
    }

    // Bullet lists
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (currentNumberedList.length > 0) {
        flushLists();
      }
      currentBulletList.push(bulletMatch[1]);
      continue;
    }

    // Numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (currentBulletList.length > 0) {
        flushLists();
      }
      currentNumberedList.push(numberedMatch[1]);
      continue;
    }

    // Regular paragraph
    flushLists();
    if (line.trim()) {
      parsed.push({
        type: 'paragraph',
        segments: parseInlineFormatting(line)
      });
    }
  }

  flushLists();
  return parsed;
}

// Parse inline formatting (bold, italic)
function parseInlineFormatting(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Look for **bold** or __bold__
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/) || remaining.match(/^(.*?)__(.+?)__(.*)$/);
    if (boldMatch) {
      if (boldMatch[1]) segments.push({ text: boldMatch[1] });
      segments.push({ text: boldMatch[2], bold: true });
      remaining = boldMatch[3];
      continue;
    }

    // Look for *italic* or _italic_
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)$/) || remaining.match(/^(.*?)_(.+?)_(.*)$/);
    if (italicMatch) {
      if (italicMatch[1]) segments.push({ text: italicMatch[1] });
      segments.push({ text: italicMatch[2], italic: true });
      remaining = italicMatch[3];
      continue;
    }

    // No more formatting found
    segments.push({ text: remaining });
    break;
  }

  return segments.length > 0 ? segments : [{ text }];
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

    // Parse and add section content with formatting
    const parsedContent = parseMarkdownContent(section.content);
    
    for (const item of parsedContent) {
      if (item.type === 'paragraph') {
        const textRuns = item.segments!.map(seg => 
          new TextRun({ 
            text: seg.text, 
            bold: seg.bold, 
            italics: seg.italic 
          })
        );
        docSections.push(
          new Paragraph({
            children: textRuns,
            spacing: { after: 200 },
          })
        );
      } else if (item.type === 'heading') {
        const headingLevel = item.level === 1 ? HeadingLevel.HEADING_2 : 
                           item.level === 2 ? HeadingLevel.HEADING_3 : 
                           HeadingLevel.HEADING_3;
        const textRuns = item.segments!.map(seg => 
          new TextRun({ 
            text: seg.text, 
            bold: seg.bold, 
            italics: seg.italic 
          })
        );
        docSections.push(
          new Paragraph({
            children: textRuns,
            heading: headingLevel,
            spacing: { before: 200, after: 150 },
          })
        );
      } else if (item.type === 'bulletList') {
        for (const listItem of item.items!) {
          const textRuns = listItem.segments!.map(seg => 
            new TextRun({ 
              text: seg.text, 
              bold: seg.bold, 
              italics: seg.italic 
            })
          );
          docSections.push(
            new Paragraph({
              children: textRuns,
              bullet: { level: 0 },
              spacing: { after: 100 },
            })
          );
        }
      } else if (item.type === 'numberedList') {
        for (let i = 0; i < item.items!.length; i++) {
          const listItem = item.items![i];
          const textRuns = [
            new TextRun({ text: `${i + 1}. `, bold: false }),
            ...listItem.segments!.map(seg => 
              new TextRun({ 
                text: seg.text, 
                bold: seg.bold, 
                italics: seg.italic 
              })
            )
          ];
          docSections.push(
            new Paragraph({
              children: textRuns,
              spacing: { after: 100 },
              indent: { left: convertInchesToTwip(0.5) },
            })
          );
        }
      } else if (item.type === 'table' && item.rows && item.rows.length > 0) {
        const tableRows = item.rows.map((row, rowIndex) => 
          new TableRow({
            children: row.map(cell => 
              new TableCell({
                children: [new Paragraph({ text: cell })],
                shading: rowIndex === 0 ? {
                  fill: "E5E7EB",
                  type: "clear"
                } : undefined,
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE }
              })
            )
          })
        );
        
        docSections.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        );
        
        docSections.push(
          new Paragraph({
            text: "",
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

        // Parse and render section content with formatting
        const parsedContent = parseMarkdownContent(section.content);
        
        for (const item of parsedContent) {
          if (item.type === 'paragraph') {
            doc.fontSize(11).font('Helvetica');
            for (let idx = 0; idx < item.segments!.length; idx++) {
              const seg = item.segments![idx];
              const font = seg.bold ? 'Helvetica-Bold' : seg.italic ? 'Helvetica-Oblique' : 'Helvetica';
              const isLastSegment = idx === item.segments!.length - 1;
              doc.font(font).text(seg.text, { 
                continued: !isLastSegment, 
                width: doc.page.width - 144 
              });
            }
            doc.moveDown(0.5);
          } else if (item.type === 'heading') {
            const fontSize = item.level === 1 ? 14 : item.level === 2 ? 12 : 11;
            doc.fontSize(fontSize).font('Helvetica-Bold');
            for (const seg of item.segments!) {
              doc.text(seg.text, { continued: seg !== item.segments![item.segments!.length - 1] });
            }
            doc.moveDown(0.3);
          } else if (item.type === 'bulletList') {
            doc.fontSize(11).font('Helvetica');
            for (const listItem of item.items!) {
              const startY = doc.y;
              const bulletX = doc.x;
              
              // Render bullet marker
              doc.text('•', bulletX, startY, { continued: true, lineBreak: false });
              
              // Render text segments on same line
              for (const seg of listItem.segments!) {
                const font = seg.bold ? 'Helvetica-Bold' : seg.italic ? 'Helvetica-Oblique' : 'Helvetica';
                doc.font(font).text(seg.text, { continued: true, lineBreak: false });
              }
              
              // End the line
              doc.text('', { continued: false });
              doc.moveDown(0.3);
            }
          } else if (item.type === 'numberedList') {
            doc.fontSize(11).font('Helvetica');
            for (let idx = 0; idx < item.items!.length; idx++) {
              const listItem = item.items![idx];
              const startY = doc.y;
              const numberX = doc.x;
              
              // Render number marker
              doc.text(`${idx + 1}.  `, numberX, startY, { continued: true, lineBreak: false });
              
              // Render text segments on same line
              for (const seg of listItem.segments!) {
                const font = seg.bold ? 'Helvetica-Bold' : seg.italic ? 'Helvetica-Oblique' : 'Helvetica';
                doc.font(font).text(seg.text, { continued: true, lineBreak: false });
              }
              
              // End the line
              doc.text('', { continued: false });
              doc.moveDown(0.3);
            }
          } else if (item.type === 'table' && item.rows && item.rows.length > 0) {
            doc.fontSize(10).font('Helvetica');
            const tableTop = doc.y;
            const tableLeft = 72;
            const tableWidth = doc.page.width - 144;
            const colWidth = tableWidth / item.rows[0].length;
            
            item.rows.forEach((row, rowIndex) => {
              const rowY = doc.y;
              const rowHeight = 25;
              
              // Draw row background for header
              if (rowIndex === 0) {
                doc.rect(tableLeft, rowY, tableWidth, rowHeight).fill('#E5E7EB');
                doc.fillColor('#000000'); // Reset text color
              }
              
              // Draw cells
              row.forEach((cell, cellIndex) => {
                const cellX = tableLeft + (cellIndex * colWidth);
                const font = rowIndex === 0 ? 'Helvetica-Bold' : 'Helvetica';
                doc.font(font).text(cell, cellX + 5, rowY + 5, {
                  width: colWidth - 10,
                  height: rowHeight - 10,
                  ellipsis: true
                });
              });
              
              // Draw borders
              doc.rect(tableLeft, rowY, tableWidth, rowHeight).stroke();
              for (let i = 1; i < row.length; i++) {
                const lineX = tableLeft + (i * colWidth);
                doc.moveTo(lineX, rowY).lineTo(lineX, rowY + rowHeight).stroke();
              }
              
              doc.y = rowY + rowHeight;
            });
            
            doc.moveDown(1);
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
