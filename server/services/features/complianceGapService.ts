import { storage } from "../storage";
import { generateCompletion, parseAIResponse, validateAIResponse } from "./aiOrchestrationService";
import type { ComplianceGap, InsertComplianceGap } from "@shared/schema";

/**
 * Compliance Gap Analysis Service
 * Identifies missing requirements, vague answers, and incomplete information in vendor proposals
 */

interface ComplianceGapResult {
  gapType: "missing_requirement" | "vague_answer" | "incomplete_information";
  severity: "critical" | "high" | "medium" | "low";
  requirementId?: string;
  section?: string;
  description: string;
  aiRationale: string;
  suggestedAction: string;
}

interface AnalyzeGapsInput {
  projectId: string;
  proposalId: string;
  requirements: string;
  proposal: string;
  vendorName: string;
}

/**
 * Analyze a vendor proposal for compliance gaps
 */
export async function analyzeComplianceGaps(input: AnalyzeGapsInput): Promise<ComplianceGap[]> {
  const { projectId, proposalId, requirements, proposal, vendorName } = input;

  console.log(`[Compliance Gap] Analyzing gaps for ${vendorName}...`);

  try {
    // Generate AI analysis
    const response = await generateCompletion(
      "complianceGap",
      {
        requirements,
        proposal,
        vendorName
      },
      {
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 4000,
        responseFormat: "json_object",
        useCache: true,
        cacheTTL: 60 // Cache for 1 hour
      }
    );

    const parsed = parseAIResponse<{ gaps: ComplianceGapResult[] }>(response);
    validateAIResponse(parsed, ["gaps"]);

    // Save gaps to database
    const savedGaps: ComplianceGap[] = [];
    for (const gap of parsed.gaps) {
      const insertGap: InsertComplianceGap = {
        projectId,
        proposalId,
        gapType: gap.gapType,
        severity: gap.severity,
        requirementId: gap.requirementId || null,
        section: gap.section || null,
        description: gap.description,
        aiRationale: gap.aiRationale,
        suggestedAction: gap.suggestedAction,
        isResolved: "false"
      };

      const saved = await storage.createComplianceGap(insertGap);
      savedGaps.push(saved);
    }

    console.log(`[Compliance Gap] Found ${savedGaps.length} gaps for ${vendorName}`);
    return savedGaps;
  } catch (error) {
    console.error(`[Compliance Gap] Error analyzing ${vendorName}:`, error);
    throw error;
  }
}

/**
 * Get all compliance gaps for a project
 */
export async function getProjectComplianceGaps(projectId: string): Promise<ComplianceGap[]> {
  return storage.getComplianceGapsByProject(projectId);
}

/**
 * Get compliance gaps for a specific vendor/proposal
 */
export async function getProposalComplianceGaps(proposalId: string): Promise<ComplianceGap[]> {
  return storage.getComplianceGapsByProposal(proposalId);
}

/**
 * Mark a compliance gap as resolved
 */
export async function resolveComplianceGap(gapId: string): Promise<void> {
  await storage.updateComplianceGap(gapId, { isResolved: "true" });
  console.log(`[Compliance Gap] Marked gap ${gapId} as resolved`);
}

/**
 * Get gap summary statistics for a project
 */
export async function getGapSummary(projectId: string): Promise<{
  totalGaps: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  resolvedCount: number;
  unresolvedCount: number;
}> {
  const gaps = await storage.getComplianceGapsByProject(projectId);

  const summary = {
    totalGaps: gaps.length,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    } as Record<string, number>,
    byType: {
      missing_requirement: 0,
      vague_answer: 0,
      incomplete_information: 0
    } as Record<string, number>,
    resolvedCount: 0,
    unresolvedCount: 0
  };

  for (const gap of gaps) {
    summary.bySeverity[gap.severity] = (summary.bySeverity[gap.severity] || 0) + 1;
    summary.byType[gap.gapType] = (summary.byType[gap.gapType] || 0) + 1;
    
    if (gap.isResolved === "true") {
      summary.resolvedCount++;
    } else {
      summary.unresolvedCount++;
    }
  }

  return summary;
}

// Export service object
export const complianceGapService = {
  analyzeComplianceGaps,
  getProjectComplianceGaps,
  getProposalComplianceGaps,
  resolveComplianceGap,
  getGapSummary
};
