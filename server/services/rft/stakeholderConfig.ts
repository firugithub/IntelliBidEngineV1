/**
 * Stakeholder Configuration for RFT Collaborative Review
 * 
 * Defines stakeholder roles, their responsibilities, and default section assignments
 * for the collaborative RFT review workflow.
 */

export interface StakeholderRole {
  id: string;
  name: string;
  description: string;
  color: string; // For UI color coding
  icon?: string; // Optional icon identifier
  responsibilities: string[];
}

export interface SectionMapping {
  sectionId: string;
  sectionTitle: string;
  defaultAssignee: string; // Default stakeholder role ID
  category: "technical" | "security" | "business" | "procurement" | "other";
}

/**
 * Aviation-specific stakeholder roles for airline procurement
 */
export const STAKEHOLDER_ROLES: StakeholderRole[] = [
  {
    id: "technical_pm",
    name: "Technical PM",
    description: "Technical Program Manager responsible for functional requirements and project delivery",
    color: "#3B82F6", // Blue
    icon: "user-cog",
    responsibilities: [
      "Functional requirements validation",
      "Project scope and timeline review",
      "Business case alignment",
      "Stakeholder coordination"
    ]
  },
  {
    id: "solution_architect",
    name: "Solution Architect",
    description: "Enterprise Architect responsible for technical architecture and integration",
    color: "#8B5CF6", // Purple
    icon: "layers",
    responsibilities: [
      "Architecture design review",
      "Non-functional requirements (NFRs)",
      "System integration requirements",
      "Technology stack validation",
      "Scalability and performance criteria"
    ]
  },
  {
    id: "cybersecurity_analyst",
    name: "Cybersecurity Analyst",
    description: "Security specialist responsible for cybersecurity compliance and risk assessment",
    color: "#EF4444", // Red
    icon: "shield",
    responsibilities: [
      "Security requirements review",
      "Compliance validation (GDPR, PCI-DSS, ISO 27001)",
      "Risk assessment",
      "Data protection requirements",
      "Security controls verification"
    ]
  },
  {
    id: "engineering_lead",
    name: "Engineering Lead",
    description: "Engineering team lead responsible for technical implementation feasibility",
    color: "#10B981", // Green
    icon: "code",
    responsibilities: [
      "Technical implementation review",
      "Development methodology requirements",
      "CI/CD and DevOps requirements",
      "Testing and quality assurance criteria",
      "Technical debt assessment"
    ]
  },
  {
    id: "procurement_specialist",
    name: "Procurement Specialist",
    description: "Procurement officer responsible for commercial terms and vendor evaluation",
    color: "#F59E0B", // Amber
    icon: "shopping-cart",
    responsibilities: [
      "Commercial terms review",
      "Pricing and payment terms",
      "Contract requirements",
      "Vendor qualification criteria",
      "SLA and penalty clauses"
    ]
  },
  {
    id: "product_owner",
    name: "Product Owner",
    description: "Product owner responsible for product vision and user requirements",
    color: "#EC4899", // Pink
    icon: "package",
    responsibilities: [
      "Product requirements validation",
      "User experience criteria",
      "Feature prioritization",
      "Acceptance criteria",
      "Product roadmap alignment"
    ]
  },
  {
    id: "compliance_officer",
    name: "Compliance Officer",
    description: "Compliance specialist ensuring regulatory and aviation industry standards",
    color: "#6366F1", // Indigo
    icon: "clipboard-check",
    responsibilities: [
      "Regulatory compliance (IATA, ICAO, EASA)",
      "Aviation industry standards",
      "Data privacy regulations",
      "Audit requirements",
      "Certification requirements"
    ]
  }
];

/**
 * Default section-to-stakeholder mappings based on RFT section types
 * Used when creating templates or as suggested defaults
 */
export const DEFAULT_SECTION_MAPPINGS: SectionMapping[] = [
  // AI-Generated RFT Standard Sections (section-1 through section-10)
  {
    sectionId: "section-1",
    sectionTitle: "Introduction & Overview",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "section-2",
    sectionTitle: "Project Background & Objectives",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "section-3",
    sectionTitle: "Scope & Deliverables",
    defaultAssignee: "product_owner",
    category: "business"
  },
  {
    sectionId: "section-4",
    sectionTitle: "Evaluation Criteria",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "section-5",
    sectionTitle: "Commercial Terms",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "section-6",
    sectionTitle: "Contractual Requirements",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "section-7",
    sectionTitle: "Non-Functional Requirements (NFRs)",
    defaultAssignee: "solution_architect",
    category: "technical"
  },
  {
    sectionId: "section-8",
    sectionTitle: "Governance & Risk Management",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "section-9",
    sectionTitle: "Response Templates & Instructions",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "section-10",
    sectionTitle: "Appendices",
    defaultAssignee: "technical_pm",
    category: "other"
  },

  // Business & Functional Sections
  {
    sectionId: "project_overview",
    sectionTitle: "Project Overview",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "business_objectives",
    sectionTitle: "Business Objectives",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "scope",
    sectionTitle: "Project Scope",
    defaultAssignee: "technical_pm",
    category: "business"
  },
  {
    sectionId: "functional_requirements",
    sectionTitle: "Functional Requirements",
    defaultAssignee: "product_owner",
    category: "business"
  },
  {
    sectionId: "deliverables",
    sectionTitle: "Deliverables",
    defaultAssignee: "technical_pm",
    category: "business"
  },

  // Technical Sections
  {
    sectionId: "technical_requirements",
    sectionTitle: "Technical Requirements",
    defaultAssignee: "solution_architect",
    category: "technical"
  },
  {
    sectionId: "architecture_requirements",
    sectionTitle: "Architecture Requirements",
    defaultAssignee: "solution_architect",
    category: "technical"
  },
  {
    sectionId: "nfr",
    sectionTitle: "Non-Functional Requirements (NFRs)",
    defaultAssignee: "solution_architect",
    category: "technical"
  },
  {
    sectionId: "integration_requirements",
    sectionTitle: "Integration Requirements",
    defaultAssignee: "solution_architect",
    category: "technical"
  },
  {
    sectionId: "performance_requirements",
    sectionTitle: "Performance Requirements",
    defaultAssignee: "solution_architect",
    category: "technical"
  },

  // Security Sections
  {
    sectionId: "security_requirements",
    sectionTitle: "Security Requirements",
    defaultAssignee: "cybersecurity_analyst",
    category: "security"
  },
  {
    sectionId: "data_protection",
    sectionTitle: "Data Protection & Privacy",
    defaultAssignee: "cybersecurity_analyst",
    category: "security"
  },
  {
    sectionId: "compliance_requirements",
    sectionTitle: "Compliance Requirements",
    defaultAssignee: "compliance_officer",
    category: "security"
  },

  // Engineering Sections
  {
    sectionId: "development_methodology",
    sectionTitle: "Development Methodology",
    defaultAssignee: "engineering_lead",
    category: "technical"
  },
  {
    sectionId: "testing_requirements",
    sectionTitle: "Testing & QA Requirements",
    defaultAssignee: "engineering_lead",
    category: "technical"
  },
  {
    sectionId: "deployment_requirements",
    sectionTitle: "Deployment Requirements",
    defaultAssignee: "engineering_lead",
    category: "technical"
  },

  // Procurement Sections
  {
    sectionId: "commercial_terms",
    sectionTitle: "Commercial Terms",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "pricing_structure",
    sectionTitle: "Pricing Structure",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "sla_requirements",
    sectionTitle: "SLA Requirements",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "vendor_qualifications",
    sectionTitle: "Vendor Qualifications",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  },
  {
    sectionId: "contract_terms",
    sectionTitle: "Contract Terms & Conditions",
    defaultAssignee: "procurement_specialist",
    category: "procurement"
  }
];

/**
 * Get stakeholder role by ID
 */
export function getStakeholderRole(roleId: string): StakeholderRole | undefined {
  return STAKEHOLDER_ROLES.find(role => role.id === roleId);
}

/**
 * Get default assignee for a section
 */
export function getDefaultAssignee(sectionId: string): string {
  const mapping = DEFAULT_SECTION_MAPPINGS.find(m => m.sectionId === sectionId);
  return mapping?.defaultAssignee || "technical_pm"; // Default to Technical PM
}

/**
 * Get all sections for a specific stakeholder category
 */
export function getSectionsByCategory(category: SectionMapping["category"]): SectionMapping[] {
  return DEFAULT_SECTION_MAPPINGS.filter(m => m.category === category);
}

/**
 * Get all sections assigned to a specific stakeholder role
 */
export function getSectionsByAssignee(assigneeId: string): SectionMapping[] {
  return DEFAULT_SECTION_MAPPINGS.filter(m => m.defaultAssignee === assigneeId);
}

/**
 * Validate if a stakeholder role exists
 */
export function isValidStakeholderRole(roleId: string): boolean {
  return STAKEHOLDER_ROLES.some(role => role.id === roleId);
}

/**
 * Get color for a stakeholder role (for UI)
 */
export function getStakeholderColor(roleId: string): string {
  const role = getStakeholderRole(roleId);
  return role?.color || "#6B7280"; // Default gray
}

/**
 * Aviation-specific compliance frameworks
 */
export const AVIATION_COMPLIANCE_FRAMEWORKS = [
  "IATA ONE Record",
  "ICAO Annex 17 (Security)",
  "EASA Part-IS (Information Security)",
  "ISO 27001 (Information Security)",
  "PCI-DSS (Payment Card Industry)",
  "GDPR (Data Protection)",
  "SOC 2 Type II",
  "NIST Cybersecurity Framework"
];

/**
 * Aviation-specific integration standards
 */
export const AVIATION_INTEGRATION_STANDARDS = [
  "IATA NDC (New Distribution Capability)",
  "IATA ONE Order",
  "IATA Baggage Services",
  "Amadeus GDS API",
  "Sabre GDS API",
  "SITA WorldTracer",
  "ARINC Standards",
  "ACI Airport Standards"
];
