import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Vendor {
  vendorName: string;
  overallScore: number;
  technicalFit: number;
  cost: string;
  status: "recommended" | "under-review" | "risk-flagged";
}

interface CostBenefitChartProps {
  vendors: Vendor[];
}

export function CostBenefitChart({ vendors }: CostBenefitChartProps) {
  // Guard against empty vendors array
  if (!vendors || vendors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost-Benefit Analysis</CardTitle>
          <CardDescription>
            Technical fit score, estimated cost level, and value-for-money comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No vendor data available for cost-benefit analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  // Parse cost and create normalized values for comparison
  const parseApproximateCost = (costStr: string): number => {
    // Layer 1: Handle descriptive cost levels (check specific phrases before generic ones)
    const lowerCost = costStr.toLowerCase();
    if (lowerCost.includes('very high') || lowerCost.includes('enterprise')) return 5;
    if (lowerCost.includes('very low') || lowerCost.includes('competitive')) return 1;
    if (lowerCost.includes('high')) return 4;
    if (lowerCost.includes('medium') || lowerCost.includes('moderate')) return 3;
    if (lowerCost.includes('low')) return 2;
    
    // Layer 2: Extract currency values
    // Match numbers with clear currency indicators:
    // Pattern: Dollar sign optionally followed by number with optional K/M multiplier
    // Examples: $1.2M, $900,000, $500K, 900K, 1.5 million
    const currencyPattern = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([KMkm]|thousand|million)?|(\d[\d,]*(?:\.\d+)?)\s*([KMkm]|thousand|million)\b/gi;
    const matches = Array.from(costStr.matchAll(currencyPattern));
    
    if (matches.length > 0) {
      const values = matches.map(match => {
        // Group 1: Dollar amount number, Group 2: Optional multiplier after $
        // Group 3: Number before multiplier (no $), Group 4: Multiplier
        let num: number;
        let multiplier = '';
        
        if (match[1]) {
          // Dollar-prefixed amount (e.g., $900,000, $1.2M, $500K)
          num = parseFloat(match[1].replace(/,/g, ''));
          multiplier = match[2]?.toLowerCase() || '';
          
          // Handle multiplier if present
          if (multiplier.startsWith('m') || multiplier === 'million') {
            return num * 1000; // Convert millions to thousands
          } else if (multiplier.startsWith('k') || multiplier === 'thousand') {
            return num; // Already in thousands
          }
          
          // No multiplier: assume raw dollar amounts >= 1000 are in dollars, convert to K
          if (num >= 1000) {
            return num / 1000;
          }
          // Otherwise assume it's already in thousands (e.g., $900 = $900K)
          return num;
        } else {
          // Number with multiplier, no $ (e.g., 900K or 1.2M)
          num = parseFloat(match[3].replace(/,/g, ''));
          multiplier = match[4].toLowerCase();
          
          if (multiplier.startsWith('m') || multiplier === 'million') {
            return num * 1000; // Convert millions to thousands
          } else if (multiplier.startsWith('k') || multiplier === 'thousand') {
            return num; // Already in thousands
          }
        }
        
        return num;
      });
      
      // Use average for ranges (e.g., "$500K-$1M"), otherwise single value
      const avgCostInK = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Layer 3: Normalize to 1-5 scale based on typical project costs
      // < $200K = 1 (Very Low)
      // $200K-$500K = 2 (Low)
      // $500K-$1M = 3 (Medium)
      // $1M-$2M = 4 (High)
      // > $2M = 5 (Very High)
      if (avgCostInK < 200) return 1;
      if (avgCostInK < 500) return 2;
      if (avgCostInK < 1000) return 3;
      if (avgCostInK < 2000) return 4;
      return 5;
    }
    
    // Layer 4: Default to medium for unparseable strings
    return 3;
  };

  const vendorData = vendors.map(vendor => {
    const costLevel = parseApproximateCost(vendor.cost);
    const valueScore = vendor.technicalFit;
    const valuePerCost = costLevel > 0 ? (valueScore / costLevel) : valueScore;
    
    return {
      ...vendor,
      costLevel,
      valueScore,
      valuePerCost: Math.round(valuePerCost * 10) / 10,
    };
  });

  // Sort by value per cost (best value first)
  const sortedVendors = [...vendorData].sort((a, b) => b.valuePerCost - a.valuePerCost);
  
  // Safe max calculation with fallback
  const maxValuePerCost = sortedVendors.length > 0 
    ? Math.max(...sortedVendors.map(v => v.valuePerCost))
    : 1;
  
  const getCostLabel = (level: number): string => {
    if (level >= 4.5) return "Very High";
    if (level >= 3.5) return "High";
    if (level >= 2.5) return "Medium";
    if (level >= 1.5) return "Low";
    return "Very Low";
  };

  const getCostColor = (level: number): string => {
    if (level >= 4) return "text-red-600 dark:text-red-400";
    if (level >= 3) return "text-orange-600 dark:text-orange-400";
    if (level >= 2) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getValueColor = (score: number): string => {
    if (score >= 80) return "bg-green-500 dark:bg-green-600";
    if (score >= 60) return "bg-yellow-500 dark:bg-yellow-600";
    if (score >= 40) return "bg-orange-500 dark:bg-orange-600";
    return "bg-red-500 dark:bg-red-600";
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      recommended: "default",
      "under-review": "secondary",
      "risk-flagged": "destructive",
    } as const;
    return variants[status as keyof typeof variants] || "secondary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost-Benefit Analysis</CardTitle>
        <CardDescription>
          Technical fit score, estimated cost level, and value-for-money comparison
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedVendors.map((vendor, index) => (
            <div
              key={vendor.vendorName}
              className="space-y-2 p-4 rounded-lg border bg-card hover-elevate"
              data-testid={`cost-benefit-${vendor.vendorName}`}
            >
              {/* Vendor header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">{vendor.vendorName}</h4>
                    {index === 0 && (
                      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
                        Best Value
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Original Cost: {vendor.cost}</span>
                    <span>•</span>
                    <Badge variant={getStatusBadge(vendor.status)} className="text-xs">
                      {vendor.status.replace("-", " ")}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                {/* Technical Fit */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Technical Fit</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getValueColor(vendor.valueScore)}`}
                        style={{ width: `${vendor.valueScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold min-w-[3ch]">{vendor.valueScore}%</span>
                  </div>
                </div>

                {/* Cost Level */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Cost Level</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                        style={{ width: `${(vendor.costLevel / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold min-w-[4ch] ${getCostColor(vendor.costLevel)}`}>
                      {getCostLabel(vendor.costLevel)}
                    </span>
                  </div>
                </div>

                {/* Value per Cost */}
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Value / Cost</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 dark:bg-blue-600"
                        style={{ width: `${(vendor.valuePerCost / maxValuePerCost) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 min-w-[3ch]">
                      {vendor.valuePerCost}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
          <p className="text-sm font-medium mb-2">How to Read This Chart:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>Technical Fit</strong>: How well the solution matches requirements (0-100%)</li>
            <li>• <strong>Cost Level</strong>: Relative cost estimation (Low to Very High)</li>
            <li>• <strong>Value / Cost</strong>: Higher is better - shows which vendor gives most value per dollar spent</li>
            <li>• Vendors sorted by <strong>Best Value</strong> (highest value-for-money ratio first)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
