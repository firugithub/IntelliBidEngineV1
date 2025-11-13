import { SearchIndexerClient, AzureKeyCredential } from "@azure/search-documents";
import { ConfigHelper } from "../core/configHelpers";

/**
 * Azure AI Search Skillset and Indexer Service
 * Manages OCR skillsets and indexers for automatic document processing
 */
export class AzureSearchSkillsetService {
  private indexerClient: SearchIndexerClient | null = null;
  private searchIndexClient: any = null; // For creating indexes
  private ocrSearchClient: any = null; // For querying OCR staging index
  private ocrIndexName = "intellibid-blob-ocr"; // Dedicated staging index for OCR results
  private dataSourceName = "intellibid-blob-datasource";
  private skillsetName = "intellibid-ocr-skillset";
  private indexerName = "intellibid-ocr-indexer";

  async initialize(): Promise<void> {
    const { endpoint, apiKey } = ConfigHelper.getAzureSearchConfig();
    const credential = new AzureKeyCredential(apiKey);
    this.indexerClient = new SearchIndexerClient(endpoint, credential);
    
    // Import SearchIndexClient and SearchClient
    const { SearchIndexClient, SearchClient } = await import("@azure/search-documents");
    this.searchIndexClient = new SearchIndexClient(endpoint, credential);
    this.ocrSearchClient = new SearchClient(endpoint, this.ocrIndexName, credential);

    // Setup complete pipeline: OCR index → data source → skillset → indexer
    await this.createOrUpdateOcrIndex();
    await this.createOrUpdateDataSource();
    await this.createOrUpdateSkillset();
    await this.createOrUpdateIndexer();
  }

  /**
   * Create or update dedicated OCR index for blob processing
   * This staging index receives OCR-enriched text from the skillset
   */
  private async createOrUpdateOcrIndex(): Promise<void> {
    if (!this.searchIndexClient) {
      throw new Error("Search index client not initialized");
    }

    const indexSchema = {
      name: this.ocrIndexName,
      fields: [
        {
          name: "id",
          type: "Edm.String",
          key: true,
          searchable: false,
        },
        {
          name: "content",
          type: "Edm.String",
          searchable: true,
        },
        {
          name: "merged_text",
          type: "Edm.String",
          searchable: true,
        },
        {
          name: "metadata_storage_name",
          type: "Edm.String",
          searchable: false,
          filterable: true,
        },
        {
          name: "metadata_storage_path",
          type: "Edm.String",
          key: false,
          searchable: false,
          filterable: true,
          retrievable: true, // Must be retrievable for queries to project the blob path
        },
        {
          name: "metadata_storage_last_modified",
          type: "Edm.DateTimeOffset",
          searchable: false,
          filterable: true,
          sortable: true,
        },
      ],
    };

    try {
      // Use createOrUpdateIndex to handle both creation and schema updates
      // This ensures existing indexes get the updated schema (e.g., retrievable metadata fields)
      await this.searchIndexClient.createOrUpdateIndex(indexSchema);
      console.log(`[Skillset] OCR staging index '${this.ocrIndexName}' created/updated with latest schema`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to create/update OCR index:`, error.message);
      throw error;
    }
  }

  /**
   * Create or update blob storage data source
   */
  private async createOrUpdateDataSource(): Promise<void> {
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    const { connectionString } = ConfigHelper.getAzureStorageConfig();
    const containerName = "intellibid-documents";

    try {
      await this.indexerClient.createOrUpdateDataSourceConnection({
        name: this.dataSourceName,
        type: "azureblob",
        connectionString,
        container: {
          name: containerName,
        },
      });
      console.log(`[Skillset] Data source '${this.dataSourceName}' created/updated`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to create data source:`, error.message);
      throw error;
    }
  }

  /**
   * Create or update skillset with OCR and merge skills
   */
  private async createOrUpdateSkillset(): Promise<void> {
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    const cognitiveServicesKey = ConfigHelper.getAzureCognitiveServicesKey();

    // Build skillset definition with explicit odataType property
    const skillsetDefinition: any = {
      name: this.skillsetName,
      description: "Extract text from images using OCR and merge with document content",
      skills: [
        // OCR Skill - Extract text from images
        {
          odataType: "#Microsoft.Skills.Vision.OcrSkill",
          context: "/document/normalized_images/*",
          defaultLanguageCode: "en",
          detectOrientation: true,
          inputs: [
            {
              name: "image",
              source: "/document/normalized_images/*",
            },
          ],
          outputs: [
            {
              name: "text",
              targetName: "text",
            },
          ],
        },
        // Merge Skill - Combine OCR text with document content
        {
          odataType: "#Microsoft.Skills.Text.MergeSkill",
          description: "Merge OCR text with document content",
          context: "/document",
          insertPreTag: " ",
          insertPostTag: " ",
          inputs: [
            {
              name: "text",
              source: "/document/content",
            },
            {
              name: "itemsToInsert",
              source: "/document/normalized_images/*/text",
            },
            {
              name: "offsets",
              source: "/document/normalized_images/*/contentOffset",
            },
          ],
          outputs: [
            {
              name: "mergedText",
              targetName: "merged_text",
            },
          ],
        },
      ],
      cognitiveServicesAccount: {
        odataType: "#Microsoft.Azure.Search.CognitiveServicesByKey",
        key: cognitiveServicesKey,
      },
    };

    try {
      await this.indexerClient.createOrUpdateSkillset(skillsetDefinition);
      console.log(`[Skillset] Skillset '${this.skillsetName}' created/updated`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to create skillset:`, error.message);
      throw error;
    }
  }

  /**
   * Create or update indexer with skillset
   */
  private async createOrUpdateIndexer(): Promise<void> {
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    try {
      await this.indexerClient.createOrUpdateIndexer({
        name: this.indexerName,
        description: "Indexer with OCR skillset for document processing",
        dataSourceName: this.dataSourceName,
        targetIndexName: this.ocrIndexName, // Target the dedicated OCR staging index
        skillsetName: this.skillsetName,
        parameters: {
          configuration: {
            dataToExtract: "contentAndMetadata",
            imageAction: "generateNormalizedImages", // Enable image extraction for OCR
            parsingMode: "default",
          },
        },
        fieldMappings: [
          {
            sourceFieldName: "metadata_storage_path",
            targetFieldName: "id",
          },
          {
            sourceFieldName: "content",
            targetFieldName: "content",
          },
        ],
        outputFieldMappings: [
          // Map the skillset's merged text output (OCR + document content)
          {
            sourceFieldName: "/document/merged_text",
            targetFieldName: "merged_text",
          },
        ],
      });
      console.log(`[Skillset] Indexer '${this.indexerName}' created/updated`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to create indexer:`, error.message);
      throw error;
    }
  }

  /**
   * Run the indexer manually to process documents
   */
  async runIndexer(): Promise<void> {
    if (!this.indexerClient) {
      await this.initialize();
    }

    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    try {
      await this.indexerClient.runIndexer(this.indexerName);
      console.log(`[Skillset] Indexer '${this.indexerName}' started`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to run indexer:`, error.message);
      throw error;
    }
  }

  /**
   * Get indexer status
   */
  async getIndexerStatus(): Promise<any> {
    if (!this.indexerClient) {
      await this.initialize();
    }

    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    try {
      const status = await this.indexerClient.getIndexerStatus(this.indexerName);
      return {
        name: status.name,
        status: status.status,
        lastResult: status.lastResult,
        executionHistory: status.executionHistory?.slice(0, 5), // Last 5 executions
      };
    } catch (error: any) {
      console.error(`[Skillset] Failed to get indexer status:`, error.message);
      return null;
    }
  }

  /**
   * Reset the indexer (useful for reprocessing all documents)
   */
  async resetIndexer(): Promise<void> {
    if (!this.indexerClient) {
      await this.initialize();
    }

    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    try {
      await this.indexerClient.resetIndexer(this.indexerName);
      console.log(`[Skillset] Indexer '${this.indexerName}' reset`);
    } catch (error: any) {
      console.error(`[Skillset] Failed to reset indexer:`, error.message);
      throw error;
    }
  }

  isConfigured(): boolean {
    return this.indexerClient !== null;
  }

  /**
   * Retrieve OCR-enriched document by blob name from staging index
   */
  async getOcrDocumentByBlob(blobName: string): Promise<{ mergedText?: string; content?: string; metadataPath?: string } | null> {
    if (!this.ocrSearchClient) {
      console.log("[Skillset] OCR search client not initialized, attempting to initialize...");
      try {
        await this.initialize();
      } catch (error) {
        console.warn("[Skillset] Failed to initialize OCR search client:", error);
        return null;
      }
    }

    try {
      // Search for document by blob name
      const searchResults = await this.ocrSearchClient.search("*", {
        filter: `metadata_storage_name eq '${blobName}'`,
        select: ["merged_text", "content", "metadata_storage_path"],
        top: 1,
      });

      // Get first result
      for await (const result of searchResults.results) {
        return {
          mergedText: result.document.merged_text,
          content: result.document.content,
          metadataPath: result.document.metadata_storage_path,
        };
      }

      // No results found
      return null;
    } catch (error: any) {
      console.warn(`[Skillset] Failed to query OCR index for blob '${blobName}':`, error.message);
      return null;
    }
  }

  /**
   * Wait for OCR merged text with polling and timeout
   * Returns merged text if available within timeout, or null if not found
   */
  async waitForOcrMergedText(options: {
    blobName: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<string | null> {
    const { blobName, timeoutMs = 45000, pollIntervalMs = 5000 } = options;
    const startTime = Date.now();

    console.log(`[Skillset] Waiting for OCR results for blob '${blobName}' (timeout: ${timeoutMs}ms)`);

    while (Date.now() - startTime < timeoutMs) {
      const ocrDoc = await this.getOcrDocumentByBlob(blobName);

      if (ocrDoc?.mergedText) {
        const elapsedMs = Date.now() - startTime;
        console.log(`[Skillset] OCR merged text retrieved for '${blobName}' after ${elapsedMs}ms`);
        return ocrDoc.mergedText;
      }

      // Wait before next poll
      if (Date.now() - startTime + pollIntervalMs < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } else {
        // Not enough time for another poll
        break;
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.warn(`[Skillset] OCR merged text not available for '${blobName}' after ${elapsedMs}ms (timeout)`);
    return null;
  }
}

// Singleton instance
export const azureSearchSkillsetService = new AzureSearchSkillsetService();
