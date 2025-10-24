import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parseDocument } from "./services/documentParser";
import { analyzeRequirements, analyzeProposal, evaluateProposal } from "./services/aiAnalysis";
import { seedSampleData, seedDepartments } from "./services/sampleData";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed departments endpoint
  app.post("/api/seed-departments", async (req, res) => {
    try {
      const departments = await seedDepartments();
      res.json({ departments, message: "Departments seeded successfully" });
    } catch (error) {
      console.error("Error seeding departments:", error);
      res.status(500).json({ error: "Failed to seed departments" });
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

  // Get all departments
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  // Get department by ID
  app.get("/api/departments/:id", async (req, res) => {
    try {
      const department = await storage.getDepartment(req.params.id);
      if (!department) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  // Get projects by department
  app.get("/api/departments/:id/projects", async (req, res) => {
    try {
      const projects = await storage.getProjectsByDepartment(req.params.id);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching department projects:", error);
      res.status(500).json({ error: "Failed to fetch department projects" });
    }
  });

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const { departmentId, name, initiativeName, vendorList } = req.body;
      const project = await storage.createProject({
        departmentId,
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

      // Evaluate each proposal
      const evaluations = [];
      for (const proposal of proposals) {
        const proposalAnalysis = proposal.extractedData as any;
        
        const evaluation = await evaluateProposal(requirementAnalysis, proposalAnalysis);

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
