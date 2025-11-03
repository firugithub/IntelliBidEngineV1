import { storage } from "./storage";

async function createSampleRFT() {
  try {
    // Get first portfolio
    const portfolios = await storage.getAllPortfolios();
    if (portfolios.length === 0) {
      console.log("No portfolios found. Please seed portfolios first.");
      return;
    }
    const portfolioId = portfolios[0].id;

    // Create a test project
    const project = await storage.createProject({
      portfolioId,
      name: "Sample Cloud Infrastructure Modernization",
      description: "Migrating legacy systems to cloud-native architecture",
      status: "rft_generated",
    });

    // Create a business case
    const businessCase = await storage.createBusinessCase({
      projectId: project.id,
      content: `# Executive Summary\n\nThis business case outlines the strategic initiative to modernize our legacy infrastructure by migrating to cloud-native technologies.\n\n## Business Objectives\n\n- Reduce operational costs by 40%\n- Improve system reliability and uptime to 99.99%\n- Enable rapid scaling for seasonal demand\n\n## Key Requirements\n\n1. **Migration Strategy**: Phased approach with zero downtime\n2. **Security**: Enterprise-grade security and compliance (ISO 27001, SOC 2)\n3. **Performance**: Sub-second response times for critical operations`,
      status: "generated",
    });

    // Get first RFT template
    const templates = await storage.getAllRftTemplates();
    if (templates.length === 0) {
      console.log("No RFT templates found. Please seed templates first.");
      return;
    }

    // Create generated RFT
    const generatedRft = await storage.createGeneratedRft({
      projectId: project.id,
      businessCaseId: businessCase.id,
      name: "Cloud Infrastructure Modernization RFT",
      status: "draft",
      sections: {
        sections: [
          {
            id: "1",
            title: "Executive Summary",
            content: "This Request for Technology (RFT) seeks proposals from qualified vendors to support our cloud infrastructure modernization initiative. We are looking for a comprehensive solution that includes migration strategy, security implementation, and ongoing support.",
          },
          {
            id: "2",
            title: "Project Overview",
            content: "**Objective**: Modernize legacy infrastructure through cloud migration\n\n**Timeline**: 12-month implementation\n\n**Budget**: $2M - $3M\n\n*Key Deliverables*:\n- Complete infrastructure assessment\n- Migration roadmap and strategy\n- Implementation and deployment\n- Training and knowledge transfer",
          },
          {
            id: "3",
            title: "Technical Requirements",
            content: "## Infrastructure Requirements\n\n- Multi-region deployment capability\n- Auto-scaling and load balancing\n- Database migration tools and services\n- Monitoring and observability platform\n\n## Security Requirements\n\n1. ISO 27001 certification\n2. SOC 2 Type II compliance\n3. Encryption at rest and in transit\n4. Identity and access management (IAM)\n\n## Performance Requirements\n\n| Metric | Target | Measurement |\n|--------|--------|-------------|\n| Uptime | 99.99% | Monthly |\n| Response Time | < 1s | p95 |\n| Throughput | 10k req/s | Peak load |",
          },
          {
            id: "4",
            title: "Vendor Qualifications",
            content: "**Required Certifications**:\n- AWS/Azure/GCP certified architects\n- Kubernetes certification (CKA/CKAD)\n- Security certifications (CISSP, CEH)\n\n**Experience Requirements**:\n1. Minimum 5 years cloud migration experience\n2. At least 3 enterprise-scale projects (1000+ users)\n3. Experience with financial services or regulated industries\n\n**References**:\nProvide 3 client references from similar projects completed in the last 2 years.",
          },
          {
            id: "5",
            title: "Proposal Guidelines",
            content: "## Submission Requirements\n\n- **Deadline**: 30 days from RFT issuance\n- **Format**: PDF document, maximum 50 pages\n- **Sections Required**:\n  1. Executive summary\n  2. Technical approach and architecture\n  3. Implementation timeline and methodology\n  4. Pricing and commercial terms\n  5. Team qualifications and CVs\n  6. Risk mitigation strategy\n\n## Evaluation Criteria\n\nProposals will be evaluated based on:\n- Technical capability (40%)\n- Cost and value (30%)\n- Experience and references (20%)\n- Implementation approach (10%)",
          },
        ],
      },
    });

    console.log("✓ Sample RFT created successfully!");
    console.log("  Project:", project.name);
    console.log("  RFT:", generatedRft.name);
    console.log("  ID:", generatedRft.id);
    console.log("\nRefresh the homepage to see the 'My RFTs' section!");
  } catch (error) {
    console.error("Error creating sample RFT:", error);
  }
}

createSampleRFT();
