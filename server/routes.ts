import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseDocument } from "./services/documentParser";
import { analyzeRequirements, analyzeProposal, evaluateProposal } from "./services/aiAnalysis";
import { seedSampleData, seedPortfolios } from "./services/sampleData";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

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
      res.json(connectors);
    } catch (error) {
      console.error("Error fetching MCP connectors:", error);
      res.status(500).json({ error: "Failed to fetch MCP connectors" });
    }
  });

  app.get("/api/mcp-connectors/active", async (req, res) => {
    try {
      const connectors = await storage.getActiveMcpConnectors();
      res.json(connectors);
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
      res.json(connector);
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
      res.json(connector);
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
      res.json(updated);
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
        if (standard && standard.status === "active") {
          requirementStandardData = {
            id: standard.id,
            name: standard.name,
            sections: standard.sections || [],
            taggedSectionIds: requirement.taggedSections || [],
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
            if (proposalStandard && proposalStandard.status === "active") {
              proposalStandardData = {
                id: proposalStandard.id,
                name: proposalStandard.name,
                sections: proposalStandard.sections || [],
                taggedSectionIds: proposal.taggedSections || [],
              };
            }
          }
        } else if (requirementStandardData) {
          // Fall back to requirement standard
          proposalStandardData = requirementStandardData;
        }
        
        const evaluation = await evaluateProposal(
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

  const httpServer = createServer(app);

  return httpServer;
}
