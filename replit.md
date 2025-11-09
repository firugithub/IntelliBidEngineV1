# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to objectively transform and streamline the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to significantly reduce manual review times, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

**Recent Updates (November 2025):**
- **Context-Aware Vendor Stage Tracking**: Stages intelligently set based on project state (stage 6-8 for evaluated projects, stage 5 for proposal-only projects)
- **Enhanced Top Vendors Display**: Replaced emojis with lucide-react icons (Trophy, Medal, Award), added color-coded scores and gradient progress bars
- **Vendor Data Quality**: Uses actual vendor names from proposals table with proper joins between evaluations and proposals
- **Improved Project Counting**: Top Vendors aggregation now includes projects from both evaluations and vendor stage tracking for accurate counts
- **Data Format Evolution**: Stage statuses stored as nested objects `{ status: string, date: string | null }` for better extensibility

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with "New York" style shadcn/ui components, and information-dense layouts.
**Key Pages & Navigation:** Portfolio-centric 7-menu structure including Home, Smart RFT Builder, Knowledge Base, KB Chatbot, Generate Mock Data, Executive Summary, and Admin Config. Dashboard features interactive visualizations like a Risk vs Value Matrix, Cost-Benefit Analysis Chart, Characteristic Scoring Matrix (ISO/IEC 25010), Functional Fit Score Comparison Table, and a Vendor Shortlisting Progress Dashboard with a 10-stage procurement workflow view.
**Executive Summary Dashboard:** Global visibility page providing aggregated metrics across all portfolios and projects, including total counts, vendor stage distribution chart, top-performing vendor leaders table, and recent activity feed with drill-down navigation to individual project dashboards.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) for core entities, requirements, proposals, evaluations, vendor_shortlisting_stages, and RAG documents. The vendor_shortlisting_stages table tracks vendor progress through the 10-stage procurement workflow with individual date fields for each stage, current stage tracking, stage status JSON, and audit timestamps.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) for objective vendor proposal evaluation.
**Document Understanding:** Parses RFTs, extracts vendor capabilities, performs semantic matching, generates weighted scores (Technical Fit, Delivery Risk, Cost, Compliance), and provides role-specific insights.
**Dynamic Scoring:** Real-time recalculation of overall and dimension-specific scores and evaluation status.
**Real-Time Evaluation Progress:** Server-Sent Events (SSE) provide live updates on evaluation status for transparency.

### Smart RFT Builder
**AI-Powered Generation:** Generates RFTs from ideas or uploaded documents.
**Multi-Deliverable Generation:** Creates 5 comprehensive RFT deliverables (Sample RFT Document, Product Questionnaire, NFR Questionnaire, Cybersecurity Questionnaire, Agile Questionnaire) with professional formatting and editable sections.
**Workflow:** A 4-step process for RFT creation, template selection, AI generation, and review.
**Azure Blob Storage Publishing:** Publishes generated files to structured paths in Azure Blob Storage.
**Vendor Response Generation:** Quick test feature generates and downloads sample vendor responses.
**Standardized RFT Format:** All RFTs follow a consistent 10-section structure aligning with enterprise procurement standards.

### Advanced AI Features
IntelliBid includes 5 production-ready AI features: Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and Conversational AI Assistant, all leveraging a shared AI infrastructure with RAG integration.

### Knowledge Base
**Purpose:** Centralized repository for organizational documents and guidelines to enhance AI evaluation accuracy, with support for external Model Context Protocol (MCP) connectors.
**Document Management with RAG:** Admin interface for uploading documents (PDF/TXT/DOC/DOCX/URL) with AI-powered section extraction and RAG ingestion.
**Knowledge Base Chatbot:** Dedicated interface for testing RAG and MCP integrations with conversational AI and source attribution.
**MCP Connectors:** Pluggable adapter system for integrating external enterprise data sources with encryption and various authentication methods.

### RAG Infrastructure (Retrieval Augmented Generation)
**Components:** Azure Embedding Service, Intelligent Chunking Service, Azure Blob Storage Service, and Azure AI Search Service (vector database with hybrid search).
**Document Ingestion Pipeline:** Robust process for parsing, chunking, embedding, storing, and indexing documents.
**Integration:** Used for contextual augmentation of AI agent prompts and compliance standard integration.
**Management:** UI for managing indexed documents and admin configuration for API keys.

### Data Management
**Generate Mock Data Page:** Dedicated page for creating persistent RFT scenarios with 10 pre-defined airline industry topics, generating RFTs, RFT packs, vendor responses, and complete evaluation reports. Includes a one-click "Download All Mock Data" feature.
**AI-Powered RFT Pack Generation:** Generates professional RFT documents and detailed questionnaires with airline-specific content.
**Azure Blob Storage Integration:** All generated documents are organized in structured project-specific folders in Azure Blob Storage.
**Query Cache Invalidation:** Automatic homepage statistics updates via React Query.
**Data Wipe Utilities:** Options to wipe all data or only Azure resources.

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