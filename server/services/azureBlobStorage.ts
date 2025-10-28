import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { storage } from "../storage";
import type { SystemConfig } from "@shared/schema";

export class AzureBlobStorageService {
  private client: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private containerName = "intellibid-documents";

  async initialize(): Promise<void> {
    const configs = await storage.getAllSystemConfig();
    const connectionString = 
      configs.find((c: SystemConfig) => c.key === "AZURE_STORAGE_CONNECTION_STRING")?.value ||
      process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error("Azure Storage connection string not configured. Please configure in Admin Config page or set AZURE_STORAGE_CONNECTION_STRING environment variable.");
    }

    this.client = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.client.getContainerClient(this.containerName);

    // Create container if it doesn't exist
    await this.containerClient.createIfNotExists();
  }

  async uploadDocument(
    fileName: string,
    content: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ blobUrl: string; blobName: string }> {
    if (!this.containerClient) {
      await this.initialize();
    }

    if (!this.containerClient) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    // Generate unique blob name
    const timestamp = Date.now();
    const blobName = `${timestamp}-${fileName}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    // Upload with metadata
    await blockBlobClient.upload(content, content.length, {
      metadata,
    });

    return {
      blobUrl: blockBlobClient.url,
      blobName,
    };
  }

  async downloadDocument(blobName: string): Promise<Buffer> {
    if (!this.containerClient) {
      await this.initialize();
    }

    if (!this.containerClient) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error("Failed to download blob");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async deleteDocument(blobName: string): Promise<void> {
    if (!this.containerClient) {
      await this.initialize();
    }

    if (!this.containerClient) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  }

  async listDocuments(prefix?: string): Promise<string[]> {
    if (!this.containerClient) {
      await this.initialize();
    }

    if (!this.containerClient) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    const blobNames: string[] = [];
    const options = prefix ? { prefix } : undefined;

    for await (const blob of this.containerClient.listBlobsFlat(options)) {
      blobNames.push(blob.name);
    }

    return blobNames;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}

// Singleton instance
export const azureBlobStorageService = new AzureBlobStorageService();
