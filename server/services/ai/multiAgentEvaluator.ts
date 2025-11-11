import type { RequirementAnalysis, ProposalAnalysis, VendorEvaluation, VendorContext } from "./aiAnalysis";
import { getOpenAIClient } from "./aiAnalysis";
import { ragRetrievalService } from "./ragRetrieval";
import { mcpConnectorService, type ConnectorError } from "./mcpConnectorService";
import { evaluationProgressService } from "./evaluationProgress";
import { agentMetricsService } from "./agentMetrics";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ES module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Agent role types
type AgentRole = "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security";

// Load agent prompts from MD files
function loadAgentPrompt(role: AgentRole): { system: string; userTemplate: string } {
  const promptPath = join(__dirname, "../prompts", `${role}-agent.md`);
  const content = readFileSync(promptPath, "utf-8");
  
  // Split by markdown headers
  const systemMatch = content.match(/## System Prompt\s+([\s\S]*?)(?=\n## )/);
  const userMatch = content.match(/## User Template\s+([\s\S]*?)$/);
  
  if (!systemMatch || !userMatch) {
    throw new Error(`Invalid prompt file format for ${role}-agent.md`);
  }
  
  return {
    system: systemMatch[1].trim(),
    userTemplate: userMatch[1].trim()
  };
}

// Load all agent prompts at startup
const AGENT_PROMPTS: Record<AgentRole, { system: string; userTemplate: string }> = {
  delivery: loadAgentPrompt("delivery"),
  product: loadAgentPrompt("product"),
  architecture: loadAgentPrompt("architecture"),
  engineering: loadAgentPrompt("engineering"),
  procurement: loadAgentPrompt("procurement"),
  security: loadAgentPrompt("security")
};

// Fallback insights when agent fails
function getFallbackInsights(role: AgentRole): string[] {
  const fallbacks: Record<AgentRole, string[]> = {
    delivery: [
      "Timeline and resource assessment requires manual review",
      "Risk analysis pending - recommend scheduling follow-up evaluation",
      "Dependencies and milestones need stakeholder validation",
      "Delivery approach should be verified against similar past projects"
    ],
    product: [
      "Product requirements coverage needs detailed mapping",
      "Feature parity analysis requires domain expert review",
      "User experience impact should be validated with stakeholders",
      "Product roadmap alignment requires business owner input"
    ],
    architecture: [
      "Architecture patterns require technical deep-dive review",
      "Integration approach needs enterprise architect validation",
      "Scalability and security posture require dedicated assessment",
      "Technical debt and migration path need detailed planning"
    ],
    engineering: [
      "API and SDK quality require hands-on technical evaluation",
      "Documentation completeness needs engineering team review",
      "Developer experience should be validated through POC",
      "Technical support model requires further investigation"
    ],
    procurement: [
      "TCO analysis requires detailed cost breakdown and validation",
      "Contract terms and SLAs need legal and procurement review",
      "Pricing model should be compared against market benchmarks",
      "Commercial risk assessment requires stakeholder input"
    ],
    security: [
      "Security and compliance posture requires detailed audit",
      "Data protection mechanisms need security team validation",
      "Certification and standards compliance requires verification",
      "Risk assessment and remediation plan need expert review"
    ]
  };
  
  return fallbacks[role];
}

// Agent result interface
interface AgentResult {
  role: AgentRole;
  insights: string[];
  scores: {
    overall: number;
    functionalFit?: number;
    technicalFit?: number;
    deliveryRisk?: number;
    compliance?: number;
    integration?: number;
    support?: number;
    scalability?: number;
    documentation?: number;
  };
  rationale: string;
  status: "recommended" | "under-review" | "risk-flagged";
  executionTime: number;
  tokenUsage: number;
  succeeded: boolean; // Track if agent completed successfully
}

// Agent diagnostics
interface AgentDiagnostics {
  role: AgentRole;
  executionTime: number;
  tokenUsage: number;
  status: "success" | "failed" | "timeout";
  error?: string;
}


// Context summarizer to reduce token usage
async function summarizeContext(requirements: RequirementAnalysis, proposal: ProposalAnalysis): Promise<string> {
  const summary = `
PROJECT: ${requirements.scope}
KEY REQUIREMENTS: ${requirements.technicalRequirements.slice(0, 5).join(", ")}
VENDOR: ${proposal.vendorName}
KEY CAPABILITIES: ${proposal.capabilities.slice(0, 5).join(", ")}
APPROACH: ${proposal.technicalApproach.substring(0, 200)}
`;
  return summary.trim();
}

// Execute a single agent with timeout and retry
async function executeAgent(
  role: AgentRole,
  requirements: RequirementAnalysis,
  proposal: ProposalAnalysis,
  standardData?: StandardData,
  ragContext?: string,
  mcpContext?: string,
  vendorContext?: VendorContext,
  timeout: number = 30000
): Promise<AgentResult> {
  const startTime = Date.now();
  
  // Emit progress: agent starting
  if (vendorContext) {
    const roleLabels: Record<AgentRole, string> = {
      delivery: "Delivery Manager",
      product: "Product Manager",
      architecture: "Solution Architect",
      engineering: "Engineering Lead",
      procurement: "Procurement",
      security: "Cybersecurity"
    };
    
    evaluationProgressService.emitProgress({
      projectId: vendorContext.projectId,
      vendorName: vendorContext.vendorName,
      vendorIndex: vendorContext.vendorIndex,
      totalVendors: vendorContext.totalVendors,
      agentRole: roleLabels[role],
      agentStatus: 'in_progress',
      timestamp: Date.now(),
    });
  }
  
  const prompt = AGENT_PROMPTS[role];
  
  // Build organization standards context
  let standardsContext = '';
  if (standardData && standardData.taggedSectionIds.length > 0) {
    const taggedSections = standardData.sections.filter(s => 
      standardData.taggedSectionIds.includes(s.id)
    );
    
    standardsContext = `

**ORGANIZATION-SPECIFIC COMPLIANCE REQUIREMENTS:**
Standard: ${standardData.name}

You MUST evaluate vendor compliance against these organization-specific sections:
${taggedSections.map(s => `- ${s.name}${s.description ? ': ' + s.description : ''}`).join('\n')}

**IMPORTANT:** Your evaluation must explicitly address how the vendor meets (or fails to meet) EACH of these organization-specific requirements. These are mandatory, not optional.`;
  }

  // Add RAG context if available
  if (ragContext) {
    standardsContext += `\n\n${ragContext}`;
  }

  // Add MCP connector context if available
  if (mcpContext) {
    standardsContext += `\n\n${mcpContext}`;
  }
  
  const userMessage = prompt.userTemplate
    .replace('{requirements}', JSON.stringify(requirements, null, 2))
    .replace('{proposal}', JSON.stringify(proposal, null, 2))
    .replace('{vendorName}', proposal.vendorName) + standardsContext;

  try {
    const client = await getOpenAIClient();
    const response = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: userMessage }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Agent timeout")), timeout)
      )
    ]);

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from agent");
    }

    const result = JSON.parse(content);
    const executionTime = Date.now() - startTime;
    
    // Debug: Log what scores each agent is returning
    console.log(`   📊 ${role} agent scores:`, JSON.stringify(result.scores || {}));

    // Calculate status based on scores if not provided by AI
    let calculatedStatus: "recommended" | "under-review" | "risk-flagged" = "under-review";
    if (!result.status && result.scores) {
      const overall = result.scores.overall || 0;
      const deliveryRisk = result.scores.deliveryRisk || 0;
      const compliance = result.scores.compliance || 0;
      
      // Risk flagged: Low overall score OR high delivery risk OR low compliance
      if (overall < 45 || deliveryRisk > 75 || compliance < 35) {
        calculatedStatus = "risk-flagged";
      }
      // Recommended: High overall score AND acceptable delivery risk
      else if (overall >= 65 && deliveryRisk <= 50) {
        calculatedStatus = "recommended";
      }
      // Otherwise: under-review
      else {
        calculatedStatus = "under-review";
      }
    }

    // Track metrics for successful execution
    const tokenUsage = response.usage?.total_tokens || 0;
    if (vendorContext && vendorContext.evaluationId) {
      await agentMetricsService.trackExecution({
        evaluationId: vendorContext.evaluationId,
        projectId: vendorContext.projectId,
        vendorName: vendorContext.vendorName,
        agentRole: role,
        executionTimeMs: executionTime,
        tokenUsage,
        estimatedCostUsd: agentMetricsService.estimateCost(tokenUsage),
        success: true,
        timestamp: new Date()
      });
    }
    
    // Emit progress: agent completed successfully
    if (vendorContext) {
      const roleLabels: Record<AgentRole, string> = {
        delivery: "Delivery Manager",
        product: "Product Manager",
        architecture: "Solution Architect",
        engineering: "Engineering Lead",
        procurement: "Procurement",
        security: "Cybersecurity"
      };
      
      evaluationProgressService.emitProgress({
        projectId: vendorContext.projectId,
        vendorName: vendorContext.vendorName,
        vendorIndex: vendorContext.vendorIndex,
        totalVendors: vendorContext.totalVendors,
        agentRole: roleLabels[role],
        agentStatus: 'completed',
        timestamp: Date.now(),
      });
    }
    
    return {
      role,
      insights: result.insights || [],
      scores: result.scores || { overall: 0 },
      rationale: result.rationale || "",
      status: result.status || calculatedStatus,
      executionTime,
      tokenUsage,
      succeeded: true,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error && error.message.includes('timeout') ? 'timeout' : 'execution_error';
    
    console.error(`Agent ${role} failed:`, error);
    
    // Track metrics for failed execution
    if (vendorContext) {
      await agentMetricsService.trackExecution({
        evaluationId: `${vendorContext.projectId}-${vendorContext.vendorName}`,
        projectId: vendorContext.projectId,
        vendorName: vendorContext.vendorName,
        agentRole: role,
        executionTimeMs: executionTime,
        tokenUsage: 0,
        estimatedCostUsd: 0,
        success: false,
        errorType,
        errorMessage,
        timestamp: new Date()
      });
    }
    
    // Emit progress: agent failed
    if (vendorContext) {
      const roleLabels: Record<AgentRole, string> = {
        delivery: "Delivery Manager",
        product: "Product Manager",
        architecture: "Solution Architect",
        engineering: "Engineering Lead",
        procurement: "Procurement",
        security: "Cybersecurity"
      };
      
      evaluationProgressService.emitProgress({
        projectId: vendorContext.projectId,
        vendorName: vendorContext.vendorName,
        vendorIndex: vendorContext.vendorIndex,
        totalVendors: vendorContext.totalVendors,
        agentRole: roleLabels[role],
        agentStatus: 'failed',
        timestamp: Date.now(),
      });
    }
    
    // Return fallback result with succeeded=false
    const fallbackInsights = getFallbackInsights(role);
    return {
      role,
      insights: fallbackInsights,
      scores: { overall: 0 },
      rationale: `Evaluation incomplete for ${role} perspective`,
      status: "under-review",
      executionTime,
      tokenUsage: 0,
      succeeded: false,
    };
  }
}

// Aggregate results from all agents
function aggregateResults(
  agentResults: AgentResult[],
  proposal: ProposalAnalysis
): VendorEvaluation {
  // Only include successful agents in scoring calculations
  const successfulAgents = agentResults.filter(r => r.succeeded);
  
  // Helper function to calculate average only from agents that provided the score
  const calculateAverage = (scoreKey: keyof AgentResult['scores']): number => {
    const agentsWithScore = successfulAgents.filter(r => r.scores[scoreKey] !== undefined && r.scores[scoreKey] !== null);
    if (agentsWithScore.length === 0) return 0;
    const sum = agentsWithScore.reduce((acc, r) => acc + (r.scores[scoreKey] || 0), 0);
    return Math.round(sum / agentsWithScore.length);
  };
  
  // Calculate average scores (only from agents that provide each specific score)
  const avgOverall = calculateAverage('overall');
  const avgFunctionalFit = calculateAverage('functionalFit');
  const avgTechnicalFit = calculateAverage('technicalFit');
  const avgDeliveryRisk = calculateAverage('deliveryRisk');
  const avgCompliance = calculateAverage('compliance');
  
  // Debug: Log functionalFit aggregation details
  const functionalFitAgents = successfulAgents.filter(r => r.scores.functionalFit !== undefined && r.scores.functionalFit !== null);
  console.log(`   🔢 FunctionalFit aggregation: ${functionalFitAgents.length} agents provided scores:`, 
    functionalFitAgents.map(a => `${a.role}=${a.scores.functionalFit}`).join(', '));
  console.log(`   📈 Average FunctionalFit: ${avgFunctionalFit}`);

  // Build role insights object
  const roleInsights: VendorEvaluation["roleInsights"] = {
    delivery: agentResults.find(r => r.role === "delivery")?.insights || [],
    product: agentResults.find(r => r.role === "product")?.insights || [],
    architecture: agentResults.find(r => r.role === "architecture")?.insights || [],
    engineering: agentResults.find(r => r.role === "engineering")?.insights || [],
    procurement: agentResults.find(r => r.role === "procurement")?.insights || [],
    security: agentResults.find(r => r.role === "security")?.insights || [],
  };

  // Aggregate detailed scores (using same approach - only count agents that provide each score)
  const detailedScores = {
    integration: calculateAverage('integration'),
    support: calculateAverage('support'),
    scalability: calculateAverage('scalability'),
    documentation: calculateAverage('documentation'),
  };

  // Determine overall status based on consensus
  const statusCounts = {
    recommended: agentResults.filter(r => r.status === "recommended").length,
    "under-review": agentResults.filter(r => r.status === "under-review").length,
    "risk-flagged": agentResults.filter(r => r.status === "risk-flagged").length,
  };
  
  const status: "recommended" | "under-review" | "risk-flagged" = 
    statusCounts["risk-flagged"] > 2 ? "risk-flagged" :
    statusCounts.recommended > 3 ? "recommended" : "under-review";

  // Aggregate rationales (only from successful agents)
  const rationale = successfulAgents
    .filter(r => r.rationale)
    .map(r => `${r.role.charAt(0).toUpperCase() + r.role.slice(1)}: ${r.rationale}`)
    .join(" ");
  
  // Add partial evaluation notice if some agents failed
  const failedCount = agentResults.length - successfulAgents.length;
  const evaluationNote = failedCount > 0 
    ? ` (Note: ${failedCount} of 6 agent evaluations incomplete - review role-specific insights for details)`
    : "";

  const evaluationResult = {
    overallScore: avgOverall,
    functionalFit: avgFunctionalFit,
    technicalFit: avgTechnicalFit,
    deliveryRisk: avgDeliveryRisk,
    cost: proposal.costStructure || "Not specified",
    compliance: avgCompliance,
    status,
    rationale: (rationale || "Multi-agent evaluation completed") + evaluationNote,
    roleInsights,
    detailedScores,
  };
  
  // Debug: Log the final evaluation result
  console.log(`   ✅ Evaluation result:`, JSON.stringify({
    overallScore: evaluationResult.overallScore,
    functionalFit: evaluationResult.functionalFit,
    technicalFit: evaluationResult.technicalFit,
    deliveryRisk: evaluationResult.deliveryRisk,
    compliance: evaluationResult.compliance,
    status: evaluationResult.status
  }));
  
  return evaluationResult;
}

// Standard data interface
interface StandardData {
  name: string;
  sections: Array<{ id: string; name: string; description?: string }>;
  taggedSectionIds: string[];
}

// Main multiagent evaluator function
export async function evaluateProposalMultiAgent(
  requirements: RequirementAnalysis,
  proposal: ProposalAnalysis,
  standardData?: StandardData,
  vendorContext?: VendorContext
): Promise<{ evaluation: VendorEvaluation; diagnostics: AgentDiagnostics[] }> {
  console.log(`🤖 Starting multiagent evaluation for ${proposal.vendorName}...`);
  
  // Emit initial progress for all agents (pending status)
  if (vendorContext) {
    const roles: AgentRole[] = ["delivery", "product", "architecture", "engineering", "procurement", "security"];
    const roleLabels = {
      delivery: "Delivery Manager",
      product: "Product Manager",
      architecture: "Solution Architect",
      engineering: "Engineering Lead",
      procurement: "Procurement",
      security: "Cybersecurity"
    };
    
    for (const role of roles) {
      evaluationProgressService.emitProgress({
        projectId: vendorContext.projectId,
        vendorName: vendorContext.vendorName,
        vendorIndex: vendorContext.vendorIndex,
        totalVendors: vendorContext.totalVendors,
        agentRole: roleLabels[role],
        agentStatus: 'pending',
        timestamp: Date.now(),
      });
    }
  }
  
  if (standardData) {
    console.log(`   📋 Organization standards: ${standardData.name} (${standardData.taggedSectionIds.length} tagged sections)`);
  }
  
  // Retrieve relevant compliance documents from RAG system
  let ragContext: string | undefined;
  try {
    const isRAGConfigured = await ragRetrievalService.isConfigured();
    if (isRAGConfigured) {
      console.log(`   🔍 Retrieving relevant compliance documents from RAG system...`);
      
      // Build retrieval query from requirements (with defensive check)
      const techReqs = requirements.technicalRequirements || [];
      if (techReqs.length === 0) {
        console.log(`   ⚠️  No technical requirements found, skipping RAG retrieval`);
      } else {
        const retrievalQueries = techReqs.slice(0, 5);
        const ragContextData = await ragRetrievalService.retrieveComplianceStandards(
          retrievalQueries,
          { topKPerRequirement: 2 }
        );
        
        ragContext = ragRetrievalService.formatForAIContext(ragContextData);
        console.log(`   ✅ Retrieved ${ragContextData.chunks.length} relevant document sections`);
      }
    } else {
      console.log(`   ⚠️  RAG system not configured, proceeding without document retrieval`);
    }
  } catch (error) {
    console.error(`   ❌ RAG retrieval failed, proceeding without it:`, error);
  }
  
  // Retrieve external data from MCP connectors
  const mcpContextByRole: Map<AgentRole, string> = new Map();
  const mcpErrors: ConnectorError[] = [];
  
  try {
    console.log(`   🔌 Retrieving external intelligence from MCP connectors...`);
    
    const evaluationContext = {
      projectName: requirements.scope,
      vendorName: proposal.vendorName,
      requirements: requirements.technicalRequirements,
      proposalSummary: proposal.technicalApproach,
    };
    
    const roles: AgentRole[] = ["delivery", "product", "architecture", "engineering", "procurement", "security"];
    
    // Fetch MCP data for all roles in parallel
    const mcpResults = await Promise.allSettled(
      roles.map(role => mcpConnectorService.fetchAllConnectorDataForRole(role, evaluationContext))
    );
    
    mcpResults.forEach((result, index) => {
      const role = roles[index];
      if (result.status === "fulfilled") {
        const { payload, diagnostics } = result.value;
        if (payload) {
          mcpContextByRole.set(role, payload);
        }
        mcpErrors.push(...diagnostics);
      }
    });
    
    const activeConnectorsCount = Array.from(mcpContextByRole.values()).filter(p => p.length > 0).length;
    if (activeConnectorsCount > 0) {
      console.log(`   ✅ Retrieved external data for ${activeConnectorsCount} agent roles`);
    } else {
      console.log(`   ⚠️  No active MCP connectors found or no data retrieved`);
    }
    
    if (mcpErrors.length > 0) {
      console.warn(`   ⚠️  ${mcpErrors.length} MCP connector errors occurred (non-blocking)`);
    }
  } catch (error) {
    console.error(`   ❌ MCP connector retrieval failed, proceeding without it:`, error);
  }
  
  const roles: AgentRole[] = ["delivery", "product", "architecture", "engineering", "procurement", "security"];
  
  try {
    // Execute all agents in parallel with allSettled for resilience
    const agentPromises = roles.map(role => 
      executeAgent(role, requirements, proposal, standardData, ragContext, mcpContextByRole.get(role), vendorContext)
    );
    const settledResults = await Promise.allSettled(agentPromises);
    
    // Extract successful results and track failures
    const agentResults: AgentResult[] = [];
    const diagnostics: AgentDiagnostics[] = [];
    
    settledResults.forEach((result, index) => {
      const role = roles[index];
      
      if (result.status === "fulfilled") {
        agentResults.push(result.value);
        diagnostics.push({
          role: result.value.role,
          executionTime: result.value.executionTime,
          tokenUsage: result.value.tokenUsage,
          status: result.value.succeeded ? "success" : "failed",
          error: result.value.succeeded ? undefined : "Agent completed but with errors",
        });
      } else {
        // Agent promise rejected - create informative fallback result
        console.error(`Agent ${role} failed with error:`, result.reason);
        
        // Generate role-specific fallback insights instead of error message
        const fallbackInsights = getFallbackInsights(role);
        
        agentResults.push({
          role,
          insights: fallbackInsights,
          scores: { overall: 0 }, // Zero score for failed agents (won't affect average)
          rationale: `Evaluation incomplete for ${role} perspective`,
          status: "under-review",
          executionTime: 0,
          tokenUsage: 0,
          succeeded: false,
        });
        diagnostics.push({
          role,
          executionTime: 0,
          tokenUsage: 0,
          status: "failed",
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        });
      }
    });
    
    // Log execution summary
    const totalTime = Math.max(...agentResults.map(r => r.executionTime), 0);
    const totalTokens = agentResults.reduce((sum, r) => sum + r.tokenUsage, 0);
    const failedAgents = diagnostics.filter(d => d.status === "failed").length;
    const successfulAgents = 6 - failedAgents;
    
    console.log(`✅ Multiagent evaluation complete in ${totalTime}ms`);
    console.log(`   Successful agents: ${successfulAgents}/6`);
    console.log(`   Failed agents: ${failedAgents}/6`);
    console.log(`   Tokens used: ${totalTokens}`);
    
    // Aggregate results from all agents (including partial failures)
    const evaluation = aggregateResults(agentResults, proposal);
    
    return { evaluation, diagnostics };
  } catch (error) {
    console.error("❌ Multiagent evaluation failed catastrophically:", error);
    throw error;
  }
}
