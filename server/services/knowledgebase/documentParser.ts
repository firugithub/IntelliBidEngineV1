import { PDFParse } from "pdf-parse";

export interface ParsedDocument {
  text: string;
  fileName: string;
  pageCount?: number;
}

export async function parseDocument(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const fileExtension = fileName.toLowerCase().split('.').pop();

  try {
    if (fileExtension === 'pdf') {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();
      
      return {
        text: textResult.text,
        fileName,
        pageCount: textResult.pages.length,
      };
    } else if (fileExtension === 'txt') {
      return {
        text: buffer.toString('utf-8'),
        fileName,
      };
    } else {
      // For other formats (Word, Excel), return a simplified text extraction
      // In production, use libraries like mammoth or xlsx
      return {
        text: buffer.toString('utf-8'),
        fileName,
      };
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error(`Failed to parse document: ${fileName}`);
  }
}
