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
- **Multi-Agent Evaluation System:** Employs 6 specialized AI agents for objective vendor proposal evaluation, supporting document understanding, semantic matching, and dynamic scoring. Includes production resilience features like duplicate evaluation prevention and exponential backoff for API rate limits.
- **Vendor Response Diversity System:** Generates realistic, differentiated vendor responses using OpenAI GPT-4o, creating unique vendor personas for credible evaluations.
- **Smart RFT Builder:** Facilitates dual-path RFT generation (AI-generated or template merge) with intelligent template processing that preserves formatting and detects sections.
- **Advanced AI Features:** Includes Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and a Conversational AI Assistant.
- **Knowledge Base & RAG Infrastructure:** Utilizes Azure Embedding Service, Intelligent Chunking, Azure Blob Storage, and Azure AI Search for document ingestion, processing, and retrieval, organized by AI agent role for targeted knowledge. OCR integration via Azure AI Search Skillsets ensures text extraction from images.
- **Data Management:** Includes a mock data generation page for creating persistent RFT scenarios and evaluation reports, with documents stored in Azure Blob Storage.
- **Configuration Management:** Uses environment variables via Replit Secrets, with a centralized `ConfigHelper` and an Admin Config page for managing Azure connectivity and data operations.

### System Design Choices
The application is designed for production deployment on Azure App Service using custom Docker containers. It employs a multi-stage Docker build strategy for optimized image size. Special attention is paid to private endpoint connectivity for PostgreSQL, configuring DNS resolution within the Docker container and adhering to VNet integration requirements for Azure App Service. Database schema management is handled by Drizzle ORM.

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

### Styling & Design
-   **Tailwind CSS:** Utility-first CSS framework.