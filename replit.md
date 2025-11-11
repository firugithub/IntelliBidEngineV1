# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to objectively transform and streamline the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data. The project's ambition is to set a new standard for efficiency and objectivity in aviation procurement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with "New York" style shadcn/ui components, and information-dense layouts. Features comprehensive gradient styling and vibrant color theming for enhanced visual appeal and data representation across dashboards.
**Key Pages & Navigation:** Portfolio-centric 7-menu structure including Home, Smart RFT Builder, Knowledge Base, KB Chatbot, Generate Mock Data, Executive Summary, and Admin Config. Includes a dedicated "Agent Metrics" page for observability.
**Executive Summary Dashboard:** Provides a global overview with a professional gradient hero section, vibrant color-themed KPI cards with trend indicators, beautified Top Vendors rankings with score-based color-coded progress bars, improved vendor stage distribution charts, and a timeline-style activity stream.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) for core entities, requirements, proposals, evaluations, vendor_shortlisting_stages, and RAG documents. The `vendor_shortlisting_stages` table tracks vendor progress through a 10-stage procurement workflow.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) for objective vendor proposal evaluation. Agent prompts are externalized to Markdown files for easy updates.
**Document Understanding:** Parses RFTs, extracts vendor capabilities, performs semantic matching, generates weighted scores, and provides role-specific insights.
**Dynamic Scoring:** Real-time recalculation of overall and dimension-specific scores.
**Real-Time Evaluation Progress:** Server-Sent Events (SSE) provide live updates on evaluation status.
**Agent Metrics & Observability:** Comprehensive tracking of execution time, token usage, cost estimation, success rates, and error classification for each agent execution, persisted in PostgreSQL and accessible via dedicated API endpoints and an enterprise dashboard.

### Smart RFT Builder
**AI-Powered Generation:** Generates context-aware RFTs from ideas or uploaded documents, deeply integrating business case details into questionnaire generation.
**Multi-Deliverable Generation:** Creates 5 comprehensive RFT deliverables (Sample RFT Document, Product Questionnaire, NFR Questionnaire, Cybersecurity Questionnaire, Agile Questionnaire) with professional formatting.
**Workflow:** A 4-step process for RFT creation, template selection, AI generation, and review.
**Azure Blob Storage Publishing:** Publishes generated files to structured paths.

### Advanced AI Features
IntelliBid includes 5 production-ready AI features: Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and Conversational AI Assistant, all leveraging a shared AI infrastructure with RAG integration.

### Knowledge Base
**Purpose:** Centralized repository for organizational documents and guidelines to enhance AI evaluation accuracy, with support for external Model Context Protocol (MCP) connectors.
**Document Management with RAG:** Admin interface for uploading documents (PDF/TXT/DOC/DOCX/URL) with AI-powered section extraction and RAG ingestion.
**Knowledge Base Chatbot:** Dedicated interface for testing RAG and MCP integrations with conversational AI and source attribution.

### RAG Infrastructure (Retrieval Augmented Generation)
**Components:** Azure Embedding Service, Intelligent Chunking Service, Azure Blob Storage Service, and Azure AI Search Service (vector database with hybrid search).
**Document Ingestion Pipeline:** Robust process for parsing, chunking, embedding, storing, and indexing documents.
**Integration:** Used for contextual augmentation of AI agent prompts and compliance standard integration.

### Data Management
**Generate Mock Data Page:** Dedicated page for creating persistent RFT scenarios with pre-defined airline industry topics, generating RFTs, RFT packs, vendor responses, and complete evaluation reports. Includes a one-click "Download All Mock Data" feature.
**Azure Blob Storage Integration:** All generated documents are organized in structured project-specific folders.

## Configuration Management

### Overview
IntelliBid uses a centralized configuration system for managing AI service credentials (OpenAI, Azure OpenAI, Azure Search, Azure Storage). All AI services access credentials through shared helper functions that implement a consistent fallback hierarchy, ensuring reliable operation in both database-configured and environment-variable-only deployments.

### Configuration Hierarchy
The system follows a strict priority order for credential retrieval:
1. **Database First (system_config table):** Credentials configured via Admin Config page are checked first
2. **Environment Variables Fallback:** If database config is unavailable, automatically falls back to environment variables
3. **Clear Error Messages:** If neither source provides required credentials, descriptive error messages guide configuration via Admin Config or environment setup

### Shared Client Usage
All AI services use centralized client factories to ensure consistent configuration:
- **getOpenAIClient()** (server/services/aiAnalysis.ts): Provides Azure OpenAI or regular OpenAI client with automatic config fallback, used by all agent evaluation, conversational AI, Smart RFT generation, business case generation, and knowledge base chatbot services
- **getAzureOpenAIConfig()** (server/services/configHelpers.ts): Provides Azure OpenAI configuration for embedding service with automatic fallback
- **ConfigHelper utility** (server/services/configHelpers.ts): Core helper providing getConfigValue() for unified credential lookup across all services

### Configuration Caching & Invalidation
- OpenAI client instances are cached for performance
- Configuration hash automatically computed from current DB and environment values
- Cache invalidated when configuration changes detected (logged as "OpenAI config changed, invalidating cache")
- Cold starts and config changes trigger automatic client re-initialization

### Credential Configuration Paths

#### Via Admin Config Page (Database)
Navigate to Admin Config → System Configuration to set:
- **For Azure OpenAI Agents:**
  - AGENTS_OPENAI_ENDPOINT (Azure endpoint URL)
  - AGENTS_OPENAI_KEY (Azure API key)
  - AGENTS_OPENAI_DEPLOYMENT (Azure deployment name)
  - AGENTS_OPENAI_API_VERSION (e.g., "2024-08-01-preview")
- **For Azure OpenAI Embeddings:**
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_KEY
  - AZURE_OPENAI_EMBEDDING_DEPLOYMENT
- **For Azure AI Search:**
  - AZURE_SEARCH_ENDPOINT
  - AZURE_SEARCH_KEY
- **For Azure Blob Storage:**
  - AZURE_STORAGE_CONNECTION_STRING
- **For Regular OpenAI:**
  - OPENAI_API_KEY (falls back to AI_INTEGRATIONS_OPENAI_API_KEY from environment)

#### Via Environment Variables (Fallback)
Set these environment variables as fallback or for environment-only deployments:
- AI_INTEGRATIONS_OPENAI_API_KEY (regular OpenAI)
- AI_INTEGRATIONS_OPENAI_BASE_URL (optional, for proxied endpoints)
- AZURE_OPENAI_ENDPOINT
- AZURE_OPENAI_KEY
- AZURE_OPENAI_DEPLOYMENT
- AZURE_OPENAI_EMBEDDING_DEPLOYMENT
- AZURE_OPENAI_API_VERSION
- AZURE_SEARCH_ENDPOINT
- AZURE_SEARCH_KEY
- AZURE_STORAGE_CONNECTION_STRING

### Deployment Considerations

#### Replit Deployment
- Configure credentials via Admin Config page for production
- Environment variables (AI_INTEGRATIONS_*) automatically available for regular OpenAI
- Azure credentials must be added via Admin Config or Replit Secrets

#### External Deployment (Azure VMs, Standard Servers)
- Set all required environment variables in deployment environment
- Admin Config page can still be used for runtime credential updates
- Ensure database connectivity for system_config table access
- Configuration automatically falls back to environment variables if database is unavailable

## External Dependencies

### Third-Party Services
**OpenAI API:** Document analysis, semantic matching, evaluation generation (GPT-4o), and embeddings (via Azure OpenAI).
**Neon Serverless (PostgreSQL):** Primary database.
**Azure Services:** Azure AI Search (vector database), Azure Blob Storage (raw document storage), and Azure OpenAI (embeddings).

### UI Component Libraries
**Radix UI:** Accessible, unstyled UI primitives.
**Recharts:** Data visualization.

### File Processing
**pdf-parse:** Extracts text from PDF documents.
**Multer:** Handles multipart/form-data file uploads.
**ExcelJS:** Creates professionally formatted Excel files.
**marked:** Markdown parser.
**docx:** Generates Word documents.
**pdfkit:** Generates PDF documents.
**archiver:** Creates ZIP archives.

### Styling & Design
**Tailwind CSS:** Utility-first CSS framework.