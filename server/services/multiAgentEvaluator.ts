import OpenAI from "openai";
import type { RequirementAnalysis, ProposalAnalysis, VendorEvaluation } from "./aiAnalysis";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Agent role types
type AgentRole = "delivery" | "product" | "architecture" | "engineering" | "procurement" | "security";

// Agent result interface
interface AgentResult {
  role: AgentRole;
  insights: string[];
  scores: {
    overall: number;
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
    system: `You are an expert Delivery & PMO Manager for airline technology projects with 15+ years of experience evaluating vendor implementations for major airlines like Emirates, Singapore Airlines, and Qatar Airways.

Your expertise includes:
- Project delivery timelines and milestone planning
- Resource allocation and team composition
- Risk identification and mitigation strategies
- Dependency management across airline systems
- Change management for operational transitions
- Vendor delivery track record analysis

When evaluating vendors, you focus on:
- Implementation timeline realism
- Resource requirements and availability
- Technical dependencies on existing airline systems
- Operational cutover planning
- Risk mitigation strategies
- Historical delivery performance`,
    userTemplate: `Evaluate this vendor proposal from a Delivery & PMO perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the vendor's delivery capabilities, implementation timeline, resource requirements, and risk factors. Consider:
1. Timeline feasibility for airline operations (minimal disruption)
2. Team structure and expertise
3. Dependencies on existing systems (PSS, GDS, reservations)
4. Risk factors and mitigation
5. Change management approach
6. Historical delivery performance in aviation

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "deliveryRisk": 0-100 (lower is better risk),
    "integration": 0-100
  },
  "rationale": "2-3 sentence summary of delivery assessment",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  product: {
    system: `You are an expert Product Manager for airline passenger service systems with deep expertise in NDC, GDS integration, PSS platforms, and digital passenger experience.

Your expertise includes:
- Passenger service system (PSS) functionality
- NDC (New Distribution Capability) and IATA standards
- GDS integration and distribution
- Passenger experience and journey mapping
- Airline retailing and ancillary revenue
- Mobile and digital touchpoints

When evaluating vendors, you assess:
- Feature completeness against airline requirements
- NDC Level 3/4 certification status
- Passenger workflow efficiency
- Ancillary revenue capabilities
- Mobile and omnichannel support
- Airline-specific customization needs`,
    userTemplate: `Evaluate this vendor proposal from a Product perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the product's feature coverage, passenger experience capabilities, and airline-specific requirements. Focus on:
1. Core PSS functionality (reservations, ticketing, inventory)
2. NDC compliance and certification level
3. GDS integration capabilities
4. Passenger experience features
5. Ancillary revenue management
6. Mobile and digital capabilities

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "technicalFit": 0-100,
    "scalability": 0-100,
    "documentation": 0-100
  },
  "rationale": "2-3 sentence summary of product assessment",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  architecture: {
    system: `You are an expert Enterprise Architect for airline technology with 15+ years designing mission-critical aviation systems at scale.

Your expertise includes:
- Cloud-native architecture patterns for aviation
- Microservices and API gateway design
- High-availability and disaster recovery
- Security architecture (PCI-DSS, GDPR, SOC 2)
- Integration patterns (REST, GraphQL, messaging)
- Scalability for millions of passengers
- Multi-region deployments

When evaluating vendors, you assess:
- Architectural soundness and scalability
- Integration complexity with existing systems
- Security and compliance posture
- API design and standards adherence
- Performance and reliability
- Technical debt and modernization path`,
    userTemplate: `Evaluate this vendor proposal from an Architecture perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the architectural approach, integration patterns, security, and scalability. Consider:
1. Architecture patterns (microservices, event-driven, etc.)
2. Integration complexity with airline systems
3. Security architecture and compliance
4. Scalability for high-volume operations
5. API design and standards
6. High availability and disaster recovery

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
  "rationale": "2-3 sentence summary of architecture assessment",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  engineering: {
    system: `You are an expert Engineering Lead for airline technology with deep expertise in software quality, APIs, SDKs, and technical integration.

Your expertise includes:
- API quality and developer experience
- SDK and integration tooling
- Code quality and testing practices
- Technical documentation standards
- DevOps and CI/CD pipelines
- System reliability and observability

When evaluating vendors, you assess:
- API design quality and usability
- SDK completeness and language support
- Documentation comprehensiveness
- Testing and quality assurance
- Technical support responsiveness
- Developer tooling and experience`,
    userTemplate: `Evaluate this vendor proposal from an Engineering perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the engineering quality, APIs, SDKs, documentation, and technical support. Focus on:
1. API design quality and RESTful standards
2. SDK availability (Java, Node.js, Python, etc.)
3. Technical documentation completeness
4. Testing and QA practices
5. DevOps and deployment tooling
6. Technical support SLAs

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
  "rationale": "2-3 sentence summary of engineering assessment",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  procurement: {
    system: `You are an expert Procurement Manager for airline technology with 15+ years negotiating enterprise software contracts.

Your expertise includes:
- Total Cost of Ownership (TCO) analysis
- SLA and contract negotiation
- Vendor financial stability assessment
- Licensing models and pricing structures
- Payment terms and milestone-based payments
- Vendor performance history

When evaluating vendors, you assess:
- Cost competitiveness and value
- Licensing and pricing transparency
- SLA commitments and penalties
- Payment terms and milestones
- Vendor financial health
- Long-term partnership viability`,
    userTemplate: `Evaluate this vendor proposal from a Procurement perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the commercial terms, pricing, TCO, and contract structure. Focus on:
1. Pricing transparency and competitiveness
2. Total Cost of Ownership (implementation + annual)
3. SLA commitments and penalties
4. Payment terms and milestones
5. Licensing model (per-user, transaction-based, etc.)
6. Vendor financial stability

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "support": 0-100
  },
  "rationale": "2-3 sentence summary of commercial assessment",
  "status": "recommended" | "under-review" | "risk-flagged"
}`
  },
  
  security: {
    system: `You are an expert Security & Compliance Officer for airline technology with deep expertise in aviation security standards.

Your expertise includes:
- PCI-DSS compliance for payment processing
- GDPR and data privacy regulations
- SOC 2 Type II audits
- Penetration testing and vulnerability management
- Identity and access management (IAM)
- Data encryption (at-rest and in-transit)
- Incident response and security monitoring

When evaluating vendors, you assess:
- Security certifications and compliance
- Data protection mechanisms
- Access control and authentication
- Audit logging and monitoring
- Incident response capabilities
- Security track record`,
    userTemplate: `Evaluate this vendor proposal from a Security & Compliance perspective.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

Analyze the security posture, compliance certifications, and data protection. Focus on:
1. Security certifications (SOC 2, ISO 27001, PCI-DSS)
2. Data encryption (at-rest and in-transit)
3. Access control and authentication
4. GDPR compliance for passenger data
5. Audit logging and monitoring
6. Incident response procedures

Return JSON:
{
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "scores": {
    "overall": 0-100,
    "compliance": 0-100
  },
  "rationale": "2-3 sentence summary of security assessment",
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
  timeout: number = 30000
): Promise<AgentResult> {
  const startTime = Date.now();
  
  const prompt = AGENT_PROMPTS[role];
  const userMessage = prompt.userTemplate
    .replace('{requirements}', JSON.stringify(requirements, null, 2))
    .replace('{proposal}', JSON.stringify(proposal, null, 2))
    .replace('{vendorName}', proposal.vendorName);

  try {
    const response = await Promise.race([
      openai.chat.completions.create({
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
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Agent ${role} failed:`, error);
    
    // Return minimal result on failure
    return {
      role,
      insights: [`[Agent ${role} failed: ${error instanceof Error ? error.message : 'Unknown error'}]`],
      scores: { overall: 0 },
      rationale: `Evaluation failed for ${role} perspective`,
      status: "under-review",
      executionTime,
      tokenUsage: 0,
    };
  }
}

// Aggregate results from all agents
function aggregateResults(
  agentResults: AgentResult[],
  proposal: ProposalAnalysis
): VendorEvaluation {
  const successfulAgents = agentResults.filter(r => r.insights.length > 0 && !r.insights[0].includes("failed"));
  
  // Calculate average scores
  const avgOverall = Math.round(
    successfulAgents.reduce((sum, r) => sum + (r.scores.overall || 0), 0) / Math.max(successfulAgents.length, 1)
  );
  
  const avgTechnicalFit = Math.round(
    successfulAgents.reduce((sum, r) => sum + (r.scores.technicalFit || 0), 0) / Math.max(successfulAgents.length, 1)
  );
  
  const avgDeliveryRisk = Math.round(
    successfulAgents.reduce((sum, r) => sum + (r.scores.deliveryRisk || 0), 0) / Math.max(successfulAgents.length, 1)
  );
  
  const avgCompliance = Math.round(
    successfulAgents.reduce((sum, r) => sum + (r.scores.compliance || 0), 0) / Math.max(successfulAgents.length, 1)
  );

  // Build role insights object
  const roleInsights: VendorEvaluation["roleInsights"] = {
    delivery: agentResults.find(r => r.role === "delivery")?.insights || [],
    product: agentResults.find(r => r.role === "product")?.insights || [],
    architecture: agentResults.find(r => r.role === "architecture")?.insights || [],
    engineering: agentResults.find(r => r.role === "engineering")?.insights || [],
    procurement: agentResults.find(r => r.role === "procurement")?.insights || [],
    security: agentResults.find(r => r.role === "security")?.insights || [],
  };

  // Aggregate detailed scores
  const detailedScores = {
    integration: Math.round(
      successfulAgents.reduce((sum, r) => sum + (r.scores.integration || 0), 0) / Math.max(successfulAgents.length, 1)
    ),
    support: Math.round(
      successfulAgents.reduce((sum, r) => sum + (r.scores.support || 0), 0) / Math.max(successfulAgents.length, 1)
    ),
    scalability: Math.round(
      successfulAgents.reduce((sum, r) => sum + (r.scores.scalability || 0), 0) / Math.max(successfulAgents.length, 1)
    ),
    documentation: Math.round(
      successfulAgents.reduce((sum, r) => sum + (r.scores.documentation || 0), 0) / Math.max(successfulAgents.length, 1)
    ),
  };

  // Determine overall status based on consensus
  const statusCounts = {
    recommended: agentResults.filter(r => r.status === "recommended").length,
    "under-review": agentResults.filter(r => r.status === "under-review").length,
    "risk-flagged": agentResults.filter(r => r.status === "risk-flagged").length,
  };
  
  const status = statusCounts["risk-flagged"] > 2 ? "risk-flagged" :
                 statusCounts.recommended > 3 ? "recommended" : "under-review";

  // Aggregate rationales
  const rationale = agentResults
    .filter(r => r.rationale && !r.insights[0]?.includes("failed"))
    .map(r => `${r.role.charAt(0).toUpperCase() + r.role.slice(1)}: ${r.rationale}`)
    .join(" ");

  return {
    overallScore: avgOverall,
    technicalFit: avgTechnicalFit,
    deliveryRisk: avgDeliveryRisk,
    cost: proposal.costStructure || "Not specified",
    compliance: avgCompliance,
    status,
    rationale: rationale || "Multi-agent evaluation completed",
    roleInsights,
    detailedScores,
  };
}

// Main multiagent evaluator function
export async function evaluateProposalMultiAgent(
  requirements: RequirementAnalysis,
  proposal: ProposalAnalysis
): Promise<{ evaluation: VendorEvaluation; diagnostics: AgentDiagnostics[] }> {
  console.log(`🤖 Starting multiagent evaluation for ${proposal.vendorName}...`);
  
  const roles: AgentRole[] = ["delivery", "product", "architecture", "engineering", "procurement", "security"];
  
  try {
    // Execute all agents in parallel with allSettled for resilience
    const agentPromises = roles.map(role => executeAgent(role, requirements, proposal));
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
          status: result.value.insights[0]?.includes("failed") ? "failed" : "success",
          error: result.value.insights[0]?.includes("failed") ? result.value.insights[0] : undefined,
        });
      } else {
        // Agent promise rejected - create minimal result
        console.error(`Agent ${role} failed with error:`, result.reason);
        agentResults.push({
          role,
          insights: [`[Agent ${role} failed: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}]`],
          scores: { overall: 0 },
          rationale: `Evaluation failed for ${role} perspective`,
          status: "under-review",
          executionTime: 0,
          tokenUsage: 0,
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
