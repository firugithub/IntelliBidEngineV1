import { BlobServiceClient, ContainerClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from "@azure/storage-blob";
import { ConfigHelper } from "../core/configHelpers";
import * as fs from "fs/promises";
import * as path from "path";

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
  private credential: StorageSharedKeyCredential | null = null;
  private accountName: string = "";
  private azureAvailable: boolean = false;
  private localStoragePath = "/tmp/intellibid-documents";
  private lastInitializationAttempt: number = 0;
  private initializationRetryDelay: number = 60000; // Retry every 60 seconds

  async initialize(): Promise<void> {
    // Allow retry after delay (to recover from transient failures)
    const now = Date.now();
    if (this.azureAvailable) {
      return; // Already successfully initialized
    }
    
    if (this.lastInitializationAttempt > 0 && (now - this.lastInitializationAttempt) < this.initializationRetryDelay) {
      return; // Don't retry too frequently
    }

    this.lastInitializationAttempt = now;

    try {
      // Use ConfigHelper to get configuration from environment variables
      const { connectionString } = ConfigHelper.getAzureStorageConfig();

      this.client = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.client.getContainerClient(this.containerName);

      // Extract account name and key from connection string for SAS token generation
      const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
      const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
      
      if (accountNameMatch && accountKeyMatch) {
        this.accountName = accountNameMatch[1];
        this.credential = new StorageSharedKeyCredential(this.accountName, accountKeyMatch[1]);
      }

      // Create container if it doesn't exist
      await this.containerClient.createIfNotExists();
      
      this.azureAvailable = true;
      console.log("[Azure Blob Storage] ✓ Successfully initialized");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Azure Blob Storage] ⚠️ Azure Blob Storage unavailable: ${errorMessage}`
      );
      console.warn(`[Azure Blob Storage] Falling back to local file storage at ${this.localStoragePath}`);
      console.warn(`[Azure Blob Storage] Will retry Azure initialization in ${this.initializationRetryDelay / 1000} seconds`);
      this.azureAvailable = false;
      
      // Create local storage directory as fallback
      await this.ensureLocalStorageDirectory();
    }
  }

  private async ensureLocalStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.localStoragePath, { recursive: true });
    } catch (error) {
      console.error("[Azure Blob Storage] Failed to create local storage directory:", error);
    }
  }

  /**
   * Sanitize blob name to prevent path traversal attacks
   * Ensures the resolved path stays within the local storage directory
   */
  private sanitizeBlobName(blobName: string): string {
    // Remove any backslashes and normalize to forward slashes
    let sanitized = blobName.replace(/\\/g, '/');
    
    // Remove leading slashes
    sanitized = sanitized.replace(/^\/+/, '');
    
    // Remove path traversal sequences
    sanitized = sanitized.replace(/\.\./g, '');
    
    // Remove any remaining suspicious patterns
    sanitized = sanitized.replace(/\/\//g, '/');
    
    // Validate the final path stays within storage root
    const fullPath = path.join(this.localStoragePath, sanitized);
    const resolvedPath = path.resolve(fullPath);
    const storageRoot = path.resolve(this.localStoragePath);
    
    if (!resolvedPath.startsWith(storageRoot + path.sep) && resolvedPath !== storageRoot) {
      throw new Error(`Invalid blob name: path traversal detected`);
    }
    
    return sanitized;
  }

  async uploadDocument(
    fileName: string,
    content: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ blobUrl: string; blobName: string }> {
    // Try to initialize Azure if not available (handles retry throttling internally)
    if (!this.azureAvailable) {
      await this.initialize();
    }

    // Normalize path separators to forward slashes
    const normalizedFileName = fileName.replace(/\\/g, '/');
    const blobName = normalizedFileName.includes('/') ? normalizedFileName : `${Date.now()}-${normalizedFileName}`;

    // Try Azure first if available
    if (this.azureAvailable && this.containerClient) {
      try {
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

        // Upload with sanitized metadata (Azure only allows ASCII characters in metadata)
        await blockBlobClient.upload(content, content.length, {
          metadata: sanitizeMetadata(metadata),
        });

        // Generate SAS URL for download (24 hour expiry)
        const sasUrl = await this.generateSasUrl(blobName, 24);

        return {
          blobUrl: sasUrl,
          blobName,
        };
      } catch (error) {
        console.warn(`[Azure Blob Storage] Failed to upload to Azure, falling back to local storage:`, error);
        // Fall through to local storage
      }
    }

    // Fallback to local file storage
    return await this.uploadToLocalStorage(blobName, content, metadata);
  }

  private async uploadToLocalStorage(
    blobName: string,
    content: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ blobUrl: string; blobName: string }> {
    await this.ensureLocalStorageDirectory();

    // Sanitize blob name to prevent path traversal
    const sanitizedBlobName = this.sanitizeBlobName(blobName);
    const filePath = path.join(this.localStoragePath, sanitizedBlobName);
    const fileDir = path.dirname(filePath);

    // Create subdirectories if needed
    await fs.mkdir(fileDir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content);

    // Store metadata in a separate JSON file if provided
    if (metadata) {
      const metadataPath = `${filePath}.metadata.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }

    // Generate local URL that will be served by the API
    const localUrl = `/api/files/${encodeURIComponent(sanitizedBlobName)}`;

    console.log(`[Azure Blob Storage] ✓ Stored locally: ${sanitizedBlobName}`);

    return {
      blobUrl: localUrl,
      blobName: sanitizedBlobName,
    };
  }

  /**
   * Generate a SAS URL for a blob with read permissions
   * @param blobName - Name of the blob
   * @param expiryHours - Hours until the SAS token expires (default: 24)
   */
  async generateSasUrl(blobName: string, expiryHours: number = 24): Promise<string> {
    if (!this.containerClient || !this.credential) {
      await this.initialize();
    }

    if (!this.containerClient || !this.credential) {
      throw new Error("Azure Blob Storage client not initialized");
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + expiryHours);

    const sasToken = generateBlobSASQueryParameters({
      containerName: this.containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"), // Read-only
      expiresOn,
    }, this.credential).toString();

    return `${blockBlobClient.url}?${sasToken}`;
  }

  async downloadDocument(blobName: string): Promise<Buffer> {
    // Try to initialize Azure if not available (handles retry throttling internally)
    if (!this.azureAvailable) {
      await this.initialize();
    }

    // Try Azure first if available
    if (this.azureAvailable && this.containerClient) {
      try {
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
      } catch (error) {
        console.warn(`[Azure Blob Storage] Failed to download from Azure, trying local storage:`, error);
        // Fall through to local storage
      }
    }

    // Fallback to local file storage
    return await this.downloadFromLocalStorage(blobName);
  }

  private async downloadFromLocalStorage(blobName: string): Promise<Buffer> {
    // Sanitize blob name to prevent path traversal
    const sanitizedBlobName = this.sanitizeBlobName(blobName);
    const filePath = path.join(this.localStoragePath, sanitizedBlobName);
    
    try {
      const content = await fs.readFile(filePath);
      return content;
    } catch (error) {
      throw new Error(`File not found in local storage: ${blobName}`);
    }
  }

  async deleteDocument(blobName: string): Promise<void> {
    // Try to initialize Azure if not available (handles retry throttling internally)
    if (!this.azureAvailable) {
      await this.initialize();
    }

    // Try Azure first if available
    if (this.azureAvailable && this.containerClient) {
      try {
        const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.deleteIfExists();
        return;
      } catch (error) {
        console.warn(`[Azure Blob Storage] Failed to delete from Azure, trying local storage:`, error);
        // Fall through to local storage
      }
    }

    // Fallback to local file storage
    await this.deleteFromLocalStorage(blobName);
  }

  private async deleteFromLocalStorage(blobName: string): Promise<void> {
    // Sanitize blob name to prevent path traversal
    const sanitizedBlobName = this.sanitizeBlobName(blobName);
    const filePath = path.join(this.localStoragePath, sanitizedBlobName);
    const metadataPath = `${filePath}.metadata.json`;
    
    try {
      await fs.unlink(filePath);
      // Also try to delete metadata file if it exists
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Metadata file might not exist, ignore error
      }
    } catch (error) {
      // File might not exist, which is fine for a delete operation
      console.log(`[Azure Blob Storage] File not found in local storage: ${blobName}`);
    }
  }

  async listDocuments(prefix?: string): Promise<string[]> {
    // Try to initialize Azure if not available (handles retry throttling internally)
    if (!this.azureAvailable) {
      await this.initialize();
    }

    // Try Azure first if available
    if (this.azureAvailable && this.containerClient) {
      try {
        const blobNames: string[] = [];
        const options = prefix ? { prefix } : undefined;

        for await (const blob of this.containerClient.listBlobsFlat(options)) {
          blobNames.push(blob.name);
        }

        return blobNames;
      } catch (error) {
        console.warn(`[Azure Blob Storage] Failed to list from Azure, trying local storage:`, error);
        // Fall through to local storage
      }
    }

    // Fallback to local file storage
    return await this.listFromLocalStorage(prefix);
  }

  private async listFromLocalStorage(prefix?: string): Promise<string[]> {
    try {
      const files = await this.listFilesRecursive(this.localStoragePath, prefix);
      return files;
    } catch (error) {
      return []; // Return empty array if directory doesn't exist
    }
  }

  private async listFilesRecursive(dir: string, prefix?: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.localStoragePath, fullPath);

        if (entry.isDirectory()) {
          const subFiles = await this.listFilesRecursive(fullPath, prefix);
          files.push(...subFiles);
        } else if (!entry.name.endsWith('.metadata.json')) {
          // Skip metadata files
          const normalizedPath = relativePath.replace(/\\/g, '/');
          if (!prefix || normalizedPath.startsWith(prefix)) {
            files.push(normalizedPath);
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    return files;
  }

  async deleteAllDocuments(): Promise<number> {
    // Try to initialize Azure if not available (handles retry throttling internally)
    if (!this.azureAvailable) {
      await this.initialize();
    }

    let count = 0;

    // Try Azure first if available
    if (this.azureAvailable && this.containerClient) {
      try {
        for await (const blob of this.containerClient.listBlobsFlat()) {
          const blockBlobClient = this.containerClient.getBlockBlobClient(blob.name);
          await blockBlobClient.deleteIfExists();
          count++;
        }
        return count;
      } catch (error) {
        console.warn(`[Azure Blob Storage] Failed to delete from Azure, trying local storage:`, error);
        // Fall through to local storage
      }
    }

    // Fallback to local file storage
    return await this.deleteAllFromLocalStorage();
  }

  private async deleteAllFromLocalStorage(): Promise<number> {
    let count = 0;
    
    try {
      const files = await this.listFromLocalStorage();
      for (const file of files) {
        await this.deleteFromLocalStorage(file);
        count++;
      }
    } catch (error) {
      // Directory might not exist
    }

    return count;
  }

  isConfigured(): boolean {
    return this.azureAvailable || this.lastInitializationAttempt > 0;
  }

  getStorageStatus(): { backend: 'azure' | 'local'; available: boolean; lastAttempt: number } {
    return {
      backend: this.azureAvailable ? 'azure' : 'local',
      available: this.azureAvailable,
      lastAttempt: this.lastInitializationAttempt
    };
  }
}

// Singleton instance
export const azureBlobStorageService = new AzureBlobStorageService();
