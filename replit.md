# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, airline-specific sample data, and intelligent template management with auto-section detection. The project's ambition is to set a new standard for efficiency and objectivity in aviation procurement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with "New York" style shadcn/ui components, information-dense layouts, comprehensive gradient styling, and vibrant color theming.
**Key Features:**
-   **9-menu structure:** Home, Executive Summary, Smart RFT Builder, Template Management, RFT Draft Review, Knowledge Base, KB Chatbot, Generate Mock Data, Admin Config, and Agent Metrics.
-   **Template Management:** DOCX template management with drag-and-drop upload, metadata configuration, sortable catalog, section-to-stakeholder assignment, intelligent auto-section detection, and full integration with template API routes.
-   **RFT Draft Review:** Stakeholder-based collaborative review interface with draft selector, role filtering, section content editor, approval workflow, real-time progress visualization, and comprehensive RFT pack management. Features automatic pack generation (DOCX, PDF, 4 Excel questionnaires) via background jobs, "Download All as ZIP" for convenient package downloads, and "Publish to Portfolio" workflow.
-   **Smart RFT Builder Integration:** 3-step draft generation workflow with tabbed template selection, generation mode switching (AI generation vs. template merge), and automatic redirection to RFT Draft Review.
-   **Executive Summary Dashboard:** Global overview with KPI cards, vendor rankings, stage distribution charts, and activity stream.
-   **Vendor Shortlisting Dashboard:** Comprehensive vendor stage visualization with 10-stage procurement workflow matrix, automatic cache invalidation upon evaluation completion, and inline stage completion dates. Displays vendor progress cards and compact matrix grid with color-coded status indicators.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) for core entities, requirements, proposals, evaluations, vendor shortlisting stages, and RAG documents.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.
**Service Organization:** Services are modularized into `ai/`, `azure/`, `knowledgebase/`, `rft/`, `features/`, and `core/` for maintainability.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) for objective vendor proposal evaluation with externalized prompts.
**Core Capabilities:** Document understanding, semantic matching, dynamic scoring, real-time evaluation progress via SSE, and comprehensive agent metrics tracking.
**Production Resilience:** Duplicate evaluation prevention (checks existing evaluations before creation), exponential backoff retry logic for Azure OpenAI rate limits (429 errors), and correct foreign key constraint handling for agent metrics tracking.

### Smart RFT Builder
**Business Case Form Fields:** Project Name, Business Objective, Scope, Timeline, Budget, Functional Requirements, Non-functional Requirements, and Success Criteria.
**Dual-Path RFT Generation:** AI-generated structured RFT sections with stakeholder assignments or template merge using token substitution.
**Intelligent Template Processing:** Custom DOCX parser preserves formatting, multi-pattern section detection for varied heading formats, smart section content extraction, and valid category mapping.
**Universal AI Enhancement:** AI enhancement applies to all dynamic content sections with adaptive prompts, smart skipping of boilerplate sections, and tracking of enhancement status and extraction confidence.

### Advanced AI Features
Includes 5 production-ready AI features: Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and Conversational AI Assistant, all leveraging shared AI infrastructure with RAG.

### Knowledge Base & RAG Infrastructure
**Purpose:** Centralized repository for organizational documents and guidelines, enhancing AI evaluation accuracy.
**RAG Infrastructure:** Utilizes Azure Embedding Service, Intelligent Chunking Service, Azure Blob Storage, and Azure AI Search (vector database with hybrid search) for document ingestion, processing, and retrieval.
**Features:** Admin interface for document upload (PDF/TXT/DOC/DOCX/URL) with AI-powered section extraction and a Knowledge Base Chatbot.
**Category-Based Organization:** Documents are organized by AI agent role for targeted knowledge retrieval. Each document is assigned one of seven categories aligned with the multi-agent evaluation system: `delivery`, `product`, `architecture`, `engineering`, `procurement`, `security`, or `shared` (default). Blob storage uses category-based paths (`knowledge-base/{category}/{filename}`) for efficient organization. During evaluation, each agent retrieves documents filtered by their specific category plus shared documents, ensuring relevant domain-specific knowledge without noise from unrelated areas. Category filtering is implemented via Azure AI Search facets with query filters: `(category eq '{agent_role}') or (category eq 'shared')`. This enables precise, role-specific RAG retrieval while maintaining a shared knowledge commons accessible to all agents.
**OCR Integration:** Azure AI Search Skillsets with OCR capabilities extract text from images embedded in documents. The skillset pipeline writes OCR-enriched text to a dedicated `intellibid-blob-ocr` staging index. This staging index contains merged text (document content + OCR-extracted image text), blob metadata, and timestamps. The document ingestion pipeline can query this staging index to retrieve OCR-enriched text before chunking and embedding, ensuring image text is searchable through the RAG system. Skillset management is available through the Admin Config page with controls for initializing, running, and monitoring the indexer.

### Data Management
**Mock Data Generation:** Dedicated page for creating persistent RFT scenarios with pre-defined airline industry topics, generating RFTs, RFT packs, vendor responses, and evaluation reports. All generated documents are stored in Azure Blob Storage.

### Configuration Management
**System:** Exclusively uses environment variables for AI service credentials (OpenAI, Azure OpenAI, Azure Search, Azure Storage) via Replit Secrets.
**Shared Client Usage:** Centralized client factories and a `ConfigHelper` utility ensure consistent configuration across services.
**Caching:** OpenAI client instances are cached, with automatic invalidation upon configuration changes.
**Admin Config Page:** Provides Azure connectivity tests, data wiping functionality, and instructions for setting environment variables.

### Production Deployment (Azure App Service)
**Deployment Model:** Custom Docker container deployed to Azure App Service (Linux) with multi-stage build.
**Docker Build Strategy:** Three-stage Dockerfile separates frontend build, backend build, and production runtime for optimized image size. Backend bundle excludes Vite dependencies using esbuild configuration. AI agent prompt files (6 markdown files in `server/prompts/`) are copied to production image.

**Private Endpoint Connectivity:**
- **Challenge:** Custom Docker containers on Azure App Service use Docker's internal DNS resolver (127.0.0.11) by default, preventing resolution of Azure Private DNS zones required for PostgreSQL private endpoints.
- **Solution:** Startup script (`startup.sh`) runs as root at container start to configure `/etc/resolv.conf` with Azure DNS (168.63.129.16), then drops privileges to `nodejs` user before starting the application using `su-exec`.
- **Security:** Container starts as root for DNS configuration only, then immediately drops to non-root `nodejs` user for application runtime.

**VNet Integration Requirements:**
- **Two Subnets Required:** Private endpoint subnet (for PostgreSQL inbound connections) and integration subnet (for App Service outbound connections, delegated to `Microsoft.Web/serverFarms`).
- **App Service Configuration:** Requires `WEBSITE_DNS_SERVER=168.63.129.16` and `WEBSITE_VNET_ROUTE_ALL=1` application settings.
- **Private DNS Zone:** Azure Private DNS zone (`privatelink.postgres.database.azure.com`) must be linked to VNet with A record mapping hostname to private IP.
- **Connection String:** DATABASE_URL format remains unchanged (`postgresql://user:pass@host:5432/db?sslmode=require`); Azure DNS automatically resolves to private IP.

**Database Setup:**
- **Schema Management:** Uses Drizzle ORM with `npm run db:push` for schema synchronization (no manual SQL migrations)
- **Initialization Scripts:**
  - `setup-database.sh`: Interactive bash script for local database setup (requires DATABASE_URL environment variable)
  - `init-db.js`: Node.js script for automated database initialization in Docker containers
- **Deployment Process:**
  1. Set DATABASE_URL to Azure PostgreSQL connection string (with private endpoint hostname)
  2. Run `npm run db:push` or `node init-db.js` to create/update schema
  3. Schema is automatically deployed on first app startup if using init-db.js
- **Schema File:** All table definitions in `shared/schema.ts`
- **Migration History:** Stored in `migrations/` directory (managed by drizzle-kit)

**Key Files:**
- `Dockerfile`: Multi-stage build with DNS configuration support
- `startup.sh`: DNS configuration and privilege-dropping script
- `esbuild.config.mjs`: Backend bundling configuration excluding Vite
- `drizzle.config.ts`: Database migration configuration
- `setup-database.sh`: Interactive database setup script
- `init-db.js`: Automated database initialization script

## External Dependencies

### Third-Party Services
-   **OpenAI API:** Document analysis, semantic matching, evaluation generation (GPT-4o), and embeddings (via Azure OpenAI).
-   **Neon Serverless:** PostgreSQL database.
-   **Azure Services:** Azure AI Search (vector database), Azure Blob Storage (raw document storage), Azure OpenAI (embeddings).

### UI Component Libraries
-   **Radix UI:** Accessible, unstyled UI primitives.
-   **Recharts:** Data visualization.

### File Processing Libraries
-   **pdf-parse:** Extracts text from PDF documents.
-   **Multer:** Handles multipart/form-data file uploads.
-   **ExcelJS:** Creates Excel files.
-   **marked:** Markdown parser.
-   **docx:** Generates Word documents.
-   **pdfkit:** Generates PDF documents.
-   **archiver:** Creates ZIP archives.

### Styling & Design
-   **Tailwind CSS:** Utility-first CSS framework.