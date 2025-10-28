import OpenAI from "openai";
import { storage } from "../storage";
import type { SystemConfig } from "@shared/schema";

interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

interface BatchEmbeddingResult {
  embeddings: number[][];
  tokenCounts: number[];
  totalTokens: number;
}

export class AzureEmbeddingService {
  private client: OpenAI | null = null;
  private deploymentName: string | null = null;

  async initialize(): Promise<void> {
    const configs = await storage.getAllSystemConfig();
    
    const endpoint = configs.find((c: SystemConfig) => c.key === "AZURE_OPENAI_ENDPOINT")?.value;
    const apiKey = configs.find((c: SystemConfig) => c.key === "AZURE_OPENAI_KEY")?.value;
    const deployment = configs.find((c: SystemConfig) => c.key === "AZURE_OPENAI_EMBEDDING_DEPLOYMENT")?.value;

    if (!endpoint || !apiKey || !deployment) {
      throw new Error("Azure OpenAI credentials not configured. Please configure in Admin Config page.");
    }

    // OpenAI SDK supports Azure endpoints natively
    // For Azure, the deployment is in the URL, but we still pass it as model parameter
    // The baseURL should point to the deployment, and the SDK appends the resource path
    this.client = new OpenAI({
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      apiKey,
      defaultQuery: { "api-version": "2024-02-01" },
      defaultHeaders: { "api-key": apiKey },
    });
    // Use the deployment name in model parameter (Azure ignores it but SDK requires it)
    this.deploymentName = deployment;
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error("Azure OpenAI client not initialized");
    }

    try {
      // For Azure, the model parameter can be any string since deployment is in the baseURL
      const response = await this.client.embeddings.create({
        input: text,
        model: "text-embedding-ada-002", // Azure ignores this but SDK requires it
      });

      const embedding = response.data[0]?.embedding;
      const tokenCount = response.usage?.total_tokens || 0;

      if (!embedding) {
        throw new Error("No embedding returned from Azure OpenAI");
      }

      return {
        embedding,
        tokenCount,
      };
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.client) {
      await this.initialize();
    }

    if (!this.client) {
      throw new Error("Azure OpenAI client not initialized");
    }

    if (texts.length === 0) {
      return { embeddings: [], tokenCounts: [], totalTokens: 0 };
    }

    // Azure OpenAI has a batch limit of 16 inputs per request
    const batchSize = 16;
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    const allEmbeddings: number[][] = [];
    const allTokenCounts: number[] = [];
    let totalTokens = 0;

    for (const batch of batches) {
      try {
        // For Azure, the model parameter can be any string since deployment is in the baseURL
        const response = await this.client.embeddings.create({
          input: batch,
          model: "text-embedding-ada-002", // Azure ignores this but SDK requires it
        });

        for (const item of response.data) {
          allEmbeddings.push(item.embedding);
        }

        const batchTokens = response.usage?.total_tokens || 0;
        const tokensPerItem = Math.ceil(batchTokens / batch.length);
        
        for (let i = 0; i < batch.length; i++) {
          allTokenCounts.push(tokensPerItem);
        }

        totalTokens += batchTokens;
      } catch (error) {
        console.error("Error in batch embedding:", error);
        throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      embeddings: allEmbeddings,
      tokenCounts: allTokenCounts,
      totalTokens,
    };
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}

// Singleton instance
export const azureEmbeddingService = new AzureEmbeddingService();
