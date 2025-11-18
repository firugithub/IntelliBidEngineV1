import { SearchClient, SearchIndexClient, AzureKeyCredential } from "@azure/search-documents";
import { ConfigHelper } from "../core/configHelpers";

interface SearchDocument {
  id: string;
  content: string;
  merged_text?: string;
  embedding?: number[];
  sourceType: string;
  sourceId?: string;
  category?: string;
  fileName: string;
  chunkIndex: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export class AzureAISearchService {
  private searchClient: SearchClient<SearchDocument> | null = null;
  private indexClient: SearchIndexClient | null = null;
  private indexName = "intellibid-rag";

  async initialize(): Promise<void> {
    // Use ConfigHelper to get configuration from environment variables
    const { endpoint, apiKey } = ConfigHelper.getAzureSearchConfig();

    const credential = new AzureKeyCredential(apiKey);
    this.searchClient = new SearchClient<SearchDocument>(endpoint, this.indexName, credential);
    this.indexClient = new SearchIndexClient(endpoint, credential);

    // Create index if it doesn't exist
    await this.createIndexIfNotExists();
  }

  private async createIndexIfNotExists(): Promise<void> {
    if (!this.indexClient) {
      throw new Error("Index client not initialized");
    }

    try {
      const existingIndex = await this.indexClient.getIndex(this.indexName);
      console.log(`Index '${this.indexName}' already exists`);
      
      // Check if category field exists
      const hasCategoryField = existingIndex.fields.some(field => field.name === 'category');
      
      if (!hasCategoryField) {
        console.log(`Index '${this.indexName}' is missing 'category' field. Updating index...`);
        
        // Update the index to include the category field
        await this.indexClient.createOrUpdateIndex({
          name: this.indexName,
          fields: [
            {
              name: "id",
              type: "Edm.String",
              key: true,
              filterable: true,
            },
            {
              name: "content",
              type: "Edm.String",
              searchable: true,
            },
            {
              name: "embedding",
              type: "Collection(Edm.Single)",
              searchable: true,
              vectorSearchDimensions: 1536,
              vectorSearchProfileName: "vector-profile",
            },
            {
              name: "sourceType",
              type: "Edm.String",
              filterable: true,
              facetable: true,
            },
            {
              name: "sourceId",
              type: "Edm.String",
              filterable: true,
            },
            {
              name: "category",
              type: "Edm.String",
              filterable: true,
              facetable: true,
            },
            {
              name: "fileName",
              type: "Edm.String",
              filterable: true,
              searchable: true,
            },
            {
              name: "chunkIndex",
              type: "Edm.Int32",
              filterable: true,
              sortable: true,
            },
            {
              name: "metadata",
              type: "Edm.ComplexType",
              fields: [
                { name: "sectionTitle", type: "Edm.String", searchable: true },
                { name: "pageNumber", type: "Edm.Int32", filterable: true },
                { name: "tags", type: "Collection(Edm.String)", filterable: true, facetable: true },
                { name: "vendor", type: "Edm.String", filterable: true, facetable: true },
                { name: "project", type: "Edm.String", filterable: true, facetable: true },
              ],
            },
            {
              name: "createdAt",
              type: "Edm.DateTimeOffset",
              filterable: true,
              sortable: true,
            },
          ],
          vectorSearch: {
            profiles: [
              {
                name: "vector-profile",
                algorithmConfigurationName: "hnsw-config",
              },
            ],
            algorithms: [
              {
                name: "hnsw-config",
                kind: "hnsw",
              },
            ],
          },
        });
        
        console.log(`Index '${this.indexName}' updated with 'category' field`);
      }
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log(`Creating index '${this.indexName}'...`);
        await this.indexClient.createIndex({
          name: this.indexName,
          fields: [
            {
              name: "id",
              type: "Edm.String",
              key: true,
              filterable: true,
            },
            {
              name: "content",
              type: "Edm.String",
              searchable: true,
            },
            {
              name: "embedding",
              type: "Collection(Edm.Single)",
              searchable: true,
              vectorSearchDimensions: 1536, // text-embedding-ada-002 dimensions
              vectorSearchProfileName: "vector-profile",
            },
            {
              name: "sourceType",
              type: "Edm.String",
              filterable: true,
              facetable: true,
            },
            {
              name: "sourceId",
              type: "Edm.String",
              filterable: true,
            },
            {
              name: "category",
              type: "Edm.String",
              filterable: true,
              facetable: true,
            },
            {
              name: "fileName",
              type: "Edm.String",
              filterable: true,
              searchable: true,
            },
            {
              name: "chunkIndex",
              type: "Edm.Int32",
              filterable: true,
              sortable: true,
            },
            {
              name: "metadata",
              type: "Edm.ComplexType",
              fields: [
                { name: "sectionTitle", type: "Edm.String", searchable: true },
                { name: "pageNumber", type: "Edm.Int32", filterable: true },
                { name: "tags", type: "Collection(Edm.String)", filterable: true, facetable: true },
                { name: "vendor", type: "Edm.String", filterable: true, facetable: true },
                { name: "project", type: "Edm.String", filterable: true, facetable: true },
              ],
            },
            {
              name: "createdAt",
              type: "Edm.DateTimeOffset",
              filterable: true,
              sortable: true,
            },
          ],
          vectorSearch: {
            profiles: [
              {
                name: "vector-profile",
                algorithmConfigurationName: "hnsw-config",
              },
            ],
            algorithms: [
              {
                name: "hnsw-config",
                kind: "hnsw",
              },
            ],
          },
        });
        console.log(`Index '${this.indexName}' created successfully`);
      } else {
        throw error;
      }
    }
  }

  async indexDocuments(documents: SearchDocument[]): Promise<void> {
    if (!this.searchClient) {
      await this.initialize();
    }

    if (!this.searchClient) {
      throw new Error("Search client not initialized");
    }

    if (documents.length === 0) {
      return;
    }

    // Azure AI Search has a batch limit of 1000 documents
    const batchSize = 1000;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.searchClient.uploadDocuments(batch);
    }
  }

  async deleteDocuments(documentIds: string[]): Promise<void> {
    if (!this.searchClient) {
      await this.initialize();
    }

    if (!this.searchClient) {
      throw new Error("Search client not initialized");
    }

    if (documentIds.length === 0) {
      return;
    }

    await this.searchClient.deleteDocuments("id", documentIds);
  }

  async hybridSearch(
    query: string,
    vectorQuery: number[],
    options?: {
      top?: number;
      filter?: string;
    }
  ): Promise<SearchDocument[]> {
    if (!this.searchClient) {
      await this.initialize();
    }

    if (!this.searchClient) {
      throw new Error("Search client not initialized");
    }

    const searchResults = await this.searchClient.search(query, {
      top: options?.top || 10,
      filter: options?.filter,
      select: ["id", "content", "merged_text", "sourceType", "sourceId", "category", "fileName", "chunkIndex", "metadata", "createdAt"],
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector: vectorQuery,
            fields: ["embedding"],
            kNearestNeighborsCount: options?.top || 10,
          },
        ],
      },
    });

    const results: SearchDocument[] = [];
    for await (const result of searchResults.results) {
      results.push(result.document);
    }

    return results;
  }

  async getIndexStats(): Promise<{ documentCount: number; storageSize: number }> {
    if (!this.indexClient) {
      await this.initialize();
    }

    if (!this.indexClient) {
      throw new Error("Index client not initialized");
    }

    const stats = await this.indexClient.getIndexStatistics(this.indexName);
    return {
      documentCount: stats.documentCount,
      storageSize: stats.storageSize,
    };
  }

  async deleteAllDocuments(): Promise<number> {
    if (!this.searchClient) {
      await this.initialize();
    }

    if (!this.searchClient) {
      throw new Error("Search client not initialized");
    }

    // Get all document IDs first
    const searchResults = await this.searchClient.search("*", {
      select: ["id"],
      top: 10000, // Max limit
    });

    const documentIds: string[] = [];
    for await (const result of searchResults.results) {
      if (result.document.id) {
        documentIds.push(result.document.id);
      }
    }

    if (documentIds.length > 0) {
      await this.deleteDocuments(documentIds);
    }

    return documentIds.length;
  }

  isConfigured(): boolean {
    return this.searchClient !== null;
  }
}

// Singleton instance
export const azureAISearchService = new AzureAISearchService();
