import { storage } from "../storage";
import { generateCompletion, parseAIResponse, validateAIResponse } from "./aiOrchestrationService";
import type { ExecutiveBriefing, InsertExecutiveBriefing } from "@shared/schema";

/**
 * Executive Briefing Generator Service
 * Creates role-specific executive summaries from vendor evaluations
 */

interface BriefingContent {
  topRecommendation: string;
  keyFindings: string[];
  riskSummary: {
    risks: string[];
    mitigations: string[];
  };
  nextSteps: string[];
  comparisonTable?: {
    headers: string[];
    rows: Array<Record<string, string>>;
  };
  additionalInsights?: string;
}

interface GenerateBriefingInput {
  projectId: string;
  projectName: string;
  stakeholderRole: "CEO" | "CTO" | "CFO" | "CISO" | "COO" | "PROJECT_MANAGER";
  evaluations: string;
  proposals: string;
}

/**
 * Generate an executive briefing for a specific stakeholder
 */
export async function generateExecutiveBriefing(input: GenerateBriefingInput): Promise<ExecutiveBriefing> {
  const { projectId, projectName, stakeholderRole, evaluations, proposals } = input;

  console.log(`[Executive Briefing] Generating briefing for ${stakeholderRole}...`);

  try {
    // Generate AI briefing
    const response = await generateCompletion(
      "executiveBriefing",
      {
        stakeholderRole,
        projectName,
        evaluations,
        proposals
      },
      {
        temperature: 0.3, // Lower temperature for consistent, professional output
        maxTokens: 3000,
        responseFormat: "json_object",
        useCache: true,
        cacheTTL: 120 // Cache for 2 hours
      }
    );

    const parsed = parseAIResponse<BriefingContent>(response);
    validateAIResponse(parsed, ["topRecommendation", "keyFindings", "riskSummary", "nextSteps"]);

    // Format content as markdown
    let markdown = `# ${parsed.topRecommendation}\n\n`;
    markdown += `## Key Findings\n\n`;
    parsed.keyFindings.forEach((finding, i) => {
      markdown += `${i + 1}. ${finding}\n`;
    });
    markdown += `\n## Risk Summary\n\n`;
    markdown += `**Risks:** ${parsed.riskSummary.risks.join(', ')}\n\n`;
    markdown += `**Mitigations:** ${parsed.riskSummary.mitigations.join(', ')}\n\n`;
    markdown += `## Next Steps\n\n`;
    parsed.nextSteps.forEach((step, i) => {
      markdown += `${i + 1}. ${step}\n`;
    });

    // Save briefing
    const insertBriefing: InsertExecutiveBriefing = {
      projectId,
      stakeholderRole,
      briefingType: "summary",
      title: `Executive Briefing for ${stakeholderRole}`,
      content: markdown,
      keyFindings: parsed.keyFindings,
      recommendations: {
        topRecommendation: parsed.topRecommendation,
        nextSteps: parsed.nextSteps
      }
    };

    const saved = await storage.createExecutiveBriefing(insertBriefing);
    console.log(`[Executive Briefing] Created briefing for ${stakeholderRole}: ${saved.id}`);
    
    return saved;
  } catch (error) {
    console.error(`[Executive Briefing] Error generating for ${stakeholderRole}:`, error);
    throw error;
  }
}

/**
 * Get all briefings for a project
 */
export async function getProjectBriefings(projectId: string): Promise<ExecutiveBriefing[]> {
  return storage.getExecutiveBriefingsByProject(projectId);
}

/**
 * Get briefings for a specific stakeholder role
 */
export async function getBriefingsByRole(
  projectId: string, 
  role: string
): Promise<ExecutiveBriefing[]> {
  const allBriefings = await storage.getExecutiveBriefingsByProject(projectId);
  return allBriefings.filter(b => b.stakeholderRole === role);
}

/**
 * Get a specific briefing
 */
export async function getBriefing(briefingId: string): Promise<ExecutiveBriefing | null> {
  const result = await storage.getExecutiveBriefing(briefingId);
  return result || null;
}

/**
 * Delete a briefing
 */
export async function deleteBriefing(briefingId: string): Promise<void> {
  await storage.deleteExecutiveBriefing(briefingId);
  console.log(`[Executive Briefing] Deleted briefing ${briefingId}`);
}

/**
 * Format briefing content as markdown
 */
export function formatBriefingAsMarkdown(briefing: ExecutiveBriefing): string {
  // The content is already in markdown format from generation
  let markdown = `# Executive Briefing: ${briefing.stakeholderRole}\n\n`;
  markdown += `*Generated: ${new Date(briefing.createdAt).toLocaleDateString()}*\n\n`;
  markdown += briefing.content;
  
  return markdown;
}

// Export service object
export const executiveBriefingService = {
  generateExecutiveBriefing,
  getProjectBriefings,
  getBriefingsByRole,
  getBriefing,
  deleteBriefing,
  formatBriefingAsMarkdown
};
