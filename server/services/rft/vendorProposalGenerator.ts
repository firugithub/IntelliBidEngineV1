/**
 * AI-Powered Vendor Proposal Generator
 * 
 * Generates realistic, diverse vendor proposals based on vendor personas
 * Creates unique technical approaches, documentation, and responses for each vendor
 */

import { getOpenAIClient } from "../ai/aiAnalysis";
import { getVendorPersona, type VendorPersona } from "./vendorPersonas";

export interface ProposalGenerationContext {
  vendorName: string;
  rftTitle: string;
  businessObjective: string;
  scope: string;
  technicalRequirements: string[];
  nonFunctionalRequirements: string[];
}

export interface GeneratedProposal {
  vendorName: string;
  executiveSummary: string;
  technicalApproach: string;
  productFeatures: string;
  implementationPlan: string;
  pricingModel: string;
  riskMitigation: string;
}

/**
 * Generate a realistic, vendor-specific proposal using AI
 */
export async function generateVendorProposal(
  context: ProposalGenerationContext
): Promise<GeneratedProposal> {
  const persona = getVendorPersona(context.vendorName);
  
  console.log(`🎭 Generating proposal for ${context.vendorName} using ${persona.marketPosition} persona`);
  
  const client = await getOpenAIClient();
  
  // Build persona-specific generation prompt
  const systemPrompt = buildSystemPrompt(persona);
  const userPrompt = buildUserPrompt(context, persona);
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8, // Higher temperature for more diversity
      max_tokens: 3000,
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }
    
    // Parse structured response
    const proposal = parseProposalResponse(content, context.vendorName);
    
    console.log(`   ✅ Generated ${persona.responseStyle.detailLevel} proposal with ${persona.responseStyle.documentationQuality} documentation quality`);
    
    return proposal;
    
  } catch (error) {
    console.error(`❌ Failed to generate proposal for ${context.vendorName}:`, error);
    
    // Fallback to template-based proposal
    return generateFallbackProposal(context, persona);
  }
}

/**
 * Build persona-specific system prompt
 */
function buildSystemPrompt(persona: VendorPersona): string {
  return `You are writing a vendor proposal response on behalf of ${persona.name}.

COMPANY PROFILE:
${persona.companyProfile}

MARKET POSITION: ${persona.marketPosition}

TECHNICAL APPROACH:
- Architecture: ${persona.technicalApproach.architecture}
- Innovation Level: ${persona.technicalApproach.innovationLevel}
- Integration Complexity: ${persona.technicalApproach.integrationComplexity}

KEY STRENGTHS TO HIGHLIGHT:
${persona.strengths.domain.map(s => `- ${s}`).join('\n')}
${persona.strengths.technical.map(s => `- ${s}`).join('\n')}
${persona.strengths.business.map(s => `- ${s}`).join('\n')}

KNOWN GAPS (address honestly or work around):
${persona.gaps.technical.map(g => `- ${g}`).join('\n')}
${persona.gaps.business.map(g => `- ${g}`).join('\n')}

RESPONSE STYLE:
- Documentation Quality: ${persona.responseStyle.documentationQuality}
- Compliance Approach: ${persona.responseStyle.complianceApproach}
- Detail Level: ${persona.responseStyle.detailLevel}

Write a realistic ${persona.responseStyle.detailLevel} proposal that:
1. Emphasizes your unique strengths
2. Addresses gaps tactfully (mitigation strategies, roadmap commitments)
3. Reflects your ${persona.responseStyle.documentationQuality} documentation style
4. Maintains authenticity - don't claim capabilities you don't have
5. Uses specific technical details and aviation industry terminology`;
}

/**
 * Build user prompt with RFT context
 */
function buildUserPrompt(context: ProposalGenerationContext, persona: VendorPersona): string {
  return `Generate a vendor proposal for the following RFT:

RFT TITLE: ${context.rftTitle}

BUSINESS OBJECTIVE:
${context.businessObjective}

PROJECT SCOPE:
${context.scope}

TECHNICAL REQUIREMENTS:
${context.technicalRequirements.slice(0, 8).map((req, i) => `${i + 1}. ${req}`).join('\n')}

NON-FUNCTIONAL REQUIREMENTS:
${context.nonFunctionalRequirements.slice(0, 5).map((req, i) => `${i + 1}. ${req}`).join('\n')}

Create a proposal with the following sections (use |SECTION_NAME| markers):

|EXECUTIVE_SUMMARY|
Brief overview (3-4 sentences) emphasizing your unique value proposition

|TECHNICAL_APPROACH|
Your architectural approach, integration strategy, and technical differentiation

|PRODUCT_FEATURES|
How your product capabilities address the requirements (highlight strengths, acknowledge gaps)

|IMPLEMENTATION_PLAN|
Timeline, phases, and delivery approach reflecting your typical methodology

|PRICING_MODEL|
Pricing structure (specific numbers not required, just model - SaaS, license, etc.)

|RISK_MITIGATION|
Key risks and your mitigation strategies

Keep each section concise (3-5 paragraphs max). Be specific and technical. Reflect ${persona.name}'s actual market positioning.`;
}

/**
 * Parse AI response into structured proposal
 */
function parseProposalResponse(content: string, vendorName: string): GeneratedProposal {
  const sections = {
    executiveSummary: extractSection(content, 'EXECUTIVE_SUMMARY'),
    technicalApproach: extractSection(content, 'TECHNICAL_APPROACH'),
    productFeatures: extractSection(content, 'PRODUCT_FEATURES'),
    implementationPlan: extractSection(content, 'IMPLEMENTATION_PLAN'),
    pricingModel: extractSection(content, 'PRICING_MODEL'),
    riskMitigation: extractSection(content, 'RISK_MITIGATION'),
  };
  
  return {
    vendorName,
    ...sections
  };
}

/**
 * Extract section content between markers with fallback to AI-free text
 */
function extractSection(content: string, sectionName: string): string {
  const marker = `|${sectionName}|`;
  const startIdx = content.indexOf(marker);
  
  if (startIdx === -1) {
    // Fallback: Try to extract content without markers using section name as header
    const headerPattern = new RegExp(`${sectionName.replace(/_/g, ' ')}[:\n]`, 'i');
    const headerMatch = content.match(headerPattern);
    
    if (headerMatch && headerMatch.index !== undefined) {
      const contentStart = headerMatch.index + headerMatch[0].length;
      const remainingContent = content.substring(contentStart);
      
      // Extract until next section header or end
      const nextHeaderMatch = remainingContent.match(/\n[A-Z][A-Z ]+[:\n]/);
      const sectionText = nextHeaderMatch 
        ? remainingContent.substring(0, nextHeaderMatch.index)
        : remainingContent;
      
      return sectionText.trim();
    }
    
    console.warn(`⚠️  Section ${sectionName} not found with marker or header`);
    return `[Content not available - AI generation incomplete]`;
  }
  
  const contentAfterMarker = content.substring(startIdx + marker.length);
  const nextMarkerIdx = contentAfterMarker.indexOf('|');
  
  const sectionContent = nextMarkerIdx === -1
    ? contentAfterMarker
    : contentAfterMarker.substring(0, nextMarkerIdx);
  
  return sectionContent.trim();
}

/**
 * Generate fallback proposal when AI fails (uses persona for realistic content)
 */
function generateFallbackProposal(
  context: ProposalGenerationContext,
  persona: VendorPersona
): GeneratedProposal {
  // Extract persona characteristics for realistic fallback
  const domainStrength = persona.strengths.domain[0] || 'comprehensive industry capabilities';
  const technicalStrength = persona.strengths.technical[0] || 'proven technical excellence';
  const businessStrength = persona.strengths.business[0] || 'strong market presence';
  const technicalGap = persona.gaps.technical[0] || 'ongoing technology evolution';
  const businessGap = persona.gaps.business[0] || 'market dynamics';
  
  return {
    vendorName: context.vendorName,
    
    executiveSummary: `${persona.name} proposes a ${persona.technicalApproach.architecture.toLowerCase()} solution for ${context.rftTitle}. As a ${persona.marketPosition.replace('_', ' ')} in the aviation technology market, we bring ${domainStrength.toLowerCase()} to address your requirements. Our solution emphasizes ${technicalStrength.toLowerCase()} with ${persona.responseStyle.documentationQuality} documentation and ${businessStrength.toLowerCase()}.`,
    
    technicalApproach: `Our technical approach leverages ${persona.technicalApproach.architecture} with ${persona.technicalApproach.innovationLevel.replace('_', ' ')} capabilities. ${technicalStrength} ensures reliable, scalable operations. Integration follows industry standards with ${persona.technicalApproach.integrationComplexity} complexity, utilizing modern APIs and proven patterns. ${persona.strengths.technical[1] || 'Advanced platform capabilities'} provide additional technical advantages.`,
    
    productFeatures: `Our product suite addresses the core requirements through ${domainStrength}. ${persona.strengths.domain[1] || 'Comprehensive feature set'} provides the foundation for meeting your objectives. ${persona.gaps.technical.length > 0 ? `We acknowledge ${technicalGap.toLowerCase()}, which we address through our product roadmap and continuous innovation.` : 'Our feature set comprehensively covers the specified requirements.'} ${persona.strengths.domain[2] || 'Industry-leading capabilities'} ensure competitive positioning.`,
    
    implementationPlan: `Implementation follows our proven methodology with phased delivery approach. Timeline estimates reflect ${persona.responseStyle.detailLevel} planning based on similar engagements. We provide ${persona.responseStyle.documentationQuality} project documentation throughout all phases. Our ${persona.responseStyle.complianceApproach} compliance approach ensures regulatory alignment. ${businessStrength} supports successful project delivery.`,
    
    pricingModel: `${persona.name} offers flexible commercial models aligned with ${persona.marketPosition === 'market_leader' ? 'enterprise requirements and proven value delivery' : 'competitive market positioning and ROI optimization'}. ${persona.gaps.business.some(g => g.toLowerCase().includes('pric')) ? 'Our pricing reflects premium capabilities and proven track record with industry-leading airlines.' : 'Pricing is structured to deliver strong ROI with transparent cost models and flexible terms.'} ${persona.marketPosition !== 'emerging' ? 'Enterprise licensing options available.' : 'Startup-friendly pricing available.'}`,
    
    riskMitigation: `Key risks include ${technicalGap.toLowerCase()}, which we mitigate through ${businessStrength.toLowerCase()} and continuous platform evolution. ${persona.strengths.technical[1] || 'Our proven platform capabilities'} reduce operational risks. We provide comprehensive support with ${persona.responseStyle.documentationQuality} documentation to minimize knowledge transfer risks. ${persona.gaps.business.length > 0 ? `We address ${businessGap.toLowerCase()} through strategic partnerships and ongoing investment.` : 'Comprehensive risk management framework ensures project success.'}`
  };
}

/**
 * Format proposal as plain text document
 */
export function formatProposalAsDocument(proposal: GeneratedProposal): string {
  return `VENDOR PROPOSAL - ${proposal.vendorName}

═══════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
${proposal.executiveSummary}

TECHNICAL APPROACH
${proposal.technicalApproach}

PRODUCT FEATURES & CAPABILITIES
${proposal.productFeatures}

IMPLEMENTATION PLAN
${proposal.implementationPlan}

PRICING MODEL
${proposal.pricingModel}

RISK MITIGATION
${proposal.riskMitigation}

═══════════════════════════════════════════════════════════════
End of Proposal`;
}
