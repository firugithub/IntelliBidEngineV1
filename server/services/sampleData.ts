import { storage } from "../storage";

const PORTFOLIOS = [
  { name: "Group Services", description: "Corporate services and group-wide initiatives" },
  { name: "Operations, Safety & Security", description: "Operational excellence and safety management" },
  { name: "Customer Brand and Experience", description: "Customer experience and brand management" },
  { name: "Commercial", description: "Commercial operations and business development" },
  { name: "Web and Mobile", description: "Digital platforms and mobile applications" },
  { name: "Enterprise Technology", description: "Enterprise technology solutions and infrastructure" },
  { name: "Dnata & Dnata International", description: "Aviation and travel services" },
  { name: "Dnata Travel", description: "Travel and tourism services" },
  { name: "CyberSecurity", description: "Information security and cyber defense" },
  { name: "Data(EDH)", description: "Enterprise data and analytics" },
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
    // Create or get Enterprise Technology portfolio
    let portfolio = await storage.getPortfolioByName("Enterprise Technology");
    if (!portfolio) {
      portfolio = await storage.createPortfolio({
        name: "Enterprise Technology",
        description: "Enterprise technology solutions and infrastructure",
      });
    }

    // Create a sample project
    const project = await storage.createProject({
      portfolioId: portfolio.id,
      name: "Cloud Platform Evaluation",
      initiativeName: "Digital Transformation 2025",
      vendorList: ["TechVendor Pro", "CloudSolutions Inc", "Enterprise Systems"],
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
        vendorName: "TechVendor Pro",
        fileName: "TechVendor_Proposal.pdf",
        extractedData: {
          vendorName: "TechVendor Pro",
          capabilities: [
            "Cloud-native architecture",
            "Real-time analytics",
            "Advanced security features",
            "API-first design",
          ],
          technicalApproach: "Microservices-based platform with containerized deployment",
          integrations: ["REST API", "OAuth 2.0", "Webhook support", "Third-party connectors"],
          security: "SOC 2 Type II, ISO 27001, GDPR compliant",
          support: "24/7 premium support with dedicated account manager",
          costStructure: "$150,000 - $180,000 annually with volume discounts",
          timeline: "8-12 weeks implementation",
        },
      },
      {
        vendorName: "CloudSolutions Inc",
        fileName: "CloudSolutions_Proposal.pdf",
        extractedData: {
          vendorName: "CloudSolutions Inc",
          capabilities: [
            "Multi-cloud deployment",
            "Customizable workflows",
            "Mobile platform support",
            "Data visualization",
          ],
          technicalApproach: "Modular SaaS platform with flexible configuration",
          integrations: ["RESTful APIs", "SSO integration", "Standard protocols"],
          security: "ISO 27001 certified, regular security audits",
          support: "Business hours support with community forums",
          costStructure: "$120,000 - $150,000 annually",
          timeline: "10-14 weeks implementation",
        },
      },
      {
        vendorName: "Enterprise Systems",
        fileName: "Enterprise_Proposal.pdf",
        extractedData: {
          vendorName: "Enterprise Systems",
          capabilities: [
            "Enterprise-grade scalability",
            "Advanced compliance tools",
            "Legacy system integration",
            "Comprehensive audit trails",
          ],
          technicalApproach: "Traditional enterprise architecture with proven stability",
          integrations: ["SOAP/REST APIs", "Enterprise connectors", "Custom integration support"],
          security: "Military-grade encryption, FedRAMP authorized",
          support: "24/7 enterprise support with SLA guarantees",
          costStructure: "$200,000 - $250,000 annually",
          timeline: "16-20 weeks implementation",
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
        "TechVendor Pro": {
          overallScore: 87,
          technicalFit: 92,
          deliveryRisk: 25,
          cost: "$150K - $180K",
          compliance: 95,
          status: "recommended" as const,
          rationale:
            "TechVendor Pro demonstrates exceptional technical alignment with requirements, achieving a 92% technical fit score. The cloud-native, microservices architecture ensures scalability and modern integration capabilities. With the lowest delivery risk at 25% and outstanding compliance score of 95%, this vendor presents the optimal balance of capability, risk mitigation, and enterprise-grade security. The 8-12 week implementation timeline is achievable with minimal dependencies.",
          roleInsights: {
            delivery: [
              "Fastest implementation timeline at 8-12 weeks reduces time-to-value",
              "Microservices architecture minimizes integration dependencies",
              "Proven track record with similar enterprise deployments",
              "Clear project phases with defined milestones and deliverables",
            ],
            product: [
              "92% feature coverage exceeds baseline requirements",
              "Cloud-native design supports future scalability needs",
              "Real-time analytics capability enables data-driven decision making",
              "API-first approach facilitates future product integrations",
            ],
            architecture: [
              "Microservices architecture aligns with enterprise standards",
              "SOC 2 Type II and ISO 27001 certifications meet compliance requirements",
              "RESTful API design follows industry best practices",
              "Containerized deployment supports multi-cloud strategy",
            ],
            engineering: [
              "Comprehensive API documentation with code examples",
              "SDK availability for Python, Java, and Node.js",
              "Webhook support enables event-driven integrations",
              "Active developer community and regular SDK updates",
            ],
            procurement: [
              "Competitive 3-year TCO at $150K-$180K annually",
              "99.9% SLA with financial penalties for downtime",
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
        "CloudSolutions Inc": {
          overallScore: 79,
          technicalFit: 85,
          deliveryRisk: 35,
          cost: "$120K - $150K",
          compliance: 88,
          status: "under-review" as const,
          rationale:
            "CloudSolutions Inc offers a competitive solution with strong customization capabilities and the lowest cost structure at $120K-$150K. The 85% technical fit indicates good alignment with core requirements, though some gaps exist in advanced features. Moderate delivery risk of 35% stems from customization requirements and less proven integration patterns. The solution meets compliance needs but lacks some certifications present in top-tier options.",
          roleInsights: {
            delivery: [
              "10-14 week timeline is reasonable but requires careful dependency management",
              "Customization flexibility may introduce scope creep risks",
              "Less proven enterprise deployment history increases uncertainty",
              "Requires dedicated testing phase for custom workflows",
            ],
            product: [
              "Strong customization options support unique business workflows",
              "Mobile platform support enables field operations",
              "Adequate feature coverage for current needs",
              "Roadmap indicates future feature parity with market leaders",
            ],
            architecture: [
              "Modular SaaS architecture provides flexibility",
              "ISO 27001 certification meets baseline security requirements",
              "Standard API protocols facilitate basic integrations",
              "Some architectural complexity in custom configuration",
            ],
            engineering: [
              "API documentation adequate but less comprehensive than alternatives",
              "Community support available but smaller developer ecosystem",
              "Standard integration patterns well-documented",
              "Testing tools provided but require additional setup",
            ],
            procurement: [
              "Best initial pricing at $120K-$150K annually",
              "Standard SLA terms with 99.5% uptime guarantee",
              "Flexible payment options and scalability pricing",
              "Additional costs may arise from customization needs",
            ],
          },
          detailedScores: {
            integration: 78,
            support: 80,
            scalability: 85,
            documentation: 76,
          },
        },
        "Enterprise Systems": {
          overallScore: 72,
          technicalFit: 78,
          deliveryRisk: 45,
          cost: "$200K - $250K",
          compliance: 92,
          status: "risk-flagged" as const,
          rationale:
            "Enterprise Systems provides robust compliance and security features with 92% compliance score and military-grade encryption. However, the traditional architecture results in lower technical fit (78%) compared to modern alternatives. Highest delivery risk at 45% is driven by complex integration requirements and extended 16-20 week timeline. Premium pricing at $200K-$250K represents the highest total cost among evaluated vendors.",
          roleInsights: {
            delivery: [
              "Longest implementation at 16-20 weeks increases time-to-market",
              "Traditional architecture requires more integration effort",
              "Legacy system support valuable but adds complexity",
              "Well-defined enterprise methodology reduces execution risk",
            ],
            product: [
              "Comprehensive audit capabilities exceed regulatory requirements",
              "Enterprise-grade features support complex workflows",
              "Legacy integration valuable for existing infrastructure",
              "Modern UX improvements needed compared to competitors",
            ],
            architecture: [
              "Proven stability with traditional enterprise architecture",
              "FedRAMP authorization valuable for regulated industries",
              "SOAP/REST hybrid may complicate modern integrations",
              "Strongest security posture with military-grade standards",
            ],
            engineering: [
              "Extensive documentation reflects mature product",
              "Custom integration support available at premium",
              "Older SDK patterns require additional development effort",
              "Comprehensive testing tools and quality assurance processes",
            ],
            procurement: [
              "Highest cost at $200K-$250K annually impacts ROI",
              "Premium support includes dedicated resources and SLA guarantees",
              "Long-term vendor stability and enterprise track record",
              "Contract flexibility limited due to enterprise sales model",
            ],
          },
          detailedScores: {
            integration: 70,
            support: 85,
            scalability: 88,
            documentation: 82,
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
