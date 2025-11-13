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

/**
 * Normalize blob identifiers by treating empty strings as null
 * This ensures backward compatibility with legacy data that may have blank identifiers
 * @returns normalized blob name or null if both identifiers are empty/null
 */
export function normalizeBlobIdentifiers(
  blobName: string | null | undefined,
  blobUrl: string | null | undefined
): { blobName: string | null; blobUrl: string | null; hasIdentifier: boolean } {
  const normalizedBlobName = blobName && blobName.trim() ? blobName.trim() : null;
  const normalizedBlobUrl = blobUrl && blobUrl.trim() ? blobUrl.trim() : null;
  
  return {
    blobName: normalizedBlobName,
    blobUrl: normalizedBlobUrl,
    hasIdentifier: !!(normalizedBlobName || normalizedBlobUrl),
  };
}

class TemplateService {
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
    
    // Auto-detect sections from DOCX headings (hybrid approach)
    const suggestedSections = metadata.templateType === "docx" 
      ? await this.extractDocxSections(file)
      : [];

    const templateId = crypto.randomUUID();
    const blobPath = `templates/${templateId}/${fileName}`;

    // Upload to Azure Blob Storage - returns both SAS URL and blob name
    const { blobUrl, blobName } = await blobStorageService.uploadDocument(
      blobPath,
      file,
      {
        templateId,
        templateName: metadata.name,
        category: metadata.category,
        uploadedBy: metadata.createdBy || "system",
      }
    );

    // Dual-write: Store both blobUrl (for backward compat) and blobName (new standard)
    const templateData: InsertOrganizationTemplate = {
      name: metadata.name,
      description: metadata.description || null,
      category: metadata.category,
      templateType: metadata.templateType,
      blobUrl, // Legacy SAS URL (will be deprecated)
      blobName, // New standard: blob path (e.g., "templates/abc123/file.docx")
      placeholders: placeholders as any,
      sectionMappings: suggestedSections.length > 0 ? (suggestedSections as any) : null,
      isActive: "true",
      isDefault: "false",
      metadata: {
        originalFileName: fileName,
        fileSize: file.length,
        uploadedAt: new Date().toISOString(),
        suggestedSectionsCount: suggestedSections.length,
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
      
      let text = "";
      try {
        // Try using docxtemplater WITHOUT the delimiters that might cause parsing issues
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: { start: '{{', end: '}}' },
        });
        text = doc.getFullText();
      } catch (docxtemplaterError: any) {
        console.warn("Docxtemplater getFullText failed, falling back to direct XML extraction");
        console.warn("Error details:", docxtemplaterError.message);
        
        // Fallback: Extract text directly from document.xml
        try {
          const documentXml = zip.file("word/document.xml")?.asText();
          if (documentXml) {
            // Strip XML tags to get plain text
            text = documentXml
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            console.log("Successfully extracted text via XML fallback");
          }
        } catch (xmlError) {
          console.warn("Direct XML extraction also failed:", xmlError);
          // Return empty array instead of throwing - template can still be used
          console.log("Template uploaded without placeholder extraction - manual configuration required");
          return [];
        }
      }

      // Extract placeholders using regex - more robust than docxtemplater parsing
      const tags = text.match(/\{\{([^}]+)\}\}/g) || [];
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

      console.log(`Extracted ${placeholders.length} placeholders from template`);
      return placeholders;
    } catch (error) {
      console.error("Error extracting DOCX placeholders:", error);
      // Return empty array instead of throwing - template can still be uploaded and configured manually
      console.log("Template uploaded without placeholder extraction - manual configuration required");
      return [];
    }
  }

  private async extractDocxSections(fileBuffer: Buffer): Promise<SectionMapping[]> {
    try {
      const zip = new PizZip(fileBuffer);
      
      // Use formatted text extraction to preserve line breaks and structure
      const text = this.extractFormattedText(zip);
      
      if (!text) {
        console.log("Section extraction failed - no text extracted from template");
        return [];
      }

      console.log("📝 Extracted text for section detection (first 800 chars):");
      console.log(text.substring(0, 800));

      // Try multiple heading patterns (more flexible to handle different template styles)
      const patterns = [
        { regex: /^(\d+)\.\s*([A-Z][A-Z\s&-]+)/gm, name: "Numbered uppercase (1. EXECUTIVE SUMMARY)" },
        { regex: /^(\d+)\.\s*([A-Z][a-z\s&-]+)/gm, name: "Numbered title case (1. Executive Summary)" },
        { regex: /^(\d+)\s+([A-Z][A-Z\s&-]{5,})/gm, name: "Numbered with space (1 EXECUTIVE SUMMARY)" },
        { regex: /(\d+)\.\s*([A-Z][A-Z\s&-]{5,})/gm, name: "Numbered anywhere in line" },
      ];

      let matches: RegExpMatchArray[] = [];
      let usedPattern = "";
      
      for (const pattern of patterns) {
        const foundMatches = Array.from(text.matchAll(pattern.regex));
        if (foundMatches.length > 0) {
          console.log(`✅ Found ${foundMatches.length} sections with pattern: ${pattern.name}`);
          matches = foundMatches;
          usedPattern = pattern.name;
          break; // Use first pattern that finds sections
        }
      }

      if (matches.length === 0) {
        console.warn("⚠️ No sections detected with any pattern - template will require manual configuration");
        return [];
      }
      
      const sections: SectionMapping[] = matches.map((match, index) => {
        const headingText = match[2].trim();
        const sectionId = `section-${index + 1}`;
        
        // Map headings to appropriate stakeholders
        const assignee = this.inferStakeholderFromHeading(headingText);
        const category = this.inferCategoryFromHeading(headingText);
        
        console.log(`  Section ${index + 1}: "${headingText}" → ${assignee} (${category})`);
        
        return {
          sectionId,
          sectionTitle: headingText,
          defaultAssignee: assignee,
          category: category as "technical" | "security" | "business" | "procurement" | "other",
        };
      });

      console.log(`✅ Auto-detected ${sections.length} sections using: ${usedPattern}`);
      return sections;
    } catch (error) {
      console.error("Error extracting DOCX sections:", error);
      return [];
    }
  }

  private extractFormattedText(zip: any): string {
    try {
      const documentXml = zip.file("word/document.xml")?.asText();
      if (!documentXml) {
        return "";
      }

      const paragraphs: string[] = [];
      const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      const matches = documentXml.matchAll(paragraphRegex);
      
      for (const match of matches) {
        const paragraphContent = match[1];
        const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
        const textMatches = paragraphContent.matchAll(textRegex);
        
        let paragraphText = "";
        for (const textMatch of textMatches) {
          const text = textMatch[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          paragraphText += text;
        }
        
        if (paragraphText.trim()) {
          paragraphs.push(paragraphText);
        }
      }
      
      return paragraphs.join('\n\n');
    } catch (error) {
      console.error("Error extracting formatted text:", error);
      return "";
    }
  }

  private inferStakeholderFromHeading(heading: string): string {
    const h = heading.toUpperCase();
    
    if (h.includes("EXECUTIVE") || h.includes("SUMMARY")) return "product_owner";
    if (h.includes("SCOPE") || h.includes("WORK")) return "product_owner";
    if (h.includes("BACKGROUND") || h.includes("CONTEXT")) return "technical_pm";
    if (h.includes("NON-FUNCTIONAL") || h.includes("NFR") || h.includes("NON FUNCTIONAL")) return "solution_architect";
    if (h.includes("TECHNICAL") || h.includes("ARCHITECTURE")) return "solution_architect";
    if (h.includes("SECURITY") || h.includes("COMPLIANCE") || h.includes("CYBERSECURITY")) return "cybersecurity_analyst";
    if (h.includes("EVALUATION") || h.includes("CRITERIA")) return "procurement_lead";
    if (h.includes("SUBMISSION") || h.includes("REQUIREMENT")) return "procurement_lead";
    if (h.includes("TERMS") || h.includes("CONDITIONS") || h.includes("LEGAL")) return "legal_counsel";
    if (h.includes("CONTACT") || h.includes("INFORMATION")) return "procurement_lead";
    
    return "technical_pm"; // Default
  }

  private inferCategoryFromHeading(heading: string): "technical" | "security" | "business" | "procurement" | "other" {
    const h = heading.toUpperCase();
    
    if (h.includes("EXECUTIVE") || h.includes("BACKGROUND")) return "business";
    if (h.includes("TECHNICAL") || h.includes("ARCHITECTURE") || h.includes("SCOPE")) return "technical";
    if (h.includes("SECURITY") || h.includes("COMPLIANCE")) return "security";
    if (h.includes("EVALUATION") || h.includes("SUBMISSION") || h.includes("TERMS")) return "procurement";
    
    return "other"; // Default
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

    // Normalize blob identifiers (handles legacy empty strings)
    const { blobName, blobUrl, hasIdentifier } = normalizeBlobIdentifiers(
      template.blobName,
      template.blobUrl
    );

    // Delete blob from Azure Blob Storage (soft-fail for legacy data with no blob)
    if (hasIdentifier) {
      try {
        const blobNameToDelete = blobName 
          ? blobName  // Use blob name directly if available
          : this.extractBlobName(blobUrl);  // Extract from URL for legacy records
        await blobStorageService.deleteDocument(blobNameToDelete);
      } catch (error) {
        console.warn(
          `Failed to delete blob for template ${templateId}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      // Legacy template with no blob file - log for remediation
      console.log(
        `Template ${templateId} has no blob file to delete (legacy data). ` +
        `Proceeding with database record deletion only.`
      );
    }

    await storage.deleteOrganizationTemplate(templateId);
  }

  private extractBlobName(blobUrl: string | null | undefined): string {
    // Normalize empty strings to null (legacy data compatibility)
    const normalizedUrl = blobUrl && blobUrl.trim() ? blobUrl.trim() : null;
    
    // Validate input is not null or empty
    if (!normalizedUrl) {
      throw new Error(
        'Blob URL is missing. Cannot extract blob name from empty URL.'
      );
    }

    // Decode URL first (handles %3F, %26, etc.), then remove query parameters (SAS tokens)
    const decodedUrl = decodeURIComponent(normalizedUrl);
    const urlWithoutQuery = decodedUrl.split('?')[0];

    const urlParts = urlWithoutQuery.split("/");
    const containerIndex = urlParts.findIndex((part) => part === "intellibid-documents");
    
    if (containerIndex === -1 || containerIndex >= urlParts.length - 1) {
      throw new Error(
        `Invalid blob URL format: ${normalizedUrl}. ` +
        `Expected URL to contain '/intellibid-documents/' container path.`
      );
    }

    const blobName = urlParts.slice(containerIndex + 1).join("/");
    
    // Validate extracted blob name is not empty
    if (!blobName || blobName.trim() === '') {
      throw new Error(
        `Extracted blob name is empty from URL: ${normalizedUrl}. ` +
        `URL may be malformed or missing file path after container name.`
      );
    }

    return blobName;
  }

  async downloadTemplate(templateId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const template = await storage.getOrganizationTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Normalize blob identifiers (handles legacy empty strings)
    const { blobName, blobUrl, hasIdentifier } = normalizeBlobIdentifiers(
      template.blobName,
      template.blobUrl
    );

    // Check if template has an associated file (required for download)
    if (!hasIdentifier) {
      throw new Error(
        `Template ${templateId} has no associated file to download. ` +
        `This may be legacy data that needs remediation. ` +
        `Please re-upload the template file.`
      );
    }

    // Prefer blob name (new) over extracting from blob URL (legacy)
    // Note: If hasIdentifier is true, at least one of blobName or blobUrl is non-null
    let blobNameToDownload: string;
    if (blobName) {
      blobNameToDownload = blobName;  // Use blob name directly if available
    } else if (blobUrl) {
      blobNameToDownload = this.extractBlobName(blobUrl);  // Extract from URL for legacy records
    } else {
      // This should never happen if normalizeBlobIdentifiers works correctly
      throw new Error(
        `Template ${templateId} normalization error: hasIdentifier is true but both identifiers are null.`
      );
    }

    const buffer = await blobStorageService.downloadDocument(blobNameToDownload);

    const fileName =
      template.metadata && typeof template.metadata === "object" && "originalFileName" in template.metadata
        ? String(template.metadata.originalFileName)
        : `${template.name}.${template.templateType}`;

    return { buffer, fileName };
  }
}

export const templateService = new TemplateService();
