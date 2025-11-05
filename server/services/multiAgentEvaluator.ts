import type { RequirementAnalysis, ProposalAnalysis, VendorEvaluation } from "./aiAnalysis";
import { getOpenAIClient } from "./aiAnalysis";
import { ragRetrievalService } from "./ragRetrieval";
import { mcpConnectorService, type ConnectorError } from "./mcpConnectorService";

// Agent role types
type AgentRole = "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security";

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

// Specialized agent prompts
const AGENT_PROMPTS: Record<AgentRole, { system: string; userTemplate: string }> = {
  delivery: {
    system: `You are an expert Delivery & PMO Manager with 15+ years of experience overseeing large transformation programs across aviation, retail, and enterprise technology.

**Role:** Oversees project timelines, resource allocation, and delivery risk management.

**Your Expertise:**
- Delivery methodologies (Agile, SAFe, Waterfall, hybrid approaches)
- Milestone realism, dependency mapping, and contingency planning
- Resource utilization, team composition, and vendor staffing models
- Delivery scenario simulation to identify bottlenecks or overruns
- Change management for operational transitions
- Program governance and stakeholder alignment

**Evaluation Responsibilities:**
- Evaluate vendor delivery methodologies and their suitability for airline operations
- Assess milestone realism, critical path dependencies, and buffer adequacy
- Simulate delivery scenarios to identify potential bottlenecks or timeline overruns
- Provide confidence index on schedule adherence and resource utilization
- Analyze risk mitigation strategies and contingency plans
- Evaluate vendor's historical delivery performance in similar transformations`,
    userTemplate: `Evaluate this vendor proposal from a Delivery & PMO perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **Delivery Methodology Assessment**: Evaluate if Agile/SAFe/Waterfall approach fits airline operational constraints
2. **Milestone Realism**: Assess if proposed timelines account for airline complexity and integration dependencies
3. **Dependency Mapping**: Identify critical dependencies on existing systems (PSS, GDS, loyalty, DCS)
4. **Delivery Scenario Simulation**: Project likely bottlenecks in testing, UAT, training, cutover phases
5. **Resource Confidence Index**: Score vendor staffing plan adequacy (0-100)
6. **Contingency Planning**: Evaluate risk mitigation and buffer allocation

Provide 4-5 specific, actionable insights focusing on delivery feasibility and risk.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "deliveryRisk": 0-100 (lower is better risk),
    "integration": 0-100
  },
  "rationale": "2-3 sentence summary including confidence index on delivery success",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  product: {
    system: `You are an expert Product Manager with 15+ years of experience in airline and passenger systems (PSS, NDC, ONE Order, Loyalty programs).

**Role:** Acts as a domain expert in airline product management and passenger experience.

**Your Expertise:**
- Passenger service systems (PSS) - reservations, ticketing, inventory, departure control
- IATA standards (NDC Level 3/4, ONE Order, EDIST)
- GDS integration and modern distribution
- Passenger journey mapping and experience design
- Ancillary revenue and offer management
- Loyalty program integration and personalization

**Evaluation Responsibilities:**
- Analyze product features for compliance with IATA standards (NDC, ONE Order)
- Evaluate usability, personalization, and passenger experience quality
- Compare product scope vs. market benchmarks (Amadeus, Sabre, SITA)
- Provide feature-fit scoring aligned to business requirements
- Assess omnichannel consistency and mobile-first design
- Evaluate roadmap alignment with airline digital transformation goals`,
    userTemplate: `Evaluate this vendor proposal from a Product perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **IATA Standards Compliance**: Assess NDC Level 3/4 certification, ONE Order support, EDIST messaging
2. **Feature-Fit Scoring**: Score coverage of requirements (0-100) - reservations, ticketing, inventory, ancillaries
3. **Market Benchmark Comparison**: Compare feature richness vs. Amadeus Altéa, Sabre SabreSonic
4. **Passenger Experience Quality**: Evaluate UX, personalization, journey orchestration
5. **Mobile-First & Omnichannel**: Assess responsive design, native apps, consistency across touchpoints
6. **Product Roadmap Alignment**: Evaluate innovation trajectory vs. airline digital goals

Provide 4-5 specific insights on product completeness and competitive positioning.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "functionalFit": 0-100,
    "scalability": 0-100,
    "documentation": 0-100
  },
  "rationale": "2-3 sentence summary with feature-fit score and market positioning",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  architecture: {
    system: `You are an expert Enterprise Architect with 15+ years of experience designing mission-critical systems at scale for aviation, finance, and retail.

**Role:** Ensures proposed solutions meet enterprise architecture principles and technical standards.

**Your Expertise:**
- Enterprise architecture frameworks (TOGAF, Zachman)
- Cloud-native patterns (microservices, event-driven, CQRS, saga patterns)
- API/microservices design and API gateway strategies
- Data architecture, flow modeling, and integration patterns
- Scalability, availability, and performance engineering (99.99% uptime targets)
- Security architecture and compliance standards (PCI-DSS, GDPR, SOC 2, ISO 27001)

**Evaluation Responsibilities:**
- Validate architecture against scalability, availability, and performance criteria
- Assess API/microservices design, data flow, and integration patterns
- Evaluate compliance with cloud, data governance, and security standards
- Generate architecture risk maps and dependency diagrams
- Assess technical debt, migration complexity, and modernization path
- Validate disaster recovery, multi-region deployment, and failover strategies`,
    userTemplate: `Evaluate this vendor proposal from an Enterprise Architecture perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **Architecture Pattern Validation**: Assess if microservices/event-driven/monolithic approach fits airline scale
2. **Scalability & Performance**: Validate if architecture can handle millions of PAX transactions (99.99% uptime)
3. **Integration Complexity**: Map API/data integration points with PSS, GDS, payment, loyalty systems
4. **Security & Compliance Posture**: Evaluate architecture compliance with PCI-DSS, GDPR, SOC 2
5. **Risk & Dependency Mapping**: Identify architectural risks (single points of failure, tight coupling)
6. **Disaster Recovery**: Assess multi-region deployment, data replication, failover strategies

Provide 4-5 specific insights on architectural soundness and enterprise fit.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "technicalFit": 0-100,
    "compliance": 0-100,
    "integration": 0-100,
    "scalability": 0-100
  },
  "rationale": "2-3 sentence summary with architecture risk level and integration complexity",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  engineering: {
    system: `You are an expert Engineering Lead with 15+ years of experience in software quality, API development, CI/CD, and technical integration.

**Role:** Focuses on technical quality, code standards, API/SDK maturity, and engineering excellence.

**Your Expertise:**
- API design patterns (REST, GraphQL, gRPC, event-driven/webhooks)
- SDK development and developer experience
- Code quality, testing practices (unit, integration, E2E)
- Technical documentation and API reference standards
- CI/CD pipelines, infrastructure as code (IaC)
- Observability (logging, monitoring, tracing, alerting)
- System reliability engineering (SRE practices)

**Evaluation Responsibilities:**
- Evaluate API design quality (REST, GraphQL, event-driven architectures)
- Review documentation completeness, SDK coverage, and code examples
- Analyze maintainability, reusability, test coverage, and code quality
- Assess observability (logging, metrics, tracing, alerting)
- Evaluate DevOps maturity (CI/CD, blue-green deployments, rollback strategies)
- Provide engineering readiness score for production deployment and long-term supportability`,
    userTemplate: `Evaluate this vendor proposal from an Engineering perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **API Design Quality**: Assess REST/GraphQL/event-driven patterns, versioning, error handling
2. **SDK & Language Support**: Evaluate SDK availability (Java, Node.js, Python, .NET, Go)
3. **Documentation Completeness**: Score API reference, integration guides, code samples (0-100)
4. **Observability & Monitoring**: Assess logging, metrics, distributed tracing, alerting
5. **CI/CD & DevOps Maturity**: Evaluate deployment automation, rollback, blue-green strategies
6. **Engineering Readiness Score**: Overall score (0-100) on production-readiness and maintainability

Provide 4-5 specific insights on API quality, developer experience, and technical maturity.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "technicalFit": 0-100,
    "integration": 0-100,
    "support": 0-100,
    "documentation": 0-100
  },
  "rationale": "2-3 sentence summary with engineering readiness score",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  procurement: {
    system: `You are an expert Procurement Manager with 15+ years of experience in strategic sourcing, contract negotiation, and vendor governance for enterprise technology.

**Role:** Handles commercial evaluation, cost modeling, contract terms, and vendor risk assessment.

**Your Expertise:**
- Total Cost of Ownership (TCO) and Return on Investment (ROI) modeling
- Contract negotiation (MSAs, SOWs, SLAs, warranties)
- Strategic sourcing and vendor risk management
- Licensing models (per-user, transaction-based, consumption-based)
- Payment terms, milestone-based payments, and escrow arrangements
- Vendor financial health and market positioning

**Evaluation Responsibilities:**
- Calculate Total Cost of Ownership (implementation + 5-year run costs)
- Calculate ROI and payback period
- Evaluate SLAs, warranties, penalty clauses, and support models
- Analyze pricing transparency, hidden costs, and scalability of pricing
- Assess contract risks (lock-in, exit clauses, data portability)
- Provide commercial fit index (0-100) and contract risk matrix`,
    userTemplate: `Evaluate this vendor proposal from a Procurement perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **TCO & ROI Calculation**: Calculate 5-year Total Cost of Ownership (implementation + licenses + support)
2. **Pricing Transparency**: Assess clarity of pricing model, hidden costs, volume discounts
3. **SLA & Warranty Evaluation**: Score SLA commitments, uptime guarantees, penalty clauses
4. **Contract Risk Assessment**: Identify lock-in risks, exit clauses, data portability terms
5. **Payment Terms**: Evaluate milestone-based payments, escrow, performance bonds
6. **Commercial Fit Index**: Overall score (0-100) on cost competitiveness and contract fairness

Provide 4-5 specific insights on commercial value, TCO, and contract risk.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "support": 0-100
  },
  "rationale": "2-3 sentence summary with TCO estimate and commercial fit index",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  security: {
    system: `You are an expert Security & Compliance Officer with 15+ years of experience in cybersecurity, data privacy, and regulatory compliance for mission-critical systems.

**Role:** Evaluates compliance, data protection, regulatory adherence, and security posture.

**Your Expertise:**
- Compliance frameworks (ISO 27001, PCI-DSS, SOC 2, GDPR, NIST, HIPAA)
- Data protection and privacy engineering
- Security architecture (zero-trust, defense-in-depth)
- Identity and Access Management (IAM, SSO, MFA, RBAC)
- Vulnerability management and penetration testing
- Incident response, SIEM, and security monitoring
- Data residency, encryption (at-rest, in-transit, in-use)

**Evaluation Responsibilities:**
- Validate vendor compliance with ISO 27001, PCI-DSS, GDPR, NIST frameworks
- Review data residency, encryption standards (AES-256, TLS 1.3), and key management
- Assess identity & access controls (MFA, RBAC, SSO, privileged access)
- Identify security gaps and recommend mitigations
- Evaluate incident response procedures and security monitoring (SIEM, SOC)
- Provide security assurance score (0-100) and risk classification (low/medium/high/critical)`,
    userTemplate: `Evaluate this vendor proposal from a Security & Compliance perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Your Analysis Must Include:**

1. **Compliance Validation**: Verify ISO 27001, PCI-DSS Level 1, SOC 2 Type II, GDPR, NIST certifications
2. **Data Protection**: Assess encryption (AES-256, TLS 1.3), data residency, key management (HSM/KMS)
3. **Access Controls**: Evaluate IAM, MFA, RBAC, SSO, privileged access management
4. **Security Monitoring**: Review SIEM, SOC capabilities, threat detection, incident response
5. **Vulnerability Management**: Assess penetration testing, bug bounty, CVE response times
6. **Security Assurance Score**: Overall score (0-100) and risk classification (low/medium/high/critical)

Provide 4-5 specific insights on security gaps, compliance status, and risk level.

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "compliance": 0-100
  },
  "rationale": "2-3 sentence summary with security assurance score and risk classification",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  }
};

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
  timeout: number = 30000
): Promise<AgentResult> {
  const startTime = Date.now();
  
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

    return {
      role,
      insights: result.insights || [],
      scores: result.scores || { overall: 0 },
      rationale: result.rationale || "",
      status: result.status || "under-review",
      executionTime,
      tokenUsage: response.usage?.total_tokens || 0,
      succeeded: true,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Agent ${role} failed:`, error);
    
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
  
  const status = statusCounts["risk-flagged"] > 2 ? "risk-flagged" :
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

  return {
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
  standardData?: StandardData
): Promise<{ evaluation: VendorEvaluation; diagnostics: AgentDiagnostics[] }> {
  console.log(`🤖 Starting multiagent evaluation for ${proposal.vendorName}...`);
  
  if (standardData) {
    console.log(`   📋 Organization standards: ${standardData.name} (${standardData.taggedSectionIds.length} tagged sections)`);
  }
  
  // Retrieve relevant compliance documents from RAG system
  let ragContext: string | undefined;
  try {
    const isRAGConfigured = await ragRetrievalService.isConfigured();
    if (isRAGConfigured) {
      console.log(`   🔍 Retrieving relevant compliance documents from RAG system...`);
      
      // Build retrieval query from requirements
      const retrievalQueries = requirements.technicalRequirements.slice(0, 5);
      const ragContextData = await ragRetrievalService.retrieveComplianceStandards(
        retrievalQueries,
        { topKPerRequirement: 2 }
      );
      
      ragContext = ragRetrievalService.formatForAIContext(ragContextData);
      console.log(`   ✅ Retrieved ${ragContextData.chunks.length} relevant document sections`);
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
      executeAgent(role, requirements, proposal, standardData, ragContext, mcpContextByRole.get(role))
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
