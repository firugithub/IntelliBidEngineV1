import { azureEmbeddingService } from "../azure/azureEmbedding";
import { azureAISearchService } from "../azure/azureAISearch";
import { azureSearchSkillsetService } from "../azure/azureSearchSkillset";
import { storage } from "../../storage";

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
   * Now queries BOTH intellibid-rag (chunked documents) AND intellibid-blob-ocr (OCR-extracted text)
   */
  async retrieveRelevantContext(
    query: string,
    options?: {
      topK?: number;
      sourceType?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<RAGContext> {
    try {
      const topK = options?.topK || 5;
      
      // Generate embedding for the query (needed for RAG index)
      const embeddingResult = await azureEmbeddingService.generateEmbedding(query);

      // Build filter if needed
      let filter: string | undefined;
      if (options?.sourceType) {
        filter = `sourceType eq '${options.sourceType}'`;
      }
      
      // Category filtering: include both agent's category AND shared category
      if (options?.category) {
        const categoryFilter = `(category eq '${options.category}') or (category eq 'shared')`;
        filter = filter ? `${filter} and (${categoryFilter})` : categoryFilter;
      }
      
      if (options?.tags && options.tags.length > 0) {
        const tagFilters = options.tags.map(tag => `metadata/tags/any(t: t eq '${tag}')`).join(' or ');
        filter = filter ? `${filter} and (${tagFilters})` : tagFilters;
      }

      // DUAL-INDEX QUERYING: Query both indexes in parallel
      console.log(`[RAG] Dual-index retrieval: querying intellibid-rag + intellibid-blob-ocr`);
      
      const [ragResults, ocrResults] = await Promise.all([
        // Query 1: Standard RAG index (chunked documents with embeddings)
        azureAISearchService.hybridSearch(
          query,
          embeddingResult.embedding,
          {
            top: topK,
            filter,
          }
        ).catch(error => {
          console.warn('[RAG] Error querying RAG index:', error.message);
          return [];
        }),
        
        // Query 2: OCR index (blob documents with merged_text from images)
        azureSearchSkillsetService.queryOcrIndex({
          query,
          topK,
        }).catch(error => {
          console.warn('[RAG] Error querying OCR index:', error.message);
          return [];
        })
      ]);

      console.log(`[RAG] Retrieved ${ragResults.length} chunks from RAG index, ${ocrResults.length} documents from OCR index`);

      // Convert RAG results to RetrievedChunk format
      const ragChunks: RetrievedChunk[] = ragResults.map((doc) => ({
        content: doc.content,
        fileName: doc.fileName,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        chunkIndex: doc.chunkIndex,
        metadata: doc.metadata || {},
        score: doc.score,
      }));

      // Convert OCR results to RetrievedChunk format
      // Prefer merged_text (OCR-enhanced) when available, fallback to content
      const ocrChunks: RetrievedChunk[] = ocrResults.map((doc) => ({
        content: doc.mergedText || doc.content,
        fileName: doc.fileName,
        sourceType: 'ocr-document',
        sourceId: doc.id,
        chunkIndex: 0,
        metadata: {
          blobPath: doc.blobPath,
          lastModified: doc.lastModified,
          hasMergedText: !!doc.mergedText,
        },
        score: doc.score,
      }));

      // INTELLIGENT MERGE: Combine RAG and OCR results with smart deduplication
      const fileNameMap = new Map<string, RetrievedChunk>();
      
      // First, add all RAG chunks (these are already chunked/processed)
      for (const chunk of ragChunks) {
        const key = `${chunk.fileName}-${chunk.chunkIndex}`;
        fileNameMap.set(key, chunk);
      }
      
      // Then, process OCR chunks with intelligent merge strategy:
      // 1. If OCR has merged_text OR content, consider adding it
      // 2. Replace RAG chunks if OCR merged_text has significantly more content (image-heavy PDFs)
      // 3. Add OCR as new chunk if file not in RAG index
      for (const ocrChunk of ocrChunks) {
        const hasOcrContent = ocrChunk.metadata.hasMergedText || (ocrChunk.content && ocrChunk.content.length > 50);
        
        if (hasOcrContent) {
          // Find all existing RAG chunks for this file
          const existingKeys = Array.from(fileNameMap.keys()).filter(key => 
            key.startsWith(`${ocrChunk.fileName}-`)
          );
          
          if (existingKeys.length === 0) {
            // No existing chunks for this file, add OCR result
            const key = `${ocrChunk.fileName}-0`;
            fileNameMap.set(key, ocrChunk);
            console.log(`[RAG] Added OCR content for: ${ocrChunk.fileName} (not in RAG index)`);
          } else {
            // File exists in RAG index - check if OCR merged_text is richer
            const firstExistingChunk = fileNameMap.get(existingKeys[0]);
            const ragContentLength = firstExistingChunk?.content?.length || 0;
            const ocrContentLength = ocrChunk.content?.length || 0;
            
            // If OCR has merged_text AND it's significantly larger (3x+), replace RAG chunks
            // This handles cases where RAG extracted minimal text from image-heavy PDFs
            if (ocrChunk.metadata.hasMergedText && ocrContentLength > ragContentLength * 3) {
              // Remove existing RAG chunks for this file
              existingKeys.forEach(k => fileNameMap.delete(k));
              // Add OCR chunk instead
              const key = `${ocrChunk.fileName}-0`;
              fileNameMap.set(key, ocrChunk);
              console.log(`[RAG] Replaced ${existingKeys.length} RAG chunks with OCR merged_text for: ${ocrChunk.fileName} (OCR: ${ocrContentLength} chars vs RAG: ${ragContentLength} chars)`);
            } else {
              // Keep RAG chunks (they're better chunked/structured)
              console.log(`[RAG] Kept RAG chunks for ${ocrChunk.fileName} (RAG sufficient: ${ragContentLength} chars)`);
            }
          }
        }
      }

      // Convert back to array and sort by score
      const mergedChunks = Array.from(fileNameMap.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topK);

      // Generate a summary of the retrieved context
      const summary = this.generateContextSummary(mergedChunks);

      console.log(`[RAG] Final merged results: ${mergedChunks.length} chunks (${mergedChunks.filter(c => c.sourceType === 'ocr-document').length} from OCR)`);

      return {
        chunks: mergedChunks,
        summary,
      };
    } catch (error) {
      console.error('[RAG] Error retrieving RAG context:', error);
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
      category?: string;
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
        category: options?.category,
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
