# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with Inter and JetBrains Mono fonts, "New York" style shadcn/ui components, and information-dense layouts.
**Key Pages:** Includes HomePage, PortfolioPage, NewProjectPage, UploadPage, DashboardPage, and GenerateMockDataPage.
**Navigation Architecture:** Portfolio-centric 6-menu structure: Home, Smart RFT Builder, Knowledge Base, KB Chatbot, Generate Mock Data, and Admin Config. HomePage displays portfolio cards with RFT statistics (Total, Active, In Progress) that update automatically via query cache invalidation. PortfolioPage features two-tab interface: RFT Creation (list all RFTs with download options) and RFT Evaluation (vendor shortlisting projects).
**Risk vs Value Matrix:** Dashboard features interactive quadrant scatter plot visualizing vendor positioning based on delivery risk (x-axis) and overall value/score (y-axis). Four strategic quadrants identify Quick Wins (high value, low risk), Strategic Bets (high value, high risk), Safe Choices (low value, low risk), and High Risk vendors. Vendor dots are color-coded by evaluation status (recommended/under-review/risk-flagged) with hover tooltips showing detailed metrics.
**Cost-Benefit Analysis Chart:** Displays comparative analysis of technical fit scores, estimated cost levels, and value-for-money ratios across all vendors. Vendors are automatically sorted by best value (highest value-per-cost ratio first), with multi-bar visualization showing technical fit progress bars, normalized cost levels, and calculated value-per-cost metrics. Helps procurement teams identify vendors offering maximum technical capability per dollar spent.
**Characteristic Scoring Matrix:** Dashboard displays NFR Excel questionnaire-based scoring across 7 ISO/IEC 25010 software quality characteristics (Compatibility, Maintainability, Performance Efficiency, Portability, Reliability, Security, Usability). Scores are calculated directly from vendor Excel responses with category-level granularity (Performance, Reliability, Scalability, Security, Compliance, Compatibility, Maintainability, Usability). Security characteristic intelligently blends NFR security questions (40%) with Cybersecurity questionnaire scores (60%), correctly handling zero scores. Color-coded cells and grand total with weighted average provide visual hierarchy. Falls back to AI-derived scores when Excel data unavailable.
**Functional Fit Score Comparison Table:** Role-Based Evaluation Reports > Product tab features vendor comparison table with 4 functional fit metrics (Feature Coverage, Configuration vs Customization, Scalability & Extensibility, Usability & UX Maturity). Table shows side-by-side vendor analysis with columns for Metric, individual vendor assessments, and Example KPI/Scoring Approach. Located on main dashboard below Product Management Perspective header. Currently uses placeholder data; will eventually extract vendor-specific insights from Product Excel questionnaires and RFT documents for data-driven comparison.

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) with tables for portfolios, projects, requirements, proposals, evaluations, standards, RAG documents, and RAG chunks.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Cybersecurity & Compliance) to evaluate vendor proposals against general best practices and organization-specific compliance standards.
**Document Understanding Flow:** Parses RFTs for criteria, extracts vendor capabilities from proposals, performs semantic matching, generates weighted scores across dimensions (Technical Fit, Delivery Risk, Cost, Compliance), and produces role-specific insights.
**Dynamic Score Recalculation:** Automatically recalculates overall and dimension-specific scores and evaluation status in real-time.
**Vendor Document Management:** Proposal documents are stored in Azure Blob Storage with URLs tracked in the database. The evaluations API enriches vendor data with project-scoped document lists for secure access control.
**Real-Time Evaluation Progress:** Server-Sent Events (SSE) stream live progress updates during re-evaluation, showing per-vendor and per-agent status (pending → in_progress → completed/failed). EvaluationProgress component displays vendor cards with agent checkmarks, spinners, and error icons, providing transparency during the 30-60 second evaluation process. Progress service maintains per-project state with automatic cleanup and replay capability for late subscribers.

### Smart RFT Builder
**Dual Business Case Creation:** Offers AI-powered generation from ideas or traditional document upload (PDF, DOC, DOCX, TXT).
**Multi-Deliverable Generation System:** AI-powered workflow generates 5 comprehensive RFT deliverables from business case documents: Sample RFT Document (DOCX), Product Questionnaire (Excel), NFR Questionnaire (Excel), Cybersecurity Questionnaire (Excel), and Agile Questionnaire (Excel).
**Excel Features:** Questionnaires include dropdown compliance scoring and remarks columns, with professional styling.
**Workflow:** 4-step process (Create Business Case → Select Template → Generate with AI → Review & Download Deliverables).
**RFT Document Edit & Download:** Provides section-by-section editing with real-time updates, Markdown formatting support, and professional DOCX/PDF generation. Single-click ZIP download for all deliverables.
**Azure Blob Storage Publishing:** When RFT is published, all generated files (DOCX, PDF, 4 Excel questionnaires) are automatically uploaded to Azure Blob Storage at structured paths (`project-{id}/RFT_Generated/[filename]`). Files use consistent naming without timestamps to ensure vendor response generation can locate them. Download endpoints intelligently serve from Azure for published RFTs or generate on-the-fly for unpublished ones, providing seamless fallback behavior.
**Vendor Response Generation & Auto-Download:** Quick test feature generates 3 sample vendor responses (Excel questionnaires) and automatically downloads them as a ZIP file with preserved vendor folder structure (VendorA/, VendorB/, VendorC/). The system generates responses, uploads to Azure (`project-{id}/RFT_Responses/`), then triggers automatic ZIP download via `/api/mock-data/download-responses/:rftId` endpoint.
**Standardized RFT Format:** All RFT documents follow a consistent 10-section structure: (1) Cover Page & Summary, (2) Introduction & Background, (3) Scope of Work (SOW), (4) Objectives & Business Outcomes, (5) Instructions to Tenderers, (6) Evaluation Criteria, (7) Vendor Response Templates, (8) Contractual & Legal Terms, (9) Governance & Delivery Model, (10) Appendices. This format aligns with enterprise procurement and IT/technical project standards.

### Advanced AI Features
IntelliBid includes 5 production-ready AI features accessible via a unified interface: Compliance Gap Analysis, Auto-Generated Follow-up Questions, Smart Vendor Comparison Matrix, Executive Briefing Generator, and Conversational AI Assistant.
**Shared AI Infrastructure:** Centralized AI orchestration service with structured prompt templates, JSON schema validation, response caching, and streaming utilities. All AI features leverage RAG integration for context-aware responses.

### Knowledge Base
**Purpose:** Centralized repository for managing organizational documents and guidelines to enhance AI evaluation accuracy, with integration for external Model Context Protocol (MCP) connectors.
**Document Management with RAG Integration:** Admin interface for uploading and managing organizational documents (PDF/TXT/DOC/DOCX or URL) with AI-powered section extraction and automatic ingestion into the RAG system.
**Knowledge Base Chatbot:** Dedicated testing interface for RAG and MCP integrations with real-time conversational AI, providing message history with source attribution, stats display, and context-only answers.
**MCP Connectors:** Pluggable adapter system for integrating external enterprise data sources into AI evaluations, supporting REST, GraphQL, and WebSocket protocols with AES-256-GCM encryption for API keys, LRU caching, and various authentication methods.

### RAG Infrastructure (Retrieval Augmented Generation)
**Components:** Azure Embedding Service, Intelligent Chunking Service, Azure Blob Storage Service, and Azure AI Search Service (vector database with hybrid search).
**Document Ingestion Pipeline:** Robust process for parsing, chunking, embedding, storing, and indexing documents.
**Knowledge Pack Integration:** Compliance standards are automatically ingested into the RAG system.
**Multi-Agent Evaluation Integration:** Utilizes hybrid search for contextual augmentation of AI agent prompts.
**RAG Documents Management:** Dedicated UI for managing indexed documents with status indicators and re-indexing functionality.
**Admin Configuration:** Allows configuration of OpenAI API keys, Azure AI Search keys, Azure Blob Storage connection strings, and Azure OpenAI embeddings.

### Data Management
**Generate Mock Data Page:** Dedicated page for creating persistent RFT scenarios with 10 pre-defined airline industry topics. Features 4-step workflow: RFT Generation (creates portfolio, project, business case, and RFT), RFT Pack Generation (6 individual files: DOCX, PDF, 4 Excel questionnaires with AI-powered content), Vendor Responses Generation (3 vendors with Excel files), and Evaluation Generation (complete evaluation report). Each topic maps to an appropriate portfolio (e.g., crew-management → Flight Operations), ensuring proper data organization and statistics tracking. Includes one-click "Download All Mock Data" feature that bundles all generated files from all three folders (RFT Generated, RFT Responses, RFT Evaluation) into a single ZIP file for easy distribution.
**AI-Powered RFT Pack Generation:** Uses smartRftService to generate professional RFT documents following industry standards with 10 comprehensive sections: (1) Introduction & Overview, (2) Scope of Work / Requirements, (3) Instructions to Tenderers, (4) Evaluation Criteria, (5) Commercial Terms & Conditions, (6) Contractual Requirements, (7) Non-Functional Requirements (NFRs), (8) Governance & Risk Management, (9) Response Templates / Schedules, (10) Appendices. Each section contains 3-5 detailed paragraphs with airline-specific content referencing IATA and ISO standards. Also generates detailed questionnaires with proper question counts (30 Product, 50 NFR, 20 Cybersecurity, 20 Agile). Uploads individual files instead of ZIP archives to maintain clean folder structure.
**Portfolio-Topic Mapping:** Intelligent mapping system that associates each RFT topic with the correct portfolio based on business domain.
**Azure Blob Storage Integration:** All generated documents are organized in structured project-specific folders (project-{id}/RFT Generated, project-{id}/RFT Responses, project-{id}/RFT Evaluation) for easy retrieval and management. The uploadDocument service preserves folder paths and only adds timestamps to simple filenames.
**Query Cache Invalidation:** Automatic homepage statistics updates after mock data generation via React Query cache invalidation.
**Data Wipe Utilities:** Options to wipe all data (database + Azure resources) or only Azure resources.

## External Dependencies

### Third-Party Services
**OpenAI API:** For document analysis, semantic matching, evaluation generation (GPT-4o), and embeddings (via Azure OpenAI).
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
**docx:** Generates professional Word documents.
**pdfkit:** Generates professional PDF documents.
**archiver:** Creates ZIP archives.

### Styling & Design
**Tailwind CSS:** Utility-first CSS framework.