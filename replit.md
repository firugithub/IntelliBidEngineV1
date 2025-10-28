# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview

IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process for Nujum Air, the Middle East's largest airline. The platform automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale tailored for various airline stakeholders including Flight Operations, Product, Procurement, Architecture, Engineering, Safety & Compliance, and QA. The system parses requirements, converts vendor proposals into structured data, performs semantic matching, and generates weighted scores across dimensions like technical fit, delivery risk, cost, and compliance. IntelliBid aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection in the aviation industry. The platform is a fully functional MVP deployed for Nujum Air with comprehensive frontend, backend, AI analysis, and airline-specific sample data.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (October 28, 2025)

**Multi-Agent Evaluation System with Organization-Specific Standards:**
- **6 Specialized AI Agents** with domain-expert personas (15+ years experience each):
  - **Delivery Agent**: Evaluates delivery methodologies (Agile/SAFe/Waterfall), simulates scenarios, provides confidence index on timeline/resources
  - **Product Agent**: Analyzes IATA standards compliance (NDC/ONE Order), compares vs market benchmarks (Amadeus/Sabre), provides feature-fit scoring
  - **Architecture Agent**: Validates patterns (microservices/event-driven), generates risk/dependency maps, assesses 99.99% uptime capability
  - **Engineering Agent**: Reviews API design (REST/GraphQL/event-driven), evaluates observability, provides engineering readiness score
  - **Procurement Agent**: Calculates TCO/ROI (5-year), evaluates SLAs/contracts, provides commercial fit index and contract risk matrix
  - **Security Agent**: Validates ISO 27001/PCI-DSS/GDPR/NIST, assesses encryption/IAM, provides security assurance score and risk classification
- **Organization-Specific Standards Integration:**
  - Each agent receives organization's compliance standards (from Standards & Compliance with tags)
  - Agents explicitly evaluate vendor proposals against tagged compliance sections
  - Section-level compliance scores generated for each organization requirement
  - Multi-agent evaluation considers BOTH general best practices AND organization-specific mandates
- Parallel execution using Promise.allSettled for resilient fault-tolerant evaluation
- Failed agents provide meaningful fallback insights instead of blocking entire evaluation
- AgentResult.succeeded flag tracks success/failure for accurate scoring aggregation
- Partial evaluation notice in rationale when agents fail
- Agent diagnostics track execution time, token usage, and status for all 6 agents
- Failed agents excluded from scoring calculations but still provide stakeholder guidance
- Automatic fallback ensures all 6 role insights always populated in UI

## Recent Changes (October 28, 2025)

**Airline Rebranding for Nujum Air:**
- Rebranded application for Nujum Air (Middle East's largest airline)
- Updated all portfolios to airline-specific departments:
  - Flight Operations, Aircraft Maintenance & Engineering, In-Flight Services & Catering
  - Ground Services & Cargo, Passenger Services & CX, Digital & Technology
  - Network Planning & Revenue, Safety & Compliance, Airport Services, Procurement & Supply Chain
- Sample project: "Passenger Service System Upgrade" for Nujum Digital Experience 2025
- Airline vendors: Amadeus IT Group, Sabre Corporation, SITA with aviation-specific proposals
- All evaluations updated with airline operations context (NDC, IATA, PSS, GDS integration)
- MCP connectors: 12 airline-specific connectors including Nujum Air Confluence, Operations Slack, Aviation Systems GitHub, Procurement, SharePoint, Architecture Registry, Security & Compliance, Vendor Performance DB, Legal-DocuSign, IP Registry, Incident & Risk, and Evaluation Matrix
- Homepage displays "IntelliBid" with "Nujum Air" badge and airline tagline

**Data Management Features:**
- Added comprehensive mock data generation system accessible via header button
- **Generate Mock Data** button creates complete application dataset:
  - 10 airline-specific portfolios across operations, services, and technology
  - Projects with complete requirements, vendor proposals, and AI evaluations
  - 3 compliance standards (ISO 27001, GDPR, SOC 2) with structured sections
  - 12 MCP connectors with airline-specific descriptions and demo API keys
- **Wipe All Data** button with confirmation dialog for complete data reset:
  - Cascade deletes all evaluations, proposals, requirements, projects, and portfolios
  - Deactivates all compliance standards (soft delete)
  - Removes all MCP connectors
  - Proper cache invalidation ensures immediate UI updates after operations
- Extended storage interface with delete methods for all entities (deletePortfolio, deleteProject, deleteRequirement, deleteProposal, deleteEvaluation)
- Backend endpoints: POST `/api/generate-mock-data` and POST `/api/wipe-data`
- UI components in App.tsx header with AlertDialog confirmation for destructive operations

**Document Upload for Standards Creation:**
- Transformed "Create New Standard" into dual-source document upload interface
- Users can choose between:
  - **Upload File**: Local PDF/TXT/DOC/DOCX file upload
  - **Add Link**: Publicly accessible URL to a compliance document
- AI automatically extracts compliance sections from uploaded documents using GPT-4o
- Added tags field for categorizing standards (e.g., ISO27001, GDPR, SOC2)
- Document metadata stored: fileName and documentContent fields in standards schema
- New backend endpoint: POST `/api/standards/upload` handles both file uploads and URL fetching
- New AI service: `extractComplianceSections()` analyzes documents and extracts structured sections
- **Security**: URL fetching includes SSRF protection (blocks private IPs, localhost, disables redirects, validates DNS for both IPv4 and IPv6, 30s timeout, 10MB limit)
- **Security Note**: For maximum security in production environments, consider using file uploads only or implementing additional IP-pinning controls
- Loading state "Analyzing Document..." shows AI processing status
- Edit mode still allows manual section management for existing standards
- UI warning alerts users that URL must be publicly accessible and from trusted sources

**MCP Connectors Integration:**
- Restructured Standards & Compliance page with tabbed interface
- Added MCP connectors database schema with secure API key storage
- **Security:** All API responses redact API keys to "••••••••" - credentials never exposed to clients

**Azure RAG Infrastructure (In Progress):**
- Created admin configuration system for managing Azure and OpenAI credentials
- **Admin Config Page** accessible via header button with 5 tabs:
  - **Agents**: Configure OpenAI endpoint and API key for 6 multi-agent evaluation system (Delivery, Product, Architecture, Engineering, Procurement, Security)
  - **Azure AI Search**: Configure search endpoint and admin API key for vector database
  - **Azure Blob Storage**: Configure connection string for document storage
  - **Azure OpenAI**: Configure endpoint, API key, and embedding deployment name for RAG embeddings
  - **RAG Settings**: Future home for chunk size, overlap, retrieval count, and re-ranking settings
- systemConfig database table stores encrypted credentials with category-based organization
- Backend API endpoints: GET/POST `/api/system-config` for configuration management
- Security: Sensitive values (API keys, connection strings) stored with isEncrypted flag
- AI services automatically read from database config and fall back to environment variables
- UI provides helpful guidance on where to find credentials in Azure Portal and OpenAI platform
- Next: Build embedding service, document ingestion pipeline, and hybrid search integration

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Vite, wouter for routing, shadcn/ui (Radix UI) for components, Tailwind CSS for styling, TanStack Query for state management, and Recharts for data visualization.

**Design System:** Dark mode-first, enterprise-focused design using Inter and JetBrains Mono fonts, "New York" style shadcn/ui components, and information-dense layouts.

**Key Pages:** Includes HomePage (portfolio overview), PortfolioPage (all projects), NewProjectPage (project creation), UploadPage (structured document uploads for RFT and vendor proposals), and DashboardPage (evaluation results with visualizations and role-based views).

### Backend Architecture

**Technology Stack:** Node.js with TypeScript, Express.js, Drizzle ORM (PostgreSQL), Multer for file uploads, pdf-parse for document parsing, and OpenAI SDK for AI analysis.

**Data Storage:** PostgreSQL database (configured for Neon serverless) with tables for portfolios, projects, requirements, proposals, evaluations, and standards.

**API Structure:** RESTful endpoints for managing portfolios, projects, requirements, proposals, and evaluations, including file uploads and sample data seeding.

**Key Services:** `documentParser` for text extraction, `aiAnalysis` for GPT-4o powered evaluations, and `sampleData` for demonstration purposes.

### AI Analysis Pipeline

**Document Understanding Flow:** Involves parsing RFTs for criteria, extracting vendor capabilities from proposals, semantic matching against requirements, weighted scoring, and generating role-specific insights for various stakeholders.

**Scoring Dimensions:** Includes Overall Score, Technical Fit, Delivery Risk, Cost, and Compliance, with detailed metrics such as integration ease and scalability. Statuses include "recommended," "under-review," and "risk-flagged."

### Standards & Compliance Framework

**Purpose:** To define and manage reusable compliance standards and integrate external Model Context Protocol (MCP) connectors for enhanced AI analysis.

**Key Features:**
- **Documents Tab:** Admin interface for managing organization-wide compliance standards, structured with sections, document tagging, and section-level compliance scoring.
- **MCP Connectors Tab:** Management of external MCP server connections with secure API key handling (redacted in responses), status toggles, and configuration storage for future AI integration.

**Security Features:** API keys are redacted in all API responses ("••••••••") to prevent exposure, and the frontend handles updates by only sending new keys when explicitly provided.

## External Dependencies

### Third-Party Services

**OpenAI API:** Utilized for document analysis, semantic matching, and generating evaluations with GPT-4o.

### Database

**PostgreSQL (Neon Serverless):** The primary database, storing all project-related data, evaluations, and compliance standards. Configured via `DATABASE_URL`.

### UI Component Libraries

**Radix UI:** Provides accessible, unstyled UI primitives for core components.
**Recharts:** Used for data visualization, specifically radar charts and comparisons.

### File Processing

**pdf-parse:** For extracting text content from PDF documents.
**Multer:** Handles multipart/form-data file uploads.

### Styling & Design

**Tailwind CSS:** Utility-first CSS framework for styling.