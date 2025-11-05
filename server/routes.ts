import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseDocument } from "./services/documentParser";
import { analyzeRequirements, analyzeProposal, evaluateProposal } from "./services/aiAnalysis";
import { seedSampleData, seedPortfolios, seedAllMockData, wipeAllData, wipeAzureOnly, seedRftTemplates } from "./services/sampleData";
import { generateRftFromBusinessCase, regenerateRftSection } from "./services/smartRftService";
import { generateRft, generateRftPack, generateVendorResponses, generateEvaluation } from "./services/rftMockDataGenerator";
import { azureEmbeddingService } from "./services/azureEmbedding";
import { azureAISearchService } from "./services/azureAISearch";
import { azureBlobStorageService } from "./services/azureBlobStorage";
import { lookup as dnsLookup } from "dns";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import archiver from "archiver";

const lookupAsync = promisify(dnsLookup);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper function to validate if an IP address is public (not private, loopback, or link-local)
function isPublicIP(ip: string): boolean {
  // Check for IPv4
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map(Number);
    
    // Validate each octet is 0-255
    if (parts.some(p => p > 255)) {
      return false;
    }
    
    // Block loopback (127.0.0.0/8)
    if (parts[0] === 127) return false;
    
    // Block private ranges
    if (parts[0] === 10) return false; // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return false; // 192.168.0.0/16
    
    // Block link-local (169.254.0.0/16)
    if (parts[0] === 169 && parts[1] === 254) return false;
    
    // Block 0.0.0.0/8
    if (parts[0] === 0) return false;
    
    // Block broadcast (255.255.255.255)
    if (parts.every(p => p === 255)) return false;
    
    return true;
  }
  
  // Check for IPv6
  const ipLower = ip.toLowerCase().trim();
  
  // Normalize IPv6 address by removing brackets
  const normalizedIP = ipLower.replace(/^\[|\]$/g, '');
  
  // Block loopback addresses (::1 and variations like 0:0:0:0:0:0:0:1)
  if (normalizedIP === '::1' || normalizedIP === '0:0:0:0:0:0:0:1' || 
      normalizedIP.match(/^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:1$/)) {
    return false;
  }
  
  // Block IPv4-mapped IPv6 addresses pointing to private ranges
  if (normalizedIP.startsWith('::ffff:127.') || normalizedIP.startsWith('::ffff:10.') || 
      normalizedIP.startsWith('::ffff:172.') || normalizedIP.startsWith('::ffff:192.168.') ||
      normalizedIP.startsWith('0:0:0:0:0:ffff:7f') || // ::ffff:127.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:a') || // ::ffff:10.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:ac1') || // ::ffff:172.16-31.x in hex
      normalizedIP.startsWith('0:0:0:0:0:ffff:c0a8')) { // ::ffff:192.168.x in hex
    return false;
  }
  
  // Block link-local (fe80::/10)
  if (normalizedIP.startsWith('fe8') || normalizedIP.startsWith('fe9') || 
      normalizedIP.startsWith('fea') || normalizedIP.startsWith('feb')) {
    return false;
  }
  
  // Block unique local addresses (fc00::/7)
  if (normalizedIP.startsWith('fc') || normalizedIP.startsWith('fd')) {
    return false;
  }
  
  // Block localhost variations
  if (normalizedIP === '::' || normalizedIP === '0:0:0:0:0:0:0:0') {
    return false;
  }
  
  return true;
}

// Helper function to validate URL and resolve DNS to check for private IPs
async function validateUrlSecurity(url: string): Promise<{ valid: boolean; error?: string }> {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  
  // Check direct hostname blocks
  const blockedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254',
    '[::1]',
    '::1',
  ];
  
  if (blockedHosts.includes(hostname)) {
    return { valid: false, error: "Access to local or internal URLs is not allowed" };
  }

  // If hostname is already an IP, validate it
  if (hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/) || hostname.includes(':')) {
    if (!isPublicIP(hostname)) {
      return { valid: false, error: "Access to private IP addresses is not allowed" };
    }
  } else {
    // Resolve DNS to check the actual IP addresses (both IPv4 and IPv6)
    try {
      // Use dns.lookup to get all addresses (IPv4 and IPv6)
      const result = await lookupAsync(hostname, { all: true }) as { address: string; family: number }[];
      const addresses = result.map(r => r.address);
      
      // Validate all resolved addresses
      for (const address of addresses) {
        if (!isPublicIP(address)) {
          return { valid: false, error: `Domain resolves to a private IP address: ${address}` };
        }
      }
    } catch (error) {
      // DNS resolution failed - could be temporary or invalid domain
      return { valid: false, error: "Failed to resolve domain name" };
    }
  }

  return { valid: true };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed portfolios endpoint
  app.post("/api/seed-portfolios", async (req, res) => {
    try {
      const portfolios = await seedPortfolios();
      res.json({ portfolios, message: "Portfolios seeded successfully" });
    } catch (error) {
      console.error("Error seeding portfolios:", error);
      res.status(500).json({ error: "Failed to seed portfolios" });
    }
  });

  // Seed sample data endpoint
  app.post("/api/seed-sample", async (req, res) => {
    try {
      const projectId = await seedSampleData();
      res.json({ projectId, message: "Sample data seeded successfully" });
    } catch (error) {
      console.error("Error seeding sample data:", error);
      res.status(500).json({ error: "Failed to seed sample data" });
    }
  });

  // Generate all mock data endpoint
  app.post("/api/generate-mock-data", async (req, res) => {
    try {
      const result = await seedAllMockData();
      res.json(result);
    } catch (error) {
      console.error("Error generating mock data:", error);
      res.status(500).json({ error: "Failed to generate mock data" });
    }
  });

  // Wipe all data endpoint
  app.post("/api/wipe-data", async (req, res) => {
    try {
      const result = await wipeAllData();
      res.json(result);
    } catch (error) {
      console.error("Error wiping data:", error);
      res.status(500).json({ error: "Failed to wipe data" });
    }
  });

  app.post("/api/wipe-azure", async (req, res) => {
    try {
      const result = await wipeAzureOnly();
      res.json(result);
    } catch (error) {
      console.error("Error wiping Azure resources:", error);
      res.status(500).json({ error: "Failed to wipe Azure resources" });
    }
  });

  // Generate RFT from topic
  app.post("/api/mock-data/generate-rft", async (req, res) => {
    try {
      const { topicId } = req.body;
      if (!topicId) {
        return res.status(400).json({ error: "Topic ID is required" });
      }
      const result = await generateRft(topicId);
      res.json(result);
    } catch (error) {
      console.error("Error generating RFT:", error);
      res.status(500).json({ error: "Failed to generate RFT" });
    }
  });

  // Generate RFT Pack
  app.post("/api/mock-data/generate-pack", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateRftPack(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating RFT pack:", error);
      res.status(500).json({ error: "Failed to generate RFT pack" });
    }
  });

  // Generate Vendor Responses
  app.post("/api/mock-data/generate-responses", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateVendorResponses(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating vendor responses:", error);
      res.status(500).json({ error: "Failed to generate vendor responses" });
    }
  });

  // Generate Evaluation
  app.post("/api/mock-data/generate-evaluation", async (req, res) => {
    try {
      const { rftId } = req.body;
      if (!rftId) {
        return res.status(400).json({ error: "RFT ID is required" });
      }
      const result = await generateEvaluation(rftId);
      res.json(result);
    } catch (error) {
      console.error("Error generating evaluation:", error);
      res.status(500).json({ error: "Failed to generate evaluation" });
    }
  });

  // Download all mock data files as ZIP
  app.get("/api/mock-data/download-all/:rftId", async (req, res) => {
    try {
      const { rftId } = req.params;
      
      // Get RFT and project info
      const rft = await storage.getGeneratedRft(rftId);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }
      
      // Note: Project might not exist for RFTs created through Smart RFT Builder
      // We'll use the projectId from the RFT regardless
      const projectId = rft.projectId;

      // Create ZIP archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      const zipFilename = `MockData_${rft.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

      // Pipe archive to response
      archive.pipe(res);

      // Define folders to download
      // IMPORTANT: Use underscores to match Azure Blob Storage paths
      const folders = [
        { prefix: `project-${projectId}/RFT_Generated`, name: 'RFT Generated' },
        { prefix: `project-${projectId}/RFT_Responses`, name: 'RFT Responses' },
        { prefix: `project-${projectId}/RFT Evaluation`, name: 'RFT Evaluation' }
      ];

      // Add files from each folder
      for (const folder of folders) {
        try {
          const blobNames = await azureBlobStorageService.listDocuments(folder.prefix);
          
          for (const blobName of blobNames) {
            try {
              const buffer = await azureBlobStorageService.downloadDocument(blobName);
              
              // Extract the path relative to the folder prefix to preserve vendor folder structure
              // For example: "project-123/RFT_Responses/VendorA/file.xlsx" -> "VendorA/file.xlsx"
              const relativePath = blobName.replace(folder.prefix + '/', '');
              
              // Organize files in ZIP preserving the full folder structure
              archive.append(buffer, { name: `${folder.name}/${relativePath}` });
            } catch (err) {
              console.error(`Error adding file ${blobName}:`, err);
            }
          }
        } catch (err) {
          console.error(`Error listing folder ${folder.prefix}:`, err);
        }
      }

      // Finalize archive
      await archive.finalize();
      
    } catch (error) {
      console.error("Error downloading mock data:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download mock data" });
      }
    }
  });

  // Get all portfolios
  app.get("/api/portfolios", async (req, res) => {
    try {
      const portfolios = await storage.getAllPortfolios();
      res.json(portfolios);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  // Get portfolio by ID
  app.get("/api/portfolios/:id", async (req, res) => {
    try {
      const portfolio = await storage.getPortfolio(req.params.id);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  // Get projects by portfolio
  app.get("/api/portfolios/:id/projects", async (req, res) => {
    try {
      const projects = await storage.getProjectsByPortfolio(req.params.id);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching portfolio projects:", error);
      res.status(500).json({ error: "Failed to fetch portfolio projects" });
    }
  });

  // Get RFTs by portfolio
  app.get("/api/portfolios/:id/rfts", async (req, res) => {
    try {
      const rfts = await storage.getGeneratedRftsByPortfolio(req.params.id);
      res.json(rfts);
    } catch (error) {
      console.error("Error fetching portfolio RFTs:", error);
      res.status(500).json({ error: "Failed to fetch portfolio RFTs" });
    }
  });

  // Get portfolio RFT statistics
  app.get("/api/portfolios/:id/rft-stats", async (req, res) => {
    try {
      const stats = await storage.getPortfolioRftStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching portfolio RFT stats:", error);
      res.status(500).json({ error: "Failed to fetch portfolio RFT stats" });
    }
  });

  // Standards routes
  app.get("/api/standards", async (req, res) => {
    try {
      const standards = await storage.getAllStandards();
      res.json(standards);
    } catch (error) {
      console.error("Error fetching standards:", error);
      res.status(500).json({ error: "Failed to fetch standards" });
    }
  });

  app.get("/api/standards/active", async (req, res) => {
    try {
      const standards = await storage.getActiveStandards();
      res.json(standards);
    } catch (error) {
      console.error("Error fetching active standards:", error);
      res.status(500).json({ error: "Failed to fetch active standards" });
    }
  });

  app.get("/api/standards/:id", async (req, res) => {
    try {
      const standard = await storage.getStandard(req.params.id);
      if (!standard) {
        return res.status(404).json({ error: "Standard not found" });
      }
      res.json(standard);
    } catch (error) {
      console.error("Error fetching standard:", error);
      res.status(500).json({ error: "Failed to fetch standard" });
    }
  });

  app.post("/api/standards", async (req, res) => {
    try {
      const { name, description, category, sections } = req.body;
      const standard = await storage.createStandard({
        name,
        description,
        category: category || "general",
        sections,
        isActive: "true",
      });
      res.json(standard);
    } catch (error) {
      console.error("Error creating standard:", error);
      res.status(500).json({ error: "Failed to create standard" });
    }
  });

  app.post("/api/standards/upload", upload.single("file"), async (req, res) => {
    try {
      const { name, description, category, tags, url } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Standard name is required" });
      }

      // Check if either file or URL is provided
      if (!req.file && !url) {
        return res.status(400).json({ error: "Either file upload or URL is required" });
      }

      let parsedDocument;
      let fileName;

      if (url) {
        // Fetch and parse document from URL
        try {
          // Validate URL to prevent SSRF attacks (includes DNS resolution)
          const validation = await validateUrlSecurity(url);
          if (!validation.valid) {
            return res.status(400).json({ error: validation.error || "URL validation failed" });
          }

          const parsedUrl = new URL(url);

          // Fetch with timeout, size limit, and no redirects
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          try {
            const response = await fetch(url, {
              signal: controller.signal,
              redirect: 'manual', // Disable automatic redirects to prevent redirect-based SSRF
              headers: {
                'User-Agent': 'IntelliBid-Document-Fetcher/1.0',
              },
            });

            // Check if response is a redirect
            if (response.status >= 300 && response.status < 400) {
              return res.status(400).json({ 
                error: "Redirects are not allowed. Please provide a direct URL to the document." 
              });
            }

            clearTimeout(timeout);

            if (!response.ok) {
              throw new Error(`Failed to fetch document: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            
            // Validate content type
            const allowedTypes = [
              'application/pdf',
              'text/plain',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ];
            
            const isAllowedType = allowedTypes.some(type => contentType.includes(type)) || 
                                  contentType.includes('text/');

            if (!isAllowedType && contentType) {
              return res.status(400).json({ 
                error: `Unsupported content type: ${contentType}. Please provide a PDF, text, or document file.` 
              });
            }

            // Limit file size to 10MB
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
              return res.status(400).json({ error: "Document size exceeds 10MB limit" });
            }

            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
              return res.status(400).json({ error: "Document size exceeds 10MB limit" });
            }

            const buffer = Buffer.from(arrayBuffer);
            
            // Extract filename from URL
            const urlPath = parsedUrl.pathname;
            fileName = urlPath.split('/').pop() || 'document';

            // Determine file type from URL or content-type
            let fileType = '';
            if (fileName.endsWith('.pdf') || contentType.includes('pdf')) {
              fileType = 'pdf';
            } else if (fileName.endsWith('.txt') || contentType.includes('text')) {
              fileType = 'txt';
            } else {
              // Default to txt for unknown types
              fileType = 'txt';
            }

            // Create a mock file object for parsing
            const mockFile = {
              buffer,
              originalname: fileName,
              mimetype: contentType || (fileType === 'pdf' ? 'application/pdf' : 'text/plain'),
            };

            parsedDocument = await parseDocument(buffer, fileName);
          } finally {
            clearTimeout(timeout);
          }
        } catch (error) {
          console.error("Error fetching document from URL:", error);
          if (error instanceof Error && error.name === 'AbortError') {
            return res.status(400).json({ error: "Request timeout: document fetch took too long" });
          }
          return res.status(400).json({ error: "Failed to fetch document from URL. Please ensure the URL is accessible and points to a valid document." });
        }
      } else if (req.file) {
        // Parse the uploaded file
        fileName = req.file.originalname;
        parsedDocument = await parseDocument(req.file.buffer, fileName);
      }

      // Safety check (should never happen due to earlier validation)
      if (!parsedDocument) {
        return res.status(400).json({ error: "Failed to parse document" });
      }
      
      // Use AI to extract compliance sections from the document
      const { extractComplianceSections } = await import("./services/aiAnalysis");
      const sections = await extractComplianceSections(parsedDocument.text, name);

      // Parse tags from JSON string
      const parsedTags = tags ? JSON.parse(tags) : [];

      // Create the standard with extracted sections
      const standard = await storage.createStandard({
        name,
        description: description || null,
        category: category || "general",
        sections: sections,
        tags: parsedTags.length > 0 ? parsedTags : null,
        fileName: fileName,
        documentContent: parsedDocument.text,
        isActive: "true",
      });

      // PHASE 3: Ingest document into RAG system (Azure Blob + AI Search)
      try {
        const { documentIngestionService } = await import("./services/documentIngestion");
        
        // Prepare document buffer
        let documentBuffer: Buffer;
        if (url) {
          // Re-fetch the document for RAG ingestion (already validated earlier)
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          documentBuffer = Buffer.from(arrayBuffer);
        } else if (req.file) {
          documentBuffer = req.file.buffer;
        } else {
          throw new Error("No document source available for RAG ingestion");
        }

        // Ingest into RAG system
        const ragResult = await documentIngestionService.ingestDocument({
          sourceType: "standard",
          sourceId: standard.id,
          fileName: fileName || "document.txt",
          content: documentBuffer,
          textContent: parsedDocument.text,
          metadata: {
            tags: parsedTags,
            sectionTitle: name,
          },
        });

        // Update standard with RAG document ID
        if (ragResult.status === "success") {
          await storage.updateStandard(standard.id, {
            ragDocumentId: ragResult.documentId,
          });
          console.log(`[RAG] Standard "${name}" linked to RAG document: ${ragResult.documentId}`);
        } else {
          console.warn(`[RAG] Failed to ingest standard "${name}" into RAG system:`, ragResult.error);
        }
      } catch (ragError) {
        // Log RAG ingestion failure but don't fail the standard creation
        console.error(`[RAG] RAG ingestion failed for standard "${name}":`, ragError);
      }

      // Return the standard (RAG ingestion happens in background)
      const updatedStandard = await storage.getStandard(standard.id);
      res.json(updatedStandard || standard);
    } catch (error) {
      console.error("Error creating standard from upload:", error);
      res.status(500).json({ error: "Failed to create standard from upload" });
    }
  });

  app.patch("/api/standards/:id", async (req, res) => {
    try {
      const { name, description, category, sections } = req.body;
      await storage.updateStandard(req.params.id, {
        name,
        description,
        category,
        sections,
      });
      const updated = await storage.getStandard(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error updating standard:", error);
      res.status(500).json({ error: "Failed to update standard" });
    }
  });

  app.delete("/api/standards/:id", async (req, res) => {
    try {
      await storage.deactivateStandard(req.params.id);
      res.json({ message: "Standard deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating standard:", error);
      res.status(500).json({ error: "Failed to deactivate standard" });
    }
  });

  // MCP Connectors
  app.get("/api/mcp-connectors", async (req, res) => {
    try {
      const connectors = await storage.getAllMcpConnectors();
      // Redact API keys for security
      const redactedConnectors = connectors.map(c => ({
        ...c,
        apiKey: c.apiKey ? "••••••••" : null,
      }));
      res.json(redactedConnectors);
    } catch (error) {
      console.error("Error fetching MCP connectors:", error);
      res.status(500).json({ error: "Failed to fetch MCP connectors" });
    }
  });

  app.get("/api/mcp-connectors/active", async (req, res) => {
    try {
      const connectors = await storage.getActiveMcpConnectors();
      // Redact API keys for security
      const redactedConnectors = connectors.map(c => ({
        ...c,
        apiKey: c.apiKey ? "••••••••" : null,
      }));
      res.json(redactedConnectors);
    } catch (error) {
      console.error("Error fetching active MCP connectors:", error);
      res.status(500).json({ error: "Failed to fetch active MCP connectors" });
    }
  });

  app.get("/api/mcp-connectors/:id", async (req, res) => {
    try {
      const connector = await storage.getMcpConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "MCP connector not found" });
      }
      // Redact API key for security
      res.json({
        ...connector,
        apiKey: connector.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error fetching MCP connector:", error);
      res.status(500).json({ error: "Failed to fetch MCP connector" });
    }
  });

  app.post("/api/mcp-connectors", async (req, res) => {
    try {
      const { name, description, serverUrl, apiKey, connectorType, authType, roleMapping, config } = req.body;
      const connector = await storage.createMcpConnector({
        name,
        description,
        serverUrl,
        apiKey,
        connectorType,
        authType,
        roleMapping,
        config,
        isActive: "true",
      });
      // Redact API key in response for security
      res.json({
        ...connector,
        apiKey: connector.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error creating MCP connector:", error);
      res.status(500).json({ error: "Failed to create MCP connector" });
    }
  });

  app.patch("/api/mcp-connectors/:id", async (req, res) => {
    try {
      const { name, description, serverUrl, apiKey, connectorType, authType, roleMapping, config, isActive } = req.body;
      await storage.updateMcpConnector(req.params.id, {
        name,
        description,
        serverUrl,
        apiKey,
        connectorType,
        authType,
        roleMapping,
        config,
        isActive,
      });
      const updated = await storage.getMcpConnector(req.params.id);
      if (!updated) {
        return res.status(404).json({ error: "MCP connector not found" });
      }
      // Redact API key in response for security
      res.json({
        ...updated,
        apiKey: updated.apiKey ? "••••••••" : null,
      });
    } catch (error) {
      console.error("Error updating MCP connector:", error);
      res.status(500).json({ error: "Failed to update MCP connector" });
    }
  });

  app.delete("/api/mcp-connectors/:id", async (req, res) => {
    try {
      await storage.deleteMcpConnector(req.params.id);
      res.json({ message: "MCP connector deleted successfully" });
    } catch (error) {
      console.error("Error deleting MCP connector:", error);
      res.status(500).json({ error: "Failed to delete MCP connector" });
    }
  });

  // Test MCP connector
  app.post("/api/mcp-connectors/:id/test", async (req, res) => {
    try {
      const { mcpConnectorService } = await import("./services/mcpConnectorService");
      const { query } = req.body;
      
      console.log(`🧪 [MCP TEST] Testing connector ${req.params.id} with query: "${query}"`);
      
      // Bypass cache for test calls to always get fresh data
      const payload = await mcpConnectorService.fetchConnectorData(
        req.params.id, 
        {
          projectName: "Test Query",
          proposalSummary: query || "test",
        },
        { bypassCache: true }
      );
      
      if (!payload) {
        return res.json({
          success: false,
          message: "No data returned from connector",
          rawData: null,
        });
      }
      
      res.json({
        success: true,
        message: "Connector test successful",
        rawData: payload.rawData,
        roleContext: payload.roleContext,
        metadata: payload.metadata,
      });
    } catch (error: any) {
      console.error("Error testing MCP connector:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to test MCP connector",
        details: error.message || String(error),
      });
    }
  });

  // System Configuration endpoints
  app.get("/api/system-config", async (req, res) => {
    try {
      const configs = await storage.getAllSystemConfig();
      // Redact encrypted values
      const sanitized = configs.map(c => ({
        ...c,
        value: c.isEncrypted === "true" ? "••••••••" : c.value,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.get("/api/system-config/category/:category", async (req, res) => {
    try {
      const configs = await storage.getSystemConfigByCategory(req.params.category);
      const sanitized = configs.map(c => ({
        ...c,
        value: c.isEncrypted === "true" ? "••••••••" : c.value,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching system config by category:", error);
      res.status(500).json({ error: "Failed to fetch system configuration" });
    }
  });

  app.post("/api/system-config", async (req, res) => {
    try {
      const { category, key, value, isEncrypted, description } = req.body;
      const config = await storage.upsertSystemConfig({
        category,
        key,
        value,
        isEncrypted: isEncrypted || "false",
        description,
      });
      // Redact encrypted values in response
      res.json({
        ...config,
        value: config.isEncrypted === "true" ? "••••••••" : config.value,
      });
    } catch (error) {
      console.error("Error upserting system config:", error);
      res.status(500).json({ error: "Failed to save system configuration" });
    }
  });

  app.delete("/api/system-config/:key", async (req, res) => {
    try {
      await storage.deleteSystemConfig(req.params.key);
      res.json({ message: "Configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting system config:", error);
      res.status(500).json({ error: "Failed to delete configuration" });
    }
  });

  // Test Azure connectivity
  app.post("/api/test-azure-connectivity", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      azureOpenAI: { configured: false, working: false, error: null, details: null },
      azureSearch: { configured: false, working: false, error: null, details: null },
    };

    // Test Azure OpenAI Embeddings
    try {
      console.log("[Test] Initializing Azure OpenAI embedding service...");
      await azureEmbeddingService.initialize();
      results.azureOpenAI.configured = true;

      console.log("[Test] Testing embedding generation...");
      const testResult = await azureEmbeddingService.generateEmbedding("test");
      
      results.azureOpenAI.working = true;
      results.azureOpenAI.details = {
        embeddingDimensions: testResult.embedding.length,
        tokenCount: testResult.tokenCount,
        testText: "test",
      };
      console.log("[Test] Azure OpenAI test successful!");
    } catch (error: any) {
      console.error("[Test] Azure OpenAI test failed:", error);
      results.azureOpenAI.error = error.message || String(error);
    }

    // Test Azure AI Search
    try {
      console.log("[Test] Initializing Azure AI Search service...");
      await azureAISearchService.initialize();
      results.azureSearch.configured = true;

      console.log("[Test] Getting index statistics...");
      const stats = await azureAISearchService.getIndexStats();
      
      results.azureSearch.working = true;
      results.azureSearch.details = {
        indexName: "intellibid-rag",
        documentCount: stats.documentCount,
        storageSize: stats.storageSize,
      };
      console.log("[Test] Azure AI Search test successful!");
    } catch (error: any) {
      console.error("[Test] Azure AI Search test failed:", error);
      results.azureSearch.error = error.message || String(error);
    }

    // Determine overall status
    const allWorking = results.azureOpenAI.working && results.azureSearch.working;
    const someWorking = results.azureOpenAI.working || results.azureSearch.working;

    res.json({
      success: allWorking,
      partialSuccess: someWorking && !allWorking,
      results,
      message: allWorking 
        ? "All Azure services are configured and working correctly!" 
        : someWorking 
          ? "Some Azure services are working, but not all. Check the details below."
          : "Azure services are not configured or not working. Please check your configuration.",
    });
  });

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const { portfolioId, name, initiativeName, vendorList, status, businessCaseId } = req.body;
      const project = await storage.createProject({
        portfolioId,
        name,
        initiativeName: initiativeName || null,
        vendorList: vendorList || null,
        status: status || "analyzing",
        businessCaseId: businessCaseId || null,
      });
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Get project by ID
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // Upload and analyze requirements
  app.post("/api/projects/:id/requirements", upload.array("files"), async (req, res) => {
    try {
      const projectId = req.params.id;
      const files = req.files as Express.Multer.File[];
      const documentType = req.body.documentType || "RFT";
      const standardId = req.body.standardId;
      const taggedSections = req.body.taggedSections ? JSON.parse(req.body.taggedSections) : null;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const requirements = [];
      for (const file of files) {
        const parsed = await parseDocument(file.buffer, file.originalname);
        const analysis = await analyzeRequirements(parsed.text);

        const requirement = await storage.createRequirement({
          projectId,
          documentType,
          fileName: file.originalname,
          extractedData: parsed,
          evaluationCriteria: analysis.evaluationCriteria,
          standardId,
          taggedSections,
        });

        requirements.push({ ...requirement, analysis });
      }

      res.json(requirements);
    } catch (error) {
      console.error("Error processing requirements:", error);
      res.status(500).json({ error: "Failed to process requirements" });
    }
  });

  // Upload and analyze proposals
  app.post("/api/projects/:id/proposals", upload.array("files"), async (req, res) => {
    try {
      const projectId = req.params.id;
      const files = req.files as Express.Multer.File[];
      const vendorName = req.body.vendorName;
      const documentType = req.body.documentType || "SOW";
      const standardId = req.body.standardId;
      const taggedSections = req.body.taggedSections ? JSON.parse(req.body.taggedSections) : null;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      if (!vendorName) {
        return res.status(400).json({ error: "Vendor name is required" });
      }

      const { azureBlobStorageService } = await import("./services/azureBlobStorage");
      
      const proposals = [];
      for (const file of files) {
        const parsed = await parseDocument(file.buffer, file.originalname);
        const analysis = await analyzeProposal(parsed.text, file.originalname);

        // Upload file to Azure Blob Storage
        let blobUrl: string | undefined;
        try {
          const uploadResult = await azureBlobStorageService.uploadDocument(
            file.originalname,
            file.buffer,
            { documentType, vendorName }
          );
          blobUrl = uploadResult.blobUrl;
        } catch (error) {
          console.error("Failed to upload to Azure Blob Storage:", error);
          // Continue without blob URL if upload fails
        }

        const proposal = await storage.createProposal({
          projectId,
          vendorName,
          documentType,
          fileName: file.originalname,
          blobUrl,
          extractedData: { ...parsed, aiAnalysis: analysis },
          standardId,
          taggedSections,
        });

        proposals.push({ ...proposal, analysis });
      }

      res.json(proposals);
    } catch (error) {
      console.error("Error processing proposals:", error);
      res.status(500).json({ error: "Failed to process proposals" });
    }
  });

  // Analyze project and generate evaluations
  app.post("/api/projects/:id/analyze", async (req, res) => {
    try {
      const projectId = req.params.id;

      // Get requirements and proposals
      const requirements = await storage.getRequirementsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      if (proposals.length === 0) {
        return res.status(400).json({ error: "No proposals found for project" });
      }

      // Use first requirement for evaluation criteria
      const requirementAnalysis = requirements[0].extractedData as any;

      // Check if there's a standard associated with requirements
      let requirementStandardData = null;
      const requirement = requirements[0];
      if (requirement.standardId) {
        const standard = await storage.getStandard(requirement.standardId);
        if (standard && standard.isActive === "true") {
          requirementStandardData = {
            id: standard.id,
            name: standard.name,
            sections: (standard.sections || []) as any,
            taggedSectionIds: (requirement.taggedSections || []) as any,
          };
        }
      }

      // Evaluate each proposal
      const evaluations = [];
      for (const proposal of proposals) {
        const proposalAnalysis = proposal.extractedData as any;
        
        // Determine which standard to use for this proposal
        let proposalStandardData = null;
        
        if (proposal.standardId) {
          // Proposal has its own standard reference
          if (requirementStandardData && proposal.standardId === requirementStandardData.id) {
            // Use requirement standard with proposal's tagged sections
            proposalStandardData = {
              ...requirementStandardData,
              taggedSectionIds: proposal.taggedSections || requirementStandardData.taggedSectionIds,
            };
          } else {
            // Fetch proposal's standard independently
            const proposalStandard = await storage.getStandard(proposal.standardId);
            if (proposalStandard && proposalStandard.isActive === "true") {
              proposalStandardData = {
                id: proposalStandard.id,
                name: proposalStandard.name,
                sections: (proposalStandard.sections || []) as any,
                taggedSectionIds: (proposal.taggedSections || []) as any,
              };
            }
          }
        } else if (requirementStandardData) {
          // Fall back to requirement standard
          proposalStandardData = requirementStandardData;
        }
        
        const { evaluation, diagnostics } = await evaluateProposal(
          requirementAnalysis, 
          proposalAnalysis,
          proposalStandardData || undefined
        );

        const savedEvaluation = await storage.createEvaluation({
          projectId,
          proposalId: proposal.id,
          overallScore: evaluation.overallScore,
          technicalFit: evaluation.technicalFit,
          deliveryRisk: evaluation.deliveryRisk,
          cost: evaluation.cost,
          compliance: evaluation.compliance,
          status: evaluation.status,
          aiRationale: evaluation.rationale,
          roleInsights: evaluation.roleInsights,
          detailedScores: evaluation.detailedScores,
          sectionCompliance: evaluation.sectionCompliance || null,
          agentDiagnostics: diagnostics || null,
        });

        evaluations.push({
          ...savedEvaluation,
          vendorName: proposal.vendorName,
        });
      }

      // Update project status
      await storage.updateProjectStatus(projectId, "completed");

      res.json(evaluations);
    } catch (error) {
      console.error("Error analyzing project:", error);
      res.status(500).json({ error: "Failed to analyze project" });
    }
  });

  // Generate PDF evaluation report for a project
  app.get("/api/projects/:id/evaluation-report.pdf", async (req, res) => {
    try {
      const projectId = req.params.id;
      const { generateEvaluationReportPdf } = await import("./services/evaluationReportPdf");
      
      const pdfBuffer = await generateEvaluationReportPdf(projectId, storage);
      
      const project = await storage.getProject(projectId);
      const filename = `${project?.name.replace(/[^a-zA-Z0-9]/g, '_')}_Evaluation_Report.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating evaluation report PDF:", error);
      res.status(500).json({ error: "Failed to generate evaluation report" });
    }
  });

  // Get evaluations for a project
  app.get("/api/projects/:id/evaluations", async (req, res) => {
    try {
      const projectId = req.params.id;
      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      // Get unique vendor names from proposals
      const vendorNames = Array.from(new Set(proposals.map(p => p.vendorName)));
      
      // Import score calculator
      const { calculateExcelScoresForVendor, calculateHybridScore, mapExcelScoresToEvaluation } = 
        await import("./services/excelScoreCalculator");
      
      // Create enriched results for all vendors (with or without evaluations)
      const enrichedEvaluations = await Promise.all(vendorNames.map(async (vendorName) => {
        // Find evaluation for this vendor (may not exist)
        const evaluation = evaluations.find((e) => {
          const proposal = proposals.find((p) => p.id === e.proposalId);
          return proposal?.vendorName === vendorName;
        });
        
        // Get all documents for this vendor IN THIS PROJECT ONLY
        const vendorDocuments = proposals
          .filter((p) => p.vendorName === vendorName && p.projectId === projectId)
          .map((p) => ({
            id: p.id,
            documentType: p.documentType,
            fileName: p.fileName,
            blobUrl: p.blobUrl || "",
            blobName: p.blobUrl ? p.blobUrl.split('/').slice(-1)[0] : p.fileName,
            createdAt: p.createdAt,
          }));

        // Calculate Excel-based scores
        let excelScores = null;
        let hybridScores = null;
        try {
          excelScores = await calculateExcelScoresForVendor(vendorDocuments);
          
          // Calculate hybrid scores if evaluation exists
          if (evaluation) {
            const excelEvaluationScores = mapExcelScoresToEvaluation(excelScores);
            
            const detailedScores = evaluation.detailedScores as Record<string, number> | null | undefined;
            hybridScores = {
              overallScore: calculateHybridScore(evaluation.overallScore, excelScores.averageScore),
              technicalFit: calculateHybridScore(evaluation.technicalFit, excelEvaluationScores.technicalFit),
              deliveryRisk: calculateHybridScore(evaluation.deliveryRisk, excelEvaluationScores.deliveryRisk),
              compliance: calculateHybridScore(evaluation.compliance, excelEvaluationScores.compliance),
              integration: calculateHybridScore(
                detailedScores?.integration || 0, 
                excelEvaluationScores.integration
              ),
            };
          }
        } catch (error) {
          console.error(`Failed to calculate Excel scores for ${vendorName}:`, error);
        }

        // If evaluation exists, return it enriched with documents and scores
        if (evaluation) {
          return {
            ...evaluation,
            vendorName,
            documents: vendorDocuments,
            excelScores,
            hybridScores,
          };
        }
        
        // Otherwise, create a placeholder evaluation for vendors with proposals but no evaluation yet
        return {
          id: `placeholder-${vendorName}`,
          proposalId: vendorDocuments[0]?.id || `placeholder-proposal-${vendorName}`,
          vendorName,
          overallScore: 0,
          technicalFit: 0,
          deliveryRisk: 0,
          cost: "Not evaluated",
          compliance: 0,
          status: "under-review" as const,
          aiRationale: "Evaluation pending",
          roleInsights: {},
          detailedScores: {},
          documents: vendorDocuments,
          excelScores,
          hybridScores: null,
        };
      }));

      res.json(enrichedEvaluations);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      res.status(500).json({ error: "Failed to fetch evaluations" });
    }
  });

  // Get evaluation criteria for an evaluation
  app.get("/api/evaluations/:id/criteria", async (req, res) => {
    try {
      const evaluationId = req.params.id;
      const role = req.query.role as string | undefined;
      const criteria = await storage.getEvaluationCriteriaByEvaluation(evaluationId, role);
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching evaluation criteria:", error);
      res.status(500).json({ error: "Failed to fetch evaluation criteria" });
    }
  });

  // Update evaluation criteria score
  app.patch("/api/evaluation-criteria/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const { score, scoreLabel } = req.body;
      
      // Update the criterion
      await storage.updateEvaluationCriteria(id, { score, scoreLabel });
      
      // Get the updated criterion to find its evaluation
      const updatedCriterion = await storage.getEvaluationCriterion(id);
      
      if (updatedCriterion) {
        // Get all criteria for this evaluation to recalculate scores
        const evaluationCriteria = await storage.getEvaluationCriteriaByEvaluation(updatedCriterion.evaluationId);
        
        // Guard against empty criteria (unlikely but possible)
        if (evaluationCriteria.length === 0) {
          console.warn(`[Evaluation Recalculation] No criteria found for evaluation ${updatedCriterion.evaluationId}`);
          res.json({ success: true });
          return;
        }
        
        // Calculate average score from all criteria
        const totalScore = evaluationCriteria.reduce((sum, c) => sum + c.score, 0);
        const avgScore = Math.round(totalScore / evaluationCriteria.length);
        
        // Group by role to calculate dimension scores
        const roleGroups = evaluationCriteria.reduce((groups, c) => {
          if (!groups[c.role]) groups[c.role] = [];
          groups[c.role].push(c);
          return groups;
        }, {} as Record<string, typeof evaluationCriteria>);
        
        // Calculate dimension scores (simplified - using role averages)
        const roles = Object.keys(roleGroups);
        const technicalFit = roles.length > 0 ? Math.round(
          Object.values(roleGroups).reduce((sum, group) => 
            sum + group.reduce((s, c) => s + c.score, 0) / group.length, 0
          ) / roles.length
        ) : avgScore;
        
        // For simplicity, use overall score for other dimensions
        // In a real system, you'd have specific criteria mapped to each dimension
        const deliveryRisk = avgScore;
        const compliance = avgScore;
        
        // Determine status based on overall score
        let status: "recommended" | "under-review" | "risk-flagged";
        if (avgScore >= 70) {
          status = "recommended";
        } else if (avgScore >= 50) {
          status = "under-review";
        } else {
          status = "risk-flagged";
        }
        
        // Update the evaluation with recalculated values
        await storage.updateEvaluation(updatedCriterion.evaluationId, {
          overallScore: avgScore,
          technicalFit,
          deliveryRisk,
          compliance,
          status,
        });
        
        console.log(`[Evaluation Recalculated] ID: ${updatedCriterion.evaluationId}, Score: ${avgScore}, Status: ${status}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating evaluation criteria:", error);
      res.status(500).json({ error: "Failed to update evaluation criteria" });
    }
  });

  // Excel questionnaire parsing and saving endpoints
  app.get("/api/proposals/:proposalId/parse-excel", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.getProposal(proposalId);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Check if this is an Excel file
      if (!proposal.fileName.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ error: "File is not an Excel file" });
      }

      const { azureBlobStorageService } = await import("./services/azureBlobStorage");
      const { parseExcelQuestionnaire } = await import("./services/excelQuestionnaireHandler");

      // Download Excel file from Azure
      if (!proposal.blobUrl) {
        return res.status(400).json({ error: "No blob URL available" });
      }
      
      // Extract blob name from full URL
      // URL format: https://intellibidstorage.blob.core.windows.net/intellibid-documents/project-xxx/RFT_Responses/Aims/Product_Response.xlsx
      // We need: project-xxx/RFT_Responses/Aims/Product_Response.xlsx
      const urlParts = proposal.blobUrl.split('/intellibid-documents/');
      const blobName = urlParts.length > 1 ? urlParts[1] : proposal.blobUrl;
      
      const excelBuffer = await azureBlobStorageService.downloadDocument(blobName);
      
      // Parse Excel to JSON
      const questions = await parseExcelQuestionnaire(excelBuffer);

      res.json({
        fileName: proposal.fileName,
        documentType: proposal.documentType,
        questions,
      });
    } catch (error) {
      console.error("Error parsing Excel file:", error);
      res.status(500).json({ error: "Failed to parse Excel file" });
    }
  });

  app.post("/api/proposals/:proposalId/save-excel", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const { questions } = req.body;

      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "Invalid questions data" });
      }

      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const { azureBlobStorageService } = await import("./services/azureBlobStorage");
      const { createExcelQuestionnaire } = await import("./services/excelQuestionnaireHandler");

      // Create updated Excel file
      const updatedExcelBuffer = await createExcelQuestionnaire(
        proposal.fileName.replace('.xlsx', ''),
        questions
      );

      // Upload updated file to Azure (replace existing file by name)
      if (!proposal.blobUrl) {
        return res.status(400).json({ error: "No blob URL available" });
      }
      
      // Delete the old file (extract blob name from URL)
      const blobName = proposal.blobUrl.split('/').pop() || proposal.fileName;
      await azureBlobStorageService.deleteDocument(blobName);
      const uploadResult = await azureBlobStorageService.uploadDocument(
        proposal.fileName,
        updatedExcelBuffer,
        { proposalId, documentType: proposal.documentType }
      );

      // Update proposal blob URL (note: we use a simpler storage interface)
      // Since we don't have updateProposal, we'll just confirm success
      console.log(`[Excel Update] Proposal ${proposalId} updated successfully`);

      res.json({ 
        success: true,
        message: "Questionnaire updated successfully",
        blobUrl: uploadResult.blobUrl,
      });
    } catch (error) {
      console.error("Error saving Excel file:", error);
      res.status(500).json({ error: "Failed to save Excel file" });
    }
  });

  // RAG Document Management
  // Note: These endpoints are for future use when RAG system is fully integrated
  app.get("/api/rag/documents", async (req, res) => {
    try {
      const documents = await storage.getAllRagDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching RAG documents:", error);
      res.status(500).json({ error: "Failed to fetch RAG documents" });
    }
  });

  app.get("/api/rag/documents/:id", async (req, res) => {
    try {
      const document = await storage.getRagDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching RAG document:", error);
      res.status(500).json({ error: "Failed to fetch RAG document" });
    }
  });

  app.delete("/api/rag/documents/:id", async (req, res) => {
    try {
      // Import at runtime to avoid circular dependencies
      const { documentIngestionService } = await import("./services/documentIngestion");
      await documentIngestionService.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RAG document:", error);
      res.status(500).json({ error: "Failed to delete RAG document" });
    }
  });

  app.post("/api/rag/documents/:id/reindex", async (req, res) => {
    try {
      const ragDoc = await storage.getRagDocument(req.params.id);
      if (!ragDoc) {
        return res.status(404).json({ error: "RAG document not found" });
      }

      // Import at runtime to avoid circular dependencies
      const { documentIngestionService } = await import("./services/documentIngestion");
      const { azureBlobStorageService } = await import("./services/azureBlobStorage");
      
      // Download the document from blob storage
      if (!ragDoc.blobName) {
        return res.status(400).json({ error: "Document has no blob reference" });
      }

      const buffer = await azureBlobStorageService.downloadDocument(ragDoc.blobName);
      const textContent = buffer.toString('utf-8');
      
      // Clear existing chunks and search index entries (preserve parent document)
      await documentIngestionService.clearDocumentChunksAndIndex(req.params.id);
      
      // Re-ingest the document using the same ID
      await documentIngestionService.ingestDocument({
        sourceType: ragDoc.sourceType as any,
        sourceId: ragDoc.sourceId || undefined,
        fileName: ragDoc.fileName,
        content: buffer,
        textContent,
        metadata: ragDoc.metadata as any,
        documentId: req.params.id, // Reuse the same document ID
      });

      // Get updated document
      const updatedDoc = await storage.getRagDocument(req.params.id);
      res.json(updatedDoc);
    } catch (error) {
      console.error("Error re-indexing RAG document:", error);
      res.status(500).json({ error: "Failed to re-index RAG document" });
    }
  });

  // ==================================================================
  // AI FEATURES ROUTES
  // ==================================================================

  // Compliance Gap Analysis
  app.post("/api/projects/:projectId/proposals/:proposalId/analyze-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/complianceGapService");
      const { projectId, proposalId } = req.params;

      // Get proposal and requirements
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Analyze compliance gaps
      const gaps = await complianceGapService.analyzeComplianceGaps({
        projectId,
        proposalId,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposal: JSON.stringify(proposal.extractedData),
        vendorName: proposal.vendorName
      });

      res.json({ gaps, summary: await complianceGapService.getGapSummary(projectId) });
    } catch (error) {
      console.error("Error analyzing compliance gaps:", error);
      res.status(500).json({ error: "Failed to analyze compliance gaps" });
    }
  });

  app.get("/api/projects/:projectId/compliance-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/complianceGapService");
      const gaps = await complianceGapService.getProjectComplianceGaps(req.params.projectId);
      const summary = await complianceGapService.getGapSummary(req.params.projectId);
      res.json({ gaps, summary });
    } catch (error) {
      console.error("Error fetching compliance gaps:", error);
      res.status(500).json({ error: "Failed to fetch compliance gaps" });
    }
  });

  app.get("/api/proposals/:proposalId/compliance-gaps", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/complianceGapService");
      const gaps = await complianceGapService.getProposalComplianceGaps(req.params.proposalId);
      res.json(gaps);
    } catch (error) {
      console.error("Error fetching proposal gaps:", error);
      res.status(500).json({ error: "Failed to fetch proposal gaps" });
    }
  });

  app.patch("/api/compliance-gaps/:id/resolve", async (req, res) => {
    try {
      const { complianceGapService } = await import("./services/complianceGapService");
      await complianceGapService.resolveComplianceGap(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error resolving gap:", error);
      res.status(500).json({ error: "Failed to resolve gap" });
    }
  });

  // Follow-up Question Generation
  app.post("/api/projects/:projectId/proposals/:proposalId/generate-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/followupQuestionService");
      const { projectId, proposalId } = req.params;

      // Get proposal and requirements
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Generate follow-up questions
      const questions = await followupQuestionService.generateFollowupQuestions({
        projectId,
        proposalId,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposal: JSON.stringify(proposal.extractedData),
        vendorName: proposal.vendorName
      });

      res.json({ questions, summary: await followupQuestionService.getQuestionSummary(projectId) });
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      res.status(500).json({ error: "Failed to generate follow-up questions" });
    }
  });

  app.get("/api/projects/:projectId/followup-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/followupQuestionService");
      const questions = await followupQuestionService.getProjectFollowupQuestions(req.params.projectId);
      const summary = await followupQuestionService.getQuestionSummary(req.params.projectId);
      res.json({ questions, summary });
    } catch (error) {
      console.error("Error fetching follow-up questions:", error);
      res.status(500).json({ error: "Failed to fetch follow-up questions" });
    }
  });

  app.get("/api/proposals/:proposalId/followup-questions", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/followupQuestionService");
      const questions = await followupQuestionService.getProposalFollowupQuestions(req.params.proposalId);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching proposal questions:", error);
      res.status(500).json({ error: "Failed to fetch proposal questions" });
    }
  });

  app.patch("/api/followup-questions/:id/answer", async (req, res) => {
    try {
      const { followupQuestionService } = await import("./services/followupQuestionService");
      const { answer } = req.body;
      if (!answer) {
        return res.status(400).json({ error: "Answer is required" });
      }
      await followupQuestionService.answerFollowupQuestion(req.params.id, answer);
      res.json({ success: true });
    } catch (error) {
      console.error("Error answering question:", error);
      res.status(500).json({ error: "Failed to answer question" });
    }
  });

  // Vendor Comparison Matrix
  app.post("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/vendorComparisonService");
      const { projectId } = req.params;
      const { proposalIds, comparisonFocus } = req.body;

      if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length < 2) {
        return res.status(400).json({ error: "At least 2 proposal IDs required for comparison" });
      }

      // Get requirements
      const requirements = await storage.getRequirementsByProject(projectId);
      if (requirements.length === 0) {
        return res.status(400).json({ error: "No requirements found for project" });
      }

      // Get all proposals
      const proposals = [];
      for (const proposalId of proposalIds) {
        const proposal = await storage.getProposal(proposalId);
        if (proposal) {
          proposals.push({
            vendorName: proposal.vendorName,
            content: JSON.stringify(proposal.extractedData)
          });
        }
      }

      // Generate comparison
      const comparison = await vendorComparisonService.generateVendorComparison({
        projectId,
        proposalIds,
        requirements: JSON.stringify(requirements[0].extractedData),
        proposals,
        comparisonFocus
      });

      res.json(comparison);
    } catch (error) {
      console.error("Error generating comparison:", error);
      res.status(500).json({ error: "Failed to generate comparison" });
    }
  });

  app.get("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/vendorComparisonService");
      const comparisons = await vendorComparisonService.getProjectComparisons(req.params.projectId);
      res.json(comparisons);
    } catch (error) {
      console.error("Error fetching comparisons:", error);
      res.status(500).json({ error: "Failed to fetch comparisons" });
    }
  });

  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/vendorComparisonService");
      const comparison = await vendorComparisonService.getComparison(req.params.id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }
      res.json(comparison);
    } catch (error) {
      console.error("Error fetching comparison:", error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  app.delete("/api/comparisons/:id", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/vendorComparisonService");
      await vendorComparisonService.deleteComparison(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comparison:", error);
      res.status(500).json({ error: "Failed to delete comparison" });
    }
  });

  app.get("/api/comparisons/:id/export/:format", async (req, res) => {
    try {
      const { vendorComparisonService } = await import("./services/vendorComparisonService");
      const { id, format } = req.params;
      
      const comparison = await vendorComparisonService.getComparison(id);
      if (!comparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      const exportData = vendorComparisonService.exportComparisonData(
        comparison,
        format as "json" | "csv"
      );

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=comparison-${id}.csv`);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=comparison-${id}.json`);
      }

      res.send(exportData);
    } catch (error) {
      console.error("Error exporting comparison:", error);
      res.status(500).json({ error: "Failed to export comparison" });
    }
  });

  // Executive Briefing
  app.post("/api/projects/:projectId/briefings", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/executiveBriefingService");
      const { projectId } = req.params;
      const { stakeholderRole } = req.body;

      if (!stakeholderRole) {
        return res.status(400).json({ error: "Stakeholder role is required" });
      }

      // Get project
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get evaluations and proposals
      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      const briefing = await executiveBriefingService.generateExecutiveBriefing({
        projectId,
        projectName: project.name,
        stakeholderRole,
        evaluations: JSON.stringify(evaluations),
        proposals: JSON.stringify(proposals)
      });

      res.json(briefing);
    } catch (error) {
      console.error("Error generating briefing:", error);
      res.status(500).json({ error: "Failed to generate briefing" });
    }
  });

  app.get("/api/projects/:projectId/briefings", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/executiveBriefingService");
      const { role } = req.query;
      
      let briefings;
      if (role) {
        briefings = await executiveBriefingService.getBriefingsByRole(req.params.projectId, role as string);
      } else {
        briefings = await executiveBriefingService.getProjectBriefings(req.params.projectId);
      }
      
      res.json(briefings);
    } catch (error) {
      console.error("Error fetching briefings:", error);
      res.status(500).json({ error: "Failed to fetch briefings" });
    }
  });

  app.get("/api/briefings/:id", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/executiveBriefingService");
      const briefing = await executiveBriefingService.getBriefing(req.params.id);
      if (!briefing) {
        return res.status(404).json({ error: "Briefing not found" });
      }
      res.json(briefing);
    } catch (error) {
      console.error("Error fetching briefing:", error);
      res.status(500).json({ error: "Failed to fetch briefing" });
    }
  });

  app.delete("/api/briefings/:id", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/executiveBriefingService");
      await executiveBriefingService.deleteBriefing(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting briefing:", error);
      res.status(500).json({ error: "Failed to delete briefing" });
    }
  });

  app.get("/api/briefings/:id/markdown", async (req, res) => {
    try {
      const { executiveBriefingService } = await import("./services/executiveBriefingService");
      const briefing = await executiveBriefingService.getBriefing(req.params.id);
      if (!briefing) {
        return res.status(404).json({ error: "Briefing not found" });
      }
      
      const markdown = executiveBriefingService.formatBriefingAsMarkdown(briefing);
      res.setHeader("Content-Type", "text/markdown");
      res.send(markdown);
    } catch (error) {
      console.error("Error formatting briefing:", error);
      res.status(500).json({ error: "Failed to format briefing" });
    }
  });

  // Conversational AI Assistant
  app.post("/api/projects/:projectId/chat/sessions", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const { projectId } = req.params;

      const session = await conversationalAIService.createChatSession(projectId);
      res.json(session);
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  app.get("/api/projects/:projectId/chat/sessions", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const sessions = await conversationalAIService.getProjectChatSessions(req.params.projectId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      res.status(500).json({ error: "Failed to fetch chat sessions" });
    }
  });

  app.get("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const session = await conversationalAIService.getChatSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching chat session:", error);
      res.status(500).json({ error: "Failed to fetch chat session" });
    }
  });

  app.get("/api/chat/sessions/:sessionId/messages", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const messages = await conversationalAIService.getSessionMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.patch("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      await conversationalAIService.updateSessionTitle(req.params.sessionId, title);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.delete("/api/chat/sessions/:sessionId", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      await conversationalAIService.deleteChatSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting chat session:", error);
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  app.post("/api/chat/sessions/:sessionId/messages", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const { sessionId } = req.params;
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await conversationalAIService.generateChatResponse(
        sessionId,
        message,
        context || {}
      );

      res.json(response);
    } catch (error) {
      console.error("Error generating chat response:", error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });

  app.post("/api/chat/sessions/:sessionId/messages/stream", async (req, res) => {
    try {
      const { conversationalAIService } = await import("./services/conversationalAIService");
      const { sessionId } = req.params;
      const { message, context } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream the response
      const stream = conversationalAIService.generateStreamingChatResponse(
        sessionId,
        message,
        context || {}
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in streaming chat:", error);
      res.status(500).json({ error: "Failed to stream chat response" });
    }
  });

  // ============================================
  // KNOWLEDGE BASE CHATBOT ROUTES
  // ============================================

  // Check chatbot readiness (RAG + MCP status)
  app.get("/api/kb-chatbot/status", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgeBaseChatbotService");
      const status = await knowledgeBaseChatbotService.isReady();
      res.json(status);
    } catch (error) {
      console.error("Error checking chatbot status:", error);
      res.status(500).json({ error: "Failed to check chatbot status" });
    }
  });

  // Query knowledge base chatbot (non-streaming)
  app.post("/api/kb-chatbot/query", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgeBaseChatbotService");
      const { query, conversationHistory } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const response = await knowledgeBaseChatbotService.generateResponse(
        query,
        conversationHistory || []
      );

      res.json(response);
    } catch (error) {
      console.error("Error querying chatbot:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to query chatbot";
      
      // Return 400 for configuration errors, 500 for runtime errors
      if (errorMessage.includes("not configured") || errorMessage.includes("API key")) {
        return res.status(400).json({ error: errorMessage, type: "configuration" });
      }
      
      res.status(500).json({ error: errorMessage, type: "runtime" });
    }
  });

  // Query knowledge base chatbot (streaming)
  app.post("/api/kb-chatbot/query/stream", async (req, res) => {
    try {
      const { knowledgeBaseChatbotService } = await import("./services/knowledgeBaseChatbotService");
      const { query, conversationHistory } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = knowledgeBaseChatbotService.generateStreamingResponse(
        query,
        conversationHistory || []
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error("Error in streaming chatbot:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to stream chatbot response";
      
      // Return 400 for configuration errors, 500 for runtime errors
      if (errorMessage.includes("not configured") || errorMessage.includes("API key")) {
        return res.status(400).json({ error: errorMessage, type: "configuration" });
      }
      
      res.status(500).json({ error: errorMessage, type: "runtime" });
    }
  });

  // ============================================
  // SMART RFT CREATION ROUTES
  // ============================================

  // Seed RFT templates
  app.post("/api/seed-rft-templates", async (req, res) => {
    try {
      const result = await seedRftTemplates();
      res.json(result);
    } catch (error) {
      console.error("Error seeding RFT templates:", error);
      res.status(500).json({ error: "Failed to seed RFT templates" });
    }
  });

  // Get all RFT templates
  app.get("/api/rft-templates", async (req, res) => {
    try {
      const templates = await storage.getAllRftTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching RFT templates:", error);
      res.status(500).json({ error: "Failed to fetch RFT templates" });
    }
  });

  // Get active RFT templates
  app.get("/api/rft-templates/active", async (req, res) => {
    try {
      const templates = await storage.getActiveRftTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching active RFT templates:", error);
      res.status(500).json({ error: "Failed to fetch active RFT templates" });
    }
  });

  // Get RFT template by ID
  app.get("/api/rft-templates/:id", async (req, res) => {
    try {
      const template = await storage.getRftTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "RFT template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching RFT template:", error);
      res.status(500).json({ error: "Failed to fetch RFT template" });
    }
  });

  // Generate business case with AI
  app.post("/api/business-cases/generate", async (req, res) => {
    try {
      const {
        portfolioId,
        name,
        description,
        projectObjective,
        projectScope,
        timeline,
        budget,
        keyRequirements,
        successCriteria,
      } = req.body;

      if (!portfolioId || !name || !projectObjective) {
        return res.status(400).json({
          error: "Portfolio ID, name, and project objective are required",
        });
      }

      // Generate lean business case with AI
      const { generateLeanBusinessCase } = await import("./services/businessCaseGenerator");
      const generatedContent = await generateLeanBusinessCase({
        projectName: name,
        projectObjective,
        projectScope,
        timeline,
        budget,
        keyRequirements,
        successCriteria,
      });

      // Create business case with AI-generated content
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name,
        description: description || null,
        fileName: "AI Generated Business Case.txt",
        documentContent: generatedContent,
        extractedData: null,
        ragDocumentId: null,
        status: "generated",
      });

      res.json(businessCase);
    } catch (error) {
      console.error("Error generating business case:", error);
      res.status(500).json({ error: "Failed to generate business case" });
    }
  });

  // Upload business case document
  app.post("/api/business-cases/upload", upload.single("document"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { portfolioId, name, description } = req.body;
      if (!portfolioId || !name) {
        return res.status(400).json({ error: "Portfolio ID and name are required" });
      }

      // Parse document
      const parsedDocument = await parseDocument(req.file.buffer, req.file.originalname);

      // Create business case
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name,
        description: description || null,
        fileName: req.file.originalname,
        documentContent: parsedDocument.text,
        extractedData: null,
        ragDocumentId: null,
        status: "uploaded",
      });

      res.json(businessCase);
    } catch (error) {
      console.error("Error uploading business case:", error);
      res.status(500).json({ error: "Failed to upload business case" });
    }
  });

  // Get all business cases
  app.get("/api/business-cases", async (req, res) => {
    try {
      const businessCases = await storage.getAllBusinessCases();
      res.json(businessCases);
    } catch (error) {
      console.error("Error fetching business cases:", error);
      res.status(500).json({ error: "Failed to fetch business cases" });
    }
  });

  // Get business cases by portfolio
  app.get("/api/portfolios/:portfolioId/business-cases", async (req, res) => {
    try {
      const businessCases = await storage.getBusinessCasesByPortfolio(req.params.portfolioId);
      res.json(businessCases);
    } catch (error) {
      console.error("Error fetching business cases:", error);
      res.status(500).json({ error: "Failed to fetch business cases" });
    }
  });

  // Get business case by ID
  app.get("/api/business-cases/:id", async (req, res) => {
    try {
      const businessCase = await storage.getBusinessCase(req.params.id);
      if (!businessCase) {
        return res.status(404).json({ error: "Business case not found" });
      }
      res.json(businessCase);
    } catch (error) {
      console.error("Error fetching business case:", error);
      res.status(500).json({ error: "Failed to fetch business case" });
    }
  });

  // Generate RFT from business case
  app.post("/api/generate-rft", async (req, res) => {
    try {
      const { businessCaseId, templateId, projectId } = req.body;

      if (!businessCaseId || !templateId || !projectId) {
        return res.status(400).json({ 
          error: "Business case ID, template ID, and project ID are required" 
        });
      }

      console.log(`Generating RFT for project ${projectId} using template ${templateId}`);

      // Generate RFT
      const generatedRftData = await generateRftFromBusinessCase(
        businessCaseId,
        templateId,
        projectId
      );

      // Save to database
      const generatedRft = await storage.createGeneratedRft(generatedRftData);

      // Update project with generated RFT ID
      const project = await storage.getProject(projectId);
      if (project) {
        await storage.updateProjectStatus(projectId, "rft_generated");
      }

      res.json(generatedRft);
    } catch (error) {
      console.error("Error generating RFT:", error);
      res.status(500).json({ error: "Failed to generate RFT" });
    }
  });

  // Get all generated RFTs
  app.get("/api/generated-rfts", async (req, res) => {
    try {
      const rfts = await storage.getAllGeneratedRfts();
      res.json(rfts);
    } catch (error) {
      console.error("Error fetching all generated RFTs:", error);
      res.status(500).json({ error: "Failed to fetch generated RFTs" });
    }
  });

  // Get generated RFTs by project
  app.get("/api/projects/:projectId/generated-rfts", async (req, res) => {
    try {
      const rfts = await storage.getGeneratedRftsByProject(req.params.projectId);
      res.json(rfts);
    } catch (error) {
      console.error("Error fetching generated RFTs:", error);
      res.status(500).json({ error: "Failed to fetch generated RFTs" });
    }
  });

  // Get generated RFT by ID
  app.get("/api/generated-rfts/:id", async (req, res) => {
    try {
      const rft = await storage.getGeneratedRft(req.params.id);
      if (!rft) {
        return res.status(404).json({ error: "Generated RFT not found" });
      }
      res.json(rft);
    } catch (error) {
      console.error("Error fetching generated RFT:", error);
      res.status(500).json({ error: "Failed to fetch generated RFT" });
    }
  });

  // Update generated RFT
  app.patch("/api/generated-rfts/:id", async (req, res) => {
    try {
      const { sections, status, name } = req.body;
      const updates: any = {};
      
      if (sections) updates.sections = sections;
      if (status) updates.status = status;
      if (name) updates.name = name;

      await storage.updateGeneratedRft(req.params.id, updates);
      
      const updatedRft = await storage.getGeneratedRft(req.params.id);
      res.json(updatedRft);
    } catch (error) {
      console.error("Error updating generated RFT:", error);
      res.status(500).json({ error: "Failed to update generated RFT" });
    }
  });

  // Publish RFT (convert to requirements AND upload files to Azure)
  app.post("/api/generated-rfts/:id/publish", async (req, res) => {
    try {
      const rft = await storage.getGeneratedRft(req.params.id);
      if (!rft) {
        return res.status(404).json({ error: "Generated RFT not found" });
      }

      console.log(`📤 Publishing RFT ${req.params.id} - uploading files to Azure...`);

      // Upload all files to Azure Blob Storage
      const { publishRftFilesToAzure } = await import("./services/smartRftService");
      const azureUrls = await publishRftFilesToAzure(req.params.id);

      console.log(`✅ Files uploaded successfully to Azure Blob Storage`);

      // Update RFT status to published and store Azure blob URLs
      await storage.updateGeneratedRft(req.params.id, {
        status: "published",
        publishedAt: new Date(),
        docxBlobUrl: azureUrls.docxBlobUrl,
        pdfBlobUrl: azureUrls.pdfBlobUrl,
        productQuestionnaireBlobUrl: azureUrls.productQuestionnaireBlobUrl,
        nfrQuestionnaireBlobUrl: azureUrls.nfrQuestionnaireBlobUrl,
        cybersecurityQuestionnaireBlobUrl: azureUrls.cybersecurityQuestionnaireBlobUrl,
        agileQuestionnaireBlobUrl: azureUrls.agileQuestionnaireBlobUrl,
      });

      // Create requirements from RFT sections
      const sections = (rft.sections as any)?.sections || [];
      const allRequirements = [];

      for (const section of sections) {
        const requirement = await storage.createRequirement({
          projectId: rft.projectId,
          documentType: "RFT",
          fileName: `${rft.name} - ${section.title}`,
          extractedData: {
            sectionId: section.sectionId,
            title: section.title,
            content: section.content,
          },
          evaluationCriteria: null,
          standardId: null,
          taggedSections: null,
        });
        allRequirements.push(requirement);
      }

      // Update project status
      await storage.updateProjectStatus(rft.projectId, "rft_published");

      res.json({
        success: true,
        rft: await storage.getGeneratedRft(req.params.id), // Return updated RFT with Azure URLs
        requirementsCreated: allRequirements.length,
        azureUrls, // Include Azure URLs in response
      });
    } catch (error) {
      console.error("Error publishing RFT:", error);
      res.status(500).json({ error: "Failed to publish RFT" });
    }
  });

  // Regenerate specific RFT section
  app.post("/api/generated-rfts/:rftId/sections/:sectionId/regenerate", async (req, res) => {
    try {
      const { rftId, sectionId } = req.params;

      const newSection = await regenerateRftSection(rftId, sectionId);

      // Update the RFT with the new section
      const rft = await storage.getGeneratedRft(rftId);
      if (rft) {
        const sections = (rft.sections as any)?.sections || [];
        const updatedSections = sections.map((s: any) =>
          s.sectionId === sectionId ? newSection : s
        );

        await storage.updateGeneratedRft(rftId, {
          sections: { sections: updatedSections },
        });
      }

      res.json(newSection);
    } catch (error) {
      console.error("Error regenerating RFT section:", error);
      res.status(500).json({ error: "Failed to regenerate section" });
    }
  });

  // Download questionnaire file
  app.get("/api/questionnaires/download/:rftId/:type", async (req, res) => {
    try {
      const { rftId, type } = req.params;
      
      const rft = await storage.getGeneratedRft(rftId);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // Check if Azure blob URL exists (for published RFTs)
      let blobUrl: string | null = null;
      let filePath: string | null = null;
      let fileName = "";
      
      switch (type) {
        case "product":
          blobUrl = rft.productQuestionnaireBlobUrl || null;
          filePath = rft.productQuestionnairePath || null;
          fileName = "Product_Questionnaire.xlsx";
          break;
        case "nfr":
          blobUrl = rft.nfrQuestionnaireBlobUrl || null;
          filePath = rft.nfrQuestionnairePath || null;
          fileName = "NFR_Questionnaire.xlsx";
          break;
        case "cybersecurity":
          blobUrl = rft.cybersecurityQuestionnaireBlobUrl || null;
          filePath = rft.cybersecurityQuestionnairePath || null;
          fileName = "Cybersecurity_Questionnaire.xlsx";
          break;
        case "agile":
          blobUrl = rft.agileQuestionnaireBlobUrl || null;
          filePath = rft.agileQuestionnairePath || null;
          fileName = "Agile_Delivery_Questionnaire.xlsx";
          break;
        default:
          return res.status(400).json({ error: "Invalid questionnaire type" });
      }

      // Serve from Azure if published
      if (blobUrl) {
        console.log(`📥 Serving ${type} questionnaire from Azure: ${blobUrl}`);
        return res.redirect(blobUrl);
      }

      // Otherwise, serve from local filesystem (for unpublished RFTs)
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Questionnaire file not found" });
      }

      console.log(`⚠️ Serving ${type} questionnaire from local file (RFT not yet published)`);

      // Send file
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error("Error downloading questionnaire:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
      });
    } catch (error) {
      console.error("Error serving questionnaire:", error);
      res.status(500).json({ error: "Failed to serve questionnaire file" });
    }
  });

  // Download RFT as DOC
  app.get("/api/generated-rfts/:id/download/doc", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // If published, serve from Azure Blob Storage
      if (rft.docxBlobUrl) {
        console.log(`📥 Serving DOCX from Azure: ${rft.docxBlobUrl}`);
        return res.redirect(rft.docxBlobUrl);
      }

      // Otherwise, generate on-the-fly (for unpublished RFTs)
      const sections = (rft.sections as any)?.sections || [];
      if (sections.length === 0) {
        return res.status(400).json({ error: "No sections found in RFT" });
      }

      console.log(`⚠️ Generating DOCX on-the-fly (RFT not yet published)`);

      // Generate DOC file
      const { generateDocxDocument } = await import("./services/documentGenerator");
      const outputPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}.docx`);
      
      await generateDocxDocument({
        projectName: rft.name,
        sections,
        outputPath,
      });

      // Send file and clean up after
      res.download(outputPath, `${rft.name.replace(/[^a-zA-Z0-9]/g, "_")}_RFT.docx`, (err) => {
        if (err) {
          console.error("Error downloading DOC:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error generating DOC:", error);
      res.status(500).json({ error: "Failed to generate DOC file" });
    }
  });

  // Download RFT as PDF
  app.get("/api/generated-rfts/:id/download/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      // If published, serve from Azure Blob Storage
      if (rft.pdfBlobUrl) {
        console.log(`📥 Serving PDF from Azure: ${rft.pdfBlobUrl}`);
        return res.redirect(rft.pdfBlobUrl);
      }

      // Otherwise, generate on-the-fly (for unpublished RFTs)
      const sections = (rft.sections as any)?.sections || [];
      if (sections.length === 0) {
        return res.status(400).json({ error: "No sections found in RFT" });
      }

      console.log(`⚠️ Generating PDF on-the-fly (RFT not yet published)`);

      // Generate PDF file
      const { generatePdfDocument } = await import("./services/documentGenerator");
      const outputPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}.pdf`);
      
      await generatePdfDocument({
        projectName: rft.name,
        sections,
        outputPath,
      });

      // Send file and clean up after
      res.download(outputPath, `${rft.name.replace(/[^a-zA-Z0-9]/g, "_")}_RFT.pdf`, (err) => {
        if (err) {
          console.error("Error downloading PDF:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        }
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }, 1000);
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF file" });
    }
  });

  // Download all RFT deliverables as ZIP
  app.get("/api/generated-rfts/:id/download/all", async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      const archiver = (await import("archiver")).default;
      const archive = archiver('zip', { zlib: { level: 9 } });

      const sanitizedName = rft.name.replace(/[^a-zA-Z0-9]/g, "_");
      res.attachment(`${sanitizedName}_Complete_RFT_Package.zip`);
      res.setHeader('Content-Type', 'application/zip');

      archive.on('error', (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create ZIP file" });
        }
      });

      archive.pipe(res);

      // Add RFT document (DOC)
      const sections = (rft.sections as any)?.sections || [];
      if (sections.length > 0) {
        const { generateDocxDocument } = await import("./services/documentGenerator");
        const docPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}_temp.docx`);
        
        await generateDocxDocument({
          projectName: rft.name,
          sections,
          outputPath: docPath,
        });

        archive.file(docPath, { name: `${sanitizedName}_RFT.docx` });
      }

      // Add questionnaires
      const questionnaires = [
        { path: rft.productQuestionnairePath, name: "Product_Questionnaire.xlsx" },
        { path: rft.nfrQuestionnairePath, name: "NFR_Questionnaire.xlsx" },
        { path: rft.cybersecurityQuestionnairePath, name: "Cybersecurity_Questionnaire.xlsx" },
        { path: rft.agileQuestionnairePath, name: "Agile_Delivery_Questionnaire.xlsx" },
      ];

      for (const q of questionnaires) {
        if (q.path && fs.existsSync(q.path)) {
          archive.file(q.path, { name: q.name });
        }
      }

      // Finalize archive
      await archive.finalize();

      // Clean up temp DOC file after a delay
      setTimeout(() => {
        const tempDocPath = path.join(process.cwd(), "uploads", "documents", `RFT_${id}_temp.docx`);
        if (fs.existsSync(tempDocPath)) {
          fs.unlinkSync(tempDocPath);
        }
      }, 2000);

    } catch (error) {
      console.error("Error creating ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP file" });
      }
    }
  });

  // Helper function to trigger project evaluation in the background
  async function triggerProjectEvaluation(projectId: string, rft: any) {
    try {
      console.log(`Starting evaluation for project ${projectId}...`);

      // Check if requirements exist, if not create them from RFT
      let requirements = await storage.getRequirementsByProject(projectId);
      
      if (requirements.length === 0) {
        console.log(`No requirements found, creating from RFT sections...`);
        const sections = (rft.sections as any)?.sections || [];
        const requirement = await storage.createRequirement({
          projectId,
          fileName: `${rft.name}_Requirements.pdf`,
          extractedData: {
            text: sections.map((s: any) => s.content).join("\n") || "",
            fileName: `${rft.name}_Requirements.pdf`,
          },
          evaluationCriteria: [
            { name: "Technical Fit", weight: 30, description: "Technical capabilities" },
            { name: "Delivery Risk", weight: 25, description: "Implementation risk" },
            { name: "Cost", weight: 20, description: "Total cost of ownership" },
            { name: "Compliance", weight: 15, description: "Regulatory compliance" },
            { name: "Support", weight: 10, description: "Vendor support quality" },
          ],
        });
        requirements = [requirement];
        console.log(`✓ Created requirement from RFT`);
      }

      // Get proposals
      const proposals = await storage.getProposalsByProject(projectId);
      
      if (proposals.length === 0) {
        console.log(`No proposals found, skipping evaluation`);
        return;
      }

      console.log(`Found ${proposals.length} proposals to evaluate`);

      // Use first requirement for evaluation criteria
      const requirementAnalysis = requirements[0].extractedData as any;

      // Check if there's a standard associated with requirements
      let requirementStandardData = null;
      const requirement = requirements[0];
      if (requirement.standardId) {
        const standard = await storage.getStandard(requirement.standardId);
        if (standard && standard.isActive === "true") {
          requirementStandardData = {
            id: standard.id,
            name: standard.name,
            sections: (standard.sections || []) as any,
            taggedSectionIds: (requirement.taggedSections || []) as any,
          };
        }
      }

      // Evaluate each proposal
      for (const proposal of proposals) {
        console.log(`Evaluating proposal for ${proposal.vendorName}...`);
        
        const proposalAnalysis = proposal.extractedData as any;
        
        // Determine which standard to use for this proposal
        let proposalStandardData = null;
        
        if (proposal.standardId) {
          if (requirementStandardData && proposal.standardId === requirementStandardData.id) {
            proposalStandardData = {
              ...requirementStandardData,
              taggedSectionIds: proposal.taggedSections || requirementStandardData.taggedSectionIds,
            };
          } else {
            const proposalStandard = await storage.getStandard(proposal.standardId);
            if (proposalStandard && proposalStandard.isActive === "true") {
              proposalStandardData = {
                id: proposalStandard.id,
                name: proposalStandard.name,
                sections: (proposalStandard.sections || []) as any,
                taggedSectionIds: (proposal.taggedSections || []) as any,
              };
            }
          }
        } else if (requirementStandardData) {
          proposalStandardData = requirementStandardData;
        }
        
        const { evaluation, diagnostics } = await evaluateProposal(
          requirementAnalysis, 
          proposalAnalysis,
          proposalStandardData || undefined
        );

        await storage.createEvaluation({
          projectId,
          proposalId: proposal.id,
          overallScore: evaluation.overallScore,
          technicalFit: evaluation.technicalFit,
          deliveryRisk: evaluation.deliveryRisk,
          cost: evaluation.cost,
          compliance: evaluation.compliance,
          status: evaluation.status,
          aiRationale: evaluation.rationale,
          roleInsights: evaluation.roleInsights,
          detailedScores: evaluation.detailedScores,
          sectionCompliance: evaluation.sectionCompliance || null,
          agentDiagnostics: diagnostics || null,
        });

        console.log(`✓ Completed evaluation for ${proposal.vendorName}`);
      }

      // Update project status to completed
      await storage.updateProjectStatus(projectId, "completed");
      console.log(`✓ Project evaluation completed, status updated to completed`);

    } catch (error) {
      console.error(`Error in triggerProjectEvaluation:`, error);
      throw error;
    }
  }

  // Upload vendor responses (ZIP file with vendor folders)
  app.post("/api/generated-rfts/:id/upload-vendor-responses", upload.single("file"), async (req, res) => {
    try {
      const { id } = req.params;
      
      const rft = await storage.getGeneratedRft(id);
      if (!rft) {
        return res.status(404).json({ error: "RFT not found" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Import adm-zip for extraction
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(req.file.buffer);
      const zipEntries = zip.getEntries();

      // Extract vendor structure from ZIP
      // Expected structure: VendorName/questionnaire.xlsx
      const vendorFiles: Map<string, { files: any[] }> = new Map();

      for (const entry of zipEntries) {
        if (entry.isDirectory || entry.entryName.startsWith("__MACOSX")) continue;
        
        const parts = entry.entryName.split("/");
        if (parts.length < 2) continue; // Skip root files
        
        const vendorName = parts[0];
        
        if (!vendorFiles.has(vendorName)) {
          vendorFiles.set(vendorName, { files: [] });
        }
        
        vendorFiles.get(vendorName)!.files.push({
          name: parts[parts.length - 1],
          data: entry.getData(),
          path: entry.entryName,
        });
      }

      if (vendorFiles.size === 0) {
        return res.status(400).json({ error: "No vendor folders found in ZIP" });
      }

      // Upload files to Azure Blob Storage and create proposals
      const { azureBlobStorageService } = await import("./services/azureBlobStorage");
      let uploadedVendorCount = 0;
      const failedUploads: string[] = [];

      for (const [vendorName, { files }] of Array.from(vendorFiles.entries())) {
        let vendorHasSuccessfulUpload = false;
        
        for (const file of files) {
          try {
            // Upload to Azure Blob Storage with project-scoped path
            const blobPath = `project-${rft.projectId}/RFT_Responses/${vendorName}/${file.name}`;
            const uploadResult = await azureBlobStorageService.uploadDocument(
              blobPath,
              file.data
            );

            // Determine document type from file extension
            const documentType = file.name.toLowerCase().includes('product') ? 'product' :
                                 file.name.toLowerCase().includes('nfr') ? 'nfr' :
                                 file.name.toLowerCase().includes('cyber') ? 'cybersecurity' :
                                 file.name.toLowerCase().includes('agile') ? 'agile' : 'other';

            // Create a proposal record for this vendor file
            await storage.createProposal({
              projectId: rft.projectId,
              vendorName,
              documentType,
              fileName: file.name,
              blobUrl: uploadResult.blobUrl,
            });
            
            vendorHasSuccessfulUpload = true;
          } catch (uploadError) {
            console.error(`Failed to upload ${file.name} for ${vendorName}:`, uploadError);
            failedUploads.push(`${vendorName}/${file.name}`);
            // Continue with other files even if one fails
          }
        }
        
        if (vendorHasSuccessfulUpload) {
          uploadedVendorCount++;
        }
      }

      // After successful upload, update project status and trigger evaluation
      if (uploadedVendorCount > 0) {
        try {
          // Update project status to eval_in_progress
          await storage.updateProjectStatus(rft.projectId, "eval_in_progress");
          console.log(`✓ Project status updated to eval_in_progress`);

          // Trigger evaluation process in the background
          // We don't await this to return response quickly
          triggerProjectEvaluation(rft.projectId, rft).catch(error => {
            console.error("Error in background evaluation:", error);
          });

          console.log(`✓ Evaluation process triggered for project ${rft.projectId}`);
        } catch (statusError) {
          console.error("Error updating status or triggering evaluation:", statusError);
          // Don't fail the upload if status update fails
        }
      }

      res.json({
        success: true,
        vendorCount: uploadedVendorCount,
        failedUploads,
        message: `Successfully uploaded responses for ${uploadedVendorCount} vendor(s). Evaluation started.`,
      });

    } catch (error) {
      console.error("Error uploading vendor responses:", error);
      res.status(500).json({ error: "Failed to upload vendor responses" });
    }
  });

  // Seed sample RFT for demonstration
  app.post("/api/seed-sample-rft", async (req, res) => {
    try {
      // Get first portfolio
      const portfolios = await storage.getAllPortfolios();
      if (portfolios.length === 0) {
        return res.status(400).json({ error: "No portfolios found. Please seed portfolios first." });
      }
      const portfolioId = portfolios[0].id;

      // Create a test project
      const project = await storage.createProject({
        portfolioId,
        name: "Sample Cloud Infrastructure Modernization",
        status: "rft_generated",
      });

      // Create a business case
      const businessCase = await storage.createBusinessCase({
        portfolioId,
        name: "Cloud Modernization Business Case",
        fileName: "business_case.txt",
        status: "generated",
        documentContent: `# Executive Summary\n\nThis business case outlines the strategic initiative to modernize our legacy infrastructure by migrating to cloud-native technologies.\n\n## Business Objectives\n\n- Reduce operational costs by 40%\n- Improve system reliability and uptime to 99.99%\n- Enable rapid scaling for seasonal demand`,
      });

      // Create generated RFT with markdown examples
      const generatedRft = await storage.createGeneratedRft({
        projectId: project.id,
        businessCaseId: businessCase.id,
        name: "Cloud Infrastructure Modernization RFT",
        templateId: "default-template",
        status: "draft",
        sections: {
          sections: [
            {
              id: "1",
              title: "Executive Summary",
              content: "This Request for Technology (RFT) seeks proposals from qualified vendors to support our cloud infrastructure modernization initiative. We are looking for a comprehensive solution that includes **migration strategy**, *security implementation*, and ongoing support.",
            },
            {
              id: "2",
              title: "Project Overview",
              content: "**Objective**: Modernize legacy infrastructure through cloud migration\n\n**Timeline**: 12-month implementation\n\n**Budget**: $2M - $3M\n\n### Key Deliverables\n\n- Complete infrastructure assessment\n- Migration roadmap and strategy\n- Implementation and deployment\n- Training and knowledge transfer",
            },
            {
              id: "3",
              title: "Technical Requirements",
              content: "## Infrastructure Requirements\n\n- Multi-region deployment capability\n- Auto-scaling and load balancing\n- Database migration tools and services\n- Monitoring and observability platform\n\n## Security Requirements\n\n1. ISO 27001 certification\n2. SOC 2 Type II compliance\n3. Encryption at rest and in transit\n4. Identity and access management (IAM)\n\n## Performance Requirements\n\n| Metric | Target | Measurement |\n|--------|--------|-------------|\n| Uptime | 99.99% | Monthly |\n| Response Time | < 1s | p95 |\n| Throughput | 10k req/s | Peak load |",
            },
          ],
        },
      });

      res.json({
        success: true,
        message: "Sample RFT created successfully",
        rft: generatedRft,
      });
    } catch (error) {
      console.error("Error creating sample RFT:", error);
      res.status(500).json({ error: "Failed to create sample RFT" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
