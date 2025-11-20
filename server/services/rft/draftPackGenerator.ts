import { storage } from "../../storage";
import { AzureBlobStorageService } from "../azure/azureBlobStorage";
import { TemplateMergeService } from "./templateMergeService";
import { generateQuestionnaireQuestions } from "./smartRftService";
import { generateAllQuestionnaires } from "./excelGenerator";
import { generateDocxDocument, generatePdfDocument } from "./documentGenerator";
import { generateContextDiagram } from "../architecture/contextDiagramGenerator";
import { generateProductTechnicalQuestionnaire } from "../architecture/productQuestionnaireGenerator";
import * as fs from "fs";
import * as path from "path";

const azureBlobStorageService = new AzureBlobStorageService();
const templateMergeService = new TemplateMergeService();

interface PackGenerationResult {
  status: "completed" | "error";
  filesCount: number;
  files: {
    docx: { name: string; url: string };
    pdf: { name: string; url: string };
    productTechnical?: { name: string; url: string };
    questionnaires: {
      product: { name: string; url: string };
      nfr: { name: string; url: string };
      cybersecurity: { name: string; url: string };
      agile: { name: string; url: string };
    };
  };
  error?: string;
}

export async function generateRftPackFromDraft(draftId: string): Promise<PackGenerationResult> {
  console.log(`[RFT Pack Generator] Starting pack generation for draft: ${draftId}`);

  try {
    // Update draft status to generating
    await updateDraftPackStatus(draftId, "generating");

    const draft = await storage.getRftGenerationDraft(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    const project = await storage.getProject(draft.projectId);
    if (!project) {
      throw new Error(`Project ${draft.projectId} not found`);
    }

    // Get business case for AI generation
    let businessCase = null;
    if (draft.businessCaseId) {
      businessCase = await storage.getBusinessCase(draft.businessCaseId);
    }

    // Extract business case data from draft or business case
    const draftMetadata = (draft.metadata as any) || {};
    const extractedData = draftMetadata.extractedData || {};
    const businessCaseExtract = {
      projectName: extractedData.PROJECT_NAME || project.name,
      businessObjective: extractedData.DESCRIPTION || businessCase?.documentContent || "Enterprise software implementation",
      scope: `Full implementation across all operations`,
      keyRequirements: extractedData.FUNCTIONAL_REQUIREMENTS?.split('\n').filter(Boolean) || [
        "Scalable cloud architecture",
        "Enterprise-grade security",
        "Regulatory compliance"
      ],
      budget: extractedData.BUDGET || "To be determined",
      timeline: extractedData.TIMELINE || "12-18 months",
      stakeholders: ["IT Department", "Operations Team", "Executive Leadership"],
      risks: ["Implementation delays", "Budget constraints"],
      successCriteria: ["On-time delivery", "Budget adherence"]
    };

    console.log(`[RFT Pack] Generating DOCX document...`);
    
    // Generate DOCX - always use draft sections (ignore template to avoid merge errors)
    let docxBuffer: Buffer;
    let docxFileName: string;
    
    const sections = (draft.generatedSections as any[]).map((s: any) => ({
      sectionId: s.sectionId,
      title: s.sectionTitle || s.sectionName || s.sectionId,
      content: s.content
    }));
    
    docxFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT_${Date.now()}.docx`;
    const docxPath = await generateDocxDocument({
      projectName: project.name,
      sections,
      outputPath: path.join(process.cwd(), 'uploads', docxFileName)
    });
    docxBuffer = fs.readFileSync(docxPath);
    fs.unlinkSync(docxPath);

    console.log(`[RFT Pack] Generating PDF document...`);
    
    const pdfFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_RFT_${Date.now()}.pdf`;
    const pdfPath = await generatePdfDocument({
      projectName: project.name,
      sections,
      outputPath: path.join(process.cwd(), 'uploads', pdfFileName)
    });
    const pdfBuffer = fs.readFileSync(pdfPath);
    fs.unlinkSync(pdfPath);

    console.log(`[RFT Pack] Generating AI-powered questionnaires...`);
    
    // Generate all 4 questionnaires using AI
    const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
      generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
      generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
      generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
      generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
    ]);

    const questionnairePaths = await generateAllQuestionnaires(project.id, {
      product: productQuestions,
      nfr: nfrQuestions,
      cybersecurity: cybersecurityQuestions,
      agile: agileQuestions,
    });

    // Generate Product Technical Questionnaire with context diagram (if business case exists)
    let productTechnicalPath: string | null = null;
    let productTechnicalBuffer: Buffer | null = null;
    
    if (businessCase?.documentContent) {
      try {
        console.log(`[RFT Pack] Generating Product Technical Questionnaire with context diagram...`);
        
        // Generate context diagram PNG
        const contextDiagramPngPath = path.join(process.cwd(), 'uploads', `context_diagram_${Date.now()}.png`);
        const { pngPath } = await generateContextDiagram(businessCase.documentContent, contextDiagramPngPath);
        
        // Generate Product Technical Questionnaire DOCX with embedded diagram
        const productTechnicalFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Product_Technical_Questionnaire_${Date.now()}.docx`;
        productTechnicalPath = await generateProductTechnicalQuestionnaire({
          projectName: project.name,
          contextDiagramPngPath: pngPath,
          outputPath: path.join(process.cwd(), 'uploads', productTechnicalFileName)
        });
        
        productTechnicalBuffer = fs.readFileSync(productTechnicalPath);
        
        // Clean up temp files
        fs.unlinkSync(pngPath);
        
        console.log(`[RFT Pack] Product Technical Questionnaire generated successfully`);
      } catch (error) {
        console.error(`[RFT Pack] Failed to generate Product Technical Questionnaire:`, error);
        // Continue without this file if generation fails
      }
    }

    console.log(`[RFT Pack] Uploading all files to Azure Blob Storage...`);

    // Upload all files to Azure Blob Storage
    const uploadPromises = [
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/RFT_Document.docx`,
        docxBuffer
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/RFT_Document.pdf`,
        pdfBuffer
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/Product_Questionnaire.xlsx`,
        fs.readFileSync(questionnairePaths.productPath)
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/NFR_Questionnaire.xlsx`,
        fs.readFileSync(questionnairePaths.nfrPath)
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/Cybersecurity_Questionnaire.xlsx`,
        fs.readFileSync(questionnairePaths.cybersecurityPath)
      ),
      azureBlobStorageService.uploadDocument(
        `project-${project.id}/RFT_Generated/Agile_Questionnaire.xlsx`,
        fs.readFileSync(questionnairePaths.agilePath)
      ),
    ];
    
    // Add Product Technical Questionnaire if generated
    if (productTechnicalBuffer) {
      uploadPromises.push(
        azureBlobStorageService.uploadDocument(
          `project-${project.id}/RFT_Generated/Product_Technical_Questionnaire.docx`,
          productTechnicalBuffer
        )
      );
    }
    
    const uploadResults = await Promise.all(uploadPromises);

    // Clean up temporary files
    try {
      fs.unlinkSync(questionnairePaths.productPath);
      fs.unlinkSync(questionnairePaths.nfrPath);
      fs.unlinkSync(questionnairePaths.cybersecurityPath);
      fs.unlinkSync(questionnairePaths.agilePath);
      if (productTechnicalPath) {
        fs.unlinkSync(productTechnicalPath);
      }
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }

    const packResult: PackGenerationResult = {
      status: "completed",
      filesCount: productTechnicalBuffer ? 7 : 6,
      files: {
        docx: { name: "RFT_Document.docx", url: uploadResults[0].blobUrl },
        pdf: { name: "RFT_Document.pdf", url: uploadResults[1].blobUrl },
        productTechnical: productTechnicalBuffer ? { 
          name: "Product_Technical_Questionnaire.docx", 
          url: uploadResults[6].blobUrl 
        } : undefined,
        questionnaires: {
          product: { name: "Product_Questionnaire.xlsx", url: uploadResults[2].blobUrl },
          nfr: { name: "NFR_Questionnaire.xlsx", url: uploadResults[3].blobUrl },
          cybersecurity: { name: "Cybersecurity_Questionnaire.xlsx", url: uploadResults[4].blobUrl },
          agile: { name: "Agile_Questionnaire.xlsx", url: uploadResults[5].blobUrl },
        },
      },
    };

    // Update draft with pack metadata
    await updateDraftWithPackMetadata(draftId, packResult);

    console.log(`[RFT Pack] Generation complete for draft ${draftId}!`);
    return packResult;

  } catch (error) {
    console.error(`[RFT Pack] Error generating pack for draft ${draftId}:`, error);
    
    const errorResult: PackGenerationResult = {
      status: "error",
      filesCount: 0,
      files: {
        docx: { name: "", url: "" },
        pdf: { name: "", url: "" },
        questionnaires: {
          product: { name: "", url: "" },
          nfr: { name: "", url: "" },
          cybersecurity: { name: "", url: "" },
          agile: { name: "", url: "" },
        },
      },
      error: error instanceof Error ? error.message : String(error),
    };

    await updateDraftPackStatus(draftId, "error", errorResult.error);
    throw error;
  }
}

async function updateDraftPackStatus(draftId: string, status: string, error?: string) {
  const draft = await storage.getRftGenerationDraft(draftId);
  if (!draft) return;

  const metadata = (draft.metadata as any) || {};
  metadata.pack = {
    ...metadata.pack,
    status,
    updatedAt: new Date().toISOString(),
    ...(error && { error }),
  };

  await storage.updateRftGenerationDraft(draftId, { metadata: metadata as any });
}

async function updateDraftWithPackMetadata(draftId: string, packResult: PackGenerationResult) {
  const draft = await storage.getRftGenerationDraft(draftId);
  if (!draft) return;

  const metadata = (draft.metadata as any) || {};
  metadata.pack = {
    status: packResult.status,
    completedAt: new Date().toISOString(),
    filesCount: packResult.filesCount,
    files: packResult.files,
  };

  await storage.updateRftGenerationDraft(draftId, { 
    metadata: metadata as any,
    status: "finalized"  // Mark draft as finalized automatically
  });
}
