# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to objectively transform and streamline the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, airline-specific sample data, and intelligent template management with auto-section detection. The project's ambition is to set a new standard for efficiency and objectivity in aviation procurement.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with "New York" style shadcn/ui components, and information-dense layouts. Features comprehensive gradient styling and vibrant color theming for enhanced visual appeal and data representation across dashboards.
**Key Pages & Navigation:** Portfolio-centric 9-menu structure including Home, Executive Summary, Smart RFT Builder, Template Management, RFT Draft Review, Knowledge Base, KB Chatbot, Generate Mock Data, Admin Config, and Agent Metrics.
**Template Management Page:** Complete DOCX template management interface with drag-and-drop upload, metadata configuration (name, description, category), sortable template catalog table, section-to-stakeholder assignment configuration modal with role legend, and full integration with all 8 template API routes. Features intelligent auto-section detection from document headings, upload extraction summary showing detected sections with default assignees, query invalidation for fresh data, and comprehensive loading/error states. Auto-detects sections from numbered headings and infers stakeholder assignments based on section content (e.g., "Security & Compliance" → Cybersecurity Analyst).
**RFT Draft Review Page:** Stakeholder-based collaborative review interface with draft selector, stakeholder role filter dropdown (7 aviation roles), section cards displaying approval status indicators and assigned stakeholder badges, section content editor dialog with approval reset, approval workflow with approver name capture, and finalize draft action with progress tracking. Fully integrated with 5 collaborative draft review API endpoints (list drafts, get draft details, update section, approve section, finalize draft). Features empty states, loading states, disabled controls based on approval status, visual highlighting for approved sections, and real-time approval progress visualization.
**Smart RFT Builder Integration:** 3-step draft generation workflow with tabbed template selection (AI Templates vs Organization Templates), generation mode switching (ai_generation vs template_merge), optional template selection for AI mode, required template for merge mode, and automatic redirect to RFT Draft Review page after successful draft creation. Success toast displays draft ID and confirms redirect to collaborative review workspace.
**Executive Summary Dashboard:** Provides a global overview with a professional gradient hero section, vibrant color-themed KPI cards with trend indicators, beautified Top Vendors rankings with score-based color-coded progress bars, improved vendor stage distribution charts, and a timeline-style activity stream.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) for core entities, requirements, proposals, evaluations, vendor_shortlisting_stages, and RAG documents. The `vendor_shortlisting_stages` table tracks vendor progress through a 10-stage procurement workflow.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.
**Service Organization:** Backend services are organized into logical modules for better maintainability:
- `server/services/ai/` - Core AI services (aiAnalysis, multiAgentEvaluator, aiOrchestration, conversationalAI)
- `server/services/azure/` - Azure integrations (azureEmbedding, azureBlobStorage, azureAISearch)
- `server/services/knowledgebase/` - RAG & document management (ragRetrieval, chatbot, MCP connector, chunking, ingestion, parsing, cache)
- `server/services/rft/` - RFT generation features (smartRft, businessCase, mockData, excel generators, document generators)
- `server/services/features/` - Advanced AI features (compliance gaps, followup questions, executive briefing, vendor comparison, summary, vendor stages, report PDF)
- `server/services/core/` - Configuration & utilities (configHelpers, agentMetrics, evaluationProgress, sampleData)

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) for objective vendor proposal evaluation. Agent prompts are externalized to Markdown files for easy updates.
**Document Understanding:** Parses RFTs, extracts vendor capabilities, performs semantic matching, generates weighted scores, and provides role-specific insights.
**Dynamic Scoring:** Real-time recalculation of overall and dimension-specific scores.
**Real-Time Evaluation Progress:** Server-Sent Events (SSE) provide live updates on evaluation status.
**Agent Metrics & Observability:** Comprehensive tracking of execution time, token usage, cost estimation, success rates, and error classification for each agent execution, persisted in PostgreSQL and accessible via dedicated API endpoints and an enterprise dashboard.

### Smart RFT Builder
**Dual-Path RFT Generation:** Two generation modes - (1) AI-generated templates with intelligent section creation, and (2) Organization template merge with token substitution from uploaded DOCX templates.
**Tabbed Template Selection:** Step 2 features tabs for "AI Templates" vs "Organization Templates" to handle large template catalogs and clearly differentiate generation modes.
**Draft-First Workflow:** A 3-step process (Business Case → Template Selection → Draft Generation) that creates collaborative drafts with stakeholder assignments instead of final documents.
**Collaborative Review Integration:** After generation, users are redirected to the RFT Draft Review page where sections are assigned to aviation stakeholders (Technical PM, Solution Architect, Cybersecurity Analyst, etc.) for approval workflow.
**Generation Modes:**
  - `ai_generation`: AI creates structured RFT sections with stakeholder assignments based on business case (template selection optional)
  - `template_merge`: Merges business case data with selected organization DOCX template using pre-configured stakeholder assignments from auto-detected sections (template selection required)
**Auto-Section Detection:** Organization templates automatically detect sections from numbered headings during upload, inferring appropriate stakeholder assignments (Procurement Lead, Technical PM, Solution Architect, Cybersecurity Analyst, Legal Counsel, etc.) based on section titles.
**Intelligent Template Processing:** Three-level fallback for robust extraction - docxtemplater → direct XML parsing → graceful degradation with manual configuration option.
**Emirates Sample Template:** Production-ready aviation RFT template with 9 sections, 7 token placeholders, and IATA/ICAO compliance content for testing template merge workflow.
**Azure Blob Storage Publishing:** Final DOCX/PDF documents published after draft finalization.

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
IntelliBid uses environment variables exclusively for managing AI service credentials (OpenAI, Azure OpenAI, Azure Search, Azure Storage). All AI services access credentials through the `ConfigHelper` utility in `server/services/core/configHelpers.ts`, which provides a simple interface for retrieving environment variables.

### Configuration System
All credentials are managed through Replit Secrets (environment variables). The database configuration system has been removed for security and simplicity. All AI services use the centralized `ConfigHelper.getConfigValue(key)` method to retrieve credentials from environment variables.

### Shared Client Usage
All AI services use centralized client factories to ensure consistent configuration:
- **getOpenAIClient()** (server/services/ai/aiAnalysis.ts): Provides Azure OpenAI or regular OpenAI client using environment variables, used by all agent evaluation, conversational AI, Smart RFT generation, business case generation, and knowledge base chatbot services
- **getAzureOpenAIConfig()** (server/services/core/configHelpers.ts): Provides Azure OpenAI configuration for embedding service using environment variables
- **ConfigHelper utility** (server/services/core/configHelpers.ts): Core helper providing `getConfigValue(key)` for unified credential lookup across all services

### Configuration Caching & Invalidation
- OpenAI client instances are cached for performance
- Configuration hash automatically computed from current environment values
- Cache invalidated when configuration changes detected (logged as "OpenAI config changed, invalidating cache")
- Cold starts and config changes trigger automatic client re-initialization

### Required Environment Variables

Set these environment variables in Replit Secrets (Tools → Secrets):

#### For Azure OpenAI (Embeddings)
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI service endpoint URL
- `AZURE_OPENAI_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` - Embedding model deployment name
- `AZURE_OPENAI_API_VERSION` - API version (e.g., "2024-08-01-preview")

#### For Azure OpenAI (Multi-Agent Evaluation) - Optional if using regular OpenAI
- `AZURE_OPENAI_DEPLOYMENT` - Azure OpenAI deployment name for agent evaluation

#### For Azure AI Search
- `AZURE_SEARCH_ENDPOINT` - Azure AI Search service endpoint
- `AZURE_SEARCH_KEY` - Azure AI Search admin API key

#### For Azure Blob Storage
- `AZURE_STORAGE_CONNECTION_STRING` - Azure Blob Storage connection string

#### For Regular OpenAI (Alternative to Azure)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (automatically set by Replit OpenAI integration)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Optional, for proxied endpoints

### Admin Config Page
The Admin Config page provides:
- **Azure Connectivity Test**: Verifies all Azure services are properly configured and accessible
- **Wipe Data**: Permanently deletes all application data and Azure resources
- **Configuration Instructions**: Displays the required environment variables and how to set them in Replit Secrets

### Deployment Considerations

#### Replit Deployment
1. Add all required environment variables to Replit Secrets (Tools → Secrets)
2. The application will automatically use these credentials on startup
3. Use the Admin Config page to test Azure connectivity and verify configuration

#### External Deployment (Azure VMs, Standard Servers)
1. Set all required environment variables in your deployment environment
2. Ensure environment variables are available to the Node.js process
3. The application will automatically detect and use these credentials
4. No database setup required for configuration management

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