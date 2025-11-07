import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Vendor {
  vendorName: string;
  overallScore: number;
  deliveryRisk: number;
  status: "recommended" | "under-review" | "risk-flagged";
}

interface RiskValueMatrixProps {
  vendors: Vendor[];
}

export function RiskValueMatrix({ vendors }: RiskValueMatrixProps) {
  const getQuadrant = (score: number, risk: number) => {
    if (score >= 65 && risk <= 40) return "quick-wins";
    if (score >= 65 && risk > 40) return "strategic-bets";
    if (score < 65 && risk <= 40) return "safe-choices";
    return "avoid";
  };

  const quadrantColors = {
    "quick-wins": "bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-700",
    "strategic-bets": "bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700",
    "safe-choices": "bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-700",
    "avoid": "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700",
  };

  const quadrantLabels = {
    "quick-wins": "Quick Wins",
    "strategic-bets": "Strategic Bets",
    "safe-choices": "Safe Choices",
    "avoid": "High Risk",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk vs Value Matrix</CardTitle>
        <CardDescription>
          Vendor positioning based on delivery risk and overall value assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-square max-w-2xl mx-auto bg-muted/30 rounded-lg border">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {/* Vertical center line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
            {/* Horizontal center line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
          </div>

          {/* Quadrant labels */}
          <div className="absolute top-4 left-4 text-sm font-semibold text-green-600 dark:text-green-400">
            Quick Wins
            <div className="text-xs font-normal text-muted-foreground">High Value, Low Risk</div>
          </div>
          <div className="absolute top-4 right-4 text-sm font-semibold text-yellow-600 dark:text-yellow-400 text-right">
            Strategic Bets
            <div className="text-xs font-normal text-muted-foreground">High Value, High Risk</div>
          </div>
          <div className="absolute bottom-4 left-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
            Safe Choices
            <div className="text-xs font-normal text-muted-foreground">Low Value, Low Risk</div>
          </div>
          <div className="absolute bottom-4 right-4 text-sm font-semibold text-red-600 dark:text-red-400 text-right">
            High Risk
            <div className="text-xs font-normal text-muted-foreground">Low Value, High Risk</div>
          </div>

          {/* Axis labels */}
          <div className="absolute -bottom-8 left-0 right-0 text-center text-sm font-medium text-muted-foreground">
            Delivery Risk →
          </div>
          <div className="absolute -left-8 top-0 bottom-0 flex items-center">
            <div className="transform -rotate-90 text-sm font-medium text-muted-foreground whitespace-nowrap">
              ← Overall Value
            </div>
          </div>

          {/* Vendor dots */}
          {vendors.map((vendor) => {
            const x = vendor.deliveryRisk; // 0-100 maps to left-right
            const y = 100 - vendor.overallScore; // Invert so high scores are at top
            const quadrant = getQuadrant(vendor.overallScore, vendor.deliveryRisk);

            return (
              <div
                key={vendor.vendorName}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                }}
                data-testid={`vendor-dot-${vendor.vendorName}`}
              >
                {/* Vendor dot */}
                <div
                  className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all hover:scale-150 ${
                    vendor.status === "recommended"
                      ? "bg-green-500 border-green-700 dark:border-green-300"
                      : vendor.status === "under-review"
                      ? "bg-yellow-500 border-yellow-700 dark:border-yellow-300"
                      : "bg-red-500 border-red-700 dark:border-red-300"
                  }`}
                />
                
                {/* Vendor label on hover */}
                <div className="absolute left-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                  <div className="bg-popover border rounded-lg shadow-lg p-3 min-w-[200px]">
                    <p className="font-semibold text-sm mb-2">{vendor.vendorName}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Overall Score:</span>
                        <span className="font-medium">{vendor.overallScore}%</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Delivery Risk:</span>
                        <span className="font-medium">{vendor.deliveryRisk}%</span>
                      </div>
                      <div className="pt-1 mt-1 border-t">
                        <Badge variant="secondary" className="text-xs">
                          {quadrantLabels[quadrant]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-700 dark:border-green-300" />
            <span>Recommended</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-yellow-700 dark:border-yellow-300" />
            <span>Under Review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-700 dark:border-red-300" />
            <span>Risk Flagged</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
