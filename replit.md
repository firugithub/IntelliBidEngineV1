# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, airline-specific sample data, and intelligent template management with auto-section detection. The project's ambition is to set a new standard for efficiency and objectivity in aviation procurement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React with TypeScript, Vite, shadcn/ui (Radix UI), and Tailwind CSS. It features a dark mode-first, enterprise-focused design with a "New York" style, information-dense layouts, comprehensive gradient styling, and vibrant color theming. The application is structured with a 9-menu navigation and includes dashboards for Executive Summary and Vendor Shortlisting, along with dedicated sections for Template Management, RFT Draft Review, Smart RFT Builder, and a Knowledge Base Chatbot.

### Technical Implementations
The backend is built with Node.js, TypeScript, Express.js, and Drizzle ORM (PostgreSQL). It provides RESTful APIs for managing core entities, file uploads, sample data, and configuration. Data is stored in a PostgreSQL database (Neon serverless).

### Feature Specifications
- **Multi-Agent Evaluation System:** Employs 6 specialized AI agents for objective vendor proposal evaluation, supporting document understanding, semantic matching, and dynamic scoring. **Atomic duplicate prevention** uses database-level unique constraints: `evaluations.proposal_id` (ensures 1:1 proposal-to-evaluation mapping) and `proposals(project_id, vendor_name, document_type)` (prevents duplicate questionnaire responses per vendor). Vendor response generation automatically updates existing proposal records with fresh Azure Blob Storage URLs on regeneration, ensuring ZIP downloads always reference current files. Implementation uses onConflictDoNothing for evaluations and updateProposal for proposal refreshes. Stuck evaluations can be manually recovered using the "Re-evaluate" button on Dashboard. Additional resilience: exponential backoff for API rate limits.
- **Vendor Response Diversity System:** Generates realistic, differentiated vendor responses using OpenAI GPT-4o, creating unique vendor personas for credible evaluations.
- **Smart RFT Builder:** Facilitates triple-path RFT generation: (1) AI-generated from business case, (2) Template merge with existing templates, or (3) **Agent-Driven creation** where the same 6 specialized AI agents (Product, Architecture, Engineering, Security, Procurement, Delivery) that evaluate proposals also generate expert-level RFT sections during creation phase. Agent-driven mode requires only project name, business objective, and scope - no business case needed. Generates comprehensive RFT (DOCX/PDF) plus 4 Excel questionnaires with domain-specific questions, all uploaded to Azure Blob Storage. **Product Technical Questionnaire**: When business case is provided, automatically generates a comprehensive DOCX questionnaire with 10 sections (Introduction, Architecture [Conceptual/Logical/Application/Roadmap], Deployment, Reliability, Security, Integration, Networking, Performance, Maintainability, Information & Data). Features **high-DPI context diagram** (3840x2880 pixels, ~11MP) embedded at 1800x1350 resolution (6"×4.5" at 300 DPI) showing stakeholders, channels, interfacing systems, and data assets in Section 2.1.1. **Separate PNG diagram** (Context_Architecture_Diagram.png, 3840x2880 pixels) is also included in download pack for maximum viewing clarity. Diagram uses Puppeteer deviceScaleFactor: 2 with 1920x1440 logical viewport, Mermaid config with 18px fonts and enhanced spacing for crisp, professional-quality output without blur.
- **Advanced AI Features:** Includes Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and a Conversational AI Assistant.
- **Knowledge Base & RAG Infrastructure:** Utilizes Azure Embedding Service, Intelligent Chunking, Azure Blob Storage, and Azure AI Search for document ingestion, processing, and retrieval, organized by AI agent role for targeted knowledge. OCR integration via Azure AI Search Skillsets ensures text extraction from images.
- **Data Management:** Includes a mock data generation page for creating persistent RFT scenarios and evaluation reports, with documents stored in Azure Blob Storage.
- **Configuration Management:** Uses environment variables via Replit Secrets, with a centralized `ConfigHelper` and an Admin Config page for managing Azure connectivity and data operations.

### System Design Choices
The application is designed for production deployment on Azure App Service using custom Docker containers. It employs a multi-stage Docker build strategy for optimized image size. Special attention is paid to private endpoint connectivity for PostgreSQL, configuring DNS resolution within the Docker container and adhering to VNet integration requirements for Azure App Service. Database schema management is handled by Drizzle ORM. SQL setup files (`azure-database-setup.sql`, `azure-database-seed.sql`, `azure-database-indexes.sql`) are maintained for Azure PostgreSQL deployment and reflect all latest schema changes including atomic duplicate prevention constraints (updated November 19, 2025). **System Dependencies:** Product Technical Questionnaire generation requires Puppeteer system libraries (glib, nss, libX11, libxkbcommon, etc.) installed on November 20, 2025 to support Mermaid diagram rendering.

## External Dependencies

### Third-Party Services
-   **OpenAI API:** Document analysis, evaluation generation, and embeddings.
-   **Neon Serverless:** PostgreSQL database.
-   **Azure Services:** Azure AI Search, Azure Blob Storage, Azure OpenAI.

### UI Component Libraries
-   **Radix UI:** UI primitives.
-   **Recharts:** Data visualization.

### File Processing Libraries
-   **pdf-parse:** PDF text extraction.
-   **Multer:** File uploads.
-   **ExcelJS:** Excel file creation.
-   **marked:** Markdown parsing.
-   **docx:** Word document generation.
-   **pdfkit:** PDF document generation.
-   **archiver:** ZIP archive creation.
-   **@mermaid-js/mermaid-cli:** Mermaid diagram rendering (requires Puppeteer and system dependencies: glib, nss, libX11, libxkbcommon, etc.).

### Styling & Design
-   **Tailwind CSS:** Utility-first CSS framework.