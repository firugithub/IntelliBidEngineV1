import { storage } from "../storage";
import { generateCompletion, parseAIResponse, validateAIResponse } from "./aiOrchestrationService";
import type { FollowupQuestion, InsertFollowupQuestion } from "@shared/schema";

/**
 * Follow-up Question Generation Service
 * Generates vendor-specific clarifying questions based on proposal analysis
 */

interface FollowupQuestionResult {
  category: "technical" | "delivery" | "cost" | "compliance" | "clarification";
  priority: "critical" | "high" | "medium" | "low";
  question: string;
  context: string;
  relatedSection?: string;
  aiRationale: string;
}

interface GenerateQuestionsInput {
  projectId: string;
  proposalId: string;
  requirements: string;
  proposal: string;
  vendorName: string;
}

/**
 * Generate follow-up questions for a vendor proposal
 */
export async function generateFollowupQuestions(input: GenerateQuestionsInput): Promise<FollowupQuestion[]> {
  const { projectId, proposalId, requirements, proposal, vendorName } = input;

  console.log(`[Followup Questions] Generating questions for ${vendorName}...`);

  try {
    // Generate AI analysis
    const response = await generateCompletion(
      "followupQuestions",
      {
        requirements,
        proposal,
        vendorName
      },
      {
        temperature: 0.4, // Slightly higher temperature for creative question generation
        maxTokens: 4000,
        responseFormat: "json_object",
        useCache: true,
        cacheTTL: 60 // Cache for 1 hour
      }
    );

    const parsed = parseAIResponse<{ questions: FollowupQuestionResult[] }>(response);
    validateAIResponse(parsed, ["questions"]);

    // Save questions to database
    const savedQuestions: FollowupQuestion[] = [];
    for (const question of parsed.questions) {
      const insertQuestion: InsertFollowupQuestion = {
        projectId,
        proposalId,
        category: question.category,
        priority: question.priority,
        question: question.question,
        context: question.context,
        relatedSection: question.relatedSection || null,
        aiRationale: question.aiRationale,
        isAnswered: "false",
        answer: null
      };

      const saved = await storage.createFollowupQuestion(insertQuestion);
      savedQuestions.push(saved);
    }

    console.log(`[Followup Questions] Generated ${savedQuestions.length} questions for ${vendorName}`);
    return savedQuestions;
  } catch (error) {
    console.error(`[Followup Questions] Error generating for ${vendorName}:`, error);
    throw error;
  }
}

/**
 * Get all follow-up questions for a project
 */
export async function getProjectFollowupQuestions(projectId: string): Promise<FollowupQuestion[]> {
  return storage.getFollowupQuestionsByProject(projectId);
}

/**
 * Get follow-up questions for a specific vendor/proposal
 */
export async function getProposalFollowupQuestions(proposalId: string): Promise<FollowupQuestion[]> {
  return storage.getFollowupQuestionsByProposal(proposalId);
}

/**
 * Mark a question as answered with vendor response
 */
export async function answerFollowupQuestion(questionId: string, answer: string): Promise<void> {
  await storage.updateFollowupQuestion(questionId, {
    isAnswered: "true",
    answer
  });
  console.log(`[Followup Questions] Answered question ${questionId}`);
}

/**
 * Get question summary statistics for a project
 */
export async function getQuestionSummary(projectId: string): Promise<{
  totalQuestions: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  answeredCount: number;
  unansweredCount: number;
}> {
  const questions = await storage.getFollowupQuestionsByProject(projectId);

  const summary = {
    totalQuestions: questions.length,
    byCategory: {
      technical: 0,
      delivery: 0,
      cost: 0,
      compliance: 0,
      clarification: 0
    } as Record<string, number>,
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    } as Record<string, number>,
    answeredCount: 0,
    unansweredCount: 0
  };

  for (const question of questions) {
    summary.byCategory[question.category] = (summary.byCategory[question.category] || 0) + 1;
    summary.byPriority[question.priority] = (summary.byPriority[question.priority] || 0) + 1;
    
    if (question.isAnswered === "true") {
      summary.answeredCount++;
    } else {
      summary.unansweredCount++;
    }
  }

  return summary;
}

// Export service object
export const followupQuestionService = {
  generateFollowupQuestions,
  getProjectFollowupQuestions,
  getProposalFollowupQuestions,
  answerFollowupQuestion,
  getQuestionSummary
};
