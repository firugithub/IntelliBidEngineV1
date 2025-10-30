# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with Inter and JetBrains Mono fonts, "New York" style shadcn/ui components, and information-dense layouts.
**Key Pages:** Includes HomePage, PortfolioPage, NewProjectPage, UploadPage (for RFT and vendor proposals), and DashboardPage (evaluation results with visualizations and role-based views).

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (configured for Neon serverless) with tables for portfolios, projects, requirements, proposals, evaluations, standards, RAG documents, and RAG chunks.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.
**Key Services:** `documentParser` for text extraction, `aiAnalysis` for GPT-4o powered evaluations, and `sampleData` for demonstration purposes.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Security) with domain-expert personas to evaluate vendor proposals against general best practices and organization-specific compliance standards (e.g., IATA, ISO 27001, PCI-DSS, GDPR, NIST).
**Document Understanding Flow:** Parses RFTs for criteria, extracts vendor capabilities from proposals, performs semantic matching against requirements, generates weighted scores across dimensions (Technical Fit, Delivery Risk, Cost, Compliance), and produces role-specific insights.
**Scoring Dimensions:** Overall Score, Technical Fit, Delivery Risk, Cost, and Compliance, with statuses like "recommended," "under-review," and "risk-flagged."
**Dynamic Score Recalculation:** Automatically recalculates overall and dimension-specific scores and evaluation status in real-time when users modify individual criterion scores.

### Advanced AI Features
IntelliBid includes 5 production-ready AI-powered features accessible via a unified tab-based interface:
1.  **Compliance Gap Analysis:** Identifies missing requirements, vague answers, and incomplete information in vendor proposals with AI rationale and suggested remediation actions.
2.  **Auto-Generated Follow-up Questions:** Generates vendor-specific clarification questions based on proposal analysis across various categories (technical, delivery, cost, compliance).
3.  **Smart Vendor Comparison Matrix:** Provides AI-generated side-by-side analysis, highlighting key differentiators, and offering top choice recommendations.
4.  **Executive Briefing Generator:** Creates role-specific, one-page summaries for C-level stakeholders (CTO, CFO, CISO, COO, CEO, Project Manager) with configurable detail levels.
5.  **Conversational AI Assistant:** Offers a natural language interface for querying vendor evaluations and project insights, leveraging RAG integration for context-aware responses.

**Shared AI Infrastructure:**
-   **AI Orchestration Service:** Centralized service providing reusable utilities like structured prompt templates, JSON schema validation, response caching, and streaming utilities.
-   **RAG Integration:** All AI features leverage the RAG system for context-aware responses using organizational compliance documents.

### Knowledge Base
**Purpose:** Centralized repository for managing organizational documents and guidelines to enhance AI evaluation accuracy, with integration for external Model Context Protocol (MCP) connectors.
**Document Management with RAG Integration:** Admin interface for uploading and managing organizational documents (PDF/TXT/DOC/DOCX or URL) with AI-powered section extraction. Documents are categorized and grouped by stakeholder (Technical, Delivery & Operations, Finance & Procurement, Security & Compliance, General) and automatically ingested into the RAG system.
**MCP Connectors:** Management of external MCP server connections.

### RAG Infrastructure (Retrieval Augmented Generation)
**Components:** Azure Embedding Service (`text-embedding-ada-002`), Intelligent Chunking Service, Azure Blob Storage Service, and Azure AI Search Service (vector database with hybrid search).
**Document Ingestion Pipeline:** Robust process for parsing, chunking, embedding, storing, and indexing documents, with progressive metadata persistence.
**Knowledge Pack Integration:** Compliance standards are automatically ingested into the RAG system upon upload, with UI status badges and re-indexing functionality.
**Multi-Agent Evaluation Integration:** Utilizes hybrid search to retrieve top document chunks for contextual augmentation of AI agent prompts, ensuring relevant compliance context is provided during evaluations.
**RAG Documents Management:** Dedicated UI for managing indexed documents, offering status indicators, comprehensive delete operations, and non-destructive re-indexing.
**Admin Configuration:** Allows configuration of OpenAI API keys, Azure AI Search keys, Azure Blob Storage connection strings, and Azure OpenAI embeddings.

### Data Management
**Mock Data Generation:** Features for generating comprehensive mock data (portfolios, projects, requirements, proposals, evaluations, standards, MCP connectors).
**Data Wipe Utilities:** Two separate wipe operations available in Admin Config:
- **Wipe All Data:** Completely deletes all database records (17 tables) AND all Azure resources (Blob Storage + AI Search).
- **Wipe Azure Resources Only:** Deletes only Azure Blob Storage documents and Azure AI Search embeddings, leaving all database data intact. Useful for re-indexing with different settings.

## External Dependencies

### Third-Party Services
**OpenAI API:** For document analysis, semantic matching, evaluation generation (GPT-4o), and embeddings (via Azure OpenAI).
**Neon Serverless (PostgreSQL):** Primary database for all project-related data.
**Azure Services:**
-   **Azure AI Search:** Vector database and hybrid search for RAG.
-   **Azure Blob Storage:** Raw document storage for RAG.
-   **Azure OpenAI:** For generating text embeddings.

### UI Component Libraries
**Radix UI:** Provides accessible, unstyled UI primitives.
**Recharts:** For data visualization.

### File Processing
**pdf-parse:** Extracts text from PDF documents.
**Multer:** Handles multipart/form-data file uploads.

### Styling & Design
**Tailwind CSS:** Utility-first CSS framework.