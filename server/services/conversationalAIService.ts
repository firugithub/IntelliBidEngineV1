import { storage } from "../storage";
import { generateCompletion } from "./aiOrchestrationService";
import type { ChatSession, ChatMessage, InsertChatSession, InsertChatMessage } from "@shared/schema";
import OpenAI from "openai";

/**
 * Conversational AI Assistant Service
 * Handles chat sessions and natural language queries about vendor evaluations
 */

interface ChatContext {
  projectId: string;
  proposals?: string;
  evaluations?: string;
  requirements?: string;
  complianceGaps?: string;
  followupQuestions?: string;
}

/**
 * Create a new chat session
 */
export async function createChatSession(projectId: string): Promise<ChatSession> {
  const insertSession: InsertChatSession = {
    projectId,
    title: "New Conversation"
  };

  const session = await storage.createChatSession(insertSession);
  console.log(`[Conversational AI] Created chat session: ${session.id}`);
  return session;
}

/**
 * Get a chat session
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const result = await storage.getChatSession(sessionId);
  return result || null;
}

/**
 * Get all chat sessions for a project
 */
export async function getProjectChatSessions(projectId: string): Promise<ChatSession[]> {
  return storage.getChatSessionsByProject(projectId);
}

/**
 * Get chat messages for a session
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return storage.getChatMessagesBySession(sessionId);
}

/**
 * Update chat session title
 */
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await storage.updateChatSession(sessionId, { title });
  console.log(`[Conversational AI] Updated session title: ${sessionId}`);
}

/**
 * Delete a chat session and all its messages
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  await storage.deleteChatSession(sessionId);
  console.log(`[Conversational AI] Deleted chat session: ${sessionId}`);
}

/**
 * Build context string from available data
 */
function buildContextString(context: ChatContext): string {
  const parts: string[] = [];

  if (context.requirements) {
    parts.push(`**Requirements:**\n${context.requirements}`);
  }

  if (context.proposals) {
    parts.push(`**Vendor Proposals:**\n${context.proposals}`);
  }

  if (context.evaluations) {
    parts.push(`**AI Evaluations:**\n${context.evaluations}`);
  }

  if (context.complianceGaps) {
    parts.push(`**Compliance Gaps:**\n${context.complianceGaps}`);
  }

  if (context.followupQuestions) {
    parts.push(`**Follow-up Questions:**\n${context.followupQuestions}`);
  }

  return parts.join('\n\n');
}

/**
 * Generate a non-streaming chat response
 */
export async function generateChatResponse(
  sessionId: string,
  userQuestion: string,
  context: ChatContext
): Promise<ChatMessage> {
  console.log(`[Conversational AI] Generating response for session ${sessionId}`);

  try {
    // Save user message
    const userMessage: InsertChatMessage = {
      sessionId,
      role: "user",
      content: userQuestion
    };
    await storage.createChatMessage(userMessage);

    // Get conversation history
    const messages = await storage.getChatMessagesBySession(sessionId);
    const conversationHistory = messages
      .slice(-10) // Last 10 messages for context
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join('\n\n');

    // Build context
    const contextString = buildContextString(context);

    // Generate AI response
    const response = await generateCompletion(
      "conversationalAssistant",
      {
        userQuestion,
        context: contextString || "No additional context available.",
        conversationHistory: conversationHistory || "This is the start of the conversation."
      },
      {
        temperature: 0.4, // Slightly higher for more conversational responses
        maxTokens: 2000,
        useCache: false // Don't cache conversational responses
      }
    );

    // Save assistant message
    const assistantMessage: InsertChatMessage = {
      sessionId,
      role: "assistant",
      content: response
    };
    const saved = await storage.createChatMessage(assistantMessage);

    // Auto-generate session title from first message if still "New Conversation"
    const session = await storage.getChatSession(sessionId);
    if (session && session.title === "New Conversation" && messages.length === 0) {
      const title = userQuestion.slice(0, 60) + (userQuestion.length > 60 ? "..." : "");
      await updateSessionTitle(sessionId, title);
    }

    return saved;
  } catch (error) {
    console.error(`[Conversational AI] Error generating response:`, error);
    throw error;
  }
}

/**
 * Generate a streaming chat response
 * Returns an async generator for streaming responses
 */
export async function* generateStreamingChatResponse(
  sessionId: string,
  userQuestion: string,
  context: ChatContext
): AsyncGenerator<string> {
  console.log(`[Conversational AI] Generating streaming response for session ${sessionId}`);

  try {
    // Save user message
    const userMessage: InsertChatMessage = {
      sessionId,
      role: "user",
      content: userQuestion
    };
    await storage.createChatMessage(userMessage);

    // Get conversation history
    const messages = await storage.getChatMessagesBySession(sessionId);
    const conversationHistory = messages
      .slice(-10) // Last 10 messages for context
      .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join('\n\n');

    // Build context
    const contextString = buildContextString(context);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    });

    // Generate streaming AI response
    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: `You are an AI assistant specializing in vendor evaluation and proposal analysis. Answer questions conversationally but professionally.` 
        },
        { 
          role: "user", 
          content: `Context: ${contextString || "No context"}\n\nConversation: ${conversationHistory || "Start"}\n\nQuestion: ${userQuestion}` 
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      stream: true
    });

    // Stream chunks to client
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        yield content;
      }
    }

    // Save complete assistant message
    const assistantMessage: InsertChatMessage = {
      sessionId,
      role: "assistant",
      content: fullResponse
    };
    await storage.createChatMessage(assistantMessage);

    // Auto-generate session title from first message if still "New Conversation"
    const session = await storage.getChatSession(sessionId);
    if (session && session.title === "New Conversation" && messages.length === 0) {
      const title = userQuestion.slice(0, 60) + (userQuestion.length > 60 ? "..." : "");
      await updateSessionTitle(sessionId, title);
    }

  } catch (error) {
    console.error(`[Conversational AI] Error in streaming response:`, error);
    throw error;
  }
}

// Export service object
export const conversationalAIService = {
  createChatSession,
  getChatSession,
  getProjectChatSessions,
  getSessionMessages,
  updateSessionTitle,
  deleteChatSession,
  generateChatResponse,
  generateStreamingChatResponse
};
