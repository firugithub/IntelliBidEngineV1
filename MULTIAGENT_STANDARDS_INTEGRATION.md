# Multi-Agent Architecture with Organization-Specific Standards

## Overview

The IntelliBid multi-agent evaluation system evaluates vendor proposals against **BOTH** general industry best practices **AND** your organization's specific compliance requirements defined in the Standards & Compliance section.

## How It Works

### 1. **Standards & Compliance Setup**

In the **Standards & Compliance** tab, you can:
- Upload or link to organization-specific compliance documents (ISO 27001, GDPR, SOC 2, etc.)
- AI automatically extracts structured sections from these documents
- Tag standards with categories (e.g., ISO27001, GDPR, SecurityPolicy)
- Define sections that represent specific organizational requirements

**Example:**
```
Standard: "Nujum Air Information Security Policy"
Sections:
  - Data Encryption Requirements
  - Access Control & Authentication
  - Incident Response Procedures
  - Third-Party Vendor Security
Tags: SecurityPolicy, ISO27001
```

### 2. **Linking Standards to Projects**

When creating a **Project** or uploading **RFT requirements**:
- Select a compliance standard from Standards & Compliance
- Tag specific sections that apply to this project
- These tagged sections become **mandatory evaluation criteria**

**Example:**
```
Project: "Passenger Service System Upgrade"
Standard: "Nujum Air Information Security Policy"
Tagged Sections:
  ✓ Data Encryption Requirements
  ✓ Access Control & Authentication
  ✓ Third-Party Vendor Security
```

### 3. **Vendor Proposal Upload**

When uploading **vendor proposals**:
- Optionally link the same standard (or a different one)
- Tag sections the vendor claims to address
- System compares vendor's claimed compliance vs. organizational requirements

### 4. **Multi-Agent Evaluation with Organization Standards**

When evaluation runs, **ALL 6 agents** receive:

#### **A. General Evaluation Context**
- Project requirements (technical, functional, timeline)
- Vendor proposal details (capabilities, approach, pricing)

#### **B. Organization-Specific Compliance Requirements**
```
**ORGANIZATION-SPECIFIC COMPLIANCE REQUIREMENTS:**
Standard: Nujum Air Information Security Policy

You MUST evaluate vendor compliance against these sections:
- Data Encryption Requirements: All data must be encrypted at-rest (AES-256) and in-transit (TLS 1.3)
- Access Control & Authentication: Multi-factor authentication required for all privileged access
- Third-Party Vendor Security: Annual SOC 2 Type II audit mandatory

**IMPORTANT:** Your evaluation must explicitly address how the vendor meets (or fails to meet) 
EACH of these organization-specific requirements. These are mandatory, not optional.
```

### 5. **How Each Agent Uses Organization Standards**

#### **🔐 Security Agent** (Primary Evaluator)
- **Role**: Directly validates compliance with all security-related sections
- **Evaluation**:
  - ✅ Does vendor meet Data Encryption Requirements?
  - ✅ Does vendor support required Access Control & Authentication?
  - ✅ Does vendor have required Third-Party Vendor Security certifications?
- **Output**: Security assurance score (0-100) + risk classification

#### **🏗️ Architecture Agent**
- **Role**: Validates architectural compliance with organization standards
- **Evaluation**:
  - ✅ Is encryption architecture aligned with organization requirements?
  - ✅ Does data architecture support organization's data residency rules?
  - ✅ Are integration patterns compliant with organization's security policies?
- **Output**: Architecture compliance score + risk/dependency map

#### **⚙️ Engineering Agent**
- **Role**: Ensures technical implementation meets organization standards
- **Evaluation**:
  - ✅ Do APIs implement required authentication mechanisms?
  - ✅ Is observability sufficient for organization's monitoring requirements?
  - ✅ Are DevOps practices aligned with organization's security policies?
- **Output**: Engineering readiness score

#### **💰 Procurement Agent**
- **Role**: Evaluates contractual compliance commitments
- **Evaluation**:
  - ✅ Does SLA include required security uptime guarantees?
  - ✅ Are audit rights included for organization's compliance verification?
  - ✅ Do contract terms meet organization's vendor governance standards?
- **Output**: Commercial fit index + contract risk matrix

#### **🧩 Delivery Agent**
- **Role**: Ensures delivery approach maintains compliance
- **Evaluation**:
  - ✅ Does implementation plan include required security milestones?
  - ✅ Are compliance checkpoints built into delivery schedule?
  - ✅ Is risk mitigation aligned with organization's standards?
- **Output**: Delivery confidence index

#### **🧠 Product Agent**
- **Role**: Validates product features meet organization's compliance needs
- **Evaluation**:
  - ✅ Do product features support organization's compliance requirements?
  - ✅ Is data handling aligned with organization's privacy policies?
  - ✅ Are required compliance features on product roadmap?
- **Output**: Feature-fit score

### 6. **Section-Level Compliance Scoring**

After evaluation, the system generates **section-level compliance scores**:

```json
{
  "sectionCompliance": [
    {
      "sectionId": "sec-001",
      "sectionName": "Data Encryption Requirements",
      "score": 95,
      "findings": "Multi-agent evaluation (95/100). All 6 specialized agents evaluated vendor 
                   compliance against 'Data Encryption Requirements'. Vendor provides AES-256 
                   encryption at-rest and TLS 1.3 in-transit. See role-specific insights."
    },
    {
      "sectionId": "sec-002",
      "sectionName": "Access Control & Authentication",
      "score": 88,
      "findings": "Multi-agent evaluation (88/100). Vendor supports MFA and RBAC. Minor gap: 
                   Privileged access management requires additional configuration."
    }
  ]
}
```

## Key Benefits

### ✅ **Dual Evaluation Approach**
- **General Best Practices**: Agents evaluate using 15+ years of industry expertise
- **Organization-Specific**: Agents explicitly check against your compliance requirements

### ✅ **Comprehensive Coverage**
- All 6 agents consider organization standards from their domain perspective
- No single point of failure - multiple agents validate each requirement

### ✅ **Transparent Compliance**
- Section-level scoring shows exactly which requirements are met
- Role-specific insights explain HOW each requirement is addressed
- Clear audit trail for compliance reporting

### ✅ **Flexible Standards Management**
- Upload documents or link to external compliance standards
- Tag and organize standards by category
- Reuse standards across multiple projects
- Update standards without re-evaluating past projects

## Example Workflow

### Step 1: Create Compliance Standard
```
Navigate to: Standards & Compliance → Documents Tab
Action: Upload "Nujum Air Security Policy.pdf"
Result: AI extracts 12 sections, tags with "SecurityPolicy"
```

### Step 2: Create Project
```
Navigate to: Portfolios → Digital & Technology → New Project
Project: "Cloud Migration Initiative"
Select Standard: "Nujum Air Security Policy"
Tag Sections: Data Encryption, Access Control, Vendor Security (3 of 12 sections)
```

### Step 3: Upload Vendor Proposals
```
Upload: Vendor A Proposal.pdf, Vendor B Proposal.pdf, Vendor C Proposal.pdf
Link to Same Standard: "Nujum Air Security Policy"
```

### Step 4: Run AI Evaluation
```
Click: "Analyze All Proposals"
Result: 
- All 6 agents evaluate each vendor
- Each agent considers the 3 tagged compliance sections
- Section-level compliance scores generated
- Role-specific insights explain compliance status
```

### Step 5: Review Results
```
Dashboard shows:
- Overall scores (aggregated from all successful agents)
- Compliance scores per vendor
- Section-level compliance breakdown
- Role-specific insights from all 6 perspectives
- Agent diagnostics (execution time, token usage, status)
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   Standards & Compliance                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ISO 27001 | GDPR | SOC 2 | Nujum Air Security Policy    │  │
│  │ Sections: Data Encryption | Access Control | Auditing    │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ Tagged Sections
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Project Requirements                          │
│  RFT Document + Tagged Compliance Sections (3 of 12)            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Vendor Proposals (3 vendors)                        │
│  Each linked to compliance standard + tagged sections           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            Multi-Agent Evaluation Orchestrator                   │
│                                                                   │
│  For each vendor:                                                │
│  1. Build context: Requirements + Proposal + Org Standards       │
│  2. Execute 6 agents in parallel (Promise.allSettled)           │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Delivery │  │ Product  │  │Architect │  │Engineer  │       │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │               │
│       └─────────────┴─────────────┴─────────────┘               │
│                       │                                          │
│  ┌──────────┐  ┌──────────┐                                    │
│  │Procure   │  │ Security │                                    │
│  │  Agent   │  │  Agent   │                                    │
│  └────┬─────┘  └────┬─────┘                                    │
│       │             │                                            │
│       └─────────────┘                                            │
│              │                                                   │
│              ↓                                                   │
│  3. Aggregate results (only successful agents)                  │
│  4. Generate section-level compliance scores                    │
│  5. Return: evaluation + diagnostics                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Evaluation Results                             │
│                                                                   │
│  Overall Scores: 89/100 (aggregated from 6 agents)              │
│  Compliance: 92/100                                              │
│  Section Compliance:                                             │
│    - Data Encryption: 95/100                                     │
│    - Access Control: 88/100                                      │
│    - Vendor Security: 90/100                                     │
│                                                                   │
│  Role Insights: 6 perspectives x 4-5 insights each              │
│  Agent Diagnostics: execution time, tokens, status              │
└─────────────────────────────────────────────────────────────────┘
```

## Conclusion

The multi-agent architecture with organization-specific standards integration provides:
- **Comprehensive evaluation** from 6 domain-expert perspectives
- **Mandatory compliance** checking against your organization's standards
- **Transparent audit trail** with section-level compliance scoring
- **Resilient execution** with graceful degradation on agent failures
- **Actionable insights** for stakeholders across all roles

Your organization's compliance requirements are not just a checklist - they're embedded into the DNA of every agent's evaluation process.
