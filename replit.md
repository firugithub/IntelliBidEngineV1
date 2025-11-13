# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, airline-specific sample data, and intelligent template management with auto-section detection. The project's ambition is to set a new standard for efficiency and objectivity in aviation procurement.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 13, 2025 - Fixed Empty ZIP Download Bug
**Issue:** "Download All as ZIP" from RFT Draft Review producing empty ZIP files (22 bytes).

**Root Causes & Fixes:**
1. **Storage Path Mismatch**: Files saved to `RFT_Pack/` instead of `RFT_Generated/` (fixed in draftPackGenerator.ts)
2. **Metadata Structure**: Download route accessed wrong nested structure `pack.docxBlobUrl` instead of `pack.files.docx.url` (fixed in server/routes.ts)
3. **Import Error**: Used default export instead of named export for Azure service (fixed in server/routes.ts)
4. **Backward Compatibility**: Added fallback logic for legacy draft metadata to support both old and new structures

**Result:** ZIP downloads now work correctly, containing all 6 files (DOCX, PDF, 4 Excel questionnaires) with actual content (~150KB+ total).

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with "New York" style shadcn/ui components, information-dense layouts, comprehensive gradient styling, and vibrant color theming.
**Key Features:**
-   **9-menu structure:** Home, Executive Summary, Smart RFT Builder, Template Management, RFT Draft Review, Knowledge Base, KB Chatbot, Generate Mock Data, Admin Config, and Agent Metrics.
-   **Template Management:** DOCX template management with drag-and-drop upload, metadata configuration, sortable catalog, section-to-stakeholder assignment, intelligent auto-section detection, and full integration with template API routes.
-   **RFT Draft Review:** Stakeholder-based collaborative review interface with draft selector, role filtering, section content editor, approval workflow, real-time progress visualization, and comprehensive RFT pack management. Features automatic pack generation (DOCX, PDF, 4 Excel questionnaires) via background jobs, auto-refresh polling for real-time completion updates, attractive progress bar during generation, "Download All as ZIP" for convenient package downloads, and "Publish to Portfolio" workflow that converts finalized drafts into published RFTs visible in the Portfolio RFT Tab.
-   **Smart RFT Builder Integration:** 3-step draft generation workflow with tabbed template selection (AI Templates vs. Organization Templates), generation mode switching (AI generation vs. template merge), and automatic redirection to RFT Draft Review.
-   **Executive Summary Dashboard:** Global overview with KPI cards, vendor rankings, stage distribution charts, and activity stream.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) for core entities, requirements, proposals, evaluations, vendor shortlisting stages, and RAG documents.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.
**Service Organization:** Services are modularized into `ai/`, `azure/`, `knowledgebase/`, `rft/`, `features/`, and `core/` for maintainability.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) for objective vendor proposal evaluation with externalized prompts.
**Core Capabilities:** Document understanding, semantic matching, dynamic scoring, real-time evaluation progress via SSE, and comprehensive agent metrics tracking (execution time, token usage, cost, success rates).

### Smart RFT Builder
**Business Case Form Fields:** Project Name, Business Objective, Scope, Timeline, Budget, Functional Requirements (required), Non-functional Requirements (optional), and Success Criteria. Functional requirements describe system capabilities; non-functional requirements specify quality attributes (performance, security, scalability).
**Dual-Path RFT Generation:**
-   **AI-generated:** AI creates structured RFT sections with stakeholder assignments.
-   **Template Merge:** Fully functional token substitution system that merges business case data with organization DOCX templates. Supports placeholders: {{PROJECT_NAME}}, {{AIRLINE_NAME}}, {{DESCRIPTION}}, {{BUDGET}}, {{TIMELINE}}, {{FUNCTIONAL_REQUIREMENTS}}, {{NON_FUNCTIONAL_REQUIREMENTS}}, {{REQUIREMENTS}} (combined), {{DEADLINE}}.
**Workflow:** A 3-step "Draft-First" process (Business Case → Template Selection → Draft Generation) leading to collaborative drafts with stakeholder assignments.
**Intelligent Template Processing:** 
-   **Text Extraction with Formatting:** Custom DOCX parser (`extractTextWithFormatting`) preserves paragraph structure by parsing XML `<w:p>` tags, joining paragraphs with `\n\n` for readable output instead of blob text.
-   **Multi-Pattern Section Detection:** Auto-detection tries multiple regex patterns (numbered uppercase, numbered mixed case, unnumbered uppercase) to handle varied heading formats. Successfully detects 9+ sections from professional templates.
-   **Smart Section Content Extraction:** Analyzes merged document to find heading positions, extracts content between headings for section-specific drafts. High-confidence extractions provide targeted content; low-confidence falls back to full document with warning.
-   **Valid Category Mapping:** All section categories strictly mapped to allowed types (business/technical/security/procurement/other). Security and compliance sections → "security", evaluation/terms sections → "procurement".
-   **Template Storage:** Business case form data stored in extractedData JSONB for template merge access. Templates without section mappings generate single-section drafts.
**Token Substitution:** Business case fields are stored in extractedData and mapped to template placeholders during merge. Robust error handling for malformed templates with user-friendly guidance.
**Universal AI Enhancement (All Dynamic Sections):**
-   **Scope:** AI enhancement applies to ALL dynamic content sections (Executive Summary, Background, Scope of Work, Requirements, Evaluation Criteria, etc.), not just technical sections.
-   **Adaptive Prompts:** Two intelligent prompt templates - (1) Structured requirements with 20+ items and acceptance criteria for technical/requirements sections, (2) Narrative expansion (300-500 words) for content sections like Executive Summary and Background.
-   **Smart Skipping:** Administrative/boilerplate sections (Contact Information, Terms & Conditions) correctly bypassed to control costs.
-   **Section Metadata:** Each section tracked with `aiEnhanced` (boolean), `enhancementStatus` (success/skipped/error), and `extractionConfidence` (high/low) for transparency and debugging.

### Advanced AI Features
Includes 5 production-ready AI features: Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and Conversational AI Assistant, all leveraging shared AI infrastructure with RAG.

### Knowledge Base & RAG Infrastructure
**Purpose:** Centralized repository for organizational documents and guidelines, enhancing AI evaluation accuracy.
**RAG Infrastructure:** Utilizes Azure Embedding Service, Intelligent Chunking Service, Azure Blob Storage, and Azure AI Search (vector database with hybrid search) for document ingestion, processing, and retrieval.
**Features:** Admin interface for document upload (PDF/TXT/DOC/DOCX/URL) with AI-powered section extraction and a Knowledge Base Chatbot for testing RAG/MCP integrations.

### Data Management
**Mock Data Generation:** Dedicated page for creating persistent RFT scenarios with pre-defined airline industry topics, generating RFTs, RFT packs, vendor responses, and evaluation reports. All generated documents are stored in Azure Blob Storage.

### Configuration Management
**System:** Exclusively uses environment variables for AI service credentials (OpenAI, Azure OpenAI, Azure Search, Azure Storage) via Replit Secrets.
**Shared Client Usage:** Centralized client factories (`getOpenAIClient()`, `getAzureOpenAIConfig()`) and a `ConfigHelper` utility ensure consistent configuration across services.
**Caching:** OpenAI client instances are cached, with automatic invalidation upon configuration changes.
**Admin Config Page:** Provides Azure connectivity tests, data wiping functionality, and instructions for setting environment variables.

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