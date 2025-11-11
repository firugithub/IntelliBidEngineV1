import { type RftGenerationDraft, type OrganizationTemplate } from "@shared/schema";
import { storage } from "../../storage";
import { AzureBlobStorageService } from "../azure/azureBlobStorage";
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

    if (draft.status !== "approved") {
      throw new Error(
        `Draft ${draftId} is not approved. Current status: ${draft.status}. Only approved drafts can be finalized.`
      );
    }

    const templateBuffer = await this.downloadTemplateFile(template.blobUrl);

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

  private async downloadTemplateFile(blobUrl: string): Promise<Buffer> {
    const urlParts = blobUrl.split("/");
    const containerIndex = urlParts.findIndex((part) => part === "intellibid-documents");
    
    if (containerIndex === -1 || containerIndex >= urlParts.length - 1) {
      throw new Error(`Invalid blob URL format: ${blobUrl}`);
    }

    const blobName = urlParts.slice(containerIndex + 1).join("/");
    return blobStorageService.downloadDocument(blobName);
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
      const zip = new PizZip(templateBuffer);
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
    } catch (error) {
      console.error("Error merging DOCX template:", error);
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
