import { azureBlobStorageService } from "../azure/azureBlobStorage";
import { azureAISearchService } from "../azure/azureAISearch";
import { azureEmbeddingService } from "../azure/azureEmbedding";
import { azureSearchSkillsetService } from "../azure/azureSearchSkillset";
import { chunkDocument } from "./chunkingService";
import { storage } from "../../storage";
import type { InsertRagDocument, InsertRagChunk } from "@shared/schema";
import { randomUUID } from "crypto";

interface DocumentIngestionOptions {
  sourceType: "standard" | "proposal" | "requirement" | "confluence" | "sharepoint";
  sourceId?: string;
  category?: "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security" | "shared";
  fileName: string;
  content: Buffer;
  textContent: string;
  metadata?: {
    tags?: string[];
    vendor?: string;
    project?: string;
    sectionTitle?: string;
    pageNumber?: number;
  };
  documentId?: string; // Optional: reuse existing document ID for re-indexing
}

interface IngestionResult {
  documentId: string;
  blobUrl: string;
  chunksIndexed: number;
  totalTokens: number;
  status: "success" | "partial" | "failed";
  error?: string;
}

export class DocumentIngestionService {
  /**
   * Get effective text content for chunking, preferring OCR-enriched text if available
   * Falls back to original text if OCR not available within timeout
   */
  private async getEffectiveContent(options: {
    blobName: string;
    defaultText: string;
    timeoutMs?: number;
  }): Promise<{ content: string; ocrEnriched: boolean }> {
    const { blobName, defaultText, timeoutMs = 30000 } = options;

    try {
      // Attempt to retrieve OCR-enriched text from staging index
      const mergedText = await azureSearchSkillsetService.waitForOcrMergedText({
        blobName,
        timeoutMs,
        pollIntervalMs: 3000,
      });

      if (mergedText) {
        console.log(`[RAG] Using OCR-enriched text for chunking: ${blobName}`);
        return { content: mergedText, ocrEnriched: true };
      }

      // OCR not available, fall back to original text
      console.log(`[RAG] OCR text not available, using original text: ${blobName}`);
      return { content: defaultText, ocrEnriched: false };
    } catch (error: any) {
      console.warn(`[RAG] Error retrieving OCR text for ${blobName}:`, error.message);
      console.log("[RAG] Falling back to original text");
      return { content: defaultText, ocrEnriched: false };
    }
  }

  /**
   * Ingest a document into the RAG system
   * 1. Create initial record with "processing" status
   * 2. Upload to Azure Blob Storage
   * 3. Get OCR-enriched text if available (or fall back to original)
   * 4. Chunk the document
   * 5. Generate embeddings
   * 6. Index in Azure AI Search
   * 7. Store chunks in database
   * 8. Update record with "indexed" status
   */
  async ingestDocument(options: DocumentIngestionOptions): Promise<IngestionResult> {
    const documentId = options.documentId || randomUUID();
    let blobName: string | null = null;
    let searchChunkIds: string[] = [];
    let blobUrl: string = "";
    
    // Step 0: Create or update initial record with "processing" status before any operations
    console.log(`[RAG] ${options.documentId ? 'Updating' : 'Creating'} record for: ${options.fileName}`);
    try {
      if (options.documentId) {
        // Re-indexing: get existing document to preserve blob metadata
        const existingDoc = await storage.getRagDocument(documentId);
        if (!existingDoc) {
          throw new Error(`Cannot re-index: document not found: ${documentId}`);
        }
        
        // Validate blob metadata exists
        if (!existingDoc.blobUrl || !existingDoc.blobName) {
          throw new Error("Cannot re-index: existing blob metadata not found");
        }
        
        // Store blob metadata for later use
        blobUrl = existingDoc.blobUrl;
        blobName = existingDoc.blobName;
        
        // Update status to processing while preserving blob metadata
        await storage.updateRagDocument(documentId, {
          status: "processing",
          totalChunks: 0,
          blobUrl: existingDoc.blobUrl,
          blobName: existingDoc.blobName,
        });
      } else {
        // New document: create initial record (blob will be uploaded later)
        await storage.createRagDocument({
          id: documentId,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          category: options.category || "shared",
          fileName: options.fileName,
          blobUrl: "",
          blobName: null,
          searchDocId: "",
          indexName: "intellibid-rag",
          totalChunks: 0,
          status: "processing",
          metadata: options.metadata,
        });
      }
    } catch (error) {
      console.error(`[RAG] Failed to ${options.documentId ? 'update' : 'create'} record: ${options.fileName}`, error);
      return {
        documentId,
        blobUrl: "",
        chunksIndexed: 0,
        totalTokens: 0,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    
    try {
      // Step 1: Upload to Azure Blob Storage (skip if re-indexing)
      if (options.documentId) {
        // Re-indexing: blob metadata already loaded in Step 0
        console.log(`[RAG] Re-indexing: Reusing existing blob for: ${options.fileName}`);
      } else {
        // New document: Upload to blob storage with category-based path
        const category = options.category || "shared";
        const categoryPath = `knowledge-base/${category}/${options.fileName}`;
        console.log(`[RAG] Uploading document to Blob Storage: ${categoryPath}`);
        const blobResult = await azureBlobStorageService.uploadDocument(
          categoryPath,
          options.content,
          {
            sourceType: options.sourceType,
            sourceId: options.sourceId || "",
            documentId,
            category,
          }
        );
        blobUrl = blobResult.blobUrl;
        blobName = blobResult.blobName;
        
        // CRITICAL: Persist blobUrl and blobName immediately after upload
        // This ensures cleanup can happen even if subsequent steps fail
        console.log(`[RAG] Persisting blob metadata for cleanup safety`);
        await storage.updateRagDocument(documentId, {
          blobUrl: blobResult.blobUrl,
          blobName: blobResult.blobName,
        });
      }

      // Step 2: Get effective content (OCR-enriched if available, otherwise original)
      let effectiveTextContent = options.textContent;
      let ocrEnriched = false;

      if (blobName) {
        // Extract just the filename from the full blob path for OCR lookup
        // blobName is full path like "knowledge-base/shared/doc.pdf"
        // metadata_storage_name in Azure stores only "doc.pdf"
        const fileName = blobName.split('/').pop() || blobName;
        
        const contentResult = await this.getEffectiveContent({
          blobName: fileName,
          defaultText: options.textContent,
          timeoutMs: 30000, // 30 second timeout for OCR retrieval
        });
        effectiveTextContent = contentResult.content;
        ocrEnriched = contentResult.ocrEnriched;
      }

      // Step 3: Chunk the document using effective content (may include OCR text)
      console.log(`[RAG] Chunking document: ${options.fileName} (OCR-enriched: ${ocrEnriched})`);
      const chunks = chunkDocument(
        [{ title: options.fileName, content: effectiveTextContent }],
        { sectionTitle: options.metadata?.sectionTitle, pageNumber: options.metadata?.pageNumber }
      );

      if (chunks.length === 0) {
        throw new Error("No chunks generated from document");
      }

      // Step 4: Generate embeddings for all chunks
      console.log(`[RAG] Generating embeddings for ${chunks.length} chunks`);
      const chunkTexts = chunks.map(c => c.content);
      const embeddingResult = await azureEmbeddingService.generateBatchEmbeddings(chunkTexts);

      // Step 5: Prepare documents for Azure AI Search and track chunk IDs
      searchChunkIds = chunks.map((chunk, index) => 
        `${documentId}-chunk-${chunk.metadata?.chunkIndex || index}`
      );
      
      const category = options.category || "shared";
      const searchDocuments = chunks.map((chunk, index) => ({
        id: searchChunkIds[index],
        content: chunk.content,
        embedding: embeddingResult.embeddings[index],
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        category,
        fileName: options.fileName,
        chunkIndex: chunk.metadata?.chunkIndex || index,
        metadata: {
          sectionTitle: chunk.metadata?.sectionTitle,
          pageNumber: chunk.metadata?.pageNumber,
          tags: options.metadata?.tags,
          vendor: options.metadata?.vendor,
          project: options.metadata?.project,
        },
        createdAt: new Date().toISOString(),
      }));

      // Step 6: Index in Azure AI Search
      console.log(`[RAG] Indexing ${searchDocuments.length} chunks in Azure AI Search`);
      await azureAISearchService.indexDocuments(searchDocuments);

      // Step 7: Store chunks in database with searchChunkIds
      console.log(`[RAG] Storing chunks in database`);
      const ragChunks: InsertRagChunk[] = chunks.map((chunk, index) => ({
        documentId,
        chunkIndex: chunk.metadata?.chunkIndex || index,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        searchChunkId: searchChunkIds[index],
        metadata: {
          sectionTitle: chunk.metadata?.sectionTitle,
          pageNumber: chunk.metadata?.pageNumber,
        },
      }));

      await storage.createRagChunks(ragChunks);

      // Step 8: Update record with success status
      console.log(`[RAG] Updating document record with indexed status (OCR-enriched: ${ocrEnriched})`);
      await storage.updateRagDocument(documentId, {
        searchDocId: documentId,
        totalChunks: chunks.length,
        status: "indexed",
      });

      console.log(`[RAG] Document ingestion completed: ${options.fileName}`);
      
      // Trigger indexer run in background for OCR processing (fire-and-forget)
      // This runs completely asynchronously without blocking ingestion
      void (async () => {
        try {
          await azureSearchSkillsetService.runIndexer();
          console.log("[RAG] Indexer triggered for OCR processing");
        } catch (err: any) {
          console.warn("[RAG] Indexer trigger failed (non-blocking):", err?.message);
        }
      })();
      
      return {
        documentId,
        blobUrl: blobUrl,
        chunksIndexed: chunks.length,
        totalTokens: embeddingResult.totalTokens,
        status: "success",
      };
    } catch (error) {
      console.error(`[RAG] Document ingestion failed: ${options.fileName}`, error);
      
      // CRITICAL: Clean up Azure resources if they were created
      // Blob cleanup (only for new uploads, not re-indexing)
      if (blobName && !options.documentId) {
        console.log(`[RAG] Cleaning up orphaned blob: ${blobName}`);
        try {
          await azureBlobStorageService.deleteDocument(blobName);
        } catch (cleanupError) {
          console.error(`[RAG] Failed to cleanup blob: ${blobName}`, cleanupError);
        }
      }
      
      // Search index cleanup
      if (searchChunkIds.length > 0) {
        console.log(`[RAG] Cleaning up orphaned search chunks: ${searchChunkIds.length} items`);
        try {
          await azureAISearchService.deleteDocuments(searchChunkIds);
        } catch (cleanupError) {
          console.error(`[RAG] Failed to cleanup search chunks`, cleanupError);
        }
      }
      
      // Update document status to failed (record already exists from step 0)
      try {
        await storage.updateRagDocumentStatus(documentId, "failed");
      } catch (updateError) {
        console.error("[RAG] Failed to update document status", updateError);
      }

      return {
        documentId,
        blobUrl: "",
        chunksIndexed: 0,
        totalTokens: 0,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear chunks and search index for a document (used for re-indexing)
   * Preserves the parent document record
   */
  async clearDocumentChunksAndIndex(documentId: string): Promise<void> {
    console.log(`[RAG] Clearing chunks and search index for document: ${documentId}`);
    
    // Get chunks for this document
    const chunks = await storage.getRagChunksByDocumentId(documentId);
    const chunkIds = chunks.map((c) => c.searchChunkId).filter((id): id is string => id !== null);
    
    // Delete chunks from Azure AI Search
    if (chunkIds.length > 0) {
      try {
        await azureAISearchService.deleteDocuments(chunkIds);
        console.log(`[RAG] Deleted ${chunkIds.length} chunks from search index`);
      } catch (error) {
        console.error(`[RAG] Failed to delete search documents`, error);
        // Continue with cleanup even if search deletion fails
      }
    }

    // Delete chunks from database (cascade will handle this, but parent document remains)
    await storage.deleteRagChunksByDocumentId(documentId);
    console.log(`[RAG] Deleted chunks from database`);
  }

  /**
   * Delete a document from the RAG system
   * Orchestrates cleanup across Azure Blob Storage, Azure AI Search, and database
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Get document metadata
    const doc = await storage.getRagDocument(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Delete from Azure Blob Storage using stored blobName
    if (doc.blobName) {
      try {
        await azureBlobStorageService.deleteDocument(doc.blobName);
      } catch (error) {
        console.error(`[RAG] Failed to delete blob: ${doc.blobName}`, error);
        // Continue with cleanup even if blob deletion fails
      }
    }

    // Clear chunks and search index
    await this.clearDocumentChunksAndIndex(documentId);

    // Delete from database (parent document)
    await storage.deleteRagDocument(documentId);
  }

  /**
   * Re-index a document (useful if embedding model changes)
   */
  async reindexDocument(documentId: string): Promise<IngestionResult> {
    // Get document metadata
    const doc = await storage.getRagDocument(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Download from Blob Storage
    if (!doc.blobUrl) {
      throw new Error("Document blob URL not found");
    }
    const blobName = doc.blobUrl.split("/").pop();
    if (!blobName) {
      throw new Error("Invalid blob URL");
    }

    const content = await azureBlobStorageService.downloadDocument(blobName);
    const textContent = content.toString("utf-8");

    // Re-ingest
    return this.ingestDocument({
      sourceType: doc.sourceType as any,
      sourceId: doc.sourceId || undefined,
      fileName: doc.fileName,
      content,
      textContent,
      metadata: doc.metadata as any,
    });
  }
}

// Singleton instance
export const documentIngestionService = new DocumentIngestionService();
