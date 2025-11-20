import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, convertInchesToTwip, Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle } from "docx";
import fs from "fs";
import path from "path";

interface QuestionnaireSection {
  number: string;
  title: string;
  subsections?: Array<{
    number: string;
    title: string;
    vendorInstruction: string;
  }>;
  vendorInstruction?: string;
}

const QUESTIONNAIRE_STRUCTURE: QuestionnaireSection[] = [
  {
    number: "1",
    title: "Introduction",
    vendorInstruction: "Please provide an overview of your solution and company background relevant to this RFT."
  },
  {
    number: "2",
    title: "Architecture",
    subsections: [
      {
        number: "2.1",
        title: "Conceptual & Logical Architecture",
        vendorInstruction: ""
      },
      {
        number: "2.1.1",
        title: "Conceptual Architecture",
        vendorInstruction: "The conceptual architecture diagram has been provided above based on the RFT requirements. Please validate this diagram and provide your proposed solution architecture that addresses these components."
      },
      {
        number: "2.1.2",
        title: "Logical Architecture",
        vendorInstruction: "Please provide your logical architecture diagram showing the system components, layers, and their interactions."
      },
      {
        number: "2.2",
        title: "Application Architecture",
        vendorInstruction: ""
      },
      {
        number: "2.2.1",
        title: "Technical Architecture",
        vendorInstruction: "Please describe your technical architecture including technology stack, frameworks, middleware, and infrastructure components."
      },
      {
        number: "2.2.2",
        title: "Mobility Architecture",
        vendorInstruction: "Please describe your mobile architecture approach including native/hybrid/web technologies, offline capabilities, and synchronization mechanisms."
      },
      {
        number: "2.3",
        title: "Technical Roadmap",
        vendorInstruction: ""
      },
      {
        number: "2.3.1",
        title: "Technical Roadmap for the next 3 to 5 years",
        vendorInstruction: "Please provide your technical roadmap outlining planned technology upgrades, new capabilities, and evolution strategy for the next 3-5 years."
      },
      {
        number: "2.3.2",
        title: "Technical Debts remediation Plan",
        vendorInstruction: "Please describe any existing technical debts in your solution and your plan for addressing them."
      }
    ]
  },
  {
    number: "3",
    title: "Deployment / Hosting",
    vendorInstruction: "Please describe your deployment model (cloud/on-premise/hybrid), hosting infrastructure, deployment automation, and environment management approach."
  },
  {
    number: "4",
    title: "Reliability",
    vendorInstruction: "Please describe your approach to ensuring system reliability including uptime SLAs, redundancy, fault tolerance, disaster recovery, and business continuity measures."
  },
  {
    number: "5",
    title: "Security",
    vendorInstruction: "Please describe your security architecture including authentication, authorization, data encryption, network security, compliance certifications, and security monitoring capabilities."
  },
  {
    number: "6",
    title: "Integration",
    vendorInstruction: "Please describe your integration capabilities including supported protocols (REST, SOAP, GraphQL), API management, data transformation, integration patterns, and pre-built connectors."
  },
  {
    number: "7",
    title: "Networking",
    vendorInstruction: "Please describe your network architecture including topology, bandwidth requirements, latency considerations, VPN/private connectivity options, and network security measures."
  },
  {
    number: "8",
    title: "Performance Efficiency",
    vendorInstruction: "Please describe your approach to performance optimization including scalability mechanisms, load balancing, caching strategies, database optimization, and performance monitoring tools."
  },
  {
    number: "9",
    title: "Maintainability",
    vendorInstruction: "Please describe your approach to system maintainability including code quality practices, documentation standards, monitoring and logging, support processes, and upgrade procedures."
  },
  {
    number: "10",
    title: "Information & Data",
    vendorInstruction: "Please describe your data management approach including data models, data quality measures, master data management, data governance, backup and recovery, and data retention policies."
  }
];

/**
 * Generate Product Technical Questionnaire DOCX with embedded context diagram
 */
export async function generateProductTechnicalQuestionnaire(options: {
  projectName: string;
  contextDiagramPngPath: string;
  outputPath: string;
}): Promise<string> {
  const { projectName, contextDiagramPngPath, outputPath } = options;

  const docSections: (Paragraph | Table)[] = [];

  // Title page
  docSections.push(
    new Paragraph({
      text: projectName,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: "Product Technical Questionnaire",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: `Generated: ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({
      text: "",
      spacing: { after: 400 },
    })
  );

  // Add Table of Contents header
  docSections.push(
    new Paragraph({
      text: "Table of Contents",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  // Generate TOC entries
  QUESTIONNAIRE_STRUCTURE.forEach(section => {
    docSections.push(
      new Paragraph({
        text: `${section.number}\t${section.title}`,
        tabStops: [{
          type: 'left',
          position: convertInchesToTwip(0.5)
        }],
        spacing: { after: 100 },
      })
    );

    if (section.subsections) {
      section.subsections.forEach(sub => {
        docSections.push(
          new Paragraph({
            text: `${sub.number}\t${sub.title}`,
            tabStops: [{
              type: 'left',
              position: convertInchesToTwip(0.75)
            }],
            spacing: { after: 100 },
          })
        );
      });
    }
  });

  docSections.push(
    new Paragraph({
      text: "",
      spacing: { after: 400 },
    })
  );

  // Process each section
  for (const section of QUESTIONNAIRE_STRUCTURE) {
    // Main section heading
    docSections.push(
      new Paragraph({
        text: `${section.number}. ${section.title}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // If section has subsections, process them
    if (section.subsections) {
      for (const subsection of section.subsections) {
        docSections.push(
          new Paragraph({
            text: `${subsection.number} ${subsection.title}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 },
          })
        );

        // For section 2.1.1 (Conceptual Architecture), embed the diagram
        if (subsection.number === "2.1.1" && fs.existsSync(contextDiagramPngPath)) {
          const imageBuffer = fs.readFileSync(contextDiagramPngPath);
          
          // Embed at high resolution for crisp output
          // PNG is 3840x2880 pixels, displaying at 1800x1350 gives 300 DPI quality
          // This preserves detail while fitting nicely on a page (~6" x 4.5")
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Context Architecture Diagram:",
                  bold: true,
                }),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 1800,   // 6 inches at 300 DPI (was 600 - causing blur)
                    height: 1350,  // 4.5 inches at 300 DPI (was 450 - causing blur)
                  },
                  type: "png",
                }),
              ],
              spacing: { after: 200 },
            })
          );
        }

        // Add vendor instruction box
        if (subsection.vendorInstruction) {
          docSections.push(
            createVendorInstructionBox(subsection.vendorInstruction)
          );
        }

        docSections.push(
          new Paragraph({
            text: "",
            spacing: { after: 200 },
          })
        );
      }
    } else {
      // No subsections, add vendor instruction directly
      if (section.vendorInstruction) {
        docSections.push(
          createVendorInstructionBox(section.vendorInstruction)
        );
      }

      docSections.push(
        new Paragraph({
          text: "",
          spacing: { after: 200 },
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: docSections,
      },
    ],
  });

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate buffer and write to file
  const { Packer } = await import("docx");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

/**
 * Create a styled vendor instruction box (table-based for better visual separation)
 */
function createVendorInstructionBox(instruction: string): Table {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "4F46E5" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4F46E5" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "4F46E5" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "4F46E5" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "📝 Vendor Response Required",
                    bold: true,
                    color: "4F46E5",
                  }),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                text: instruction,
                spacing: { after: 100 },
              }),
            ],
            shading: {
              fill: "F0F0FF",
            },
            margins: {
              top: convertInchesToTwip(0.15),
              bottom: convertInchesToTwip(0.15),
              left: convertInchesToTwip(0.15),
              right: convertInchesToTwip(0.15),
            },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });
}
