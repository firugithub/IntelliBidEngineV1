import { azureBlobStorageService } from "./azureBlobStorage";
import { azureAISearchService } from "./azureAISearch";
import { azureEmbeddingService } from "./azureEmbedding";
import { chunkDocument } from "./chunkingService";
import { storage } from "../storage";
import type { InsertRagDocument, InsertRagChunk } from "@shared/schema";
import { randomUUID } from "crypto";

interface DocumentIngestionOptions {
  sourceType: "standard" | "proposal" | "requirement" | "confluence" | "sharepoint";
  sourceId?: string;
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
   * Ingest a document into the RAG system
   * 1. Create initial record with "processing" status
   * 2. Upload to Azure Blob Storage
   * 3. Chunk the document
   * 4. Generate embeddings
   * 5. Index in Azure AI Search
   * 6. Store chunks in database
   * 7. Update record with "indexed" status
   */
  async ingestDocument(options: DocumentIngestionOptions): Promise<IngestionResult> {
    const documentId = options.documentId || randomUUID();
    let blobName: string | null = null;
    let searchChunkIds: string[] = [];
    let blobUrl: string;
    
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
        // New document: Upload to blob storage
        console.log(`[RAG] Uploading document to Blob Storage: ${options.fileName}`);
        const blobResult = await azureBlobStorageService.uploadDocument(
          options.fileName,
          options.content,
          {
            sourceType: options.sourceType,
            sourceId: options.sourceId || "",
            documentId,
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

      // Step 2: Chunk the document
      console.log(`[RAG] Chunking document: ${options.fileName}`);
      const chunks = chunkDocument(
        [{ title: options.fileName, content: options.textContent }],
        { sectionTitle: options.metadata?.sectionTitle, pageNumber: options.metadata?.pageNumber }
      );

      if (chunks.length === 0) {
        throw new Error("No chunks generated from document");
      }

      // Step 3: Generate embeddings for all chunks
      console.log(`[RAG] Generating embeddings for ${chunks.length} chunks`);
      const chunkTexts = chunks.map(c => c.content);
      const embeddingResult = await azureEmbeddingService.generateBatchEmbeddings(chunkTexts);

      // Step 4: Prepare documents for Azure AI Search and track chunk IDs
      searchChunkIds = chunks.map((chunk, index) => 
        `${documentId}-chunk-${chunk.metadata?.chunkIndex || index}`
      );
      
      const searchDocuments = chunks.map((chunk, index) => ({
        id: searchChunkIds[index],
        content: chunk.content,
        embedding: embeddingResult.embeddings[index],
        sourceType: options.sourceType,
        sourceId: options.sourceId,
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

      // Step 5: Index in Azure AI Search
      console.log(`[RAG] Indexing ${searchDocuments.length} chunks in Azure AI Search`);
      await azureAISearchService.indexDocuments(searchDocuments);

      // Step 6: Store chunks in database with searchChunkIds
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

      // Step 7: Update record with success status
      console.log(`[RAG] Updating document record with indexed status`);
      await storage.updateRagDocument(documentId, {
        searchDocId: documentId,
        totalChunks: chunks.length,
        status: "indexed",
      });

      console.log(`[RAG] Document ingestion completed: ${options.fileName}`);
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
