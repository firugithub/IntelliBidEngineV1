import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface BusinessCaseInput {
  projectName: string;
  projectObjective: string;
  projectScope?: string;
  timeline?: string;
  budget?: string;
  keyRequirements?: string;
  successCriteria?: string;
}

/**
 * Generate a comprehensive lean business case document from user's project idea
 */
export async function generateLeanBusinessCase(
  input: BusinessCaseInput
): Promise<string> {
  const prompt = `You are an expert business analyst creating a Lean Business Case document for an aviation/airline industry project.

Generate a comprehensive, professional business case document based on the following information:

Project Name: ${input.projectName}
Business Objective: ${input.projectObjective}
${input.projectScope ? `Scope: ${input.projectScope}` : ""}
${input.timeline ? `Timeline: ${input.timeline}` : ""}
${input.budget ? `Budget: ${input.budget}` : ""}
${input.keyRequirements ? `Key Requirements: ${input.keyRequirements}` : ""}
${input.successCriteria ? `Success Criteria: ${input.successCriteria}` : ""}

Create a structured Lean Business Case document with the following sections:

1. Executive Summary
   - Brief overview of the project
   - Business value proposition
   - Key recommendations

2. Business Context and Need
   - Current situation and challenges
   - Business drivers for this initiative
   - Alignment with strategic objectives

3. Project Scope and Objectives
   - Detailed scope description
   - Primary and secondary objectives
   - Out of scope items
   - Key deliverables

4. Stakeholder Analysis
   - Key stakeholders and their interests
   - Impact on different business units
   - Change management considerations

5. Solution Overview
   - Proposed solution description
   - Technical approach (high-level)
   - Implementation approach

6. Business Benefits
   - Quantifiable benefits (financial, operational)
   - Qualitative benefits
   - Value realization timeline

7. Cost Analysis
   - Budget breakdown
   - Cost components (development, licenses, infrastructure, people)
   - Total cost of ownership

8. Timeline and Milestones
   - Project phases
   - Key milestones
   - Critical path items

9. Risk Assessment
   - Key risks and their impact
   - Mitigation strategies
   - Dependencies and constraints

10. Success Criteria and Metrics
    - KPIs and success metrics
    - Measurement approach
    - Target outcomes

11. Recommendations
    - Recommended approach
    - Next steps
    - Decision points

Format the document in clear, professional language suitable for executive review. Use proper headings, bullet points, and structured content. Make it comprehensive and aviation industry-focused.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert business case writer with deep experience in aviation and airline industry projects. You create comprehensive, professional business case documents that are clear, structured, and suitable for executive decision-making.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent) {
      throw new Error("No content generated from OpenAI");
    }

    return generatedContent;
  } catch (error) {
    console.error("Error generating business case:", error);
    throw new Error("Failed to generate business case with AI");
  }
}
