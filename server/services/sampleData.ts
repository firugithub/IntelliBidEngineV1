import { storage } from "../storage";

const PORTFOLIOS = [
  { name: "Flight Operations", description: "Flight planning, crew management, and operational excellence" },
  { name: "Aircraft Maintenance & Engineering", description: "MRO services, technical operations, and fleet management" },
  { name: "In-Flight Services & Catering", description: "Cabin services, catering operations, and passenger experience" },
  { name: "Ground Services & Cargo", description: "Ground handling, cargo operations, and ramp services" },
  { name: "Passenger Services & CX", description: "Check-in, boarding, loyalty programs, and customer experience" },
  { name: "Digital & Technology", description: "IT infrastructure, digital platforms, and innovation" },
  { name: "Network Planning & Revenue", description: "Route optimization, pricing, and revenue management" },
  { name: "Safety & Compliance", description: "Aviation safety, regulatory compliance, and quality assurance" },
  { name: "Airport Services", description: "Lounge operations, terminal services, and facilities management" },
  { name: "Procurement & Supply Chain", description: "Strategic sourcing, vendor management, and logistics" },
];

export async function seedPortfolios() {
  try {
    const portfolios = await storage.getAllPortfolios();
    
    // Only seed if portfolios don't exist
    if (portfolios.length === 0) {
      for (const portfolio of PORTFOLIOS) {
        await storage.createPortfolio(portfolio);
      }
      console.log(`Seeded ${PORTFOLIOS.length} portfolios`);
    }
    
    return await storage.getAllPortfolios();
  } catch (error) {
    console.error("Error seeding portfolios:", error);
    throw error;
  }
}

export async function seedSampleData() {
  try {
    // Create or get Digital & Technology portfolio
    let portfolio = await storage.getPortfolioByName("Digital & Technology");
    if (!portfolio) {
      portfolio = await storage.createPortfolio({
        name: "Digital & Technology",
        description: "IT infrastructure, digital platforms, and innovation",
      });
    }

    // Create a sample project
    const project = await storage.createProject({
      portfolioId: portfolio.id,
      name: "Passenger Service System Upgrade",
      initiativeName: "Nujum Digital Experience 2025",
      vendorList: ["Amadeus IT Group", "Sabre Corporation", "SITA"],
      status: "completed",
    });

    // Create sample requirement
    const requirement = await storage.createRequirement({
      projectId: project.id,
      fileName: "Requirements_Document.pdf",
      extractedData: {
        text: "Sample requirements document content",
        fileName: "Requirements_Document.pdf",
      },
      evaluationCriteria: [
        {
          name: "Technical Fit",
          weight: 30,
          description: "How well the solution meets technical requirements",
        },
        {
          name: "Delivery Risk",
          weight: 25,
          description: "Risk factors in implementation timeline",
        },
        {
          name: "Cost",
          weight: 20,
          description: "Total cost of ownership",
        },
        {
          name: "Compliance",
          weight: 15,
          description: "Security and regulatory compliance",
        },
        {
          name: "Support",
          weight: 10,
          description: "Vendor support quality",
        },
      ],
    });

    // Create sample proposals
    const proposals = [
      {
        vendorName: "Amadeus IT Group",
        fileName: "Amadeus_Proposal.pdf",
        extractedData: {
          vendorName: "Amadeus IT Group",
          capabilities: [
            "Altéa PSS Suite with full NDC capability",
            "Real-time inventory and reservation management",
            "Advanced revenue management",
            "Mobile-first passenger experience",
          ],
          technicalApproach: "Cloud-native microservices with proven airline deployments",
          integrations: ["REST API", "NDC/ONE Order", "IATA standards", "GDS connectivity"],
          security: "ISO 27001, PCI DSS Level 1, IATA certified",
          support: "24/7 airline operations support with regional hubs",
          costStructure: "$2.5M - $3.2M annually based on passenger volumes",
          timeline: "12-16 months phased implementation",
        },
      },
      {
        vendorName: "Sabre Corporation",
        fileName: "Sabre_Proposal.pdf",
        extractedData: {
          vendorName: "Sabre Corporation",
          capabilities: [
            "SabreSonic platform for full-service carriers",
            "Dynamic pricing and offers",
            "Crew management integration",
            "Loyalty and ancillary revenue optimization",
          ],
          technicalApproach: "Hybrid cloud platform with flexible configuration",
          integrations: ["RESTful APIs", "SITA connectivity", "Standard airline protocols"],
          security: "ISO 27001, SOC 2 Type II, regular penetration testing",
          support: "Global support network with 24/7 airline operations desk",
          costStructure: "$2.8M - $3.5M annually",
          timeline: "14-18 months implementation",
        },
      },
      {
        vendorName: "SITA",
        fileName: "SITA_Proposal.pdf",
        extractedData: {
          vendorName: "SITA",
          capabilities: [
            "SITA Horizon PSS for airline operations",
            "Integrated baggage and check-in systems",
            "Airport common-use infrastructure",
            "Biometric passenger processing",
          ],
          technicalApproach: "Enterprise airline platform with proven MENA deployments",
          integrations: ["IATA standards", "Airport systems", "ARINC protocols", "SITA network"],
          security: "Aviation-grade security, IATA ISAGO compliant",
          support: "24/7 airline operations center with MENA regional expertise",
          costStructure: "$3.2M - $4.0M annually",
          timeline: "16-20 months implementation",
        },
      },
    ];

    for (const proposalData of proposals) {
      const proposal = await storage.createProposal({
        projectId: project.id,
        vendorName: proposalData.vendorName,
        fileName: proposalData.fileName,
        extractedData: proposalData.extractedData,
      });

      // Create evaluation for each proposal
      const evaluationData = {
        "Amadeus IT Group": {
          overallScore: 89,
          technicalFit: 95,
          deliveryRisk: 20,
          cost: "$2.5M - $3.2M",
          compliance: 98,
          status: "recommended" as const,
          rationale:
            "Amadeus IT Group demonstrates exceptional technical alignment with Nujum Air's passenger service system requirements, achieving a 95% technical fit score. The Altéa PSS Suite with full NDC capability ensures modern airline distribution and retailing. With the lowest delivery risk at 20% and outstanding compliance score of 98%, this vendor presents the optimal balance of airline-specific capability, proven MENA deployments, and IATA-certified security. The 12-16 month phased implementation timeline aligns with Nujum's digital transformation roadmap.",
          roleInsights: {
            delivery: [
              "12-16 month phased implementation minimizes operational disruption",
              "NDC-enabled architecture supports Nujum's distribution strategy",
              "Proven deployments at 30+ airlines in MENA region",
              "Clear migration path from legacy PSS with data integrity guarantees",
            ],
            product: [
              "95% coverage of Nujum's passenger service requirements",
              "Full NDC/ONE Order support enables modern airline retailing",
              "Real-time inventory management across all sales channels",
              "Mobile-first design aligns with digital experience goals",
            ],
            architecture: [
              "Cloud-native microservices enable airline operational resilience",
              "IATA PSS certified with ISO 27001 and PCI DSS Level 1",
              "REST API design supports integration with existing systems",
              "Multi-cloud deployment strategy ensures vendor independence",
            ],
            engineering: [
              "Comprehensive airline API library with IATA standards",
              "Integration toolkit for GDS, airport systems, and ancillaries",
              "Dedicated airline developer portal and sandbox environment",
              "Active airline developer community and quarterly SDK updates",
            ],
            procurement: [
              "Competitive 5-year TCO at $2.5M-$3.2M annually per million PAX",
              "99.95% operational uptime SLA with revenue protection clauses",
              "Flexible contract terms with volume discounts available",
              "Transparent pricing with no hidden implementation costs",
            ],
          },
          detailedScores: {
            integration: 90,
            support: 88,
            scalability: 92,
            documentation: 94,
          },
        },
        "Sabre Corporation": {
          overallScore: 84,
          technicalFit: 90,
          deliveryRisk: 30,
          cost: "$2.8M - $3.5M",
          compliance: 92,
          status: "under-review" as const,
          rationale:
            "Sabre Corporation offers a strong airline PSS solution with excellent customization capabilities and proven deployment at full-service carriers globally. The 90% technical fit indicates strong alignment with Nujum's requirements, particularly in crew management and ancillary revenue optimization. Moderate delivery risk of 30% stems from 14-18 month timeline and integration complexity with existing loyalty systems. SOC 2 Type II and ISO 27001 certifications meet airline compliance standards.",
          roleInsights: {
            delivery: [
              "14-18 month implementation timeline allows thorough testing and validation",
              "Hybrid cloud platform offers flexibility in deployment strategy",
              "Proven deployment history at 50+ full-service carriers worldwide",
              "Dedicated migration team with airline-specific expertise",
            ],
            product: [
              "SabreSonic platform designed specifically for full-service carrier operations",
              "Dynamic pricing and offers enable competitive revenue optimization",
              "Strong loyalty program integration supports Nujum's frequent flyer strategy",
              "Ancillary revenue capabilities exceed industry benchmarks",
            ],
            architecture: [
              "Hybrid cloud architecture balances control and scalability",
              "ISO 27001 and SOC 2 Type II meet airline security requirements",
              "Standard airline protocol support for GDS and airport systems",
              "Flexible API design supports custom airline integrations",
            ],
            engineering: [
              "Comprehensive airline developer portal with sandbox environments",
              "Strong integration toolkit for crew, ops, and commercial systems",
              "Active airline developer community with quarterly releases",
              "Dedicated technical account management for enterprise airlines",
            ],
            procurement: [
              "Competitive pricing at $2.8M-$3.5M annually for airline scale",
              "Global support network with 24/7 airline operations coverage",
              "Flexible contract structure with volume-based discounts",
              "Transparent implementation and ongoing maintenance costs",
            ],
          },
          detailedScores: {
            integration: 85,
            support: 90,
            scalability: 88,
            documentation: 84,
          },
        },
        "SITA": {
          overallScore: 78,
          technicalFit: 85,
          deliveryRisk: 40,
          cost: "$3.2M - $4.0M",
          compliance: 95,
          status: "risk-flagged" as const,
          rationale:
            "SITA provides comprehensive airline operations platform with exceptional compliance and security features, achieving 95% compliance score with IATA ISAGO certification. The SITA Horizon PSS includes integrated baggage and check-in systems valuable for airport operations. However, highest delivery risk at 40% is driven by complex airport infrastructure integration and extended 16-20 month timeline. Premium pricing at $3.2M-$4.0M represents the highest total cost, though MENA regional expertise adds strategic value.",
          roleInsights: {
            delivery: [
              "Extended 16-20 month implementation accommodates airport system integration",
              "Proven MENA region deployments provide local market expertise",
              "Common-use infrastructure requires coordination with airport authorities",
              "Well-defined methodology for complex multi-stakeholder projects",
            ],
            product: [
              "Comprehensive PSS with integrated baggage and check-in capabilities",
              "Biometric passenger processing aligns with smart airport initiatives",
              "Strong airport common-use platform for seamless terminal operations",
              "Legacy system support valuable for phased modernization",
            ],
            architecture: [
              "Enterprise platform architecture proven in complex airline environments",
              "IATA ISAGO compliance and aviation-grade security standards",
              "ARINC and SITA network protocols ensure airport connectivity",
              "Traditional architecture may require modernization for cloud strategy",
            ],
            engineering: [
              "Extensive airline and airport integration documentation",
              "SITA network connectivity provides dedicated aviation infrastructure",
              "Custom integration services available for complex requirements",
              "Mature product with comprehensive testing frameworks",
            ],
            procurement: [
              "Premium pricing at $3.2M-$4.0M annually reflects integrated solution",
              "24/7 airline operations center with MENA regional support",
              "Long-term vendor relationship and aviation industry commitment",
              "Higher implementation costs due to airport infrastructure scope",
            ],
          },
          detailedScores: {
            integration: 80,
            support: 92,
            scalability: 82,
            documentation: 88,
          },
        },
      };

      const evalData = evaluationData[proposalData.vendorName as keyof typeof evaluationData];
      if (evalData) {
        await storage.createEvaluation({
          projectId: project.id,
          proposalId: proposal.id,
          ...evalData,
          aiRationale: evalData.rationale,
        });
      }
    }

    console.log(`Sample data seeded successfully! Project ID: ${project.id}`);
    return project.id;
  } catch (error) {
    console.error("Error seeding sample data:", error);
    throw error;
  }
}

export async function seedAllMockData() {
  try {
    console.log("Starting comprehensive mock data generation...");
    
    // 1. Seed portfolios
    await seedPortfolios();
    console.log("✓ Portfolios seeded");
    
    // 2. Seed projects with complete data
    await seedSampleData();
    console.log("✓ Projects, proposals, and evaluations seeded");
    
    // 3. Seed compliance standards
    const standards = await storage.getAllStandards();
    if (standards.length === 0) {
      await storage.createStandard({
        name: "ISO 27001 Information Security",
        description: "Information security management system requirements",
        sections: [
          { id: "iso-001", name: "Access Control", description: "User access management and authentication requirements" },
          { id: "iso-002", name: "Cryptography", description: "Data encryption and cryptographic controls" },
          { id: "iso-003", name: "Physical Security", description: "Physical access controls and environmental security" },
          { id: "iso-004", name: "Incident Management", description: "Security incident response procedures" },
        ],
        tags: ["ISO27001", "Security", "Compliance"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "GDPR Data Protection",
        description: "General Data Protection Regulation compliance framework",
        sections: [
          { id: "gdpr-001", name: "Data Processing", description: "Lawful basis for processing personal data" },
          { id: "gdpr-002", name: "Data Subject Rights", description: "Rights to access, rectification, and erasure" },
          { id: "gdpr-003", name: "Data Breach Notification", description: "Requirements for breach reporting" },
          { id: "gdpr-004", name: "Privacy by Design", description: "Data protection by design and by default" },
        ],
        tags: ["GDPR", "Privacy", "Compliance"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "SOC 2 Trust Services",
        description: "Service Organization Control 2 security criteria",
        sections: [
          { id: "soc2-001", name: "Security", description: "Protection against unauthorized access" },
          { id: "soc2-002", name: "Availability", description: "System availability and performance" },
          { id: "soc2-003", name: "Confidentiality", description: "Protection of confidential information" },
          { id: "soc2-004", name: "Processing Integrity", description: "System processing accuracy and completeness" },
        ],
        tags: ["SOC2", "Security", "Audit"],
        isActive: "true",
      });
      
      console.log("✓ Compliance standards seeded");
    }
    
    // 4. Seed MCP connectors
    const connectors = await storage.getAllMcpConnectors();
    if (connectors.length === 0) {
      await storage.createMcpConnector({
        name: "Confluence Documentation",
        description: "Access to company knowledge base and documentation",
        serverUrl: "https://company.atlassian.net/wiki",
        apiKey: "demo-key-confluence-12345",
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Slack Conversations",
        description: "Integration with team communication channels",
        serverUrl: "https://slack.com/api",
        apiKey: "demo-key-slack-67890",
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "GitHub Repositories",
        description: "Source code and technical documentation access",
        serverUrl: "https://api.github.com",
        apiKey: "demo-key-github-abcde",
        isActive: "false",
      });
      
      console.log("✓ MCP connectors seeded");
    }
    
    console.log("✅ All mock data generated successfully!");
    return { success: true, message: "All mock data generated successfully" };
  } catch (error) {
    console.error("Error seeding all mock data:", error);
    throw error;
  }
}

export async function wipeAllData() {
  try {
    console.log("Starting data wipe...");
    
    // Get all items to delete
    const portfolios = await storage.getAllPortfolios();
    const projects = await storage.getAllProjects();
    const standards = await storage.getAllStandards();
    const connectors = await storage.getAllMcpConnectors();
    
    // Delete all evaluations (by getting all projects and their proposals)
    for (const project of projects) {
      const proposals = await storage.getProposalsByProject(project.id);
      for (const proposal of proposals) {
        const evaluation = await storage.getEvaluationByProposal(proposal.id);
        if (evaluation) {
          await storage.deleteEvaluation(evaluation.id);
        }
      }
    }
    console.log(`✓ Deleted evaluations`);
    
    // Delete all proposals
    for (const project of projects) {
      const proposals = await storage.getProposalsByProject(project.id);
      for (const proposal of proposals) {
        await storage.deleteProposal(proposal.id);
      }
    }
    console.log(`✓ Deleted proposals`);
    
    // Delete all requirements
    for (const project of projects) {
      const requirements = await storage.getRequirementsByProject(project.id);
      for (const requirement of requirements) {
        await storage.deleteRequirement(requirement.id);
      }
    }
    console.log(`✓ Deleted requirements`);
    
    // Delete all projects
    for (const project of projects) {
      await storage.deleteProject(project.id);
    }
    console.log(`✓ Deleted ${projects.length} projects`);
    
    // Delete all portfolios
    for (const portfolio of portfolios) {
      await storage.deletePortfolio(portfolio.id);
    }
    console.log(`✓ Deleted ${portfolios.length} portfolios`);
    
    // Deactivate all standards (soft delete)
    for (const standard of standards) {
      await storage.deactivateStandard(standard.id);
    }
    console.log(`✓ Deactivated ${standards.length} standards`);
    
    // Delete all MCP connectors
    for (const connector of connectors) {
      await storage.deleteMcpConnector(connector.id);
    }
    console.log(`✓ Deleted ${connectors.length} MCP connectors`);
    
    console.log("✅ All data wiped successfully!");
    return { success: true, message: "All data wiped successfully" };
  } catch (error) {
    console.error("Error wiping data:", error);
    throw error;
  }
}
