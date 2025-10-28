import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseDocument } from "./services/documentParser";
import { analyzeRequirements, analyzeProposal, evaluateProposal } from "./services/aiAnalysis";
import { seedSampleData, seedPortfolios, seedAllMockData, wipeAllData } from "./services/sampleData";
import { lookup as dnsLookup } from "dns";
import { promisify } from "util";

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
      const result = await lookupAsync(hostname, { all: true });
      const addresses = Array.isArray(result) ? result.map(r => r.address) : [result.address];
      
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
      const { name, description, sections } = req.body;
      const standard = await storage.createStandard({
        name,
        description,
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
      const { name, description, tags, url } = req.body;
      
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
      const { name, description, sections } = req.body;
      await storage.updateStandard(req.params.id, {
        name,
        description,
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
      const { name, description, serverUrl, apiKey, config } = req.body;
      const connector = await storage.createMcpConnector({
        name,
        description,
        serverUrl,
        apiKey,
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
      const { name, description, serverUrl, apiKey, config, isActive } = req.body;
      await storage.updateMcpConnector(req.params.id, {
        name,
        description,
        serverUrl,
        apiKey,
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

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const { portfolioId, name, initiativeName, vendorList } = req.body;
      const project = await storage.createProject({
        portfolioId,
        name,
        initiativeName,
        vendorList,
        status: "analyzing",
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

      const proposals = [];
      for (const file of files) {
        const parsed = await parseDocument(file.buffer, file.originalname);
        const analysis = await analyzeProposal(parsed.text, file.originalname);

        const proposal = await storage.createProposal({
          projectId,
          vendorName,
          documentType,
          fileName: file.originalname,
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

  // Get evaluations for a project
  app.get("/api/projects/:id/evaluations", async (req, res) => {
    try {
      const projectId = req.params.id;
      const evaluations = await storage.getEvaluationsByProject(projectId);
      const proposals = await storage.getProposalsByProject(projectId);

      // Enrich evaluations with vendor names
      const enrichedEvaluations = evaluations.map((evaluation) => {
        const proposal = proposals.find((p) => p.id === evaluation.proposalId);
        return {
          ...evaluation,
          vendorName: proposal?.vendorName || "Unknown Vendor",
        };
      });

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
      
      await storage.updateEvaluationCriteria(id, { score, scoreLabel });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating evaluation criteria:", error);
      res.status(500).json({ error: "Failed to update evaluation criteria" });
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

  const httpServer = createServer(app);

  return httpServer;
}
