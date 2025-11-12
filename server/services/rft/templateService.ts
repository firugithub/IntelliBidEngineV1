import { type InsertOrganizationTemplate, type OrganizationTemplate } from "@shared/schema";
import { storage } from "../../storage";
import { AzureBlobStorageService } from "../azure/azureBlobStorage";
import { type SectionMapping, getSectionMapping } from "./stakeholderConfig";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

const blobStorageService = new AzureBlobStorageService();

interface PlaceholderInfo {
  name: string;
  type: "simple" | "loop" | "condition";
  description?: string;
  defaultValue?: string;
}

interface TemplateUploadResult {
  template: OrganizationTemplate;
  placeholders: PlaceholderInfo[];
}

export class TemplateService {
  async uploadTemplate(
    file: Buffer,
    fileName: string,
    metadata: {
      name: string;
      description?: string;
      category: string;
      templateType: "docx" | "xlsx";
      createdBy?: string;
    }
  ): Promise<TemplateUploadResult> {
    const fileExtension = fileName.toLowerCase().endsWith(".docx")
      ? "docx"
      : fileName.toLowerCase().endsWith(".xlsx")
      ? "xlsx"
      : null;

    if (!fileExtension) {
      throw new Error("Invalid file type. Only DOCX and XLSX files are supported.");
    }

    if (fileExtension !== metadata.templateType) {
      throw new Error(
        `File extension ${fileExtension} does not match specified template type ${metadata.templateType}`
      );
    }

    if (metadata.templateType === "xlsx") {
      throw new Error(
        "XLSX template support is not available in this release. " +
        "Please use DOCX templates for token substitution. " +
        "XLSX support requires SheetJS integration and will be added in a future update. " +
        "Current implementation supports Emirates-style DOCX RFT templates with {{TOKEN}} placeholders."
      );
    }

    const placeholders = await this.extractPlaceholders(file, metadata.templateType);

    const templateId = crypto.randomUUID();
    const blobPath = `templates/${templateId}/${fileName}`;

    const { blobUrl } = await blobStorageService.uploadDocument(
      blobPath,
      file,
      {
        templateId,
        templateName: metadata.name,
        category: metadata.category,
        uploadedBy: metadata.createdBy || "system",
      }
    );

    const templateData: InsertOrganizationTemplate = {
      name: metadata.name,
      description: metadata.description || null,
      category: metadata.category,
      templateType: metadata.templateType,
      blobUrl,
      placeholders: placeholders as any,
      sectionMappings: null,
      isActive: "true",
      isDefault: "false",
      metadata: {
        originalFileName: fileName,
        fileSize: file.length,
        uploadedAt: new Date().toISOString(),
      } as any,
      createdBy: metadata.createdBy || "system",
    };

    const template = await storage.createOrganizationTemplate(templateData);

    return {
      template,
      placeholders,
    };
  }

  async extractPlaceholders(
    fileBuffer: Buffer,
    templateType: "docx" | "xlsx"
  ): Promise<PlaceholderInfo[]> {
    if (templateType === "docx") {
      return this.extractDocxPlaceholders(fileBuffer);
    } else {
      return this.extractXlsxPlaceholders(fileBuffer);
    }
  }

  private async extractDocxPlaceholders(fileBuffer: Buffer): Promise<PlaceholderInfo[]> {
    try {
      const zip = new PizZip(fileBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      const tags = doc.getFullText().match(/\{\{([^}]+)\}\}/g) || [];
      const uniqueTags = Array.from(new Set(tags));

      const placeholders: PlaceholderInfo[] = uniqueTags.map((tag) => {
        const cleanTag = tag.replace(/[{}]/g, "").trim();
        const isLoop = cleanTag.startsWith("#") || cleanTag.startsWith("/");
        const isCondition = cleanTag.includes("?") || cleanTag.includes(":");

        return {
          name: cleanTag.replace(/^[#/]/, ""),
          type: isLoop ? "loop" : isCondition ? "condition" : "simple",
          description: this.generatePlaceholderDescription(cleanTag),
        };
      });

      return placeholders;
    } catch (error) {
      console.error("Error extracting DOCX placeholders:", error);
      throw new Error(
        `Failed to extract placeholders from DOCX template: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async extractXlsxPlaceholders(fileBuffer: Buffer): Promise<PlaceholderInfo[]> {
    console.warn("XLSX placeholder extraction requires proper XLSX parsing library (e.g., SheetJS)");
    console.warn("Current implementation is limited. For production use, integrate SheetJS for accurate extraction.");
    
    return [];
  }

  private generatePlaceholderDescription(placeholderName: string): string {
    const nameUpper = placeholderName.toUpperCase();

    if (nameUpper.includes("PROJECT") && nameUpper.includes("NAME")) {
      return "Project name or title";
    }
    if (nameUpper.includes("DATE")) {
      return "Date value";
    }
    if (nameUpper.includes("BUDGET")) {
      return "Budget or cost information";
    }
    if (nameUpper.includes("TIMELINE") || nameUpper.includes("SCHEDULE")) {
      return "Timeline or schedule information";
    }
    if (nameUpper.includes("OBJECTIVE")) {
      return "Project objective or goal";
    }
    if (nameUpper.includes("SCOPE")) {
      return "Project scope information";
    }
    if (nameUpper.includes("REQUIREMENT")) {
      return "Requirements information";
    }
    if (nameUpper.includes("AI_") || nameUpper.includes("GENERATED_")) {
      return "AI-generated content section";
    }

    return `Placeholder for ${placeholderName}`;
  }

  /**
   * Normalize legacy section mappings to canonical SectionMapping format
   * Handles backward compatibility with old formats (sectionName, stakeholderRole, tokens)
   * Uses getSectionMapping() to provide smart defaults for BOTH assignee AND category
   * ALWAYS rebuilds objects to drop legacy-only fields (tokens, description)
   * Gracefully handles missing or invalid sectionIds
   */
  private normalizeSectionMappings(mappings: any[]): SectionMapping[] {
    return mappings.map((mapping: any, index: number) => {
      // Validate sectionId presence
      const sectionId = mapping.sectionId;
      if (!sectionId) {
        console.warn(`⚠️  Section mapping at index ${index} missing sectionId. Skipping normalization for this entry.`);
        throw new Error(`Section mapping at index ${index} must have a sectionId`);
      }
      
      // Get configured defaults from global config (safe - returns defaults for unknown IDs)
      const globalMapping = getSectionMapping(sectionId);
      
      // Normalize field names: sectionName/title → sectionTitle
      const sectionTitle = mapping.sectionTitle || mapping.sectionName || mapping.title || sectionId;
      
      // Normalize assignee with smart fallback to configured default
      // Priority: provided value > global config default (NOT hardcoded "technical_pm")
      const defaultAssignee = mapping.defaultAssignee || 
                             mapping.assignedTo || 
                             mapping.stakeholderRole || 
                             globalMapping.assignee; // Use configured default!
      
      // Normalize category with smart fallback to configured default
      const category = mapping.category || globalMapping.category;
      
      // Validate that we have valid assignee (getSectionMapping should always provide one)
      if (!defaultAssignee) {
        console.warn(`⚠️  Section mapping for ${sectionId} has no assignee. Using technical_pm as fallback.`);
      }
      
      // ALWAYS return new object with ONLY canonical fields
      // This drops legacy fields: tokens, description, sectionName, stakeholderRole
      return {
        sectionId,
        sectionTitle,
        defaultAssignee: defaultAssignee || "technical_pm", // Final safety fallback
        category
      };
    });
  }

  /**
   * Validate NORMALIZED section mappings conform to canonical SectionMapping interface
   * This runs AFTER normalization, so it expects canonical fields only
   */
  private validateNormalizedSectionMappings(mappings: SectionMapping[]): void {
    if (!Array.isArray(mappings)) {
      throw new Error("sectionMappings must be an array");
    }

    for (const mapping of mappings) {
      if (!mapping.sectionId) {
        throw new Error("Each section mapping must have a sectionId");
      }
      if (!mapping.sectionTitle) {
        throw new Error(`Section mapping for ${mapping.sectionId} must have a sectionTitle`);
      }
      if (!mapping.defaultAssignee) {
        throw new Error(`Section mapping for ${mapping.sectionId} must have a defaultAssignee`);
      }
      if (!mapping.category) {
        throw new Error(`Section mapping for ${mapping.sectionId} must have a category`);
      }
    }
  }

  async configureSectionMappings(
    templateId: string,
    sectionMappings: SectionMapping[]
  ): Promise<OrganizationTemplate> {
    const template = await storage.getOrganizationTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    if (template.templateType !== "docx") {
      throw new Error(
        `Cannot configure section mappings for ${template.templateType} template. ` +
        `Only DOCX templates are supported in this release.`
      );
    }

    // Step 1: Normalize incoming data (handles legacy formats)
    const normalizedMappings = this.normalizeSectionMappings(sectionMappings);
    
    // Step 2: Validate normalized data (expects canonical format only)
    this.validateNormalizedSectionMappings(normalizedMappings);

    console.log(`✅ Normalized and validated ${normalizedMappings.length} section mappings for template ${templateId}`);

    // Step 3: Save normalized data
    await storage.updateOrganizationTemplate(templateId, {
      sectionMappings: normalizedMappings as any,
    });

    const updatedTemplate = await storage.getOrganizationTemplate(templateId);
    if (!updatedTemplate) {
      throw new Error(`Failed to retrieve updated template ${templateId}`);
    }

    return updatedTemplate;
  }

  async getAllTemplates(filters?: {
    category?: string;
    isActive?: boolean;
  }): Promise<OrganizationTemplate[]> {
    const allTemplates = await storage.getAllOrganizationTemplates();

    let filtered = allTemplates.filter((template) => template.templateType === "docx");

    // Normalize section mappings on read for all templates
    filtered = filtered.map((template) => {
      if (template.sectionMappings && Array.isArray(template.sectionMappings)) {
        const normalized = this.normalizeSectionMappings(template.sectionMappings);
        return {
          ...template,
          sectionMappings: normalized as any
        };
      }
      return template;
    });

    if (!filters) {
      return filtered;
    }

    return filtered.filter((template) => {
      if (filters.category && template.category !== filters.category) {
        return false;
      }
      if (filters.isActive !== undefined) {
        const isActive = template.isActive === "true";
        if (isActive !== filters.isActive) {
          return false;
        }
      }
      return true;
    });
  }

  async getTemplateById(templateId: string): Promise<OrganizationTemplate | null> {
    const template = await storage.getOrganizationTemplate(templateId);
    if (!template) return null;
    
    // Normalize section mappings on read to ensure consumers get canonical format
    if (template.sectionMappings && Array.isArray(template.sectionMappings)) {
      const normalized = this.normalizeSectionMappings(template.sectionMappings);
      // Return template with normalized mappings
      return {
        ...template,
        sectionMappings: normalized as any
      };
    }
    
    return template;
  }

  async setDefaultTemplate(templateId: string): Promise<OrganizationTemplate> {
    const template = await storage.getOrganizationTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.templateType !== "docx") {
      throw new Error(
        `Cannot set ${template.templateType} template as default. ` +
        `Only DOCX templates are supported in this release.`
      );
    }

    const allTemplates = await storage.getAllOrganizationTemplates();
    
    for (const t of allTemplates) {
      if (t.isDefault === "true") {
        await storage.updateOrganizationTemplate(t.id, {
          isDefault: "false",
        });
      }
    }

    await storage.updateOrganizationTemplate(templateId, {
      isDefault: "true",
    });

    const updatedTemplate = await storage.getOrganizationTemplate(templateId);
    if (!updatedTemplate) {
      throw new Error(`Failed to retrieve template ${templateId} after setting as default`);
    }

    return updatedTemplate;
  }

  async deactivateTemplate(templateId: string): Promise<OrganizationTemplate> {
    await storage.updateOrganizationTemplate(templateId, {
      isActive: "false",
    });

    const updatedTemplate = await storage.getOrganizationTemplate(templateId);
    if (!updatedTemplate) {
      throw new Error(`Failed to retrieve template ${templateId} after deactivation`);
    }

    return updatedTemplate;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const template = await storage.getOrganizationTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    if (template.blobUrl) {
      try {
        const blobName = this.extractBlobName(template.blobUrl);
        await blobStorageService.deleteDocument(blobName);
      } catch (error) {
        console.warn(
          `Failed to delete blob for template ${templateId}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    await storage.deleteOrganizationTemplate(templateId);
  }

  private extractBlobName(blobUrl: string): string {
    const urlParts = blobUrl.split("/");
    const containerIndex = urlParts.findIndex((part) => part === "intellibid-documents");
    
    if (containerIndex === -1 || containerIndex >= urlParts.length - 1) {
      throw new Error(`Invalid blob URL format: ${blobUrl}`);
    }

    return urlParts.slice(containerIndex + 1).join("/");
  }

  async downloadTemplate(templateId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const template = await storage.getOrganizationTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    if (!template.blobUrl) {
      throw new Error(`Template ${templateId} has no associated file`);
    }

    const blobName = this.extractBlobName(template.blobUrl);
    const buffer = await blobStorageService.downloadDocument(blobName);

    const fileName =
      template.metadata && typeof template.metadata === "object" && "originalFileName" in template.metadata
        ? String(template.metadata.originalFileName)
        : `${template.name}.${template.templateType}`;

    return { buffer, fileName };
  }
}

export const templateService = new TemplateService();
