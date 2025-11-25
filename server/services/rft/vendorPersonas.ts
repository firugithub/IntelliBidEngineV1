/**
 * Vendor Persona System
 * 
 * Defines realistic vendor profiles with unique characteristics, strengths, and gaps
 * to generate diverse, differentiated vendor responses across all RFT scenarios.
 */

export interface VendorPersona {
  name: string;
  
  // Core characteristics
  companyProfile: string;
  marketPosition: "market_leader" | "challenger" | "specialist" | "emerging";
  
  // Technical approach
  technicalApproach: {
    architecture: string; // e.g., "Cloud-native microservices", "Hybrid cloud", "Proven legacy"
    innovationLevel: "cutting_edge" | "modern" | "conservative" | "legacy";
    integrationComplexity: "low" | "medium" | "high";
  };
  
  // Strengths (what this vendor excels at)
  strengths: {
    domain: string[]; // e.g., ["NDC Level 4", "PSS modernization"]
    technical: string[]; // e.g., ["Real-time performance", "API maturity"]
    business: string[]; // e.g., ["Proven at scale", "Cost-effective"]
  };
  
  // Gaps/Weaknesses (areas where vendor falls short)
  gaps: {
    technical: string[]; // e.g., ["Limited mobile-first design", "Legacy architecture"]
    business: string[]; // e.g., ["Higher pricing", "Limited regional support"]
    documentation: string[]; // e.g., ["Sparse API docs", "Outdated examples"]
  };
  
  // Response characteristics (how vendor responds to RFTs)
  responseStyle: {
    documentationQuality: "excellent" | "good" | "adequate" | "sparse";
    complianceApproach: "proactive" | "standard" | "selective" | "minimal";
    detailLevel: "comprehensive" | "detailed" | "summary" | "brief";
  };
  
  // Scoring profiles for different RFT categories
  scoringProfile: {
    productStrength: number; // 0-1
    nfrStrength: number;
    cybersecurityStrength: number;
    agileStrength: number;
    procurementStrength: number; // 0-1 (commercial competitiveness)
  };
  
  // Commercial profile for procurement responses
  commercialProfile: {
    pricingTier: "premium" | "competitive" | "value" | "budget";
    licensingModel: string;
    typicalImplementationMonths: number;
    annualMaintenancePercent: number; // % of license cost
    slaUptime: string;
    paymentTerms: string;
  };
}

/**
 * Aviation Industry Vendor Personas
 * Based on real-world market positioning and characteristics
 */
export const AVIATION_VENDOR_PERSONAS: Record<string, VendorPersona> = {
  "Amadeus IT Group": {
    name: "Amadeus IT Group",
    companyProfile: "Global market leader in airline IT solutions with 30+ years of PSS experience serving 200+ airlines worldwide",
    marketPosition: "market_leader",
    
    technicalApproach: {
      architecture: "Cloud-native microservices with AI/ML integration, migrating from proven Altéa platform",
      innovationLevel: "cutting_edge",
      integrationComplexity: "medium",
    },
    
    strengths: {
      domain: [
        "NDC Level 4 certification with advanced offer/order management",
        "Comprehensive PSS suite (reservations, ticketing, inventory, DCS)",
        "Market-leading ancillary revenue optimization",
        "ONE Order implementation with industry-first features"
      ],
      technical: [
        "Proven scalability handling billions of transactions annually",
        "Advanced analytics and AI-powered personalization",
        "Modern API-first architecture with extensive SDK support",
        "Multi-datacenter redundancy with 99.99% uptime SLA"
      ],
      business: [
        "200+ airline customers providing extensive market validation",
        "Strong partner ecosystem (GDS, payment providers, ancillary services)",
        "Continuous innovation with regular feature releases",
        "Dedicated customer success teams with deep aviation expertise"
      ]
    },
    
    gaps: {
      technical: [
        "Complex migration path from legacy Altéa systems",
        "Some mobile-first design limitations in older modules",
        "API versioning can be challenging during transitions"
      ],
      business: [
        "Premium pricing tier (20-30% above market average)",
        "Long implementation timelines (12-18 months typical)",
        "Heavy dependency on Amadeus ecosystem for full functionality"
      ],
      documentation: [
        "Documentation scattered across multiple portals",
        "Some legacy API docs lack modern examples"
      ]
    },
    
    responseStyle: {
      documentationQuality: "excellent",
      complianceApproach: "proactive",
      detailLevel: "comprehensive",
    },
    
    scoringProfile: {
      productStrength: 0.90,
      nfrStrength: 0.85,
      cybersecurityStrength: 0.85,
      agileStrength: 0.75,
      procurementStrength: 0.65, // Premium pricing limits competitiveness
    },
    
    commercialProfile: {
      pricingTier: "premium",
      licensingModel: "Per-passenger transaction fee + annual platform license",
      typicalImplementationMonths: 15,
      annualMaintenancePercent: 20,
      slaUptime: "99.99%",
      paymentTerms: "Net 30, milestone-based for implementation",
    }
  },
  
  "Sabre Corporation": {
    name: "Sabre Corporation",
    companyProfile: "Enterprise travel technology leader with deep GDS roots, strong real-time processing capabilities, serving major carriers globally",
    marketPosition: "market_leader",
    
    technicalApproach: {
      architecture: "Hybrid cloud architecture blending proven SabreSonic platform with modern microservices",
      innovationLevel: "modern",
      integrationComplexity: "high",
    },
    
    strengths: {
      domain: [
        "Industry-leading real-time booking and availability performance",
        "Mature GDS integration with global distribution reach",
        "Strong revenue management and pricing optimization",
        "Comprehensive APIs for distribution and retailing"
      ],
      technical: [
        "Sub-100ms response times for availability queries",
        "Battle-tested architecture handling peak travel seasons",
        "Advanced caching and load balancing infrastructure",
        "Robust API gateway with rate limiting and monitoring"
      ],
      business: [
        "Strong presence in North American and European markets",
        "Proven track record with legacy carrier migrations",
        "Comprehensive training programs and technical support",
        "Flexible commercial models (SaaS, license, hybrid)"
      ]
    },
    
    gaps: {
      technical: [
        "Legacy architecture patterns in core SabreSonic modules",
        "Limited native mobile-first experiences",
        "Complex data models requiring specialized expertise",
        "Modernization debt in older system components"
      ],
      business: [
        "Integration complexity can extend project timelines",
        "Dependency on Sabre distribution network for some features",
        "Higher total cost of ownership for smaller airlines"
      ],
      documentation: [
        "API documentation quality varies by product line",
        "Some integration guides assume deep GDS knowledge"
      ]
    },
    
    responseStyle: {
      documentationQuality: "good",
      complianceApproach: "standard",
      detailLevel: "detailed",
    },
    
    scoringProfile: {
      productStrength: 0.85,
      nfrStrength: 0.90,
      cybersecurityStrength: 0.80,
      agileStrength: 0.70,
      procurementStrength: 0.75, // Flexible commercial models
    },
    
    commercialProfile: {
      pricingTier: "competitive",
      licensingModel: "SaaS subscription + usage-based pricing for transactions",
      typicalImplementationMonths: 12,
      annualMaintenancePercent: 18,
      slaUptime: "99.95%",
      paymentTerms: "Net 45, quarterly billing options",
    }
  },
  
  "SITA": {
    name: "SITA",
    companyProfile: "Aviation-specialized IT provider with deep industry expertise, focused on compliance, airport/airline operations, and end-to-end passenger journey",
    marketPosition: "specialist",
    
    technicalApproach: {
      architecture: "Modular, standards-compliant architecture emphasizing interoperability and aviation-specific protocols",
      innovationLevel: "conservative",
      integrationComplexity: "low",
    },
    
    strengths: {
      domain: [
        "Deep aviation domain expertise (50+ years in industry)",
        "Strong compliance and regulatory knowledge",
        "Airport systems integration (baggage, DCS, gates)",
        "IATA standards implementation (NDC, ONE Order, EDIST)"
      ],
      technical: [
        "Aviation-optimized protocols and data formats",
        "Proven interoperability with legacy airline systems",
        "Strong security posture with aviation certifications",
        "Reliable, conservative architecture with high stability"
      ],
      business: [
        "Competitive pricing for regional and mid-size carriers",
        "Strong focus on industry best practices",
        "Excellent regulatory and compliance support",
        "Close collaboration with IATA and aviation bodies"
      ]
    },
    
    gaps: {
      technical: [
        "Smaller feature set compared to market leaders (Amadeus, Sabre)",
        "Limited AI/ML capabilities and advanced analytics",
        "Slower innovation cycles with conservative release cadence",
        "Fewer developer tools and SDK options"
      ],
      business: [
        "Smaller market share limits network effects",
        "Less partner ecosystem compared to major platforms",
        "Limited ancillary revenue optimization capabilities"
      ],
      documentation: [
        "Documentation focuses on aviation standards over developer experience",
        "Fewer code examples and integration tutorials",
        "Limited community resources and third-party tools"
      ]
    },
    
    responseStyle: {
      documentationQuality: "adequate",
      complianceApproach: "proactive",
      detailLevel: "summary",
    },
    
    scoringProfile: {
      productStrength: 0.70,
      nfrStrength: 0.75,
      cybersecurityStrength: 0.90,
      agileStrength: 0.80,
      procurementStrength: 0.85, // Very competitive pricing for mid-size carriers
    },
    
    commercialProfile: {
      pricingTier: "value",
      licensingModel: "Annual subscription with tiered passenger volume pricing",
      typicalImplementationMonths: 9,
      annualMaintenancePercent: 15,
      slaUptime: "99.9%",
      paymentTerms: "Net 60, flexible payment plans available",
    }
  },
  
  // Fallback for generic/unknown vendors
  "Generic Vendor": {
    name: "Generic Vendor",
    companyProfile: "Mid-tier technology provider with general-purpose solutions",
    marketPosition: "challenger",
    
    technicalApproach: {
      architecture: "Modern cloud-based platform with standard microservices",
      innovationLevel: "modern",
      integrationComplexity: "medium",
    },
    
    strengths: {
      domain: ["Standard industry compliance", "Core feature coverage"],
      technical: ["Modern architecture", "Good API design"],
      business: ["Competitive pricing", "Flexible contracts"]
    },
    
    gaps: {
      technical: ["Limited track record at scale", "Fewer advanced features"],
      business: ["Smaller partner ecosystem", "Limited market validation"],
      documentation: ["Standard documentation quality"]
    },
    
    responseStyle: {
      documentationQuality: "good",
      complianceApproach: "standard",
      detailLevel: "detailed",
    },
    
    scoringProfile: {
      productStrength: 0.75,
      nfrStrength: 0.75,
      cybersecurityStrength: 0.75,
      agileStrength: 0.75,
      procurementStrength: 0.80, // Competitive pricing as challenger
    },
    
    commercialProfile: {
      pricingTier: "competitive",
      licensingModel: "SaaS subscription with annual commitment",
      typicalImplementationMonths: 10,
      annualMaintenancePercent: 17,
      slaUptime: "99.9%",
      paymentTerms: "Net 30, standard enterprise terms",
    }
  }
};

/**
 * Get vendor persona by name, with fuzzy matching and fallback to generic
 */
export function getVendorPersona(vendorName: string): VendorPersona {
  // Direct match
  if (AVIATION_VENDOR_PERSONAS[vendorName]) {
    return AVIATION_VENDOR_PERSONAS[vendorName];
  }
  
  // Fuzzy match (case-insensitive, partial)
  const normalizedName = vendorName.toLowerCase();
  for (const [key, persona] of Object.entries(AVIATION_VENDOR_PERSONAS)) {
    if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
      return persona;
    }
  }
  
  // Fallback to generic
  console.log(`⚠️  No persona found for "${vendorName}", using generic profile`);
  return {
    ...AVIATION_VENDOR_PERSONAS["Generic Vendor"],
    name: vendorName,
  };
}

/**
 * Get all available vendor personas
 */
export function getAllVendorPersonas(): VendorPersona[] {
  return Object.values(AVIATION_VENDOR_PERSONAS).filter(p => p.name !== "Generic Vendor");
}
