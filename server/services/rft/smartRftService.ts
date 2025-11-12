import { type InsertGeneratedRft, type RftTemplate, type BusinessCase } from "@shared/schema";
import { storage } from "../../storage";
import { generateAllQuestionnaires, type QuestionnaireQuestion } from "./excelGenerator";
import { getOpenAIClient } from "../ai/aiAnalysis";
import { getSectionMapping, STAKEHOLDER_ROLES, type SectionMapping } from "./stakeholderConfig";

interface RftSection {
  sectionId: string;
  title: string;
  content: string;
  suggestedAssignee?: string; // Suggested stakeholder role ID
  category?: SectionMapping["category"];
  subsections?: RftSection[];
}

interface BusinessCaseExtract {
  projectName: string;
  businessObjective: string;
  scope: string;
  stakeholders: string[];
  budget: string;
  timeline: string;
  keyRequirements: string[];
  risks: string[];
  successCriteria: string[];
}

/**
 * Enrich AI-generated sections with stakeholder metadata
 * Maps section IDs to suggested assignees and categories
 * Recursively enriches subsections to maintain consistent metadata throughout the tree
 * Priority: template-specific mappings > DEFAULT_SECTION_MAPPINGS > defaults
 * @param sections - Array of sections to enrich
 * @param template - Optional template with custom sectionMappings to override defaults
 */
function enrichSectionsWithStakeholderMetadata(sections: any[], template?: RftTemplate | null): RftSection[] {
  /**
   * Translate legacy display names to role IDs using robust lookup
   * Handles exact matches, case-insensitive matches, and variations
   */
  function translateDisplayNameToRoleId(displayName: string): string | null {
    if (!displayName) return null;
    
    // Normalize for comparison
    const normalized = displayName.trim().toLowerCase();
    
    // Try exact match against STAKEHOLDER_ROLES
    const exactMatch = STAKEHOLDER_ROLES.find(
      role => role.id === normalized || role.id === displayName
    );
    if (exactMatch) return exactMatch.id;
    
    // Try case-insensitive match against role names
    const nameMatch = STAKEHOLDER_ROLES.find(
      role => role.name.toLowerCase() === normalized
    );
    if (nameMatch) return nameMatch.id;
    
    // Try partial/fuzzy matches for common variations
    const partialMatch = STAKEHOLDER_ROLES.find(role => {
      const roleName = role.name.toLowerCase();
      return roleName.includes(normalized) || normalized.includes(roleName);
    });
    if (partialMatch) return partialMatch.id;
    
    // No match found
    return null;
  }

  /**
   * Recursively enrich a section and its subsections
   * Looks up mapping with priority: template override > global config > default
   * Handles both new format (defaultAssignee/category) and legacy formats (assignedTo/stakeholderRole)
   * Translates legacy display names to role IDs using robust lookup
   */
  function enrichSection(section: any): RftSection {
    // Priority 1: Check template-specific section mappings
    let mapping: { assignee: string; category: SectionMapping["category"] } | undefined;
    
    if (template?.sectionMappings) {
      const templateMapping = template.sectionMappings.find(
        (m: any) => m.sectionId === section.sectionId
      );
      if (templateMapping) {
        // Try new format first (defaultAssignee), then legacy formats
        let rawAssignee = templateMapping.defaultAssignee || 
                         templateMapping.assignedTo || 
                         templateMapping.stakeholderRole;
        
        // Translate display names to role IDs for backward compatibility
        // If rawAssignee is already a valid role ID, it passes through
        // If it's a display name, we translate it
        let roleId: string | null = null;
        if (rawAssignee) {
          // Try translation first
          roleId = translateDisplayNameToRoleId(rawAssignee);
          
          // If translation failed, log warning and fall back to global config
          if (!roleId) {
            console.warn(`⚠️  Template mapping for section ${section.sectionId} has invalid assignee "${rawAssignee}". Falling back to global config.`);
          }
        }
        
        // If we have a valid role ID from template, use it with category
        if (roleId) {
          const globalMapping = getSectionMapping(section.sectionId);
          mapping = {
            assignee: roleId,
            // Use template category if present, otherwise fallback to global config category
            category: templateMapping.category || globalMapping.category
          };
        }
      }
    }
    
    // Priority 2: Fallback to global configuration if template mapping invalid/missing
    if (!mapping) {
      mapping = getSectionMapping(section.sectionId);
    }
    
    const enrichedSection: RftSection = {
      sectionId: section.sectionId,
      title: section.title,
      content: section.content,
      suggestedAssignee: mapping.assignee,
      category: mapping.category,
      // Recursively enrich subsections if present
      subsections: section.subsections 
        ? section.subsections.map((sub: any) => enrichSection(sub))
        : undefined
    };
    
    return enrichedSection;
  }

  return sections.map(enrichSection);
}

/**
 * Generate comprehensive RFT document sections following professional standards
 * @param businessCaseExtract - Extracted business case information
 * @param template - Optional template with custom sectionMappings for stakeholder overrides
 */
export async function generateProfessionalRftSections(
  businessCaseExtract: BusinessCaseExtract,
  template?: RftTemplate | null
): Promise<RftSection[]> {
  
  // Validate and build requirements and criteria lists
  const missingFields: string[] = [];
  
  if (!businessCaseExtract.keyRequirements || businessCaseExtract.keyRequirements.length === 0) {
    console.warn("⚠️  WARNING: No key requirements found in business case");
    missingFields.push("key requirements");
  }
  if (!businessCaseExtract.risks || businessCaseExtract.risks.length === 0) {
    console.warn("⚠️  WARNING: No risks found in business case");
    missingFields.push("risks");
  }
  if (!businessCaseExtract.successCriteria || businessCaseExtract.successCriteria.length === 0) {
    console.warn("⚠️  WARNING: No success criteria found in business case");
    missingFields.push("success criteria");
  }
  if (!businessCaseExtract.stakeholders || businessCaseExtract.stakeholders.length === 0) {
    console.warn("⚠️  WARNING: No stakeholders found in business case");
    missingFields.push("stakeholders");
  }
  
  if (missingFields.length > 0) {
    console.warn(`⚠️  Business case is missing: ${missingFields.join(", ")}. RFT may be less specific.`);
  }
  
  const requirementsList = businessCaseExtract.keyRequirements.length > 0
    ? businessCaseExtract.keyRequirements.map((req, i) => `${i + 1}. ${req}`).join("\n")
    : "1. [Requirement details not provided in business case - vendors should propose solutions]";
  
  const risksList = businessCaseExtract.risks.length > 0
    ? businessCaseExtract.risks.map((risk, i) => `${i + 1}. ${risk}`).join("\n")
    : "1. [Risks not identified in business case - vendors should highlight potential risks]";
  
  const criteriaList = businessCaseExtract.successCriteria.length > 0
    ? businessCaseExtract.successCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join("\n")
    : "1. [Success criteria not defined in business case - use standard evaluation metrics]";
  
  const stakeholdersList = businessCaseExtract.stakeholders.length > 0
    ? businessCaseExtract.stakeholders.join(", ")
    : "[Stakeholders not specified in business case]";
  
  const prompt = `Create a detailed RFT document for "${businessCaseExtract.projectName}" based on the business case below.

PROJECT DETAILS:
Objective: ${businessCaseExtract.businessObjective}
Scope: ${businessCaseExtract.scope}
Timeline: ${businessCaseExtract.timeline}
Budget: ${businessCaseExtract.budget}
Stakeholders: ${stakeholdersList}

KEY REQUIREMENTS TO ADDRESS:
${requirementsList}

RISKS TO MITIGATE:
${risksList}

SUCCESS CRITERIA:
${criteriaList}

Generate 10 sections that comprehensively address this specific project. Use the above information to create relevant, detailed content - NOT generic templates. Each section should elaborate on how these specific requirements, risks, and criteria apply.

Section 1 - Introduction & Overview:
Explain why this solution is needed to achieve: ${businessCaseExtract.businessObjective}. Describe what problem it solves for these stakeholders: ${stakeholdersList}. Include organizational context based on the scope (${businessCaseExtract.scope}) and explain the tendering process.

Section 2 - Scope of Work / Requirements:
Create a comprehensive, detailed scope of work with MINIMUM 20 specific requirements. For each requirement, provide:
- Requirement ID and Title
- Detailed description of what the requirement means in practice
- Technical specifications and constraints
- Expected deliverables (tangible outputs)
- Clear acceptance criteria (measurable, testable conditions that must be met)
- Integration points and dependencies
- Priority level (Critical/High/Medium/Low)

Organize requirements into logical categories (e.g., Functional, Technical, Integration, Data Migration, Training, Documentation).

Format each requirement as:
REQ-[ID]: [Title]
Description: [What needs to be delivered]
Technical Specs: [Specific technical details]
Deliverables: [Concrete outputs]
Acceptance Criteria:
  ✓ [Measurable criterion 1]
  ✓ [Measurable criterion 2]
  ✓ [Measurable criterion 3]
Dependencies: [Other requirements or systems]
Priority: [Critical/High/Medium/Low]

Additionally, create a timeline table mapping all requirements to implementation phases with clear milestones.

Section 3 - Instructions to Tenderers:
Create submission instructions specific to ${businessCaseExtract.projectName}:
- Explain what vendors must demonstrate regarding the key requirements listed above
- Set submission deadline that aligns with ${businessCaseExtract.timeline}
- List required documentation that addresses the ${businessCaseExtract.scope}
- Define compliance requirements based on project stakeholders (${stakeholdersList})

Section 4 - Evaluation Criteria:
Transform each success criterion listed above into a scored evaluation metric. Create a detailed scoring table where each criterion has:
- Description derived from the success criteria above
- Weight/points allocation
- Assessment method
The total evaluation must directly map back to how we measure success for ${businessCaseExtract.projectName}.

Section 5 - Commercial Terms & Conditions:
Based on budget ${businessCaseExtract.budget} and timeline ${businessCaseExtract.timeline}, specify:
- Payment structure that aligns with project milestones  derived from timeline
- Pricing model appropriate for ${businessCaseExtract.scope}
- SLA metrics that support achieving ${businessCaseExtract.businessObjective}
- Warranty terms relevant to the key requirements
- Cost implications for the risks identified above

Section 6 - Contractual Requirements:
Draft contract terms specific to ${businessCaseExtract.projectName} and ${businessCaseExtract.scope}:
- IP ownership for deliverables created for this ${businessCaseExtract.projectName}
- Data handling requirements appropriate for stakeholders: ${stakeholdersList}
- Liability terms proportional to budget: ${businessCaseExtract.budget}
- Insurance coverage for risks identified above
- Termination conditions tied to success criteria

Section 7 - Non-Functional Requirements:
Transform each key requirement into quantified non-functional specifications:
${requirementsList}

For each requirement above, define: target performance metrics, availability SLAs, security standards, scalability targets, required certifications. Create a comprehensive NFR table.

Section 8 - Governance & Risk Management:
Build a complete risk management framework for ${businessCaseExtract.projectName}:

For each identified risk:
${risksList}

Provide: probability assessment, business impact on ${businessCaseExtract.businessObjective}, mitigation approach, contingency plan, risk owner from ${stakeholdersList}.

Also define: governance committee composition from stakeholders, reporting cadence aligned with ${businessCaseExtract.timeline}, escalation paths, change control tied to scope.

Section 9 - Response Templates / Schedules:
Design vendor response templates that capture information needed to evaluate against the success criteria above. For ${businessCaseExtract.projectName}, vendors must provide:
- Technical solution addressing each key requirement
- Delivery schedule aligned with ${businessCaseExtract.timeline}
- Cost breakdown within budget ${businessCaseExtract.budget}
- Risk mitigation for risks identified above
- Evidence for success criteria measurement

Section 10 - Appendices:
Create project-specific appendices for ${businessCaseExtract.projectName}:
- Glossary: Define all technical terms from ${businessCaseExtract.scope}
- Standards: List industry standards and regulations relevant to ${businessCaseExtract.scope} and ${businessCaseExtract.businessObjective}
- Stakeholder Matrix: Detail roles and responsibilities for ${stakeholdersList}
- Risk Register: Full detail on identified risks
- Requirement Traceability: Map requirements to success criteria

CRITICAL Formatting Rules (use markdown):
- Use bullet lists with "- " for unordered items (requirements, features, criteria)
- Use numbered lists with "1. ", "2. ", etc. for sequential steps or processes
- Use markdown tables with "| Header 1 | Header 2 |" format for structured data (timelines, scoring, metrics, deadlines)
- Separate paragraphs with "\n\n"
- Use terminology appropriate to ${businessCaseExtract.scope} and industry context
- Reference relevant industry standards and regulations based on project requirements
- Use formal procurement language
- Make ALL content specific to ${businessCaseExtract.projectName} and ${businessCaseExtract.businessObjective}

Return JSON array (MUST include all 10 sections):
[
  {
    "sectionId": "section-1",
    "title": "Introduction & Overview",
    "content": "Professional formatted content with bullets, lists, and tables in markdown..."
  },
  ...all 10 sections...
]`;

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert procurement specialist with 20+ years of experience in creating professional RFT/RFP documents across various industries. You adapt your language and standards to match the project domain and requirements.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);
    // Handle both array and object with sections array
    const sections = Array.isArray(result) ? result : (result.sections || []);
    
    console.log(`📊 AI generated ${sections.length} sections`);
    
    // Validate that we got all 10 sections
    if (sections.length < 10) {
      console.warn(`⚠️  WARNING: Expected 10 sections but got ${sections.length}. This may indicate the AI response was truncated.`);
      console.warn("Sections received:", sections.map((s: any) => s.title).join(", "));
    }
    
    // Log content length for first section to verify comprehensiveness
    if (sections.length > 0) {
      const firstSection = sections[0] as any;
      const wordCount = firstSection.content?.split(/\s+/).length || 0;
      console.log(`📝 First section word count: ${wordCount} words (target: 500+)`);
      if (wordCount < 300) {
        console.warn(`⚠️  WARNING: First section has only ${wordCount} words, expected 500+`);
      }
    }
    
    // Enrich sections with stakeholder metadata
    // Template-specific mappings override DEFAULT_SECTION_MAPPINGS
    const enrichedSections = enrichSectionsWithStakeholderMetadata(sections, template);
    
    return enrichedSections;
  } catch (error) {
    console.error("Error generating RFT sections:", error);
    throw new Error("Failed to generate professional RFT sections");
  }
}

/**
 * Extract structured information from a business case document
 */
export async function extractBusinessCaseInfo(
  businessCaseContent: string
): Promise<BusinessCaseExtract> {
  const prompt = `You are analyzing a Lean Business Case document for a procurement project.
Extract the following information in JSON format:

{
  "projectName": "Name of the project or initiative",
  "businessObjective": "Main business objective or goal",
  "scope": "Project scope description",
  "stakeholders": ["List", "of", "key", "stakeholders"],
  "budget": "Budget information or constraints",
  "timeline": "Timeline or delivery expectations",
  "keyRequirements": ["Key", "business", "requirements"],
  "risks": ["Identified", "risks", "or", "challenges"],
  "successCriteria": ["Success", "metrics", "or", "criteria"]
}

Business Case Document:
${businessCaseContent.substring(0, 8000)}

Return ONLY valid JSON, no additional text.`;

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert business analyst specializing in procurement processes across various industries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const extracted = JSON.parse(content) as BusinessCaseExtract;
    
    // Log what was actually extracted for debugging
    console.log("📊 Extracted from business case:", {
      projectName: extracted.projectName,
      hasObjective: !!extracted.businessObjective,
      hasScope: !!extracted.scope,
      stakeholderCount: extracted.stakeholders?.length || 0,
      requirementsCount: extracted.keyRequirements?.length || 0,
      risksCount: extracted.risks?.length || 0,
      criteriaCount: extracted.successCriteria?.length || 0,
    });

    return extracted;
  } catch (error) {
    console.error("Error extracting business case info:", error);
    throw new Error("Failed to extract business case information");
  }
}

/**
 * Generate questionnaire questions using AI based on business case
 */
export async function generateQuestionnaireQuestions(
  businessCaseExtract: BusinessCaseExtract,
  questionnaireType: "product" | "nfr" | "cybersecurity" | "agile",
  count: number
): Promise<QuestionnaireQuestion[]> {
  
  // Build detailed context strings
  const requirementsList = businessCaseExtract.keyRequirements?.length > 0
    ? businessCaseExtract.keyRequirements.map((req, i) => `${i + 1}. ${req}`).join("\n")
    : "No specific requirements provided";
  
  const risksList = businessCaseExtract.risks?.length > 0
    ? businessCaseExtract.risks.map((risk, i) => `${i + 1}. ${risk}`).join("\n")
    : "No specific risks identified";
  
  const criteriaList = businessCaseExtract.successCriteria?.length > 0
    ? businessCaseExtract.successCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join("\n")
    : "No specific success criteria defined";
  
  const stakeholdersList = businessCaseExtract.stakeholders?.length > 0
    ? businessCaseExtract.stakeholders.join(", ")
    : "Not specified";

  // Calculate questions per requirement for better distribution
  const requirementCount = businessCaseExtract.keyRequirements?.length || 0;
  const questionsPerRequirement = requirementCount > 0 
    ? Math.ceil(count / requirementCount)
    : count;

  const questionnairePrompts = {
    product: `CRITICAL: Generate ${count} product capability questions that are DIRECTLY DERIVED from the Key Requirements listed below.

APPROACH:
${requirementCount > 0 
  ? `For each of the ${requirementCount} Key Requirements listed, create approximately ${questionsPerRequirement} specific questions that ask vendors to demonstrate how their product addresses that exact requirement.` 
  : `Since no specific requirements were provided, generate ${count} questions covering core product capabilities aligned with the project objective and scope.`}
The questions MUST reference the specific requirement details whenever available.

For example, if a requirement is "Real-time fleet tracking for 200+ aircraft":
✓ GOOD: "How does your solution handle real-time tracking and location updates for a fleet of 200+ aircraft simultaneously?"
✓ GOOD: "Describe your product's data refresh rate and latency for fleet tracking operations at scale."
✗ BAD: "Does your product support fleet tracking?" (too generic, yes/no)
✗ BAD: "What features does your product have?" (not tied to requirement)

Additional question categories to cover:
- Integration capabilities (mention specific systems from scope)
- User experience for the stakeholders mentioned
- Scalability to handle the scope described
- Product roadmap alignment with project timeline
- Support and training approach

Each question MUST be measurable and require detailed vendor responses with evidence.`,
    
    nfr: `Generate ${count} Non-Functional Requirements (NFR) questions that directly address the Risks and Timeline/Budget constraints below.

APPROACH:
1. For each Risk identified, create questions asking how vendors will mitigate that specific risk
2. Reference the Timeline (${businessCaseExtract.timeline}) and Budget (${businessCaseExtract.budget}) in performance/scalability questions
3. Tie NFR questions to Success Criteria where applicable

Example: If a risk is "Integration with legacy systems":
✓ GOOD: "What is your approach to integrating with legacy systems, and what performance impact should we expect?"
✗ BAD: "How do you handle integrations?" (too generic)

Cover these NFR categories with specific context:
- Performance requirements aligned with project scale
- Reliability needs based on identified risks
- Scalability to support the scope over the timeline
- Security requirements for the stakeholders involved
- Maintainability considering the project lifecycle
- Compliance with regulations mentioned in scope`,
    
    cybersecurity: `Generate ${count} cybersecurity and compliance questions tailored to the Stakeholders and industry context.

APPROACH:
1. Consider who the stakeholders are (${stakeholdersList}) and what data they'll access
2. Reference any compliance or regulatory requirements mentioned in the scope
3. Ask about specific security measures for the risks identified

Example: If scope mentions "customer data" and stakeholders include "passengers":
✓ GOOD: "How does your solution protect passenger personal data in compliance with GDPR and local privacy regulations?"
✗ BAD: "Do you encrypt data?" (yes/no, not specific)

Cover:
- Data protection for stakeholder groups mentioned
- Access control appropriate to organizational structure
- Compliance certifications relevant to the industry/scope
- Incident response for risks identified
- Security audits and penetration testing approach
- Data residency requirements if mentioned in scope`,
    
    agile: `Generate ${count} agile delivery questions aligned with the Project Timeline and Stakeholder structure.

APPROACH:
1. Reference the specific Timeline (${businessCaseExtract.timeline}) in delivery schedule questions
2. Ask about collaboration with the Stakeholders mentioned
3. Tie delivery methodology to achieving the Success Criteria

Example: If timeline is "6 months" and stakeholders include "operations team":
✓ GOOD: "How will you structure sprints and deliverables over the 6-month timeline to enable early feedback from the operations team?"
✗ BAD: "What agile methodology do you use?" (too generic)

Cover:
- Delivery approach aligned with project timeline
- Collaboration and communication with specific stakeholder groups
- Risk management for identified risks
- Quality assurance approach for success criteria
- Team structure and expertise for the scope
- Change management process
- Progress reporting frequency and format`
  };

  const prompt = `You are creating a vendor evaluation questionnaire for: ${businessCaseExtract.projectName}

PROJECT CONTEXT:
Objective: ${businessCaseExtract.businessObjective}
Scope: ${businessCaseExtract.scope}
Timeline: ${businessCaseExtract.timeline}
Budget: ${businessCaseExtract.budget}

KEY REQUIREMENTS (use these as the foundation for questions):
${requirementsList}

IDENTIFIED RISKS (address these in questions):
${risksList}

SUCCESS CRITERIA (ensure questions help evaluate these):
${criteriaList}

STAKEHOLDERS (consider their needs):
${stakeholdersList}

${questionnairePrompts[questionnaireType]}

CRITICAL INSTRUCTIONS:
1. Every question must reference specific details from the context above
2. Do NOT use generic template questions
3. Questions should be open-ended, requiring detailed vendor responses
4. Include specific metrics, numbers, systems, or stakeholders from the context
5. Make vendors demonstrate HOW they address each requirement/risk/criterion

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "number": 1,
      "question": "Detailed, context-specific question text here?",
      "category": "Category name"
    }
  ]
}

Generate exactly ${count} questions. Number them sequentially from 1 to ${count}.`;

  console.log(`\n🎯 Generating ${questionnaireType} questionnaire with ${count} questions`);
  console.log(`📊 Context: ${requirementCount} requirements, ${businessCaseExtract.risks?.length || 0} risks, ${businessCaseExtract.successCriteria?.length || 0} criteria`);
  console.log(`📝 First requirement: ${businessCaseExtract.keyRequirements?.[0] || "None"}`);

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert procurement specialist creating comprehensive vendor evaluation questionnaires across various industries.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    
    return questions.slice(0, count) as QuestionnaireQuestion[];
  } catch (error) {
    console.error(`Error generating ${questionnaireType} questionnaire:`, error);
    
    // Fallback: generate generic questions
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      question: `[AI generation failed] Please provide details about ${questionnaireType} aspect ${i + 1}.`,
      category: questionnaireType.toUpperCase()
    }));
  }
}

/**
 * Generate a specific RFT section using AI
 */
async function generateRftSection(
  sectionConfig: any,
  businessCaseExtract: BusinessCaseExtract,
  businessCaseContent: string
): Promise<RftSection> {
  const { id, title, prompt_template, subsections } = sectionConfig;

  // Build the prompt
  const prompt = `You are creating a Request for Tender (RFT) document for ${businessCaseExtract.projectName}.

Business Context:
- Objective: ${businessCaseExtract.businessObjective}
- Scope: ${businessCaseExtract.scope}
- Budget: ${businessCaseExtract.budget}
- Timeline: ${businessCaseExtract.timeline}

Generate the "${title}" section of the RFT document.

${prompt_template || ''}

Requirements:
- Be specific and measurable
- Reference industry-appropriate standards and regulations (e.g., ISO 27001, PCI-DSS, GDPR) where applicable
- Include acceptance criteria
- CRITICAL: Format professionally in markdown with:
  * Bullet lists (- ) for requirements, features, criteria
  * Numbered lists (1., 2., etc.) for sequential steps or processes
  * Tables (| Header | Header |) for structured data (metrics, timelines, scoring)
- Be comprehensive and realistic (400+ words)

Example format:
"## ${title}\n\nIntroduction paragraph...\n\n### Key Requirements\n\n- Requirement 1: Details here\n- Requirement 2: More details\n\n### Deliverables Timeline\n\n| Phase | Duration | Deliverables |\n|-------|----------|-------------|\n| Phase 1 | 2 months | Analysis |\n| Phase 2 | 4 months | Development |\n\nFurther details..."

Generate ONLY the content for this section, well-formatted in markdown.`;

  try {
    const openai = await getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert RFT author with deep knowledge of industry standards and procurement best practices across various domains.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      // No max_tokens limit - allow comprehensive responses
    });

    const content = response.choices[0]?.message?.content || "";

    const section: RftSection = {
      sectionId: id,
      title,
      content,
    };

    // Generate subsections if defined in template
    if (subsections && Array.isArray(subsections)) {
      section.subsections = [];
      for (const subConfig of subsections) {
        const subsection = await generateRftSection(
          subConfig,
          businessCaseExtract,
          businessCaseContent
        );
        section.subsections.push(subsection);
      }
    }

    return section;
  } catch (error) {
    console.error(`Error generating RFT section ${title}:`, error);
    return {
      sectionId: id,
      title,
      content: `Error generating this section. Please review and edit manually.`,
    };
  }
}

/**
 * Generate complete RFT document from business case using a template
 */
export async function generateRftFromBusinessCase(
  businessCaseId: string,
  templateId: string,
  projectId: string
): Promise<InsertGeneratedRft> {
  // Get business case
  const businessCase = await storage.getBusinessCase(businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  // Get template
  const template = await storage.getRftTemplate(templateId);
  if (!template) {
    throw new Error("RFT template not found");
  }

  console.log(`Generating RFT for business case: ${businessCase.name}`);

  // Extract business case information
  const businessCaseExtract = await extractBusinessCaseInfo(
    businessCase.documentContent || ""
  );

  console.log(`✅ Extracted business case info for: ${businessCaseExtract.projectName}`);
  console.log(`📋 Business Objective: ${businessCaseExtract.businessObjective.substring(0, 100)}...`);
  console.log(`📊 Key Requirements: ${businessCaseExtract.keyRequirements.length} items`);
  console.log(`⚠️  Risks: ${businessCaseExtract.risks.length} items`);
  console.log(`🎯 Success Criteria: ${businessCaseExtract.successCriteria.length} items`);

  // Generate all sections from template
  const sections: RftSection[] = [];
  const templateSections = (template.sections as any)?.sections || [];

  for (const sectionConfig of templateSections) {
    console.log(`Generating section: ${sectionConfig.title}`);
    const section = await generateRftSection(
      sectionConfig,
      businessCaseExtract,
      businessCase.documentContent || ""
    );
    sections.push(section);
  }

  console.log(`Generated ${sections.length} RFT sections`);

  // Generate all 4 questionnaires using AI
  console.log("Generating questionnaires...");
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
  ]);

  console.log("Generated all questionnaire questions, creating Excel files...");

  // Generate Excel files
  const questionnairePaths = await generateAllQuestionnaires(projectId, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
  });

  console.log("Excel questionnaires created successfully");

  // Create generated RFT record with all deliverables
  const generatedRft: InsertGeneratedRft = {
    projectId,
    businessCaseId,
    templateId,
    name: `${businessCaseExtract.projectName} - RFT`,
    sections: { sections },
    productQuestionnairePath: questionnairePaths.productPath,
    nfrQuestionnairePath: questionnairePaths.nfrPath,
    cybersecurityQuestionnairePath: questionnairePaths.cybersecurityPath,
    agileQuestionnairePath: questionnairePaths.agilePath,
    status: "draft",
    version: 1,
    metadata: {
      generatedAt: new Date().toISOString(),
      model: "gpt-4o",
      templateName: template.name,
      businessCaseName: businessCase.name,
      questionnaireStats: {
        productQuestions: productQuestions.length,
        nfrQuestions: nfrQuestions.length,
        cybersecurityQuestions: cybersecurityQuestions.length,
        agileQuestions: agileQuestions.length,
      },
    },
  };

  return generatedRft;
}

/**
 * Regenerate a specific section of an RFT
 */
export async function regenerateRftSection(
  rftId: string,
  sectionId: string
): Promise<RftSection> {
  const rft = await storage.getGeneratedRft(rftId);
  if (!rft) {
    throw new Error("Generated RFT not found");
  }

  const businessCase = await storage.getBusinessCase(rft.businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  const template = await storage.getRftTemplate(rft.templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  // Find section config in template
  const templateSections = (template.sections as any)?.sections || [];
  const sectionConfig = templateSections.find((s: any) => s.id === sectionId);
  
  if (!sectionConfig) {
    throw new Error("Section not found in template");
  }

  // Extract business case info
  const businessCaseExtract = await extractBusinessCaseInfo(
    businessCase.documentContent || ""
  );

  // Regenerate the section
  const newSection = await generateRftSection(
    sectionConfig,
    businessCaseExtract,
    businessCase.documentContent || ""
  );

  return newSection;
}

/**
 * Generate all RFT files and upload to Azure Blob Storage
 * Follows the same pattern as mock data generation
 */
export async function publishRftFilesToAzure(rftId: string): Promise<{
  docxBlobUrl: string;
  pdfBlobUrl: string;
  productQuestionnaireBlobUrl: string;
  nfrQuestionnaireBlobUrl: string;
  cybersecurityQuestionnaireBlobUrl: string;
  agileQuestionnaireBlobUrl: string;
}> {
  const rft = await storage.getGeneratedRft(rftId);
  if (!rft) {
    throw new Error("RFT not found");
  }

  const project = await storage.getProject(rft.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const businessCase = await storage.getBusinessCase(rft.businessCaseId);
  if (!businessCase) {
    throw new Error("Business case not found");
  }

  console.log(`📤 Publishing RFT files to Azure Blob Storage for: ${rft.name}`);

  // Import required services
  const fs = await import("fs");
  const path = await import("path");
  const { generateDocxDocument, generatePdfDocument } = await import("./documentGenerator");
  const { azureBlobStorageService } = await import("../azure/azureBlobStorage");

  // Extract sections from RFT
  const sections = (rft.sections as any)?.sections || [];
  if (sections.length === 0) {
    throw new Error("No sections found in RFT");
  }

  // Extract business case information for questionnaire generation
  const businessCaseExtract: BusinessCaseExtract = {
    projectName: rft.name,
    businessObjective: businessCase.documentContent || `Modernize ${rft.name}`,
    scope: `Full implementation of ${rft.name}`,
    stakeholders: ["IT Department", "Operations Team", "Executive Leadership"],
    budget: "To be determined based on vendor proposals",
    timeline: "12-18 months",
    keyRequirements: sections.map((s: any) => s.title).filter(Boolean) || [
      "Cloud-native architecture",
      "Scalable and secure platform",
    ],
    risks: ["Implementation delays", "Budget overruns"],
    successCriteria: ["On-time delivery", "Budget adherence"],
  };

  // Generate questionnaires with AI (30, 50, 20, 20)
  console.log("Generating AI-powered questionnaires...");
  const [productQuestions, nfrQuestions, cybersecurityQuestions, agileQuestions] = await Promise.all([
    generateQuestionnaireQuestions(businessCaseExtract, "product", 30),
    generateQuestionnaireQuestions(businessCaseExtract, "nfr", 50),
    generateQuestionnaireQuestions(businessCaseExtract, "cybersecurity", 20),
    generateQuestionnaireQuestions(businessCaseExtract, "agile", 20),
  ]);

  // Generate Excel files
  console.log("Creating Excel questionnaires...");
  const questionnairePaths = await generateAllQuestionnaires(project.id, {
    product: productQuestions,
    nfr: nfrQuestions,
    cybersecurity: cybersecurityQuestions,
    agile: agileQuestions,
  });

  // Generate DOCX document
  console.log("Generating DOCX document...");
  const docxPath = path.join(process.cwd(), "uploads", "documents", `RFT_${rft.id}.docx`);
  await generateDocxDocument({
    projectName: rft.name,
    sections,
    outputPath: docxPath,
  });

  // Generate PDF document
  console.log("Generating PDF document...");
  const pdfPath = path.join(process.cwd(), "uploads", "documents", `RFT_${rft.id}.pdf`);
  await generatePdfDocument({
    projectName: rft.name,
    sections,
    outputPath: pdfPath,
  });

  // Read file contents into buffers
  const docxBuffer = fs.readFileSync(docxPath);
  const pdfBuffer = fs.readFileSync(pdfPath);

  console.log("Uploading files to Azure Blob Storage...");

  const sanitizedName = rft.name.replace(/[^a-zA-Z0-9]/g, '_');

  // Upload all files to Azure Blob Storage
  // Use consistent naming WITHOUT timestamps so vendor response generation can find them
  const uploadResults = await Promise.all([
    // Upload RFT document (DOCX)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${sanitizedName}_RFT.docx`,
      docxBuffer
    ),
    // Upload RFT document (PDF)
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/${sanitizedName}_RFT.pdf`,
      pdfBuffer
    ),
    // Upload Product Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Product_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.productPath)
    ),
    // Upload NFR Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/NFR_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.nfrPath)
    ),
    // Upload Cybersecurity Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Cybersecurity_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.cybersecurityPath)
    ),
    // Upload Agile Questionnaire
    azureBlobStorageService.uploadDocument(
      `project-${project.id}/RFT_Generated/Agile_Questionnaire.xlsx`,
      fs.readFileSync(questionnairePaths.agilePath)
    ),
  ]);

  console.log(`✅ Uploaded ${uploadResults.length} files to Azure Blob Storage`);

  // Clean up temporary files
  try {
    fs.unlinkSync(docxPath);
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(questionnairePaths.productPath);
    fs.unlinkSync(questionnairePaths.nfrPath);
    fs.unlinkSync(questionnairePaths.cybersecurityPath);
    fs.unlinkSync(questionnairePaths.agilePath);
  } catch (error) {
    console.error("Error cleaning up temporary files:", error);
  }

  // Return Azure blob URLs
  return {
    docxBlobUrl: uploadResults[0].blobUrl,
    pdfBlobUrl: uploadResults[1].blobUrl,
    productQuestionnaireBlobUrl: uploadResults[2].blobUrl,
    nfrQuestionnaireBlobUrl: uploadResults[3].blobUrl,
    cybersecurityQuestionnaireBlobUrl: uploadResults[4].blobUrl,
    agileQuestionnaireBlobUrl: uploadResults[5].blobUrl,
  };
}
