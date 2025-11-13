import { type RftGenerationDraft, type OrganizationTemplate } from "@shared/schema";
import { storage } from "../../storage";
import { AzureBlobStorageService } from "../azure/azureBlobStorage";
import { normalizeBlobIdentifiers } from "./templateService";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

const blobStorageService = new AzureBlobStorageService();

interface MergeData {
  [key: string]: string | number | boolean | MergeData | MergeData[];
}

interface GeneratedSection {
  sectionId: string;
  sectionName: string;
  content: string;
  assignedTo: string;
  reviewStatus: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
}

interface MergeResult {
  blobUrl: string;
  blobName: string;
  fileName: string;
}

export class TemplateMergeService {
  async mergeTemplate(
    templateId: string,
    draftId: string,
    projectId: string,
    additionalData?: MergeData
  ): Promise<MergeResult> {
    const template = await storage.getOrganizationTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.templateType !== "docx") {
      throw new Error(
        `Template ${templateId} is type "${template.templateType}" which is not supported. ` +
        `Only DOCX templates are supported in this release. ` +
        `Please use a DOCX template for token substitution.`
      );
    }

    const draft = await storage.getRftGenerationDraft(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    // Normalize blob identifiers (handles legacy empty strings)
    const { 
      blobName: normalizedBlobName, 
      blobUrl: normalizedBlobUrl, 
      hasIdentifier 
    } = normalizeBlobIdentifiers(
      template.blobName,
      template.blobUrl
    );

    // Validate template has a blob identifier (required for merge)
    if (!hasIdentifier) {
      throw new Error(
        `Template ${templateId} has no associated file to merge. ` +
        `This may be legacy data that needs remediation. ` +
        `Please re-upload the template file.`
      );
    }

    // Prefer blob name over blob URL (blob name is the new standard)
    const blobIdentifier = normalizedBlobName || normalizedBlobUrl;
    const templateBuffer = await this.downloadTemplateFile(blobIdentifier);

    const mergeData = this.prepareMergeData(
      draft.generatedSections as GeneratedSection[],
      additionalData
    );

    const mergedBuffer = await this.performMerge(
      templateBuffer,
      template.templateType as "docx" | "xlsx",
      mergeData
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `RFT_${projectId}_${timestamp}.${template.templateType}`;
    const blobPath = `projects/${projectId}/rfts/${fileName}`;

    const { blobUrl, blobName } = await blobStorageService.uploadDocument(
      blobPath,
      mergedBuffer,
      {
        projectId,
        templateId,
        draftId,
        generatedAt: new Date().toISOString(),
      }
    );

    return {
      blobUrl,
      blobName,
      fileName,
    };
  }

  /**
   * Download template file from Azure Blob Storage
   * Supports both blob name (preferred) and blob URL (legacy) formats
   * @param blobNameOrUrl - Either blob name (templates/abc/file.docx) or full blob URL with SAS tokens
   * @note Caller must validate identifier is not null/empty before calling this method
   */
  private async downloadTemplateFile(blobNameOrUrl: string): Promise<Buffer> {
    // Caller has already validated identifier is not null/empty via normalizeBlobIdentifiers helper
    const normalizedIdentifier = blobNameOrUrl.trim();

    // If it looks like a blob URL (starts with http), extract the blob name
    if (normalizedIdentifier.startsWith('http://') || normalizedIdentifier.startsWith('https://')) {
      // Decode URL first (handles %3F, %26, etc.), then remove query parameters (SAS tokens)
      const decodedUrl = decodeURIComponent(normalizedIdentifier);
      const urlWithoutQuery = decodedUrl.split('?')[0];
      
      const urlParts = urlWithoutQuery.split("/");
      const containerIndex = urlParts.findIndex((part) => part === "intellibid-documents");
      
      if (containerIndex === -1 || containerIndex >= urlParts.length - 1) {
        throw new Error(
          `Invalid blob URL format: ${normalizedIdentifier}. ` +
          `Expected URL to contain '/intellibid-documents/' container path.`
        );
      }

      const blobName = urlParts.slice(containerIndex + 1).join("/");
      
      // Validate extracted blob name is not empty
      if (!blobName || blobName.trim() === '') {
        throw new Error(
          `Extracted blob name is empty from URL: ${normalizedIdentifier}. ` +
          `URL may be malformed or missing file path after container name.`
        );
      }

      return blobStorageService.downloadDocument(blobName);
    }
    
    // Otherwise, assume it's already a blob name (e.g., "templates/abc123/file.docx")
    // Validate blob name format (should contain forward slashes for path)
    if (!normalizedIdentifier.includes('/')) {
      throw new Error(
        `Invalid blob name format: "${normalizedIdentifier}". ` +
        `Expected path format like "templates/abc123/file.docx".`
      );
    }

    return blobStorageService.downloadDocument(normalizedIdentifier);
  }

  private prepareMergeData(
    generatedSections: GeneratedSection[],
    additionalData?: MergeData
  ): MergeData {
    const mergeData: MergeData = {};

    generatedSections.forEach((section) => {
      const tokenName = this.sectionIdToTokenName(section.sectionId);
      mergeData[tokenName] = section.content;
    });

    if (additionalData) {
      Object.assign(mergeData, additionalData);
    }

    return mergeData;
  }

  private sectionIdToTokenName(sectionId: string): string {
    return `AI_${sectionId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  }

  /**
   * Normalize malformed placeholders in DOCX template
   * Fixes issues like {{{{PROJ}}}} -> {{PROJ}} and {{NAME}}}} -> {{NAME}}
   */
  private normalizeTemplatePlaceholders(templateBuffer: Buffer): Buffer {
    try {
      const zip = new PizZip(templateBuffer);
      const xml = zip.file("word/document.xml")?.asText();
      
      if (!xml) {
        console.warn("Could not find document.xml in template - skipping normalization");
        return templateBuffer;
      }

      // Fix malformed placeholders:
      // 1. Replace {{{{VAR}}}} with {{VAR}}
      // 2. Replace {{{VAR}}} with {{VAR}}
      // 3. Replace {{VAR}}}} with {{VAR}}
      // 4. Replace {{VAR}}} with {{VAR}}
      let normalizedXml = xml;
      
      // Fix 4+ opening braces: {{{{+ -> {{
      normalizedXml = normalizedXml.replace(/\{\{+/g, '{{');
      
      // Fix 3+ closing braces: }}}+ -> }}
      normalizedXml = normalizedXml.replace(/\}\}+/g, '}}');

      console.log(`✓ Normalized template placeholders`);
      
      // Update the zip with normalized XML
      zip.file("word/document.xml", normalizedXml);
      
      return zip.generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });
    } catch (error) {
      console.warn("Error normalizing template placeholders - using original:", error);
      return templateBuffer;
    }
  }

  private async performMerge(
    templateBuffer: Buffer,
    templateType: "docx" | "xlsx",
    mergeData: MergeData
  ): Promise<Buffer> {
    if (templateType === "docx") {
      return this.mergeDocx(templateBuffer, mergeData);
    } else {
      return this.mergeXlsx(templateBuffer, mergeData);
    }
  }

  private async mergeDocx(templateBuffer: Buffer, mergeData: MergeData): Promise<Buffer> {
    try {
      // Normalize template placeholders before processing
      const normalizedBuffer = this.normalizeTemplatePlaceholders(templateBuffer);
      
      const zip = new PizZip(normalizedBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: (part) => {
          console.warn(`Missing placeholder data for: ${part.value}`);
          return `[${part.value}]`;
        },
      });

      doc.render(mergeData);

      const buffer = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      return buffer;
    } catch (error: any) {
      console.error("Error merging DOCX template:", error);
      
      if (error.properties && error.properties.errors) {
        const detailedErrors = error.properties.errors.map((err: any) => {
          const { message, name, properties } = err;
          let userMessage = `Template error: ${message}`;
          
          if (properties) {
            if (properties.xtag) {
              userMessage = `Invalid placeholder syntax near "{{${properties.xtag}}}". Check for duplicate closing braces or malformed tags.`;
            } else if (properties.offset) {
              userMessage = `${message} at position ${properties.offset}`;
            }
          }
          
          return userMessage;
        }).join(' | ');
        
        throw new Error(
          `Template has syntax errors that prevent merging: ${detailedErrors}. ` +
          `Please check the template file for malformed placeholders (e.g., extra braces like "{{NAME}}}}" instead of "{{NAME}}").`
        );
      }
      
      throw new Error(
        `Failed to merge DOCX template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async mergeXlsx(templateBuffer: Buffer, mergeData: MergeData): Promise<Buffer> {
    throw new Error(
      "XLSX template merging requires the SheetJS library for proper binary handling. " +
      "Please use DOCX templates for token substitution, or implement SheetJS integration " +
      "for XLSX support. Current implementation focuses on DOCX templates as per Emirates RFT requirements."
    );
  }

  async previewMerge(
    templateId: string,
    draftId: string,
    additionalData?: MergeData
  ): Promise<{ placeholders: string[]; sampleData: MergeData }> {
    const template = await storage.getOrganizationTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.templateType !== "docx") {
      throw new Error(
        `Cannot preview merge for ${template.templateType} template. ` +
        `Only DOCX templates are supported in this release.`
      );
    }

    const draft = await storage.getRftGenerationDraft(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    const mergeData = this.prepareMergeData(
      draft.generatedSections as GeneratedSection[],
      additionalData
    );

    const placeholders = template.placeholders
      ? (template.placeholders as any[]).map((p) => p.name)
      : [];

    return {
      placeholders,
      sampleData: mergeData,
    };
  }

  async validateMergeData(
    templateId: string,
    mergeData: MergeData
  ): Promise<{ valid: boolean; missing: string[]; extra: string[] }> {
    const template = await storage.getOrganizationTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const requiredPlaceholders = template.placeholders
      ? (template.placeholders as any[])
          .filter((p) => p.type === "simple")
          .map((p) => p.name)
      : [];

    const providedKeys = Object.keys(mergeData);

    const missing = requiredPlaceholders.filter((p) => !providedKeys.includes(p));
    const extra = providedKeys.filter((p) => !requiredPlaceholders.includes(p));

    return {
      valid: missing.length === 0,
      missing,
      extra,
    };
  }
}

export const templateMergeService = new TemplateMergeService();
