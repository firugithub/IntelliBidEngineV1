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
        documentType: "vendor-proposal",
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
        const evaluation = await storage.createEvaluation({
          projectId: project.id,
          proposalId: proposal.id,
          ...evalData,
          aiRationale: evalData.rationale,
        });

        // Add detailed evaluation criteria for Product and Architecture roles
        // Product criteria
        const productCriteria = [
          { section: "PSS Core Functionality", question: "Reservation and booking management", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "PSS Core Functionality", question: "Inventory control and seat management", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 100 },
          { section: "PSS Core Functionality", question: "Departure control system (DCS)", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 100 },
          { section: "Distribution & Retailing", question: "NDC (New Distribution Capability) support", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 25 },
          { section: "Distribution & Retailing", question: "IATA ONE Order compliance", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 25 },
          { section: "Distribution & Retailing", question: "Multi-channel distribution (GDS, direct, OTA)", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "Revenue Management", question: "Dynamic pricing and offers", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "Revenue Management", question: "Ancillary revenue management", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "Revenue Management", question: "Loyalty program integration", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "Passenger Services", question: "Mobile app and web booking", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "Passenger Services", question: "Self-service check-in (web, mobile, kiosk)", score: proposalData.vendorName === "Amadeus IT Group" ? 50 : proposalData.vendorName === "Sabre Corporation" ? 50 : 100 },
          { section: "Passenger Services", question: "Biometric passenger processing", score: proposalData.vendorName === "Amadeus IT Group" ? 25 : proposalData.vendorName === "Sabre Corporation" ? 25 : 100 },
        ];

        for (const criterion of productCriteria) {
          const scoreLabel = criterion.score === 100 ? "Fully met through standard functionality" :
                            criterion.score === 50 ? "Partially met through standard or custom extensions" :
                            criterion.score === 25 ? "Not Compliant - Can be developed" : "Not applicable";
          await storage.createEvaluationCriteria({
            evaluationId: evaluation.id,
            role: "product",
            section: criterion.section,
            question: criterion.question,
            score: criterion.score,
            scoreLabel,
          });
        }

        // Architecture criteria
        const architectureCriteria = [
          { section: "System Architecture", question: "Cloud-native microservices design", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 25 },
          { section: "System Architecture", question: "Multi-cloud deployment capability", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "System Architecture", question: "Auto-scaling and high availability", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "Integration & APIs", question: "RESTful API design", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 50 },
          { section: "Integration & APIs", question: "GraphQL support", score: proposalData.vendorName === "Amadeus IT Group" ? 50 : proposalData.vendorName === "Sabre Corporation" ? 25 : 0 },
          { section: "Integration & APIs", question: "Event-driven architecture (pub/sub)", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 25 },
          { section: "Integration & APIs", question: "API gateway and rate limiting", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "Security & Compliance", question: "ISO 27001 certification", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 100 },
          { section: "Security & Compliance", question: "PCI DSS Level 1 compliance", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "Security & Compliance", question: "IATA PSS certification", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 100 },
          { section: "Data Management", question: "Real-time data replication", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 50 : 50 },
          { section: "Data Management", question: "Data encryption at rest and in transit", score: proposalData.vendorName === "Amadeus IT Group" ? 100 : proposalData.vendorName === "Sabre Corporation" ? 100 : 100 },
        ];

        for (const criterion of architectureCriteria) {
          const scoreLabel = criterion.score === 100 ? "Fully met through standard functionality" :
                            criterion.score === 50 ? "Partially met through standard or custom extensions" :
                            criterion.score === 25 ? "Not Compliant - Can be developed" : "Not applicable";
          await storage.createEvaluationCriteria({
            evaluationId: evaluation.id,
            role: "architecture",
            section: criterion.section,
            question: criterion.question,
            score: criterion.score,
            scoreLabel,
          });
        }
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
    
    // 3. Seed knowledge base documents for all stakeholder types
    const standards = await storage.getAllStandards();
    if (standards.length === 0) {
      // ARCHITECTURE DOCUMENTS (Technical Teams)
      await storage.createStandard({
        name: "Cloud Architecture Standards",
        category: "architecture",
        description: "Enterprise cloud architecture patterns and best practices for airline systems",
        sections: [
          { id: "arch-001", name: "Microservices Design", description: "Service decomposition and API gateway patterns" },
          { id: "arch-002", name: "Data Architecture", description: "Database design and data flow patterns" },
          { id: "arch-003", name: "Infrastructure as Code", description: "Terraform and CloudFormation standards" },
          { id: "arch-004", name: "High Availability", description: "Redundancy and failover requirements" },
        ],
        tags: ["Architecture", "Cloud", "Microservices"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "API Design Guidelines",
        category: "architecture",
        description: "RESTful API standards and GraphQL implementation guidelines",
        sections: [
          { id: "api-001", name: "REST Conventions", description: "HTTP methods, status codes, and resource naming" },
          { id: "api-002", name: "Versioning Strategy", description: "API versioning and deprecation policies" },
          { id: "api-003", name: "Authentication", description: "OAuth 2.0, JWT, and API key standards" },
          { id: "api-004", name: "Documentation", description: "OpenAPI/Swagger specification requirements" },
        ],
        tags: ["API", "Architecture", "Integration"],
        isActive: "true",
      });
      
      // DEVELOPMENT DOCUMENTS (Technical Teams)
      await storage.createStandard({
        name: "Development Best Practices",
        category: "development",
        description: "Coding standards, testing frameworks, and CI/CD pipeline requirements",
        sections: [
          { id: "dev-001", name: "Code Quality", description: "Linting, formatting, and code review standards" },
          { id: "dev-002", name: "Testing Standards", description: "Unit, integration, and end-to-end testing requirements" },
          { id: "dev-003", name: "Git Workflow", description: "Branching strategy and commit message conventions" },
          { id: "dev-004", name: "CI/CD Pipeline", description: "Automated build, test, and deployment processes" },
        ],
        tags: ["Development", "DevOps", "Quality"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "Estimation Framework",
        category: "development",
        description: "Story pointing, effort estimation, and project planning guidelines",
        sections: [
          { id: "est-001", name: "Story Sizing", description: "Fibonacci sequence and relative estimation" },
          { id: "est-002", name: "Velocity Tracking", description: "Sprint capacity and team velocity metrics" },
          { id: "est-003", name: "Risk Buffer", description: "Contingency planning and risk allowances" },
          { id: "est-004", name: "Dependencies", description: "Cross-team dependency identification" },
        ],
        tags: ["Estimation", "Agile", "Planning"],
        isActive: "true",
      });
      
      // DELIVERY DOCUMENTS (Delivery & Operations)
      await storage.createStandard({
        name: "Agile Delivery Methodology",
        category: "delivery",
        description: "Scrum and Kanban frameworks for airline project delivery",
        sections: [
          { id: "agile-001", name: "Sprint Planning", description: "Sprint goals, backlog refinement, and capacity planning" },
          { id: "agile-002", name: "Daily Standups", description: "Team synchronization and blocker identification" },
          { id: "agile-003", name: "Sprint Reviews", description: "Demo and stakeholder feedback sessions" },
          { id: "agile-004", name: "Retrospectives", description: "Continuous improvement and team health" },
        ],
        tags: ["Agile", "Scrum", "Delivery"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "Project Governance Framework",
        category: "delivery",
        description: "Project management standards and decision-making processes",
        sections: [
          { id: "gov-001", name: "Steering Committee", description: "Executive oversight and strategic direction" },
          { id: "gov-002", name: "RAID Management", description: "Risks, assumptions, issues, and dependencies tracking" },
          { id: "gov-003", name: "Change Control", description: "Scope change approval and impact assessment" },
          { id: "gov-004", name: "Quality Gates", description: "Stage-gate reviews and go/no-go criteria" },
        ],
        tags: ["Governance", "PMO", "Project Management"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "IATA Standards Compliance",
        category: "delivery",
        description: "International Air Transport Association standards for airline operations",
        sections: [
          { id: "iata-001", name: "NDC Compliance", description: "New Distribution Capability implementation" },
          { id: "iata-002", name: "ONE Order", description: "Order management and fulfillment standards" },
          { id: "iata-003", name: "Baggage Standards", description: "Baggage tracking and handling protocols" },
          { id: "iata-004", name: "Safety Audits", description: "IOSA operational safety audit requirements" },
        ],
        tags: ["IATA", "Aviation", "Standards"],
        isActive: "true",
      });
      
      // PROCUREMENT DOCUMENTS (Finance & Procurement)
      await storage.createStandard({
        name: "Vendor Contract Standards",
        category: "procurement",
        description: "Contract templates and vendor agreement requirements for airline suppliers",
        sections: [
          { id: "contract-001", name: "Master Service Agreement", description: "Standard MSA terms and conditions" },
          { id: "contract-002", name: "Statement of Work", description: "SOW structure and deliverables definition" },
          { id: "contract-003", name: "Payment Terms", description: "Milestone-based payments and invoicing" },
          { id: "contract-004", name: "Termination Clauses", description: "Exit rights and transition assistance" },
        ],
        tags: ["Contracts", "Legal", "Procurement"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "SLA Standards",
        category: "procurement",
        description: "Service Level Agreement requirements and KPI definitions",
        sections: [
          { id: "sla-001", name: "Uptime Requirements", description: "System availability targets and measurement" },
          { id: "sla-002", name: "Response Times", description: "Support ticket response and resolution SLAs" },
          { id: "sla-003", name: "Performance Metrics", description: "Transaction throughput and latency requirements" },
          { id: "sla-004", name: "Penalties", description: "Service credits and financial remedies" },
        ],
        tags: ["SLA", "Performance", "KPI"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "TCO Analysis Framework",
        category: "procurement",
        description: "Total Cost of Ownership evaluation methodology for vendor selection",
        sections: [
          { id: "tco-001", name: "License Costs", description: "Software licensing models and true-up calculations" },
          { id: "tco-002", name: "Implementation Costs", description: "Professional services and integration expenses" },
          { id: "tco-003", name: "Operational Costs", description: "Ongoing support, maintenance, and infrastructure" },
          { id: "tco-004", name: "Hidden Costs", description: "Training, data migration, and opportunity costs" },
        ],
        tags: ["TCO", "Finance", "ROI"],
        isActive: "true",
      });
      
      // SECURITY DOCUMENTS (Security & Compliance)
      await storage.createStandard({
        name: "ISO 27001 Information Security",
        category: "security",
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
        category: "security",
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
        name: "PCI DSS Payment Security",
        category: "security",
        description: "Payment Card Industry Data Security Standard for transaction processing",
        sections: [
          { id: "pci-001", name: "Secure Network", description: "Firewall configuration and network segmentation" },
          { id: "pci-002", name: "Cardholder Data Protection", description: "Encryption and tokenization requirements" },
          { id: "pci-003", name: "Access Management", description: "Role-based access control and authentication" },
          { id: "pci-004", name: "Security Testing", description: "Vulnerability scanning and penetration testing" },
        ],
        tags: ["PCI-DSS", "Payments", "Security"],
        isActive: "true",
      });
      
      // GENERAL DOCUMENTS (General Resources)
      await storage.createStandard({
        name: "Aviation Safety Management System",
        category: "general",
        description: "SMS framework for proactive safety risk management across airline operations",
        sections: [
          { id: "sms-001", name: "Hazard Identification", description: "Systematic hazard reporting and analysis" },
          { id: "sms-002", name: "Risk Assessment", description: "Safety risk probability and severity matrix" },
          { id: "sms-003", name: "Safety Assurance", description: "Performance monitoring and continuous improvement" },
          { id: "sms-004", name: "Safety Promotion", description: "Training, communication, and safety culture" },
        ],
        tags: ["Safety", "Aviation", "SMS"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "Corporate Branding Guidelines",
        category: "general",
        description: "Brand identity standards for Nujum Air across all customer touchpoints",
        sections: [
          { id: "brand-001", name: "Visual Identity", description: "Logo usage, color palette, and typography" },
          { id: "brand-002", name: "Digital Presence", description: "Website, app, and social media guidelines" },
          { id: "brand-003", name: "Customer Communications", description: "Tone of voice and messaging framework" },
          { id: "brand-004", name: "Aircraft Livery", description: "Fleet branding and cabin interior design" },
        ],
        tags: ["Branding", "Marketing", "Design"],
        isActive: "true",
      });
      
      await storage.createStandard({
        name: "Environmental Sustainability Policy",
        category: "general",
        description: "Sustainable aviation fuel, carbon reduction, and environmental commitments",
        sections: [
          { id: "env-001", name: "Carbon Offsetting", description: "Net-zero targets and offset programs" },
          { id: "env-002", name: "Fuel Efficiency", description: "Fleet modernization and operational efficiency" },
          { id: "env-003", name: "Waste Management", description: "Recycling, single-use plastics reduction" },
          { id: "env-004", name: "Stakeholder Reporting", description: "ESG disclosure and sustainability metrics" },
        ],
        tags: ["Sustainability", "ESG", "Environment"],
        isActive: "true",
      });
      
      console.log("✓ Knowledge base documents seeded for all stakeholder types");
    }
    
    // 4. Seed MCP connectors
    const connectors = await storage.getAllMcpConnectors();
    if (connectors.length === 0) {
      await storage.createMcpConnector({
        name: "Nujum Air Confluence",
        description: "Access to airline operations documentation and technical knowledge base",
        serverUrl: "https://nujumair.atlassian.net/wiki",
        apiKey: "demo-key-nujum-confluence-12345",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["product", "architecture", "engineering"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Operations Slack Channel",
        description: "Integration with flight ops, maintenance, and crew communication channels",
        serverUrl: "https://nujumair.slack.com/api",
        apiKey: "demo-key-nujum-slack-67890",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["delivery", "product"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Aviation Systems GitHub",
        description: "Source code repositories for airline systems and integrations",
        serverUrl: "https://api.github.com",
        apiKey: "demo-key-nujum-github-abcde",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["engineering", "architecture"],
        isActive: "false",
      });
      
      await storage.createMcpConnector({
        name: "Procurement Connector",
        description: "Procurement system integration for vendor contracts and purchase orders",
        serverUrl: "https://procurement.nujumair.com/api",
        apiKey: "demo-key-procurement-xyz789",
        connectorType: "rest",
        authType: "apikey",
        roleMapping: ["procurement"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "SharePoint Connector",
        description: "Access to airline documentation, policies, and collaborative workspaces",
        serverUrl: "https://nujumair.sharepoint.com/_api",
        apiKey: "demo-key-sharepoint-sp1234",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["product", "delivery", "architecture"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Architecture Registry Connector",
        description: "Enterprise architecture repository for systems, services, and integrations",
        serverUrl: "https://archregistry.nujumair.com/api",
        apiKey: "demo-key-architecture-arc456",
        connectorType: "rest",
        authType: "apikey",
        roleMapping: ["architecture", "engineering"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Security & Compliance Connector",
        description: "Security posture management and compliance tracking system",
        serverUrl: "https://seccomp.nujumair.com/api",
        apiKey: "demo-key-security-sec789",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["security"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Vendor Performance DB Connector",
        description: "Historical vendor performance metrics and SLA tracking database",
        serverUrl: "https://vendordb.nujumair.com/api",
        apiKey: "demo-key-vendorperf-vp2468",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["procurement", "delivery"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Legal - DocuSign",
        description: "Electronic signature platform for vendor contracts and legal agreements",
        serverUrl: "https://api.docusign.com",
        apiKey: "demo-key-docusign-ds1357",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["procurement"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "IP Registry",
        description: "Intellectual property and patent registry for technology assets",
        serverUrl: "https://ipreg.nujumair.com/api",
        apiKey: "demo-key-ipreg-ip9753",
        connectorType: "rest",
        authType: "apikey",
        roleMapping: ["architecture", "security"],
        isActive: "false",
      });
      
      await storage.createMcpConnector({
        name: "Incident & Risk Connector",
        description: "Incident management and operational risk tracking system",
        serverUrl: "https://incidents.nujumair.com/api",
        apiKey: "demo-key-incidents-ir4862",
        connectorType: "rest",
        authType: "bearer",
        roleMapping: ["security", "delivery"],
        isActive: "true",
      });
      
      await storage.createMcpConnector({
        name: "Evaluation Matrix Connector",
        description: "Historical evaluation criteria and scoring frameworks repository",
        serverUrl: "https://evalmatrix.nujumair.com/api",
        apiKey: "demo-key-evalmatrix-em3691",
        connectorType: "rest",
        authType: "apikey",
        roleMapping: ["product", "procurement", "delivery"],
        isActive: "true",
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
    
    const deletionSummary = {
      database: {
        evaluations: 0,
        proposals: 0,
        requirements: 0,
        projects: 0,
        portfolios: 0,
        standards: 0,
        connectors: 0,
        ragDocuments: 0,
        ragChunks: 0,
        chatSessions: 0,
        chatMessages: 0,
        complianceGaps: 0,
        followupQuestions: 0,
        comparisonSnapshots: 0,
        executiveBriefings: 0,
      },
      azure: {
        blobDocuments: 0,
        searchDocuments: 0,
      },
    };
    
    // Get all items to delete
    const portfolios = await storage.getAllPortfolios();
    const projects = await storage.getAllProjects();
    const standards = await storage.getAllStandards();
    const connectors = await storage.getAllMcpConnectors();
    const ragDocuments = await storage.getAllRagDocuments();
    const chatSessions: any[] = []; // TODO: Implement getAllChatSessions when needed
    
    // Delete all evaluations (by getting all projects and their proposals)
    for (const project of projects) {
      const proposals = await storage.getProposalsByProject(project.id);
      for (const proposal of proposals) {
        const evaluation = await storage.getEvaluationByProposal(proposal.id);
        if (evaluation) {
          await storage.deleteEvaluation(evaluation.id);
          deletionSummary.database.evaluations++;
        }
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.evaluations} evaluations`);
    
    // Delete all proposals
    for (const project of projects) {
      const proposals = await storage.getProposalsByProject(project.id);
      for (const proposal of proposals) {
        await storage.deleteProposal(proposal.id);
        deletionSummary.database.proposals++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.proposals} proposals`);
    
    // Delete all requirements
    for (const project of projects) {
      const requirements = await storage.getRequirementsByProject(project.id);
      for (const requirement of requirements) {
        await storage.deleteRequirement(requirement.id);
        deletionSummary.database.requirements++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.requirements} requirements`);
    
    // Delete all projects
    for (const project of projects) {
      await storage.deleteProject(project.id);
      deletionSummary.database.projects++;
    }
    console.log(`✓ Deleted ${deletionSummary.database.projects} projects`);
    
    // Delete all portfolios
    for (const portfolio of portfolios) {
      await storage.deletePortfolio(portfolio.id);
      deletionSummary.database.portfolios++;
    }
    console.log(`✓ Deleted ${deletionSummary.database.portfolios} portfolios`);
    
    // Deactivate all standards (soft delete)
    for (const standard of standards) {
      await storage.deactivateStandard(standard.id);
      deletionSummary.database.standards++;
    }
    console.log(`✓ Deactivated ${deletionSummary.database.standards} standards`);
    
    // Delete all MCP connectors
    for (const connector of connectors) {
      await storage.deleteMcpConnector(connector.id);
      deletionSummary.database.connectors++;
    }
    console.log(`✓ Deleted ${deletionSummary.database.connectors} MCP connectors`);
    
    // Delete all RAG documents and chunks
    for (const ragDoc of ragDocuments) {
      const chunks = await storage.getRagChunksByDocumentId(ragDoc.id);
      for (const chunk of chunks) {
        await storage.deleteRagChunk(chunk.id);
        deletionSummary.database.ragChunks++;
      }
      await storage.deleteRagDocument(ragDoc.id);
      deletionSummary.database.ragDocuments++;
    }
    console.log(`✓ Deleted ${deletionSummary.database.ragDocuments} RAG documents and ${deletionSummary.database.ragChunks} chunks`);
    
    // Delete all chat sessions and messages
    for (const session of chatSessions) {
      const messages = await storage.getChatMessagesBySession(session.id);
      for (const message of messages) {
        await storage.deleteChatMessage(message.id);
        deletionSummary.database.chatMessages++;
      }
      await storage.deleteChatSession(session.id);
      deletionSummary.database.chatSessions++;
    }
    console.log(`✓ Deleted ${deletionSummary.database.chatSessions} chat sessions and ${deletionSummary.database.chatMessages} messages`);
    
    // Delete all compliance gaps
    for (const project of projects) {
      const gaps = await storage.getComplianceGapsByProject(project.id);
      for (const gap of gaps) {
        await storage.deleteComplianceGap(gap.id);
        deletionSummary.database.complianceGaps++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.complianceGaps} compliance gaps`);
    
    // Delete all follow-up questions
    for (const project of projects) {
      const questions = await storage.getFollowupQuestionsByProject(project.id);
      for (const question of questions) {
        await storage.deleteFollowupQuestion(question.id);
        deletionSummary.database.followupQuestions++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.followupQuestions} follow-up questions`);
    
    // Delete all comparison snapshots
    for (const project of projects) {
      const snapshots = await storage.getComparisonSnapshotsByProject(project.id);
      for (const snapshot of snapshots) {
        await storage.deleteComparisonSnapshot(snapshot.id);
        deletionSummary.database.comparisonSnapshots++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.comparisonSnapshots} comparison snapshots`);
    
    // Delete all executive briefings
    for (const project of projects) {
      const briefings = await storage.getExecutiveBriefingsByProject(project.id);
      for (const briefing of briefings) {
        await storage.deleteExecutiveBriefing(briefing.id);
        deletionSummary.database.executiveBriefings++;
      }
    }
    console.log(`✓ Deleted ${deletionSummary.database.executiveBriefings} executive briefings`);
    
    // Delete Azure resources
    console.log("\n🔵 Starting Azure cleanup...");
    
    try {
      const { azureBlobStorageService } = await import("./azureBlobStorage");
      const blobCount = await azureBlobStorageService.deleteAllDocuments();
      deletionSummary.azure.blobDocuments = blobCount;
      console.log(`✓ Deleted ${blobCount} documents from Azure Blob Storage`);
    } catch (error: any) {
      console.log(`⚠️  Azure Blob Storage cleanup skipped: ${error.message}`);
    }
    
    try {
      const { azureAISearchService } = await import("./azureAISearch");
      const searchCount = await azureAISearchService.deleteAllDocuments();
      deletionSummary.azure.searchDocuments = searchCount;
      console.log(`✓ Deleted ${searchCount} documents from Azure AI Search`);
    } catch (error: any) {
      console.log(`⚠️  Azure AI Search cleanup skipped: ${error.message}`);
    }
    
    console.log("\n✅ All data wiped successfully!");
    return { 
      success: true, 
      message: "All data wiped successfully",
      summary: deletionSummary,
    };
  } catch (error) {
    console.error("Error wiping data:", error);
    throw error;
  }
}

export async function wipeAzureOnly() {
  try {
    console.log("Starting Azure-only cleanup...");
    
    const deletionSummary = {
      azure: {
        blobDocuments: 0,
        searchDocuments: 0,
      },
    };
    
    // Delete Azure Blob Storage documents
    try {
      const { azureBlobStorageService } = await import("./azureBlobStorage");
      const blobCount = await azureBlobStorageService.deleteAllDocuments();
      deletionSummary.azure.blobDocuments = blobCount;
      console.log(`✓ Deleted ${blobCount} documents from Azure Blob Storage`);
    } catch (error: any) {
      console.log(`⚠️  Azure Blob Storage cleanup skipped: ${error.message}`);
    }
    
    // Delete Azure AI Search documents
    try {
      const { azureAISearchService } = await import("./azureAISearch");
      const searchCount = await azureAISearchService.deleteAllDocuments();
      deletionSummary.azure.searchDocuments = searchCount;
      console.log(`✓ Deleted ${searchCount} documents from Azure AI Search`);
    } catch (error: any) {
      console.log(`⚠️  Azure AI Search cleanup skipped: ${error.message}`);
    }
    
    console.log("\n✅ Azure resources wiped successfully!");
    return { 
      success: true, 
      message: "Azure resources wiped successfully",
      summary: deletionSummary,
    };
  } catch (error) {
    console.error("Error wiping Azure resources:", error);
    throw error;
  }
}

/**
 * Seed RFT Templates for different industries
 */
export async function seedRftTemplates() {
  try {
    console.log("Seeding RFT templates...");

    // IT & Software Development Template
    await storage.createRftTemplate({
      name: "IT & Software Development RFT",
      description: "Comprehensive RFT template for IT projects, software development, and digital transformation initiatives",
      category: "IT",
      isActive: "true",
      createdBy: "system",
      metadata: {
        industry: "Technology",
        complexity: "High",
        tags: ["software", "digital", "cloud", "agile"],
      },
      sections: {
        sections: [
          {
            id: "exec_summary",
            title: "Executive Summary",
            prompt_template: "Provide a concise executive summary covering project background, objectives, and expected outcomes. Focus on business value and strategic alignment.",
          },
          {
            id: "business_requirements",
            title: "Business Requirements",
            prompt_template: "Detail all business requirements including functional needs, business processes to be supported, user roles, and expected business outcomes. Include KPIs and success metrics.",
          },
          {
            id: "functional_requirements",
            title: "Functional Requirements",
            prompt_template: "Specify detailed functional requirements covering: core features, user interfaces, integrations, data management, reporting capabilities, and workflow automation. Use clear acceptance criteria.",
          },
          {
            id: "technical_requirements",
            title: "Technical & Non-Functional Requirements",
            prompt_template: "Define technical requirements: technology stack preferences, performance requirements, scalability needs, availability/uptime, disaster recovery, backup requirements, and technical constraints.",
            subsections: [
              {
                id: "performance",
                title: "Performance Requirements",
                prompt_template: "Specify response times, throughput, concurrent users, data volumes.",
              },
              {
                id: "security",
                title: "Security Requirements",
                prompt_template: "Detail authentication, authorization, encryption, audit logging, compliance needs.",
              },
              {
                id: "integration",
                title: "Integration Requirements",
                prompt_template: "List all required integrations with existing systems, APIs, data sources.",
              },
            ],
          },
          {
            id: "cybersecurity",
            title: "Cybersecurity & Compliance",
            prompt_template: "Specify cybersecurity requirements: data protection, access controls, vulnerability management, incident response, compliance standards (ISO 27001, SOC 2, GDPR, etc.).",
          },
          {
            id: "delivery_approach",
            title: "Delivery Approach & Methodology",
            prompt_template: "Define preferred delivery methodology (Agile, Waterfall, DevOps), sprint duration, release cycles, testing approach, change management process.",
          },
          {
            id: "support_maintenance",
            title: "Support & Maintenance",
            prompt_template: "Outline support requirements: SLA expectations, support hours, escalation procedures, maintenance windows, documentation needs.",
          },
          {
            id: "evaluation_criteria",
            title: "Evaluation Criteria",
            prompt_template: "Define how proposals will be evaluated: technical capability (30%), cost (25%), delivery approach (20%), team experience (15%), support model (10%).",
          },
        ],
      },
    });

    // Aviation & Airline Operations Template
    await storage.createRftTemplate({
      name: "Aviation & Airline Operations RFT",
      description: "Specialized RFT template for aviation industry projects including airline operations, passenger services, and aviation systems",
      category: "Aviation",
      isActive: "true",
      createdBy: "system",
      metadata: {
        industry: "Aviation",
        complexity: "High",
        tags: ["aviation", "airline", "IATA", "safety", "operations"],
      },
      sections: {
        sections: [
          {
            id: "exec_summary",
            title: "Executive Summary",
            prompt_template: "Provide executive summary emphasizing aviation industry context, operational impact, and alignment with airline strategic goals.",
          },
          {
            id: "aviation_context",
            title: "Aviation Industry Context",
            prompt_template: "Detail aviation-specific context: regulatory environment, IATA/ICAO standards, safety requirements, operational constraints, fleet information if applicable.",
          },
          {
            id: "operational_requirements",
            title: "Operational Requirements",
            prompt_template: "Specify operational requirements: flight operations impact, passenger service requirements, ground operations needs, baggage handling, crew management, schedule optimization.",
          },
          {
            id: "functional_requirements",
            title: "Functional Requirements",
            prompt_template: "Detail functional requirements specific to aviation operations: reservation systems, check-in processes, boarding systems, loyalty programs, revenue management.",
          },
          {
            id: "technical_requirements",
            title: "Technical Requirements",
            prompt_template: "Define technical requirements: system availability (99.9%+), disaster recovery (RTO/RPO), real-time processing capabilities, mobile compatibility, integration with legacy systems.",
          },
          {
            id: "regulatory_compliance",
            title: "Regulatory & Safety Compliance",
            prompt_template: "Specify compliance requirements: aviation regulations, data privacy (GDPR, local laws), security standards, safety management systems, audit trail requirements.",
          },
          {
            id: "security_cybersecurity",
            title: "Security & Cybersecurity",
            prompt_template: "Detail cybersecurity for aviation: PCI-DSS for payments, passenger data protection, system access controls, threat detection, incident response aligned with aviation security protocols.",
          },
          {
            id: "implementation",
            title: "Implementation & Go-Live",
            prompt_template: "Define implementation approach: phased rollout, pilot programs, training requirements for airline staff, cutover strategy, rollback procedures, operational testing.",
          },
          {
            id: "support_sla",
            title: "Support & Service Level Agreements",
            prompt_template: "Specify support requirements: 24/7 support for critical systems, response times, escalation procedures, maintenance windows (must avoid peak travel times), backup support.",
          },
        ],
      },
    });

    // Infrastructure & Construction Template
    await storage.createRftTemplate({
      name: "Infrastructure & Construction RFT",
      description: "RFT template for infrastructure projects, construction, and physical asset development",
      category: "Infrastructure",
      isActive: "true",
      createdBy: "system",
      metadata: {
        industry: "Construction",
        complexity: "Medium",
        tags: ["construction", "infrastructure", "facilities", "engineering"],
      },
      sections: {
        sections: [
          {
            id: "project_overview",
            title: "Project Overview",
            prompt_template: "Provide comprehensive project overview: location, scope, scale, strategic importance, stakeholder benefits.",
          },
          {
            id: "technical_specifications",
            title: "Technical Specifications",
            prompt_template: "Detail technical specifications: design requirements, materials, engineering standards, quality specifications, capacity requirements.",
          },
          {
            id: "delivery_timeline",
            title: "Delivery Timeline & Milestones",
            prompt_template: "Define project timeline: key milestones, phase delivery dates, dependencies, critical path items, seasonal considerations.",
          },
          {
            id: "quality_safety",
            title: "Quality & Safety Requirements",
            prompt_template: "Specify quality standards, safety protocols, inspection requirements, certifications needed, environmental considerations.",
          },
          {
            id: "compliance",
            title: "Compliance & Permits",
            prompt_template: "List regulatory compliance needs, permits required, environmental impact assessments, local authority approvals.",
          },
          {
            id: "warranty_maintenance",
            title: "Warranty & Maintenance",
            prompt_template: "Define warranty requirements, maintenance obligations, handover procedures, documentation requirements.",
          },
        ],
      },
    });

    // Professional Services Template
    await storage.createRftTemplate({
      name: "Professional Services RFT",
      description: "RFT template for consulting, advisory, and professional service engagements",
      category: "Professional Services",
      isActive: "true",
      createdBy: "system",
      metadata: {
        industry: "Services",
        complexity: "Low",
        tags: ["consulting", "advisory", "services", "expertise"],
      },
      sections: {
        sections: [
          {
            id: "engagement_overview",
            title: "Engagement Overview",
            prompt_template: "Describe the consulting engagement: objectives, scope, expected deliverables, business challenges to address.",
          },
          {
            id: "scope_deliverables",
            title: "Scope of Work & Deliverables",
            prompt_template: "Detail specific work to be performed, deliverables expected, timelines, acceptance criteria for each deliverable.",
          },
          {
            id: "team_expertise",
            title: "Team & Expertise Requirements",
            prompt_template: "Specify required expertise: qualifications, experience levels, certifications, industry knowledge, team size and composition.",
          },
          {
            id: "methodology",
            title: "Methodology & Approach",
            prompt_template: "Describe preferred approach: project management methodology, communication protocols, reporting frequency, stakeholder engagement.",
          },
          {
            id: "evaluation",
            title: "Evaluation Criteria",
            prompt_template: "Define evaluation: team expertise (40%), methodology (25%), cost (20%), references (15%).",
          },
        ],
      },
    });

    console.log("✓ RFT templates seeded successfully");
    return { success: true, message: "RFT templates seeded" };
  } catch (error) {
    console.error("Error seeding RFT templates:", error);
    throw error;
  }
}
