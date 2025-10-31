import { storage } from "../storage";
import { ragRetrievalService } from "./ragRetrieval";
import { mcpConnectorService } from "./mcpConnectorService";
import OpenAI from "openai";

/**
 * Knowledge Base Chatbot Service
 * Specialized chatbot that ONLY uses knowledge base data (RAG) and MCP connectors
 * Does not use general AI knowledge - strictly data-driven responses
 */

export interface KnowledgeBaseChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  sources?: string[];
}

export interface ChatbotResponse {
  answer: string;
  sources: Array<{
    type: "rag" | "mcp";
    name: string;
    content?: string;
  }>;
  ragChunksUsed: number;
  mcpConnectorsUsed: number;
}

class KnowledgeBaseChatbotService {
  private openai: OpenAI | null = null;

  constructor() {
    // Don't throw in constructor - allow lazy initialization
  }

  /**
   * Lazy-load OpenAI client
   */
  private getOpenAI(): OpenAI {
    if (this.openai) {
      return this.openai;
    }

    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Please add AI_INTEGRATIONS_OPENAI_API_KEY to your environment.");
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });

    return this.openai;
  }

  /**
   * Generate chatbot response using ONLY knowledge base and MCP data
   */
  async generateResponse(
    userQuery: string,
    conversationHistory: KnowledgeBaseChatMessage[] = []
  ): Promise<ChatbotResponse> {
    console.log("[Knowledge Base Chatbot] Processing query:", userQuery);

    // Step 1: Retrieve relevant RAG context
    const ragContext = await ragRetrievalService.retrieveRelevantContext(userQuery, {
      topK: 8,
    });

    console.log(`[Knowledge Base Chatbot] Retrieved ${ragContext.chunks.length} RAG chunks`);

    // Step 2: Fetch MCP connector data for all roles (test all connectors)
    const mcpConnectors = await storage.getActiveMcpConnectors();
    const mcpPayloads: Array<{ connectorName: string; data: any; roles: string[] }> = [];

    for (const connector of mcpConnectors) {
      try {
        const payload = await mcpConnectorService.fetchConnectorData(connector.id, {
          projectName: "Knowledge Base Query",
          proposalSummary: userQuery,
        });

        if (payload) {
          mcpPayloads.push({
            connectorName: connector.name,
            data: payload.rawData,
            roles: connector.roleMapping || [],
          });
        }
      } catch (error) {
        console.warn(`[Knowledge Base Chatbot] Failed to fetch from connector ${connector.name}:`, error);
      }
    }

    console.log(`[Knowledge Base Chatbot] Retrieved MCP data from ${mcpPayloads.length} connectors`);

    // Step 3: Build context from RAG chunks
    let contextParts: string[] = [];

    if (ragContext.chunks.length > 0) {
      contextParts.push("## Knowledge Base Documents\n");
      ragContext.chunks.forEach((chunk, index) => {
        contextParts.push(`### Document ${index + 1}: ${chunk.fileName}`);
        if (chunk.metadata?.sectionTitle) {
          contextParts.push(`Section: ${chunk.metadata.sectionTitle}`);
        }
        contextParts.push(chunk.content);
        contextParts.push("---\n");
      });
    }

    // Step 4: Build context from MCP connectors
    if (mcpPayloads.length > 0) {
      contextParts.push("\n## External Data Sources (MCP Connectors)\n");
      mcpPayloads.forEach((mcp, index) => {
        contextParts.push(`### Connector ${index + 1}: ${mcp.connectorName}`);
        contextParts.push(`Mapped to Agents: ${mcp.roles.join(", ")}`);
        contextParts.push(`Data: ${JSON.stringify(mcp.data, null, 2)}`);
        contextParts.push("---\n");
      });
    }

    const contextString = contextParts.join("\n");

    // Step 5: Build conversation history for OpenAI
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: this.getSystemPrompt(ragContext.chunks.length, mcpPayloads.length),
      },
    ];

    // Add conversation history (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role !== "system") {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current context and query
    messages.push({
      role: "user",
      content: `${contextString}\n\n---\n\n**User Question:** ${userQuery}\n\nPlease answer based ONLY on the knowledge base documents and MCP connector data provided above. If the information is not in the provided context, clearly state that you don't have that information in the knowledge base.`,
    });

    // Step 6: Generate response
    console.log("[Knowledge Base Chatbot] Generating AI response...");
    const openai = this.getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    });

    const answer = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    // Step 7: Build sources list
    const sources: Array<{ type: "rag" | "mcp"; name: string; content?: string }> = [];

    ragContext.chunks.forEach((chunk) => {
      sources.push({
        type: "rag",
        name: chunk.fileName,
        content: chunk.metadata?.sectionTitle || undefined,
      });
    });

    mcpPayloads.forEach((mcp) => {
      sources.push({
        type: "mcp",
        name: mcp.connectorName,
      });
    });

    return {
      answer,
      sources,
      ragChunksUsed: ragContext.chunks.length,
      mcpConnectorsUsed: mcpPayloads.length,
    };
  }

  /**
   * Generate streaming response
   */
  async *generateStreamingResponse(
    userQuery: string,
    conversationHistory: KnowledgeBaseChatMessage[] = []
  ): AsyncGenerator<{
    type: "chunk" | "sources" | "done";
    content?: string;
    sources?: Array<{ type: "rag" | "mcp"; name: string; content?: string }>;
    ragChunksUsed?: number;
    mcpConnectorsUsed?: number;
  }> {
    console.log("[Knowledge Base Chatbot] Processing streaming query:", userQuery);

    // Step 1: Retrieve RAG context
    const ragContext = await ragRetrievalService.retrieveRelevantContext(userQuery, {
      topK: 8,
    });

    // Step 2: Fetch MCP data
    const mcpConnectors = await storage.getActiveMcpConnectors();
    const mcpPayloads: Array<{ connectorName: string; data: any; roles: string[] }> = [];

    for (const connector of mcpConnectors) {
      try {
        const payload = await mcpConnectorService.fetchConnectorData(connector.id, {
          projectName: "Knowledge Base Query",
          proposalSummary: userQuery,
        });

        if (payload) {
          mcpPayloads.push({
            connectorName: connector.name,
            data: payload.rawData,
            roles: connector.roleMapping || [],
          });
        }
      } catch (error) {
        console.warn(`[Knowledge Base Chatbot] Failed to fetch from connector ${connector.name}:`, error);
      }
    }

    // Step 3: Build context
    let contextParts: string[] = [];

    if (ragContext.chunks.length > 0) {
      contextParts.push("## Knowledge Base Documents\n");
      ragContext.chunks.forEach((chunk, index) => {
        contextParts.push(`### Document ${index + 1}: ${chunk.fileName}`);
        if (chunk.metadata?.sectionTitle) {
          contextParts.push(`Section: ${chunk.metadata.sectionTitle}`);
        }
        contextParts.push(chunk.content);
        contextParts.push("---\n");
      });
    }

    if (mcpPayloads.length > 0) {
      contextParts.push("\n## External Data Sources (MCP Connectors)\n");
      mcpPayloads.forEach((mcp, index) => {
        contextParts.push(`### Connector ${index + 1}: ${mcp.connectorName}`);
        contextParts.push(`Mapped to Agents: ${mcp.roles.join(", ")}`);
        contextParts.push(`Data: ${JSON.stringify(mcp.data, null, 2)}`);
        contextParts.push("---\n");
      });
    }

    const contextString = contextParts.join("\n");

    // Step 4: Build messages
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: this.getSystemPrompt(ragContext.chunks.length, mcpPayloads.length),
      },
    ];

    const recentHistory = conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role !== "system") {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    messages.push({
      role: "user",
      content: `${contextString}\n\n---\n\n**User Question:** ${userQuery}\n\nPlease answer based ONLY on the knowledge base documents and MCP connector data provided above.`,
    });

    // Step 5: Stream response
    const openai = this.getOpenAI();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          type: "chunk",
          content,
        };
      }
    }

    // Send sources
    const sources: Array<{ type: "rag" | "mcp"; name: string; content?: string }> = [];

    ragContext.chunks.forEach((chunk) => {
      sources.push({
        type: "rag",
        name: chunk.fileName,
        content: chunk.metadata?.sectionTitle || undefined,
      });
    });

    mcpPayloads.forEach((mcp) => {
      sources.push({
        type: "mcp",
        name: mcp.connectorName,
      });
    });

    yield {
      type: "sources",
      sources,
      ragChunksUsed: ragContext.chunks.length,
      mcpConnectorsUsed: mcpPayloads.length,
    };

    yield {
      type: "done",
    };
  }

  /**
   * System prompt that enforces knowledge-base-only responses
   */
  private getSystemPrompt(ragChunks: number, mcpConnectors: number): string {
    return `You are a specialized Knowledge Base Assistant for IntelliBid, an AI-powered vendor evaluation platform for Nujum Air (Middle East's largest airline).

**YOUR STRICT ROLE:**
- Answer questions ONLY using the provided knowledge base documents and MCP connector data
- DO NOT use your general knowledge about aviation, airlines, or technology
- If information is NOT in the provided context, clearly state: "I don't have that information in the current knowledge base"
- Always cite which documents or connectors you're using in your answer

**CURRENT CONTEXT AVAILABLE:**
- Knowledge Base Documents: ${ragChunks} retrieved chunks
- MCP Connectors: ${mcpConnectors} external data sources

**RESPONSE GUIDELINES:**
1. **RFT/RFI Questions:** If asked about RFT (Request for Tender) or RFI (Request for Information) processes, reference relevant compliance standards and organizational guidelines from the knowledge base
2. **Document Queries:** When asked about specific documents, summarize and quote from the retrieved chunks
3. **MCP Data:** When external connector data is available, explain what systems are being queried and what data is available
4. **Compliance & Standards:** Reference specific compliance frameworks (IATA, ISO 27001, PCI-DSS, GDPR, NIST) only if they appear in the retrieved documents
5. **Vendor Evaluation:** Provide insights based on the organization's evaluation criteria found in the knowledge base

**TESTING MODE:**
You are helping test the RAG (Retrieval Augmented Generation) system and MCP (Model Context Protocol) connectors. Be explicit about:
- Which knowledge base documents you're referencing
- Which MCP connectors provided data
- What information is or isn't available

**CRITICAL:** Never make up information. Only use what's in the provided context.`;
  }

  /**
   * Check if chatbot is ready (RAG + OpenAI configured)
   */
  async isReady(): Promise<{ 
    ready: boolean; 
    openAIConfigured: boolean;
    ragConfigured: boolean; 
    mcpConnectorsAvailable: number;
    missingConfiguration: string[];
  }> {
    const ragConfigured = await ragRetrievalService.isConfigured();
    const mcpConnectors = await storage.getActiveMcpConnectors();
    const openAIConfigured = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    const missingConfiguration: string[] = [];
    if (!openAIConfigured) {
      missingConfiguration.push("OpenAI API key (AI_INTEGRATIONS_OPENAI_API_KEY)");
    }
    if (!ragConfigured) {
      missingConfiguration.push("Azure AI Search configuration");
    }

    return {
      ready: ragConfigured && openAIConfigured,
      openAIConfigured,
      ragConfigured,
      mcpConnectorsAvailable: mcpConnectors.length,
      missingConfiguration,
    };
  }
}

// Singleton instance
export const knowledgeBaseChatbotService = new KnowledgeBaseChatbotService();
