# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview

IntelliBid is an AI-powered platform that transforms the vendor evaluation process from days of manual review into minutes of objective, transparent decision-making. The system analyzes RFT/RFI responses and partner proposals, then generates risk-adjusted shortlisting reports with clear rationale for multiple stakeholder roles (Delivery, Procurement, Product, Architecture, Engineering, QA).

**Core Functionality:**
- Parse requirements documents (RFT/BRD/EPICs) to extract scope, technical NFRs, and evaluation criteria
- Convert vendor proposals (PDF/Word/Excel) into structured, comparable data
- Perform semantic matching of vendor capabilities against requirements
- Generate weighted scoring across multiple dimensions (technical fit, delivery risk, cost, compliance)
- Provide role-specific insights and recommendations for cross-functional teams
- Demo mode with pre-loaded sample evaluations for immediate testing

**Target Users:** Delivery Managers, Procurement teams, Product Managers, Architects, Engineers, and QA teams involved in vendor selection decisions.

**Current Status:** ✅ Fully functional MVP with complete frontend, backend, AI analysis, and sample data seeding. Ready for testing and deployment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript, using Vite as the build tool
- **Routing:** wouter for client-side routing
- **UI Library:** shadcn/ui components built on Radix UI primitives
- **Styling:** Tailwind CSS with custom design tokens
- **State Management:** TanStack Query (React Query) for server state
- **Charts/Visualization:** Recharts for data visualization (radar charts, comparisons)

**Design System:**
- Primary focus on dark mode with enterprise-focused design
- Color palette emphasizes clarity, trust signals, and data hierarchy
- Typography uses Inter for UI and JetBrains Mono for data/technical content
- Component library follows "New York" style variant from shadcn/ui
- Information-dense layouts with contextual spacing

**Key Pages:**
- **HomePage:** Displays 10 department cards with project statistics
- **DepartmentPage:** Shows all projects within a department
- **NewProjectPage:** Multi-step form for project details (name, initiative, vendor list)
- **UploadPage:** Structured document upload with RFT section and vendor-specific tabs
  - RFT (Request for Tender) upload section
  - Per-vendor tabs with 5 document types each:
    1. SOW (Statement of Work)
    2. Product Questionnaire
    3. Functional Requirement Sheet
    4. Non-Functional Requirement Sheet
    5. CSOC Sheet
- **DashboardPage:** Evaluation results with multiple visualization types and role-based tabbed views

**Rationale:** React with TypeScript provides type safety and component reusability. shadcn/ui offers accessible, customizable components that maintain consistency. TanStack Query simplifies server state management with built-in caching and optimistic updates. The design system prioritizes enterprise users who need to process complex information quickly.

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js for HTTP server
- **ORM:** Drizzle ORM with PostgreSQL dialect
- **File Processing:** Multer for multipart/form-data uploads
- **Document Parsing:** pdf-parse for PDF extraction
- **AI Integration:** OpenAI SDK for GPT-4o analysis

**Data Storage:**
- PostgreSQL database (configured for Neon serverless)
- In-memory storage fallback (MemStorage) for development/testing
- Session storage using connect-pg-simple
- Document type categorization (RFT, SOW, Product Questionnaire, Functional Requirement, Non-Functional Requirement, CSOC Sheet)

**API Structure:**
- RESTful endpoints for departments, projects, requirements, proposals, and evaluations
- Department-based project filtering and statistics
- File upload endpoints with 10MB size limit, supporting vendor-specific document types
- Sample data seeding endpoints for departments and demonstration projects

**Key Services:**
- **documentParser:** Extracts text from uploaded documents (PDF, TXT, Word, Excel)
- **aiAnalysis:** Uses OpenAI to analyze requirements, proposals, and generate evaluations with role-specific insights
- **sampleData:** Seeds demonstration data for testing purposes

**Rationale:** Express provides a minimal, flexible foundation for the API. Drizzle ORM offers type-safe database queries with PostgreSQL, suitable for structured vendor data. The modular service architecture separates concerns (parsing, AI analysis, storage) for easier testing and maintenance. OpenAI integration enables semantic understanding of unstructured vendor documents.

**Alternatives Considered:**
- tRPC for end-to-end type safety (chose REST for simplicity and broader compatibility)
- Prisma ORM (chose Drizzle for lighter weight and better TypeScript inference)

### AI Analysis Pipeline

**Document Understanding Flow:**
1. Select department and create project with vendor list
2. Upload RFT document → Parse and extract evaluation criteria, weights, technical requirements
3. Upload vendor-specific documents (SOW, Product Questionnaire, Functional Requirements, Non-Functional Requirements) → Extract capabilities, pricing, technical approach per vendor
4. Semantic matching → AI compares vendor proposals against RFT requirements
5. Scoring generation → Weighted evaluation across multiple dimensions
6. Role-specific insights → Generate tailored summaries for each stakeholder role (Delivery/PMO, Procurement, Product, Architecture, Engineering/QA)

**Scoring Dimensions:**
- Overall Score (0-100)
- Technical Fit (feature coverage, integration complexity)
- Delivery Risk (timeline, dependencies, team capability)
- Cost (TCO, pricing structure)
- Compliance (security, regulatory alignment)
- Detailed metrics (integration ease, support quality, scalability, documentation)

**Status Classification:**
- "recommended" - High overall score, low risk
- "under-review" - Medium score or mixed signals
- "risk-flagged" - Significant concerns identified

**Rationale:** Multi-stage pipeline allows for transparent, auditable decision-making. Role-specific insights ensure each stakeholder gets relevant information without information overload. Weighted scoring accommodates different organizational priorities.

## External Dependencies

### Third-Party Services

**OpenAI API:**
- **Purpose:** GPT-4o for document analysis, semantic matching, and evaluation generation
- **Configuration:** Requires `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables
- **Usage:** Analyzes requirements documents, extracts vendor capabilities, generates comparative evaluations with explanations

### Database

**PostgreSQL (Neon Serverless):**
- **Purpose:** Primary data storage for departments, projects, requirements, proposals, and evaluations
- **Configuration:** Requires `DATABASE_URL` environment variable
- **Schema:** Five main tables with JSONB fields for flexible structured data:
  - departments: Organizational units (10 predefined departments)
  - projects: Vendor evaluation projects with departmentId, initiativeName, vendorList
  - requirements: RFT documents with documentType field
  - proposals: Vendor-specific documents with vendorName and documentType (SOW, Product Questionnaire, Functional Requirement, Non-Functional Requirement, CSOC Sheet)
  - evaluations: AI-generated vendor assessments with role-specific insights
- **Migration:** Uses Drizzle Kit for schema management

### UI Component Libraries

**Radix UI:**
- Comprehensive set of accessible, unstyled UI primitives
- Includes: Dialog, Dropdown Menu, Tabs, Tooltip, Accordion, Select, and 20+ other components
- Provides keyboard navigation, ARIA attributes, and focus management

**Recharts:**
- Chart library for radar visualizations and data comparisons
- Used for multi-vendor capability comparisons

### Development Tools

**Vite:**
- Development server with HMR (Hot Module Replacement)
- Production build tool with optimized bundling
- Custom plugins for Replit integration (cartographer, dev-banner, runtime-error-modal)

**esbuild:**
- Server-side bundling for production builds
- Fast TypeScript compilation

### File Processing

**pdf-parse:**
- Extracts text content from PDF documents
- Returns page count and raw text for AI analysis

**Multer:**
- Handles multipart/form-data file uploads
- In-memory storage with configurable size limits

### Styling & Design

**Tailwind CSS:**
- Utility-first CSS framework
- Custom configuration with design tokens for colors, spacing, and typography
- PostCSS integration for processing

**Google Fonts:**
- DM Sans, Fira Code, Geist Mono, Architects Daughter for typography hierarchy