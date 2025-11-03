import { parseExcelQuestionnaire, QuestionnaireQuestion } from "./excelQuestionnaireHandler";

export interface QuestionnaireScore {
  questionnaireType: string;
  totalQuestions: number;
  answeredQuestions: number;
  notApplicableQuestions: number;
  fullCompliance: number;
  partialCompliance: number;
  noCompliance: number;
  overallScore: number;
  breakdown: {
    full: number;
    partial: number;
    none: number;
    notApplicable: number;
  };
}

export interface VendorExcelScores {
  vendorName: string;
  productScore: QuestionnaireScore | null;
  nfrScore: QuestionnaireScore | null;
  cybersecurityScore: QuestionnaireScore | null;
  agileScore: QuestionnaireScore | null;
  averageScore: number;
}

export function calculateQuestionnaireScore(questions: QuestionnaireQuestion[]): QuestionnaireScore {
  let fullCount = 0;
  let partialCount = 0;
  let noneCount = 0;
  let notApplicableCount = 0;
  
  questions.forEach(q => {
    const score = q.complianceScore.toLowerCase().trim();
    if (score === 'full') {
      fullCount++;
    } else if (score === 'partial') {
      partialCount++;
    } else if (score === 'none' || score === '') {
      noneCount++;
    } else if (score === 'not applicable' || score === 'n/a') {
      notApplicableCount++;
    }
  });
  
  const answeredQuestions = fullCount + partialCount + noneCount;
  const totalQuestions = questions.length;
  
  let overallScore = 0;
  if (answeredQuestions > 0) {
    const fullPoints = fullCount * 100;
    const partialPoints = partialCount * 50;
    const nonePoints = noneCount * 0;
    
    overallScore = (fullPoints + partialPoints + nonePoints) / answeredQuestions;
  }
  
  return {
    questionnaireType: "Unknown",
    totalQuestions,
    answeredQuestions,
    notApplicableQuestions: notApplicableCount,
    fullCompliance: fullCount,
    partialCompliance: partialCount,
    noCompliance: noneCount,
    overallScore: Math.round(overallScore * 10) / 10,
    breakdown: {
      full: fullCount,
      partial: partialCount,
      none: noneCount,
      notApplicable: notApplicableCount,
    },
  };
}

export async function calculateExcelScoresForVendor(
  vendorDocuments: Array<{ fileName: string; blobUrl: string; documentType: string; blobName?: string }>
): Promise<VendorExcelScores> {
  const { AzureBlobStorageService } = await import('./azureBlobStorage');
  const azureService = new AzureBlobStorageService();
  
  const scores: VendorExcelScores = {
    vendorName: "",
    productScore: null,
    nfrScore: null,
    cybersecurityScore: null,
    agileScore: null,
    averageScore: 0,
  };
  
  for (const doc of vendorDocuments) {
    if (!doc.fileName.toLowerCase().endsWith('.xlsx')) continue;
    
    try {
      let buffer: Buffer;
      if (doc.blobName) {
        buffer = await azureService.downloadDocument(doc.blobName);
      } else {
        const blobName = extractBlobNameFromUrl(doc.blobUrl);
        buffer = await azureService.downloadDocument(blobName);
      }
      
      const questions = await parseExcelQuestionnaire(buffer);
      
      const score = calculateQuestionnaireScore(questions);
      const fileName = doc.fileName.toLowerCase();
      
      if (fileName.includes('product')) {
        score.questionnaireType = 'Product';
        scores.productScore = score;
      } else if (fileName.includes('nfr') || fileName.includes('non-functional')) {
        score.questionnaireType = 'NFR';
        scores.nfrScore = score;
      } else if (fileName.includes('cybersecurity') || fileName.includes('security')) {
        score.questionnaireType = 'Cybersecurity';
        scores.cybersecurityScore = score;
      } else if (fileName.includes('agile')) {
        score.questionnaireType = 'Agile';
        scores.agileScore = score;
      }
    } catch (error) {
      console.error(`Failed to calculate score for ${doc.fileName}:`, error);
    }
  }
  
  const validScores = [
    scores.productScore?.overallScore,
    scores.nfrScore?.overallScore,
    scores.cybersecurityScore?.overallScore,
    scores.agileScore?.overallScore,
  ].filter((s): s is number => s !== null && s !== undefined);
  
  if (validScores.length > 0) {
    scores.averageScore = Math.round(
      (validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 10
    ) / 10;
  }
  
  return scores;
}

function extractBlobNameFromUrl(blobUrl: string): string {
  const url = new URL(blobUrl);
  const pathParts = url.pathname.split('/');
  return pathParts.slice(2).join('/');
}

export interface HybridScore {
  aiScore: number;
  excelScore: number;
  combinedScore: number;
  weight: {
    ai: number;
    excel: number;
  };
}

export function calculateHybridScore(
  aiScore: number,
  excelScore: number | null,
  aiWeight: number = 0.4,
  excelWeight: number = 0.6
): HybridScore {
  if (excelScore === null || excelScore === undefined) {
    return {
      aiScore,
      excelScore: 0,
      combinedScore: aiScore,
      weight: { ai: 1.0, excel: 0.0 },
    };
  }
  
  const combinedScore = Math.round((aiScore * aiWeight + excelScore * excelWeight) * 10) / 10;
  
  return {
    aiScore,
    excelScore,
    combinedScore,
    weight: { ai: aiWeight, excel: excelWeight },
  };
}

export function mapExcelScoresToEvaluation(excelScores: VendorExcelScores): {
  technicalFit: number;
  integration: number;
  compliance: number;
  deliveryRisk: number;
} {
  const productScore = excelScores.productScore?.overallScore ?? 0;
  const nfrScore = excelScores.nfrScore?.overallScore ?? 0;
  const cybersecurityScore = excelScores.cybersecurityScore?.overallScore ?? 0;
  const agileScore = excelScores.agileScore?.overallScore ?? 0;
  
  return {
    technicalFit: Math.round(((productScore * 0.5) + (nfrScore * 0.5)) * 10) / 10,
    integration: Math.round(((nfrScore * 0.7) + (productScore * 0.3)) * 10) / 10,
    compliance: cybersecurityScore,
    deliveryRisk: 100 - agileScore,
  };
}
