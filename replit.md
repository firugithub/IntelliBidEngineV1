# IntelliBid - AI-Powered Vendor Shortlisting Engine

## Overview

IntelliBid is an AI-powered platform designed to streamline and objectively transform the vendor evaluation and shortlisting process. It automates the analysis of RFT/RFI responses and partner proposals, generating risk-adjusted shortlisting reports with clear rationale tailored for various stakeholders including Delivery, Procurement, Product, Architecture, Engineering, and QA. The system parses requirements, converts vendor proposals into structured data, performs semantic matching, and generates weighted scores across dimensions like technical fit, delivery risk, cost, and compliance. IntelliBid aims to reduce manual review times from days to minutes, offering transparent, data-driven decision-making for vendor selection. The platform is a fully functional MVP with comprehensive frontend, backend, AI analysis, and sample data.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (October 28, 2025)

**Document Upload for Standards Creation:**
- Transformed "Create New Standard" into document upload interface
- Users upload compliance documents (PDF/TXT/DOC/DOCX) instead of manually entering sections
- AI automatically extracts compliance sections from uploaded documents using GPT-4o
- Added tags field for categorizing standards (e.g., ISO27001, GDPR, SOC2)
- Document metadata stored: fileName and documentContent fields in standards schema
- New backend endpoint: POST `/api/standards/upload` with multipart file handling
- New AI service: `extractComplianceSections()` analyzes documents and extracts structured sections
- Loading state "Analyzing Document..." shows AI processing status
- Edit mode still allows manual section management for existing standards

**MCP Connectors Integration:**
- Restructured Standards & Compliance page with tabbed interface
- Added MCP connectors database schema with secure API key storage
- **Security:** All API responses redact API keys to "••••••••" - credentials never exposed to clients

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