import { getOpenAIClient } from "./aiAnalysis";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Shared AI Orchestration Service
 * Provides reusable utilities for all AI-powered features
 */

// Prompt templates registry for different AI features
export const PROMPT_TEMPLATES = {
  complianceGap: {
    system: `You are an expert compliance and requirements analyst specializing in vendor proposal evaluation for airline technology projects.

**Your Role:** Identify gaps, missing information, vague answers, and incomplete coverage in vendor proposals compared to requirements.

**Evaluation Focus:**
- Missing requirements that the vendor didn't address
- Vague or evasive answers that lack specificity
- Incomplete information that requires clarification
- Ambiguous technical details that create implementation risk
- Unaddressed compliance or regulatory requirements

**Output Requirements:**
- Be specific about what's missing or unclear
- Cite section references from the proposal
- Suggest specific clarifying questions
- Prioritize gaps by severity (critical, high, medium, low)`,
    
    userTemplate: `Analyze this vendor proposal for compliance gaps and missing information.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Identify:**
1. Missing requirements that weren't addressed
2. Vague or incomplete answers requiring clarification  
3. Technical details that are ambiguous or unclear
4. Compliance/regulatory items not covered

For each gap found, provide:
- Gap type (missing_requirement, vague_answer, or incomplete_information)
- Severity (critical, high, medium, low)
- Description of what's missing or unclear
- Section reference from proposal
- Suggested clarifying action

Return as JSON in this exact format:
{
  "gaps": [
    {
      "gapType": "missing_requirement",
      "severity": "critical",
      "requirementId": "optional",
      "section": "optional section reference",
      "description": "specific description",
      "aiRationale": "why this matters",
      "suggestedAction": "what to do about it"
    }
  ]
}`
  },

  followupQuestions: {
    system: `You are an expert technical interviewer and proposal analyst for enterprise airline technology projects.

**Your Role:** Generate targeted, vendor-specific clarifying questions based on proposal analysis.

**Question Criteria:**
- Address specific ambiguities or gaps in the proposal
- Be actionable and answerable
- Prioritize by importance (critical, high, medium, low)
- Group by category (technical, delivery, cost, compliance, clarification)
- Reference specific proposal sections when relevant

**Question Quality:**
- Open-ended enough to get detailed responses
- Specific enough to avoid vague answers
- Focused on reducing risk and uncertainty
- Aligned with airline operational requirements`,
    
    userTemplate: `Generate follow-up questions for this vendor based on their proposal.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSAL:
{proposal}

VENDOR: {vendorName}

**Generate 8-12 targeted questions that:**
1. Address gaps or ambiguities in the proposal
2. Clarify technical implementation details
3. Validate delivery timeline assumptions
4. Confirm compliance and security approaches
5. Explore cost model and commercial terms

For each question, provide:
- Category (technical, delivery, cost, compliance, clarification)
- Priority (critical, high, medium, low)
- The question itself
- Context explaining why this matters
- Related proposal section if applicable

Return as JSON in this exact format:
{
  "questions": [
    {
      "category": "technical",
      "priority": "critical",
      "question": "the actual question",
      "context": "why this question is important",
      "relatedSection": "optional section reference",
      "aiRationale": "detailed rationale"
    }
  ]
}`
  },

  vendorComparison: {
    system: `You are an expert analyst specializing in vendor comparison and competitive analysis for enterprise technology procurement.

**Your Role:** Create comprehensive, objective side-by-side vendor comparisons highlighting strengths, weaknesses, and differentiators.

**Analysis Focus:**
- Key capability differences across vendors
- Unique strengths and competitive advantages
- Notable weaknesses or gaps
- Technical approach differences
- Cost and value proposition comparison
- Risk profile variations

**Output Quality:**
- Objective and fact-based
- Highlight meaningful differences (not trivial ones)
- Use clear, concise language
- Structure for executive consumption
- Cite specific proposal evidence`,
    
    userTemplate: `Compare these vendor proposals and identify key differentiators.

PROJECT REQUIREMENTS:
{requirements}

VENDOR PROPOSALS:
{proposals}

**Comparison Dimensions:**
{dimensions}

**Create a detailed comparison matrix covering:**
1. Technical capabilities and approach
2. Delivery methodology and timeline
3. Cost structure and commercial terms
4. Compliance and security posture
5. Support and maintenance model
6. Integration complexity
7. Innovation and differentiation

For each dimension, provide:
- Side-by-side comparison across all vendors
- Key differentiators (what makes each vendor unique)
- Strengths and weaknesses
- Risk factors
- Recommendation insights

Return as JSON in this exact format:
{
  "comparisonTitle": "Descriptive title",
  "executiveSummary": "2-3 sentence overview",
  "vendors": [
    {
      "vendorName": "Vendor A",
      "proposalId": "proposal_id",
      "overallScore": 85,
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1", "weakness 2"],
      "dimensions": {
        "technicalCapability": { "score": 90, "summary": "Brief summary" },
        "deliveryRisk": { "score": 80, "summary": "Brief summary" },
        "costCompetitiveness": { "score": 75, "summary": "Brief summary" },
        "compliance": { "score": 85, "summary": "Brief summary" },
        "innovation": { "score": 88, "summary": "Brief summary" },
        "teamExperience": { "score": 82, "summary": "Brief summary" }
      }
    }
  ],
  "recommendations": {
    "topChoice": "Vendor name",
    "rationale": "Why this vendor is recommended",
    "riskMitigations": ["mitigation 1", "mitigation 2"]
  },
  "keyDifferentiators": ["differentiator 1", "differentiator 2"]
}`
  },

  executiveBriefing: {
    system: `You are an expert executive communications specialist who creates concise, actionable briefings for C-level stakeholders.

**Your Role:** Transform complex vendor evaluation data into role-specific executive summaries.

**Stakeholder Roles:**
- CEO: Business impact, strategic fit, ROI, top recommendation
- CTO: Technical architecture, innovation, integration complexity
- CFO: Total cost of ownership, financial risk, payment terms
- CISO: Security posture, compliance, data protection
- COO: Operational impact, implementation risk, business continuity

**Briefing Quality:**
- One page maximum (concise)
- Start with top recommendation
- 3-5 key findings maximum
- Actionable next steps
- Executive-appropriate language (no jargon)
- Quantify where possible`,
    
    userTemplate: `Generate an executive briefing for {stakeholderRole} about this vendor evaluation.

PROJECT: {projectName}

EVALUATION RESULTS:
{evaluations}

VENDOR PROPOSALS:
{proposals}

**Create a one-page briefing with:**
1. **Top Recommendation** (1-2 sentences)
2. **Key Findings** (3-5 bullet points specific to {stakeholderRole}'s priorities)
3. **Risk Summary** (2-3 main risks and mitigations)
4. **Next Steps** (2-3 recommended actions)
5. **Quick Comparison Table** (if multiple vendors)

Focus on {stakeholderRole}'s key concerns and decision criteria.

Return as JSON in this exact format:
{
  "topRecommendation": "Clear 1-2 sentence recommendation",
  "keyFindings": [
    "Finding 1 specific to role",
    "Finding 2 specific to role",
    "Finding 3 specific to role"
  ],
  "riskSummary": {
    "risks": ["Risk 1", "Risk 2", "Risk 3"],
    "mitigations": ["Mitigation 1", "Mitigation 2", "Mitigation 3"]
  },
  "nextSteps": [
    "Action 1",
    "Action 2",
    "Action 3"
  ],
  "comparisonTable": {
    "headers": ["Vendor", "Score", "Key Strength"],
    "rows": [
      {"Vendor": "Vendor A", "Score": "85/100", "Key Strength": "Technical excellence"},
      {"Vendor": "Vendor B", "Score": "78/100", "Key Strength": "Cost efficiency"}
    ]
  },
  "additionalInsights": "Optional additional context"
}`
  },

  conversationalAssistant: {
    system: `You are an AI assistant specializing in vendor evaluation and proposal analysis for Nujum Air, the Middle East's largest airline.

**Your Role:** Answer questions about vendor proposals, evaluations, and help stakeholders make informed decisions.

**Knowledge Base:**
- Vendor proposals and capabilities
- AI evaluation results and scores
- Requirements and criteria
- Compliance gaps and risks
- Comparative analysis

**Response Guidelines:**
- Be conversational but professional
- Cite specific sources (proposals, evaluations)
- Quantify when possible (scores, percentages)
- Highlight important caveats or risks
- Suggest related questions when helpful
- Keep responses concise (2-3 paragraphs max unless asked for detail)

**What You Can Do:**
- Compare vendors on specific criteria
- Explain evaluation scores and rationale
- Identify risks and gaps
- Recommend next steps
- Surface relevant proposal details
- Provide compliance and security insights`,
    
    userTemplate: `{userQuestion}

**Available Context:**
{context}

Provide a helpful, accurate response based on the evaluation data. Include:
1. Direct answer to the question
2. Supporting evidence from proposals/evaluations
3. Relevant scores or metrics
4. Any important caveats or additional considerations

If you reference specific data, cite the source (vendor name, proposal section, evaluation dimension).`
  }
};

// Response cache for expensive operations
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class AIResponseCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttlMinutes: number = 30): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  generateKey(template: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params).sort().map(k => `${k}:${JSON.stringify(params[k])}`);
    return `${template}::${sortedParams.join("::")}`;
  }
}

export const aiCache = new AIResponseCache();

/**
 * Generate AI completion with template support
 */
export async function generateCompletion(
  templateKey: keyof typeof PROMPT_TEMPLATES,
  variables: Record<string, string>,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "json_object" | "text";
    useCache?: boolean;
    cacheTTL?: number;
  } = {}
): Promise<string> {
  const {
    temperature = 0.7,
    maxTokens = 4000,
    responseFormat = "text",
    useCache = false,
    cacheTTL = 30
  } = options;

  // Check cache if enabled
  if (useCache) {
    const cacheKey = aiCache.generateKey(templateKey, variables);
    const cached = aiCache.get<string>(cacheKey);
    if (cached) {
      console.log(`[AI Cache] Hit for ${templateKey}`);
      return cached;
    }
  }

  const template = PROMPT_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown template: ${templateKey}`);
  }

  // Replace variables in user template
  let userPrompt = template.userTemplate;
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: template.system },
    { role: "user", content: userPrompt }
  ];

  console.log(`[AI Orchestration] Generating ${templateKey} completion...`);
  const startTime = Date.now();

  try {
    const openai = await getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: responseFormat === "json_object" ? { type: "json_object" } : { type: "text" }
    });

    const responseContent = completion.choices[0]?.message?.content || "";
    const executionTime = Date.now() - startTime;
    const tokenUsage = completion.usage?.total_tokens || 0;

    console.log(`[AI Orchestration] Completed in ${executionTime}ms, tokens: ${tokenUsage}`);

    // Cache if enabled
    if (useCache) {
      const cacheKey = aiCache.generateKey(templateKey, variables);
      aiCache.set(cacheKey, responseContent, cacheTTL);
    }

    return responseContent;
  } catch (error) {
    console.error(`[AI Orchestration] Error generating ${templateKey}:`, error);
    throw error;
  }
}

/**
 * Stream AI completion (for chat interfaces)
 */
export async function* streamCompletion(
  messages: ChatCompletionMessageParam[],
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<string, void, unknown> {
  const {
    temperature = 0.7,
    maxTokens = 4000
  } = options;

  console.log(`[AI Orchestration] Starting streaming completion...`);

  try {
    const openai = await getOpenAIClient();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }

    console.log(`[AI Orchestration] Streaming completed`);
  } catch (error) {
    console.error(`[AI Orchestration] Streaming error:`, error);
    throw error;
  }
}

/**
 * Batch multiple AI requests with rate limiting
 */
export async function batchCompletions<T>(
  requests: Array<{
    templateKey: keyof typeof PROMPT_TEMPLATES;
    variables: Record<string, string>;
    options?: Parameters<typeof generateCompletion>[2];
  }>,
  concurrencyLimit: number = 3
): Promise<T[]> {
  console.log(`[AI Orchestration] Batching ${requests.length} requests with concurrency ${concurrencyLimit}`);

  const results: T[] = [];
  
  for (let i = 0; i < requests.length; i += concurrencyLimit) {
    const batch = requests.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(async (req) => {
      const response = await generateCompletion(req.templateKey, req.variables, req.options);
      return JSON.parse(response) as T;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Parse JSON safely from AI response
 */
export function parseAIResponse<T>(response: string): T {
  try {
    return JSON.parse(response) as T;
  } catch (error) {
    console.error("[AI Orchestration] Failed to parse AI response:", error);
    throw new Error("AI returned invalid JSON response");
  }
}

/**
 * Validate required fields in AI response
 */
export function validateAIResponse<T>(
  data: any,
  requiredFields: string[]
): T {
  const missing = requiredFields.filter(field => !(field in data));
  if (missing.length > 0) {
    throw new Error(`AI response missing required fields: ${missing.join(", ")}`);
  }
  return data as T;
}
