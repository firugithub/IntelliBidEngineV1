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
    console.log("=".repeat(80));
    console.log("[Skillset] Starting OCR skillset initialization...");
    console.log("=".repeat(80));
    
    try {
      // Step 1: Validate configuration
      console.log("[Skillset] Step 1/6: Validating Azure configuration...");
      const { endpoint, apiKey } = ConfigHelper.getAzureSearchConfig();
      console.log(`[Skillset] ✓ AI Search endpoint configured: ${endpoint}`);
      console.log(`[Skillset] ✓ AI Search key configured: ${apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING'}`);
      
      if (!endpoint || !apiKey) {
        throw new Error("Azure AI Search endpoint or key is missing. Check AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_KEY environment variables.");
      }

      // Step 2: Validate Blob Storage configuration
      console.log("[Skillset] Step 2/6: Validating Azure Blob Storage configuration...");
      const { connectionString } = ConfigHelper.getAzureStorageConfig();
      console.log(`[Skillset] ✓ Storage connection string configured: ${connectionString ? 'Yes' : 'MISSING'}`);
      
      if (!connectionString) {
        throw new Error("Azure Storage connection string is missing. Check AZURE_STORAGE_CONNECTION_STRING environment variable.");
      }

      // Step 3: Validate Cognitive Services key
      console.log("[Skillset] Step 3/6: Validating Azure Cognitive Services key...");
      const cognitiveKey = ConfigHelper.getAzureCognitiveServicesKey();
      console.log(`[Skillset] ✓ Cognitive Services key configured: ${cognitiveKey ? `${cognitiveKey.substring(0, 8)}...` : 'MISSING'}`);
      
      if (!cognitiveKey) {
        throw new Error("Azure Cognitive Services key is missing. Set AZURE_COGNITIVE_SERVICES_KEY or AZURE_OPENAI_KEY.");
      }

      // Step 4: Initialize Azure clients
      console.log("[Skillset] Step 4/6: Initializing Azure AI Search clients...");
      const startTime = Date.now();
      const credential = new AzureKeyCredential(apiKey);
      
      console.log("[Skillset]   - Creating SearchIndexerClient...");
      this.indexerClient = new SearchIndexerClient(endpoint, credential);
      
      console.log("[Skillset]   - Importing search modules...");
      const { SearchIndexClient, SearchClient } = await import("@azure/search-documents");
      
      console.log("[Skillset]   - Creating SearchIndexClient...");
      this.searchIndexClient = new SearchIndexClient(endpoint, credential);
      
      console.log("[Skillset]   - Creating SearchClient for OCR index...");
      this.ocrSearchClient = new SearchClient(endpoint, this.ocrIndexName, credential);
      
      const clientInitTime = Date.now() - startTime;
      console.log(`[Skillset] ✓ Clients initialized successfully (${clientInitTime}ms)`);

      // Step 5: Setup OCR pipeline components
      console.log("[Skillset] Step 5/6: Setting up OCR processing pipeline...");
      console.log("[Skillset]   Pipeline: OCR Index → Data Source → Skillset → Indexer");
      
      console.log("[Skillset]   - Creating/updating OCR index...");
      await this.createOrUpdateOcrIndex();
      
      console.log("[Skillset]   - Creating/updating blob data source...");
      await this.createOrUpdateDataSource();
      
      console.log("[Skillset]   - Creating/updating OCR skillset...");
      await this.createOrUpdateSkillset();
      
      console.log("[Skillset]   - Creating/updating indexer...");
      await this.createOrUpdateIndexer();

      // Step 6: Success
      const totalTime = Date.now() - startTime;
      console.log("=".repeat(80));
      console.log(`[Skillset] ✅ OCR skillset initialization completed successfully! (${totalTime}ms)`);
      console.log(`[Skillset] Components created:`);
      console.log(`[Skillset]   - Index: ${this.ocrIndexName}`);
      console.log(`[Skillset]   - Data Source: ${this.dataSourceName}`);
      console.log(`[Skillset]   - Skillset: ${this.skillsetName}`);
      console.log(`[Skillset]   - Indexer: ${this.indexerName}`);
      console.log("=".repeat(80));
      
    } catch (error: any) {
      console.error("=".repeat(80));
      console.error("[Skillset] ❌ Initialization FAILED");
      console.error("=".repeat(80));
      this.logDetailedError(error);
      console.error("=".repeat(80));
      throw error;
    }
  }

  /**
   * Log detailed error information with Azure-specific error codes
   */
  private logDetailedError(error: any): void {
    console.error("[Skillset] Error Type:", error.name || "Unknown");
    console.error("[Skillset] Error Message:", error.message || "No message");
    
    // Azure SDK specific error details
    if (error.code) {
      console.error("[Skillset] Azure Error Code:", error.code);
    }
    
    if (error.statusCode) {
      console.error("[Skillset] HTTP Status Code:", error.statusCode);
      
      // Provide user-friendly explanations for common errors
      switch (error.statusCode) {
        case 401:
          console.error("[Skillset] → This is an authentication error. Your Azure AI Search key may be incorrect or expired.");
          console.error("[Skillset] → Check: AZURE_SEARCH_KEY environment variable");
          break;
        case 403:
          console.error("[Skillset] → This is an authorization error. Your key may not have sufficient permissions.");
          console.error("[Skillset] → Required: Admin key (not query key) with permission to create indexes/skillsets");
          break;
        case 404:
          console.error("[Skillset] → Resource not found. The Azure AI Search service may not exist at the specified endpoint.");
          console.error("[Skillset] → Check: AZURE_SEARCH_ENDPOINT environment variable");
          break;
        case 504:
          console.error("[Skillset] → Gateway timeout. The request took too long to complete.");
          console.error("[Skillset] → Possible causes:");
          console.error("[Skillset]    1. Network connectivity issues (firewall, VNet)");
          console.error("[Skillset]    2. Azure AI Search service is using private endpoints");
          console.error("[Skillset]    3. Your App Service cannot reach the AI Search service");
          console.error("[Skillset] → Solutions:");
          console.error("[Skillset]    1. Enable VNet Integration on your App Service");
          console.error("[Skillset]    2. Add App Service IPs to AI Search firewall");
          console.error("[Skillset]    3. Change AI Search networking to 'All networks' (for testing)");
          break;
        default:
          console.error(`[Skillset] → HTTP ${error.statusCode} error occurred`);
      }
    }
    
    // Network/connectivity errors
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error("[Skillset] → This is a network connectivity error.");
      console.error("[Skillset] → Your application cannot reach the Azure AI Search endpoint.");
      console.error("[Skillset] → Possible causes:");
      console.error("[Skillset]    1. Incorrect endpoint URL");
      console.error("[Skillset]    2. Firewall blocking access");
      console.error("[Skillset]    3. Private endpoint without VNet integration");
    }
    
    // Additional error details
    if (error.details) {
      console.error("[Skillset] Additional Details:", JSON.stringify(error.details, null, 2));
    }
    
    // Stack trace (helpful for debugging)
    if (error.stack) {
      console.error("[Skillset] Stack Trace:");
      console.error(error.stack);
    }
  }

  /**
   * Create or update dedicated OCR index for blob processing
   * This staging index receives OCR-enriched text from the skillset
   */
  private async createOrUpdateOcrIndex(): Promise<void> {
    const startTime = Date.now();
    
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
      console.log(`[Skillset]     → Attempting to create/update index '${this.ocrIndexName}'...`);
      // Use createOrUpdateIndex to handle both creation and schema updates
      // This ensures existing indexes get the updated schema (e.g., retrievable metadata fields)
      await this.searchIndexClient.createOrUpdateIndex(indexSchema);
      const elapsed = Date.now() - startTime;
      console.log(`[Skillset]     ✓ Index '${this.ocrIndexName}' created/updated successfully (${elapsed}ms)`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Skillset]     ✗ Failed to create/update OCR index after ${elapsed}ms`);
      console.error(`[Skillset]     Error:`, error.message);
      if (error.statusCode) {
        console.error(`[Skillset]     HTTP Status: ${error.statusCode}`);
      }
      throw error;
    }
  }

  /**
   * Create or update blob storage data source
   */
  private async createOrUpdateDataSource(): Promise<void> {
    const startTime = Date.now();
    
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    const { connectionString } = ConfigHelper.getAzureStorageConfig();
    const containerName = "intellibid-documents";

    try {
      console.log(`[Skillset]     → Attempting to create/update data source '${this.dataSourceName}'...`);
      console.log(`[Skillset]       Container: ${containerName}`);
      await this.indexerClient.createOrUpdateDataSourceConnection({
        name: this.dataSourceName,
        type: "azureblob",
        connectionString,
        container: {
          name: containerName,
        },
      });
      const elapsed = Date.now() - startTime;
      console.log(`[Skillset]     ✓ Data source '${this.dataSourceName}' created/updated successfully (${elapsed}ms)`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Skillset]     ✗ Failed to create/update data source after ${elapsed}ms`);
      console.error(`[Skillset]     Error:`, error.message);
      if (error.statusCode) {
        console.error(`[Skillset]     HTTP Status: ${error.statusCode}`);
      }
      throw error;
    }
  }

  /**
   * Create or update skillset with OCR and merge skills
   */
  private async createOrUpdateSkillset(): Promise<void> {
    const startTime = Date.now();
    
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    const cognitiveServicesKey = ConfigHelper.getAzureCognitiveServicesKey();

    // Build skillset definition with correct lowercase odatatype property
    const skillsetDefinition: any = {
      name: this.skillsetName,
      description: "Extract text from images using OCR and merge with document content",
      skills: [
        // OCR Skill - Extract text from images
        {
          odatatype: "#Microsoft.Skills.Vision.OcrSkill",
          context: "/document/normalized_images/*",
          defaultLanguageCode: "en",
          shouldDetectOrientation: true,
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
          odatatype: "#Microsoft.Skills.Text.MergeSkill",
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
        odatatype: "#Microsoft.Azure.Search.CognitiveServicesByKey",
        key: cognitiveServicesKey,
      },
    };

    try {
      console.log(`[Skillset]     → Attempting to create/update skillset '${this.skillsetName}'...`);
      console.log(`[Skillset]       Skills: OCR + Text Merge`);
      await this.indexerClient.createOrUpdateSkillset(skillsetDefinition);
      const elapsed = Date.now() - startTime;
      console.log(`[Skillset]     ✓ Skillset '${this.skillsetName}' created/updated successfully (${elapsed}ms)`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Skillset]     ✗ Failed to create/update skillset after ${elapsed}ms`);
      console.error(`[Skillset]     Error:`, error.message);
      if (error.statusCode) {
        console.error(`[Skillset]     HTTP Status: ${error.statusCode}`);
      }
      throw error;
    }
  }

  /**
   * Create or update indexer with skillset
   */
  private async createOrUpdateIndexer(): Promise<void> {
    const startTime = Date.now();
    
    if (!this.indexerClient) {
      throw new Error("Indexer client not initialized");
    }

    try {
      console.log(`[Skillset]     → Attempting to create/update indexer '${this.indexerName}'...`);
      console.log(`[Skillset]       Data source: ${this.dataSourceName}`);
      console.log(`[Skillset]       Target index: ${this.ocrIndexName}`);
      console.log(`[Skillset]       Skillset: ${this.skillsetName}`);
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
            mappingFunction: {
              name: "base64Encode",
            },
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
      const elapsed = Date.now() - startTime;
      console.log(`[Skillset]     ✓ Indexer '${this.indexerName}' created/updated successfully (${elapsed}ms)`);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[Skillset]     ✗ Failed to create/update indexer after ${elapsed}ms`);
      console.error(`[Skillset]     Error:`, error.message);
      if (error.statusCode) {
        console.error(`[Skillset]     HTTP Status: ${error.statusCode}`);
      }
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
