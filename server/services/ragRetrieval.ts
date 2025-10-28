import { azureEmbeddingService } from "./azureEmbedding";
import { azureAISearchService } from "./azureAISearch";
import { storage } from "../storage";

export interface RetrievedChunk {
  content: string;
  fileName: string;
  sourceType: string;
  sourceId?: string;
  chunkIndex: number;
  metadata: Record<string, any>;
  score?: number;
}

export interface RAGContext {
  chunks: RetrievedChunk[];
  summary: string;
}

export class RAGRetrievalService {
  /**
   * Retrieve relevant compliance documents for a given query
   */
  async retrieveRelevantContext(
    query: string,
    options?: {
      topK?: number;
      sourceType?: string;
      tags?: string[];
    }
  ): Promise<RAGContext> {
    try {
      // Generate embedding for the query
      const embeddingResult = await azureEmbeddingService.generateEmbedding(query);

      // Build filter if needed
      let filter: string | undefined;
      if (options?.sourceType) {
        filter = `sourceType eq '${options.sourceType}'`;
      }
      if (options?.tags && options.tags.length > 0) {
        const tagFilters = options.tags.map(tag => `metadata/tags/any(t: t eq '${tag}')`).join(' or ');
        filter = filter ? `${filter} and (${tagFilters})` : tagFilters;
      }

      // Perform hybrid search
      const results = await azureAISearchService.hybridSearch(
        query,
        embeddingResult.embedding,
        {
          top: options?.topK || 5,
          filter,
        }
      );

      // Convert to RetrievedChunk format
      const chunks: RetrievedChunk[] = results.map((doc) => ({
        content: doc.content,
        fileName: doc.fileName,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        chunkIndex: doc.chunkIndex,
        metadata: doc.metadata || {},
      }));

      // Generate a summary of the retrieved context
      const summary = this.generateContextSummary(chunks);

      return {
        chunks,
        summary,
      };
    } catch (error) {
      console.error('Error retrieving RAG context:', error);
      // Return empty context on error
      return {
        chunks: [],
        summary: 'No relevant compliance documents found.',
      };
    }
  }

  /**
   * Retrieve compliance standards relevant to specific requirements
   */
  async retrieveComplianceStandards(
    requirements: string[],
    options?: {
      topKPerRequirement?: number;
    }
  ): Promise<RAGContext> {
    const topK = options?.topKPerRequirement || 3;
    const allChunks: RetrievedChunk[] = [];
    const seenChunkIds = new Set<string>();

    // For each requirement, retrieve relevant compliance documents
    for (const requirement of requirements) {
      const context = await this.retrieveRelevantContext(requirement, {
        topK,
        sourceType: 'compliance-standard',
      });

      // Add unique chunks only
      for (const chunk of context.chunks) {
        const chunkId = `${chunk.fileName}-${chunk.chunkIndex}`;
        if (!seenChunkIds.has(chunkId)) {
          seenChunkIds.add(chunkId);
          allChunks.push(chunk);
        }
      }
    }

    const summary = this.generateContextSummary(allChunks);

    return {
      chunks: allChunks,
      summary,
    };
  }

  /**
   * Generate a concise summary of the retrieved chunks
   */
  private generateContextSummary(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant compliance documents found.';
    }

    const uniqueDocuments = new Set(chunks.map(c => c.fileName));
    const documentList = Array.from(uniqueDocuments).join(', ');
    
    return `Retrieved ${chunks.length} relevant sections from ${uniqueDocuments.size} compliance document(s): ${documentList}`;
  }

  /**
   * Format retrieved chunks for AI agent context
   */
  formatForAIContext(ragContext: RAGContext): string {
    if (ragContext.chunks.length === 0) {
      return '';
    }

    let context = '## Organization Compliance Standards\n\n';
    context += `${ragContext.summary}\n\n`;
    
    ragContext.chunks.forEach((chunk, index) => {
      context += `### Reference ${index + 1}: ${chunk.fileName}\n`;
      if (chunk.metadata.sectionTitle) {
        context += `**Section:** ${chunk.metadata.sectionTitle}\n`;
      }
      context += `\n${chunk.content}\n\n`;
      context += '---\n\n';
    });

    return context;
  }

  /**
   * Check if RAG system is configured and ready
   */
  async isConfigured(): Promise<boolean> {
    try {
      const configs = await storage.getAllSystemConfig();
      
      const hasAzureSearch = configs.some(c => c.key === 'AZURE_SEARCH_ENDPOINT' && c.value) ||
                            !!process.env.AZURE_SEARCH_ENDPOINT;
      const hasAzureSearchKey = configs.some(c => c.key === 'AZURE_SEARCH_KEY' && c.value) ||
                               !!process.env.AZURE_SEARCH_KEY;
      const hasEmbeddings = configs.some(c => c.key === 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT' && c.value) ||
                           !!process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;

      return hasAzureSearch && hasAzureSearchKey && hasEmbeddings;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const ragRetrievalService = new RAGRetrievalService();
