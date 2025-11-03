# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview
IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale for various airline stakeholders. The platform aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection in the aviation industry. It is a fully functional MVP with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
**Technology Stack:** React with TypeScript, Vite, wouter, shadcn/ui (Radix UI), Tailwind CSS, TanStack Query, and Recharts.
**Design System:** Dark mode-first, enterprise-focused with Inter and JetBrains Mono fonts, "New York" style shadcn/ui components, and information-dense layouts.
**Key Pages:** Includes HomePage, PortfolioPage, NewProjectPage, UploadPage, and DashboardPage.
**Navigation Architecture:** Portfolio-centric 4-menu structure. HomePage displays portfolio cards with RFT statistics (Total RFTs Created, Active RFTs, Evaluations in Progress). PortfolioPage features two-tab interface: RFT Creation (list all RFTs with download options) and RFT Evaluation (vendor shortlisting projects).

### Backend
**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer, and OpenAI SDK.
**Data Storage:** PostgreSQL database (Neon serverless) with tables for portfolios, projects, requirements, proposals, evaluations, standards, RAG documents, and RAG chunks.
**API Structure:** RESTful endpoints for managing core entities, file uploads, sample data seeding, system configuration, and RAG document management.

### AI Analysis Pipeline
**Multi-Agent Evaluation System:** Employs 6 specialized AI agents (Delivery, Product, Architecture, Engineering, Procurement, Security) to evaluate vendor proposals against general best practices and organization-specific compliance standards.
**Document Understanding Flow:** Parses RFTs for criteria, extracts vendor capabilities from proposals, performs semantic matching, generates weighted scores across dimensions (Technical Fit, Delivery Risk, Cost, Compliance), and produces role-specific insights.
**Dynamic Score Recalculation:** Automatically recalculates overall and dimension-specific scores and evaluation status in real-time.

### Smart RFT Builder
**Dual Business Case Creation:** Offers AI-powered generation from ideas or traditional document upload (PDF, DOC, DOCX, TXT).
**Multi-Deliverable Generation System:** AI-powered workflow generates 5 comprehensive RFT deliverables from business case documents: Sample RFT Document (DOCX), Product Questionnaire (Excel), NFR Questionnaire (Excel), Cybersecurity Questionnaire (Excel), and Agile Questionnaire (Excel).
**Excel Features:** Questionnaires include dropdown compliance scoring and remarks columns, with professional styling.
**Workflow:** 4-step process (Create Business Case → Select Template → Generate with AI → Review & Download Deliverables).
**RFT Document Edit & Download:** Provides section-by-section editing with real-time updates, Markdown formatting support, and professional DOCX/PDF generation. Single-click ZIP download for all deliverables.

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
**Mock Data Generation:** Features for generating comprehensive mock data (portfolios, projects, requirements, proposals, evaluations, standards, MCP connectors).
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