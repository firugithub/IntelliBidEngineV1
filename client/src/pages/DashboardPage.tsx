import { ProposalCard } from "@/components/ProposalCard";
import { ScoreCard } from "@/components/ScoreCard";
import { ComparisonTable } from "@/components/ComparisonTable";
import { RoleViewTabs } from "@/components/RoleViewTabs";
import { RadarChart } from "@/components/RadarChart";
import { RoleBasedEvaluationReport } from "@/components/RoleBasedEvaluationReport";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, TrendingUp, DollarSign, Shield, Download, Upload, Loader2, X, Sparkles } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface Evaluation {
  id: string;
  vendorName: string;
  overallScore: number;
  technicalFit: number;
  deliveryRisk: number;
  cost: string;
  compliance: number;
  status: "recommended" | "under-review" | "risk-flagged";
  aiRationale: string | null;
  roleInsights: {
    delivery?: string[];
    product?: string[];
    architecture?: string[];
    engineering?: string[];
    procurement?: string[];
    security?: string[];
  };
  detailedScores: {
    integration?: number;
    support?: number;
    scalability?: number;
    documentation?: number;
  };
  sectionCompliance?: {
    sectionId: string;
    sectionName: string;
    score: number;
    findings: string;
  }[];
}

// Helper to ensure role insights are always arrays (handles legacy string data)
const ensureArray = (value: string[] | string | null | undefined): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value]; // Convert legacy string to array
  return [];
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id;
  const [selectedVendor, setSelectedVendor] = useState<Evaluation | null>(null);

  const { data: evaluations, isLoading } = useQuery<Evaluation[]>({
    queryKey: ["/api/projects", projectId, "evaluations"],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading evaluation results...</p>
        </div>
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No evaluations found</p>
          <Button onClick={() => setLocation("/")}>
            Start New Evaluation
          </Button>
        </div>
      </div>
    );
  }

  // Calculate aggregated metrics
  const avgTechnicalFit = Math.round(
    evaluations.reduce((sum, e) => sum + e.technicalFit, 0) / evaluations.length
  );
  
  const lowestRisk = Math.min(...evaluations.map((e) => e.deliveryRisk));
  const lowestRiskVendor = evaluations.find((e) => e.deliveryRisk === lowestRisk);

  const bestValueEval = evaluations.reduce((prev, curr) => {
    const prevCost = parseInt(prev.cost.replace(/[^0-9]/g, ""));
    const currCost = parseInt(curr.cost.replace(/[^0-9]/g, ""));
    return currCost < prevCost ? curr : prev;
  });

  const highestCompliance = Math.max(...evaluations.map((e) => e.compliance));
  const highestComplianceVendor = evaluations.find((e) => e.compliance === highestCompliance);

  // Prepare comparison table data
  const comparisonData = evaluations.map((e) => ({
    vendorName: e.vendorName,
    technicalFit: e.technicalFit,
    deliveryRisk: e.deliveryRisk,
    cost: e.cost,
    compliance: e.compliance,
    integration: (e.detailedScores?.integration || 0) > 80 ? ("easy" as const) : 
                 (e.detailedScores?.integration || 0) > 60 ? ("moderate" as const) : ("complex" as const),
    support: (e.detailedScores?.support || 0) > 80 ? ("24/7" as const) : ("business-hours" as const),
  }));

  // Prepare radar chart data
  const radarData = evaluations.map((e, index) => ({
    name: e.vendorName,
    color: index === 0 ? "hsl(210, 100%, 60%)" : 
           index === 1 ? "hsl(142, 71%, 55%)" : 
           "hsl(38, 92%, 60%)",
    data: [
      { criterion: "Technical Fit", score: e.technicalFit },
      { criterion: "Cost", score: 100 - (parseInt(e.cost.replace(/[^0-9]/g, "")) / 3000) },
      { criterion: "Compliance", score: e.compliance },
      { criterion: "Support", score: e.detailedScores?.support || 75 },
      { criterion: "Integration", score: e.detailedScores?.integration || 75 },
    ],
  }));

  // Get role insights from top-rated vendor
  const topVendor = evaluations.reduce((prev, curr) => 
    curr.overallScore > prev.overallScore ? curr : prev
  );

  const handleDownloadReport = () => {
    console.log("Downloading shortlisting report...");
    // todo: Implement actual report download
  };

  const handleNewEvaluation = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Shortlisting Report</h1>
              <p className="text-muted-foreground">
                AI-generated evaluation of {evaluations.length} vendor proposal{evaluations.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setLocation(`/project/${projectId}/ai-features`)}
                className="gap-2"
                data-testid="button-ai-features"
              >
                <Sparkles className="h-4 w-4" />
                AI Features
              </Button>
              <Button
                variant="outline"
                onClick={handleNewEvaluation}
                className="gap-2"
                data-testid="button-new-evaluation"
              >
                <Upload className="h-4 w-4" />
                New Evaluation
              </Button>
              <Button
                onClick={handleDownloadReport}
                className="gap-2"
                data-testid="button-download-report"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScoreCard
              title="Average Technical Fit"
              value={`${avgTechnicalFit}%`}
              subtitle="Across all proposals"
              icon={CheckCircle2}
              trend={avgTechnicalFit > 75 ? "up" : "neutral"}
              trendValue={avgTechnicalFit > 75 ? "+12% above threshold" : "Meeting baseline"}
            />
            <ScoreCard
              title="Lowest Delivery Risk"
              value={`${lowestRisk}%`}
              subtitle={lowestRiskVendor?.vendorName || ""}
              icon={TrendingUp}
              trend="down"
              trendValue="Low risk profile"
            />
            <ScoreCard
              title="Best Value"
              value={bestValueEval.cost.split(" - ")[0]}
              subtitle={bestValueEval.vendorName}
              icon={DollarSign}
            />
            <ScoreCard
              title="Highest Compliance"
              value={`${highestCompliance}%`}
              subtitle={highestComplianceVendor?.vendorName || ""}
              icon={Shield}
              trend="up"
            />
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-6">Shortlisted Proposals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {evaluations.map((evaluation) => (
                <ProposalCard
                  key={evaluation.id}
                  vendorName={evaluation.vendorName}
                  overallScore={evaluation.overallScore}
                  technicalFit={evaluation.technicalFit}
                  deliveryRisk={evaluation.deliveryRisk}
                  cost={evaluation.cost}
                  compliance={evaluation.compliance}
                  status={evaluation.status}
                  onViewDetails={() => setSelectedVendor(evaluation)}
                />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Multi-Criteria Comparison</CardTitle>
              <CardDescription>
                Visual comparison across key evaluation dimensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadarChart vendors={radarData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
              <CardDescription>
                Side-by-side analysis of all evaluation criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonTable data={comparisonData} />
            </CardContent>
          </Card>

          {/* Role-Based Evaluation Reports - Comparative View */}
          <RoleBasedEvaluationReport evaluations={evaluations} />

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>AI Recommendation</CardTitle>
              <CardDescription>
                AI-generated recommendation based on weighted scoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                {topVendor.aiRationale || `Based on the comprehensive multi-criteria evaluation, ${topVendor.vendorName} is recommended as the preferred vendor with an overall fit score of ${topVendor.overallScore}%.`}
              </p>
              <div className="space-y-2 pt-2">
                <h4 className="font-semibold text-sm">Next Steps:</h4>
                <ol className="space-y-1 text-sm list-decimal list-inside">
                  <li>Schedule technical deep-dive with {topVendor.vendorName}</li>
                  <li>Request detailed pricing breakdown and contract terms</li>
                  <li>Conduct proof of concept for critical integration points</li>
                  <li>Obtain executive approval for budget allocation</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-vendor-details">
          {selectedVendor && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center justify-between">
                  {selectedVendor.vendorName}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedVendor(null)}
                    data-testid="button-close-dialog"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
                <DialogDescription>
                  Comprehensive evaluation and role-specific insights
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                    <p className="text-2xl font-bold font-mono">{selectedVendor.overallScore}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Technical Fit</p>
                    <p className="text-2xl font-bold font-mono">{selectedVendor.technicalFit}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Compliance</p>
                    <p className="text-2xl font-bold font-mono">{selectedVendor.compliance}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Delivery Risk</p>
                    <p className="text-2xl font-bold font-mono">{selectedVendor.deliveryRisk}%</p>
                  </div>
                </div>

                {selectedVendor.detailedScores && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Detailed Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Integration</p>
                          <p className="text-lg font-semibold font-mono">{selectedVendor.detailedScores.integration}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Support</p>
                          <p className="text-lg font-semibold font-mono">{selectedVendor.detailedScores.support}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Scalability</p>
                          <p className="text-lg font-semibold font-mono">{selectedVendor.detailedScores.scalability}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Documentation</p>
                          <p className="text-lg font-semibold font-mono">{selectedVendor.detailedScores.documentation}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedVendor.aiRationale && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">AI Evaluation Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">{selectedVendor.aiRationale}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedVendor.roleInsights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Role-Specific Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RoleViewTabs
                        deliveryInsights={{
                          title: "Delivery & PMO Assessment",
                          items: ensureArray(selectedVendor.roleInsights.delivery),
                        }}
                        productInsights={{
                          title: "Product Requirements Coverage",
                          items: ensureArray(selectedVendor.roleInsights.product),
                        }}
                        architectureInsights={{
                          title: "Architecture & Security Analysis",
                          items: ensureArray(selectedVendor.roleInsights.architecture),
                        }}
                        engineeringInsights={{
                          title: "Engineering & Quality Assessment",
                          items: ensureArray(selectedVendor.roleInsights.engineering),
                        }}
                        procurementInsights={{
                          title: "Commercial & TCO Analysis",
                          items: ensureArray(selectedVendor.roleInsights.procurement),
                        }}
                        evaluationId={selectedVendor.id}
                        vendorName={selectedVendor.vendorName}
                        projectId={projectId}
                      />
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedVendor(null)}
                    data-testid="button-close"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
