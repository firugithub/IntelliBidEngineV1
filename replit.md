# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview

IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. The platform automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale tailored for various airline stakeholders. It aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection in the aviation industry. The platform is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.

**Design System:** Dark mode-first, enterprise-focused design with Inter and JetBrains Mono fonts, "New York" style shadcn/ui components, and information-dense layouts.

**Key Pages:** Includes HomePage (portfolio overview), PortfolioPage (all projects), NewProjectPage (project creation), UploadPage (structured document uploads for RFT and vendor proposals), and DashboardPage (evaluation results with visualizations and role-based views).

### Backend Architecture

**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.

**Data Storage:** PostgreSQL database (configured for Neon serverless) with tables for portfolios, projects, requirements, proposals, evaluations, standards, RAG documents, and RAG chunks.

**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.

**Key Services:** `documentParser` for text extraction, `aiAnalysis` for GPT-4o powered evaluations, and `sampleData` for demonstration purposes.

### AI Analysis Pipeline

**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Security) with domain-expert personas to evaluate vendor proposals against both general best practices and organization-specific compliance standards. This includes evaluating delivery methodologies, IATA standards, architectural patterns, API design, TCO/ROI, and security compliance (ISO 27001, PCI-DSS, GDPR, NIST).

**Document Understanding Flow:** Parses RFTs for criteria, extracts vendor capabilities from proposals, performs semantic matching against requirements, generates weighted scores across dimensions like Technical Fit, Delivery Risk, Cost, and Compliance, and produces role-specific insights.

**Scoring Dimensions:** Overall Score, Technical Fit, Delivery Risk, Cost, and Compliance, with statuses like "recommended," "under-review," and "risk-flagged."

### Knowledge Base

**Purpose:** Centralized repository for managing organizational documents and guidelines across multiple domains to enhance AI evaluation accuracy. Integrates external Model Context Protocol (MCP) connectors for additional data sources.

**Document Categories:**
- **Architecture Guidelines:** Cloud architecture patterns, system design standards, infrastructure best practices
- **Delivery & Project Management:** Project methodologies, sprint planning frameworks, delivery standards
- **Procurement & SLA Standards:** Vendor contracts, service level agreements, procurement policies
- **Development Standards & Frameworks:** Coding standards, estimation frameworks, development best practices
- **Security Standards & Policies:** ISO 27001, PCI-DSS, GDPR, NIST, security policies
- **General Documentation:** Any other organizational knowledge not fitting the above categories

**Key Features:**
- **Document Management with RAG Integration:** Admin interface for uploading and managing organizational documents with automatic RAG ingestion. Features include:
  - Document upload (PDF/TXT/DOC/DOCX or URL) with AI-powered section extraction
  - Category selection to organize documents by domain (Architecture, Delivery, Procurement, Development, Security, General)
  - **Stakeholder-Based Grouping:** Documents automatically organized into 5 stakeholder groups for easy navigation:
    - Technical Teams (Settings icon) - Architecture & Development documents for CTO, Architects, Engineers
    - Delivery & Operations (Rocket icon) - Delivery & PM documents for Project Managers, Operations
    - Finance & Procurement (Briefcase icon) - Procurement documents for CFO, Procurement Teams
    - Security & Compliance (Shield icon) - Security documents for CISO, Compliance Officers
    - General Resources (BookOpen icon) - General documents for all stakeholders
  - Automatic ingestion into RAG system upon upload (Azure Blob Storage + AI Search)
  - RAG status badges showing indexing state
  - Tagging and section-level organization
  - Category badges for quick identification
  - Linked to RAG documents via ragDocumentId for retrieval during evaluations
- **MCP Connectors:** Management of external MCP server connections with secure API key handling (redacted in responses).

### RAG Infrastructure (Retrieval Augmented Generation)

**Components:**
- **Azure Embedding Service:** Generates embeddings using Azure OpenAI `text-embedding-ada-002`.
- **Chunking Service:** Intelligent text chunking with sentence-based boundaries and configurable token sizes, preserving semantic context.
- **Azure Blob Storage Service:** Document storage in Azure for raw documents.
- **Azure AI Search Service:** Vector database with hybrid search capabilities for efficient retrieval of relevant document chunks.
- **Document Ingestion Pipeline:** A robust process for parsing, chunking, embedding, storing, and indexing documents, with progressive metadata persistence and reliable cleanup for failure scenarios.

**Knowledge Pack Integration (RAG Phase 3):**
- Compliance standards automatically ingested into RAG system upon upload
- Standards table links to RAG documents via ragDocumentId field
- Upload flow: Parse document → Extract sections → Create standard → Ingest into RAG → Update standard with RAG link
- RAG status badges in UI showing indexing state (indexed/processing/failed)
- Error handling: RAG failures logged but don't block standard creation
- Supports both file uploads and URL-based document fetches

**Multi-Agent Evaluation Integration (RAG Phase 5):**
- **Hybrid Search Retrieval:** Combines semantic (vector) and keyword search for optimal document retrieval
- **Contextual Augmentation:** Before each evaluation, retrieves top 2 document chunks per requirement (max 10 chunks total) to balance context fidelity with token costs
- **Agent Integration:** All 6 specialized agents (Delivery, Product, Architecture, Engineering, Procurement, Security) receive retrieved compliance context in their prompts
- **Graceful Degradation:** System continues evaluations even if RAG is unconfigured, logging warnings but not blocking operations
- **Performance:** Hybrid search adds ~1-2 seconds per evaluation (acceptable for multi-agent workflows)
- **Configured via:** `ragRetrieval.ts` service with `isConfigured()` check before retrieval attempts

**RAG Documents Management (RAG Phase 6):**
- **Dedicated UI Tab:** Third tab in Knowledge Pack page for managing all RAG documents
- **Document List:** Displays all indexed documents with filename, source type, chunk count, status badges, and creation date
- **Status Indicators:** Color-coded badges (indexed/processing/failed/pending) show indexing state
- **Delete Operation:** Comprehensive cleanup removing document from Azure Blob Storage, Azure AI Search, and database
- **Re-index Functionality:** Production-ready non-destructive re-indexing that:
  - Preserves document ID (maintains foreign key references from standards table)
  - Reuses existing blob in Azure Storage (no orphaned blobs created)
  - Clears old chunks and search index entries
  - Regenerates chunks with latest algorithm
  - Generates new embeddings with current model
  - Updates search index with fresh data
  - Handles failures safely (won't delete existing blob on error)
- **Error Handling:** Clear error messages, loading states, confirmation dialogs for destructive operations

**Admin Configuration:** A dedicated admin page allows configuration of OpenAI API keys for agents, Azure AI Search keys, Azure Blob Storage connection strings, and Azure OpenAI embeddings. Credentials are stored encrypted.

**Data Management:** Features for generating comprehensive mock data (portfolios, projects, requirements, proposals, evaluations, standards, MCP connectors) and safely wiping all application data.

## External Dependencies

### Third-Party Services

**OpenAI API:** Used for document analysis, semantic matching, and generating evaluations with GPT-4o, and for embeddings via Azure OpenAI.

**Neon Serverless (PostgreSQL):** The primary database, storing all project-related data, evaluations, and compliance standards.

**Azure Services:**
- **Azure AI Search:** For vector database and hybrid search capabilities in the RAG system.
- **Azure Blob Storage:** For storing raw documents within the RAG infrastructure.
- **Azure OpenAI:** For generating text embeddings.

### UI Component Libraries

**Radix UI:** Provides accessible, unstyled UI primitives.
**Recharts:** Used for data visualization (e.g., radar charts).

### File Processing

**pdf-parse:** Extracts text content from PDF documents.
**Multer:** Handles multipart/form-data file uploads.

### Styling & Design

**Tailwind CSS:** Utility-first CSS framework.