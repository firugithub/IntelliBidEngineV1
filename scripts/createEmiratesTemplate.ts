import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import fs from "fs";
import path from "path";

const createEmiratesTemplate = () => {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "REQUEST FOR TENDER",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "{{PROJECT_NAME}}",
                bold: true,
                size: 32,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // 1. Executive Summary (assigned to: Procurement Lead)
          new Paragraph({
            text: "1. EXECUTIVE SUMMARY",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "{{AIRLINE_NAME}} invites qualified vendors to submit proposals for {{PROJECT_NAME}}. This tender seeks innovative solutions that align with our strategic objectives and operational excellence standards.",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Project Description: ", bold: true }),
              new TextRun("{{DESCRIPTION}}"),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Estimated Budget: ", bold: true }),
              new TextRun("{{BUDGET}}"),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Timeline: ", bold: true }),
              new TextRun("{{TIMELINE}}"),
            ],
            spacing: { after: 400 },
          }),

          // 2. Background & Context (assigned to: Technical PM)
          new Paragraph({
            text: "2. BACKGROUND & ORGANIZATIONAL CONTEXT",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "{{AIRLINE_NAME}} is committed to maintaining world-class aviation services through strategic technology investments. This RFT is part of our digital transformation initiative to enhance operational efficiency and customer experience.",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Strategic Objectives:", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Enhance operational efficiency by 30%",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Improve customer satisfaction scores",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Ensure compliance with aviation industry standards",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Support sustainability initiatives",
            spacing: { after: 400 },
          }),

          // 3. Scope of Work (assigned to: Solution Architect)
          new Paragraph({
            text: "3. SCOPE OF WORK",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "The selected vendor will be responsible for delivering the following:",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.1 Core Requirements", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "{{REQUIREMENTS}}",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3.2 Deliverables", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Detailed technical design documentation",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Implementation plan with milestones",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Testing and quality assurance reports",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Training materials and knowledge transfer",
            spacing: { after: 400 },
          }),

          // 4. Technical Requirements (assigned to: Solution Architect)
          new Paragraph({
            text: "4. TECHNICAL REQUIREMENTS",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4.1 System Architecture", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Cloud-native architecture with 99.9% uptime SLA",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Microservices-based design for scalability",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• API-first approach with RESTful interfaces",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4.2 Integration Requirements", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Seamless integration with existing airline systems",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Support for IATA standards and protocols",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Real-time data synchronization capabilities",
            spacing: { after: 400 },
          }),

          // 5. Security & Compliance (assigned to: Cybersecurity Analyst)
          new Paragraph({
            text: "5. SECURITY & COMPLIANCE REQUIREMENTS",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "All proposed solutions must adhere to the following security and compliance standards:",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.1 Security Standards", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• ISO 27001 certification required",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• End-to-end encryption for data in transit and at rest",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Multi-factor authentication (MFA) mandatory",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Regular security audits and penetration testing",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.2 Compliance Requirements", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• GDPR compliance for data protection",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• PCI DSS for payment processing",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Aviation industry regulations (IATA, ICAO)",
            spacing: { after: 400 },
          }),

          // 6. Evaluation Criteria (assigned to: Procurement Lead)
          new Paragraph({
            text: "6. EVALUATION CRITERIA",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Proposals will be evaluated based on the following weighted criteria:",
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: "• Technical Solution (30%): Innovation, scalability, and alignment with requirements",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Commercial Terms (25%): Cost-effectiveness and value for money",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Experience & Track Record (20%): Relevant aviation industry experience",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Implementation Approach (15%): Methodology and timeline feasibility",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Support & Maintenance (10%): Post-implementation support capabilities",
            spacing: { after: 400 },
          }),

          // 7. Submission Requirements (assigned to: Procurement Lead)
          new Paragraph({
            text: "7. SUBMISSION REQUIREMENTS",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "7.1 Proposal Format", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Executive summary (max 2 pages)",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Technical proposal with detailed solution architecture",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Commercial proposal with pricing breakdown",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Company credentials and references",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "7.2 Submission Deadline", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "All proposals must be submitted by {{DEADLINE}} to procurement@{{AIRLINE_NAME}}.com",
            spacing: { after: 400 },
          }),

          // 8. Terms & Conditions (assigned to: Legal Counsel)
          new Paragraph({
            text: "8. TERMS & CONDITIONS",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "• {{AIRLINE_NAME}} reserves the right to accept or reject any proposal",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• This RFT does not constitute a binding contract",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• All submitted materials become property of {{AIRLINE_NAME}}",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Confidentiality agreements must be signed before detailed discussions",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "• Payment terms: Net 30 days from invoice date",
            spacing: { after: 400 },
          }),

          // Contact Information
          new Paragraph({
            text: "9. CONTACT INFORMATION",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "For inquiries regarding this RFT, please contact:",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Procurement Department", bold: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "{{AIRLINE_NAME}}",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Email: procurement@{{AIRLINE_NAME}}.com",
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: "Phone: +971-XXX-XXXX",
            spacing: { after: 100 },
          }),
        ],
      },
    ],
  });

  return doc;
};

// Generate and save the template
const outputPath = path.join(process.cwd(), "attached_assets", "Emirates_RFT_Template.docx");

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const doc = createEmiratesTemplate();
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Emirates template created at: ${outputPath}`);
  console.log("\nTemplate includes the following token placeholders:");
  console.log("  - {{PROJECT_NAME}}");
  console.log("  - {{AIRLINE_NAME}}");
  console.log("  - {{DESCRIPTION}}");
  console.log("  - {{BUDGET}}");
  console.log("  - {{TIMELINE}}");
  console.log("  - {{REQUIREMENTS}}");
  console.log("  - {{DEADLINE}}");
  console.log("\nSections with stakeholder assignments:");
  console.log("  1. Executive Summary → Procurement Lead");
  console.log("  2. Background & Context → Technical PM");
  console.log("  3. Scope of Work → Solution Architect");
  console.log("  4. Technical Requirements → Solution Architect");
  console.log("  5. Security & Compliance → Cybersecurity Analyst");
  console.log("  6. Evaluation Criteria → Procurement Lead");
  console.log("  7. Submission Requirements → Procurement Lead");
  console.log("  8. Terms & Conditions → Legal Counsel");
  console.log("  9. Contact Information → Procurement Lead");
});
