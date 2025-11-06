import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { storage } from "../storage";
import type { SystemConfig } from "@shared/schema";

// Helper function to sanitize metadata values for Azure Blob Storage
// Azure metadata only allows ASCII characters
function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
  if (!metadata) return undefined;
  
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    // Replace non-ASCII characters with their ASCII equivalents or remove them
    sanitized[key] = value
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\x00-\x7F]/g, '') // Remove any remaining non-ASCII characters
      .trim();
  }
  return sanitized;
}

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

    try {
      this.client = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.client.getContainerClient(this.containerName);

      // Create container if it doesn't exist
      await this.containerClient.createIfNotExists();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize Azure Blob Storage: ${errorMessage}. ` +
        `Please verify your connection string is correct and has proper permissions. ` +
        `Configure in Admin Config page or check AZURE_STORAGE_CONNECTION_STRING environment variable.`
      );
    }
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

    // Normalize path separators to forward slashes for Azure Blob Storage
    // Use fileName directly if it's a path (contains '/' or '\'), otherwise add timestamp for uniqueness
    const normalizedFileName = fileName.replace(/\\/g, '/');
    const blobName = normalizedFileName.includes('/') ? normalizedFileName : `${Date.now()}-${normalizedFileName}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    // Upload with sanitized metadata (Azure only allows ASCII characters in metadata)
    await blockBlobClient.upload(content, content.length, {
      metadata: sanitizeMetadata(metadata),
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

  async deleteAllDocuments(): Promise<number> {
    if (!this.containerClient) {
      await this.initialize();
    }

    if (!this.containerClient) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    let count = 0;
    for await (const blob of this.containerClient.listBlobsFlat()) {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
      await blockBlobClient.deleteIfExists();
      count++;
    }

    return count;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}

// Singleton instance
export const azureBlobStorageService = new AzureBlobStorageService();
