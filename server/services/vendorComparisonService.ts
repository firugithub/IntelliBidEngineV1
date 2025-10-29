import { storage } from "../storage";
import { generateCompletion, parseAIResponse, validateAIResponse } from "./aiOrchestrationService";
import type { ComparisonSnapshot, InsertComparisonSnapshot } from "@shared/schema";

/**
 * Smart Vendor Comparison Matrix Service
 * Generates structured side-by-side vendor comparisons across multiple dimensions
 */

interface VendorComparisonData {
  vendorName: string;
  proposalId: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  dimensions: {
    technicalCapability: { score: number; summary: string };
    deliveryRisk: { score: number; summary: string };
    costCompetitiveness: { score: number; summary: string };
    compliance: { score: number; summary: string };
    innovation: { score: number; summary: string };
    teamExperience: { score: number; summary: string };
  };
}

interface ComparisonMatrixResult {
  comparisonTitle: string;
  executiveSummary: string;
  vendors: VendorComparisonData[];
  recommendations: {
    topChoice: string;
    rationale: string;
    riskMitigations: string[];
  };
  keyDifferentiators: string[];
}

interface GenerateComparisonInput {
  projectId: string;
  proposalIds: string[];
  requirements: string;
  proposals: Array<{ vendorName: string; content: string }>;
  comparisonFocus?: string;
}

/**
 * Generate a smart vendor comparison matrix
 */
export async function generateVendorComparison(input: GenerateComparisonInput): Promise<ComparisonSnapshot> {
  const { projectId, proposalIds, requirements, proposals, comparisonFocus } = input;

  console.log(`[Vendor Comparison] Comparing ${proposals.length} vendors...`);

  try {
    // Generate AI comparison
    const response = await generateCompletion(
      "vendorComparison",
      {
        requirements,
        proposals: JSON.stringify(proposals),
        vendorCount: proposals.length.toString(),
        comparisonFocus: comparisonFocus || "overall fit and value"
      },
      {
        temperature: 0.3, // Lower temperature for consistent analysis
        maxTokens: 5000, // Larger token budget for comprehensive comparisons
        responseFormat: "json_object",
        useCache: true,
        cacheTTL: 120 // Cache for 2 hours (longer for expensive comparisons)
      }
    );

    const parsed = parseAIResponse<ComparisonMatrixResult>(response);
    validateAIResponse(parsed, ["comparisonTitle", "vendors", "recommendations"]);

    // Save comparison snapshot
    const insertSnapshot: InsertComparisonSnapshot = {
      projectId,
      title: parsed.comparisonTitle,
      comparisonType: "full",
      vendorIds: proposalIds,
      comparisonData: parsed,
      highlights: {
        executiveSummary: parsed.executiveSummary,
        topChoice: parsed.recommendations.topChoice,
        keyDifferentiators: parsed.keyDifferentiators
      }
    };

    const saved = await storage.createComparisonSnapshot(insertSnapshot);
    console.log(`[Vendor Comparison] Created comparison snapshot: ${saved.id}`);
    
    return saved;
  } catch (error) {
    console.error(`[Vendor Comparison] Error generating comparison:`, error);
    throw error;
  }
}

/**
 * Get all comparison snapshots for a project
 */
export async function getProjectComparisons(projectId: string): Promise<ComparisonSnapshot[]> {
  return storage.getComparisonSnapshotsByProject(projectId);
}

/**
 * Get a specific comparison snapshot
 */
export async function getComparison(snapshotId: string): Promise<ComparisonSnapshot | null> {
  const result = await storage.getComparisonSnapshot(snapshotId);
  return result || null;
}

/**
 * Delete a comparison snapshot
 */
export async function deleteComparison(snapshotId: string): Promise<void> {
  await storage.deleteComparisonSnapshot(snapshotId);
  console.log(`[Vendor Comparison] Deleted comparison ${snapshotId}`);
}

/**
 * Export comparison data in various formats
 */
export function exportComparisonData(comparison: ComparisonSnapshot, format: "json" | "csv"): string {
  if (format === "json") {
    return JSON.stringify(comparison.comparisonData, null, 2);
  }

  if (format === "csv") {
    const data = comparison.comparisonData as ComparisonMatrixResult;
    let csv = "Vendor,Overall Score,Technical,Delivery Risk,Cost,Compliance,Innovation,Team Experience\n";
    
    for (const vendor of data.vendors) {
      csv += `${vendor.vendorName},${vendor.overallScore},`;
      csv += `${vendor.dimensions.technicalCapability.score},`;
      csv += `${vendor.dimensions.deliveryRisk.score},`;
      csv += `${vendor.dimensions.costCompetitiveness.score},`;
      csv += `${vendor.dimensions.compliance.score},`;
      csv += `${vendor.dimensions.innovation.score},`;
      csv += `${vendor.dimensions.teamExperience.score}\n`;
    }
    
    return csv;
  }

  throw new Error(`Unsupported export format: ${format}`);
}

// Export service object
export const vendorComparisonService = {
  generateVendorComparison,
  getProjectComparisons,
  getComparison,
  deleteComparison,
  exportComparisonData
};
