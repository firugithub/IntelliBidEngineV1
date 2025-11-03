import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VendorDocumentsDialog } from "./VendorDocumentsDialog";
import { useState } from "react";
import {
  Briefcase,
  Package,
  Layers,
  Code,
  DollarSign,
  Shield,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
} from "lucide-react";

interface VendorDocument {
  id: string;
  documentType: string;
  fileName: string;
  blobUrl?: string | null;
  createdAt: Date | string;
}

interface VendorEvaluation {
  vendorName: string;
  overallScore: number;
  technicalFit: number;
  deliveryRisk: number;
  cost: string;
  compliance: number;
  status: "recommended" | "under-review" | "risk-flagged";
  documents?: VendorDocument[];
  roleInsights?: {
    delivery?: string[];
    product?: string[];
    architecture?: string[];
    engineering?: string[];
    procurement?: string[];
    security?: string[];
  };
  detailedScores?: {
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

interface RoleBasedEvaluationReportProps {
  evaluations: VendorEvaluation[];
}

export function RoleBasedEvaluationReport({ evaluations }: RoleBasedEvaluationReportProps) {
  const [selectedVendor, setSelectedVendor] = useState<VendorEvaluation | null>(null);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);

  const handleViewDocuments = (evaluation: VendorEvaluation) => {
    setSelectedVendor(evaluation);
    setDocumentsDialogOpen(true);
  };

  // Helper to ensure role insights are always arrays (handles legacy string data)
  const ensureArray = (value: string[] | string | null | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value]; // Convert legacy string to array
    return [];
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      recommended: "default",
      "under-review": "secondary",
      "risk-flagged": "destructive",
    } as const;
    return variants[status as keyof typeof variants] || "secondary";
  };

  const getScoreColor = (score: number, inverse = false) => {
    if (inverse) {
      // For risk metrics where lower is better
      if (score <= 30) return "text-green-500";
      if (score <= 60) return "text-yellow-500";
      return "text-red-500";
    }
    // For normal metrics where higher is better
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const renderVendorCard = (evaluation: VendorEvaluation, relevantInsights: string[], metrics?: { label: string; value: number | string; inverse?: boolean }[]) => (
    <Card key={evaluation.vendorName} className="hover-elevate">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{evaluation.vendorName}</CardTitle>
            <CardDescription>Overall Score: {evaluation.overallScore}%</CardDescription>
          </div>
          <Badge variant={getStatusBadge(evaluation.status)} data-testid={`badge-${evaluation.vendorName}-status`}>
            {evaluation.status === "recommended" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
            {evaluation.status.replace("-", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics && metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-3 pb-3 border-b">
            {metrics.map((metric, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className={`text-sm font-semibold ${typeof metric.value === 'number' ? getScoreColor(metric.value, metric.inverse) : ''}`}>
                  {typeof metric.value === 'number' ? `${metric.value}%` : metric.value}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">Key Insights:</p>
          <ul className="space-y-2">
            {relevantInsights.length > 0 ? (
              relevantInsights.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground italic">No specific insights available</li>
            )}
          </ul>
        </div>
        {evaluation.documents && evaluation.documents.length > 0 && (
          <div className="pt-3 border-t">
            <Button
              onClick={() => handleViewDocuments(evaluation)}
              variant="outline"
              className="w-full gap-2"
              data-testid={`button-view-documents-${evaluation.vendorName}`}
            >
              <FileText className="h-4 w-4" />
              View Detailed Evaluation ({evaluation.documents.length} documents)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Role-Based Evaluation Reports</h2>
        <p className="text-muted-foreground">
          Comparative vendor analysis from each stakeholder perspective
        </p>
      </div>

      <Tabs defaultValue="delivery" className="w-full" data-testid="tabs-role-evaluation">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="delivery" className="flex items-center gap-2" data-testid="tab-delivery-report">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Delivery</span>
          </TabsTrigger>
          <TabsTrigger value="product" className="flex items-center gap-2" data-testid="tab-product-report">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Product</span>
          </TabsTrigger>
          <TabsTrigger value="architecture" className="flex items-center gap-2" data-testid="tab-architecture-report">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Architects</span>
          </TabsTrigger>
          <TabsTrigger value="engineering" className="flex items-center gap-2" data-testid="tab-engineering-report">
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">Engineers</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2" data-testid="tab-security-report">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Cybersecurity</span>
          </TabsTrigger>
          <TabsTrigger value="procurement" className="flex items-center gap-2" data-testid="tab-procurement-report">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Procurement</span>
          </TabsTrigger>
        </TabsList>

        {/* Delivery & PMO Tab */}
        <TabsContent value="delivery" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Delivery & PMO Perspective
              </CardTitle>
              <CardDescription>
                Timeline feasibility, resource requirements, delivery risk assessment, and project dependencies
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) =>
              renderVendorCard(
                evaluation,
                ensureArray(evaluation.roleInsights?.delivery),
                [
                  { label: "Delivery Risk", value: evaluation.deliveryRisk, inverse: true },
                  { label: "Overall Fit", value: evaluation.overallScore },
                ]
              )
            )}
          </div>
        </TabsContent>

        {/* Product Tab */}
        <TabsContent value="product" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Product Management Perspective
              </CardTitle>
              <CardDescription>
                Feature coverage, roadmap alignment, user experience, and product-market fit analysis
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) =>
              renderVendorCard(
                evaluation,
                ensureArray(evaluation.roleInsights?.product),
                [
                  { label: "Technical Fit", value: evaluation.technicalFit },
                  { label: "Scalability", value: evaluation.detailedScores?.scalability || 0 },
                ]
              )
            )}
          </div>
        </TabsContent>

        {/* Architecture Tab */}
        <TabsContent value="architecture" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Architecture & Design Perspective
              </CardTitle>
              <CardDescription>
                System design, integration complexity, scalability, compliance standards, and technical debt assessment
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) =>
              renderVendorCard(
                evaluation,
                ensureArray(evaluation.roleInsights?.architecture),
                [
                  { label: "Integration", value: evaluation.detailedScores?.integration || 0 },
                  { label: "Compliance", value: evaluation.compliance },
                ]
              )
            )}
          </div>
        </TabsContent>

        {/* Engineering Tab */}
        <TabsContent value="engineering" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Engineering & QA Perspective
              </CardTitle>
              <CardDescription>
                SDK quality, API design, testability, documentation, developer experience, and code maintainability
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) =>
              renderVendorCard(
                evaluation,
                ensureArray(evaluation.roleInsights?.engineering),
                [
                  { label: "Documentation", value: evaluation.detailedScores?.documentation || 0 },
                  { label: "Support Quality", value: evaluation.detailedScores?.support || 0 },
                ]
              )
            )}
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Cybersecurity & Compliance Perspective
              </CardTitle>
              <CardDescription>
                Security posture, compliance standards, data protection, vulnerability management, and audit readiness
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) => (
              <Card key={evaluation.vendorName} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{evaluation.vendorName}</CardTitle>
                      <CardDescription>Compliance Score: {evaluation.compliance}%</CardDescription>
                    </div>
                    <Badge variant={getStatusBadge(evaluation.status)}>
                      {evaluation.compliance >= 80 ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                      {evaluation.compliance >= 80 ? "Compliant" : "Review Required"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Compliance</p>
                      <p className={`text-sm font-semibold ${getScoreColor(evaluation.compliance)}`}>
                        {evaluation.compliance}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Overall Risk</p>
                      <p className={`text-sm font-semibold ${getScoreColor(evaluation.deliveryRisk, true)}`}>
                        {evaluation.deliveryRisk < 30 ? "Low" : evaluation.deliveryRisk < 60 ? "Medium" : "High"}
                      </p>
                    </div>
                  </div>

                  {/* Section Compliance if available */}
                  {evaluation.sectionCompliance && evaluation.sectionCompliance.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Standards Compliance:</p>
                      {evaluation.sectionCompliance.map((section, idx) => (
                        <div key={idx} className="space-y-1 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{section.sectionName}</p>
                            <span className={`text-sm font-semibold ${getScoreColor(section.score)}`}>
                              {section.score}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{section.findings}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Security Insights */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Security Analysis:</p>
                    <ul className="space-y-2">
                      {ensureArray(evaluation.roleInsights?.security).length > 0 ? (
                        ensureArray(evaluation.roleInsights?.security).map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground italic">Security insights will be generated from vendor proposals</li>
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Procurement Tab */}
        <TabsContent value="procurement" className="mt-6 space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Procurement & Commercial Perspective
              </CardTitle>
              <CardDescription>
                Total cost of ownership, pricing models, contract terms, SLA commitments, and commercial viability
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {evaluations.map((evaluation) =>
              renderVendorCard(
                evaluation,
                ensureArray(evaluation.roleInsights?.procurement),
                [
                  { label: "Cost Estimate", value: evaluation.cost },
                  { label: "Support Model", value: evaluation.detailedScores?.support ? `${evaluation.detailedScores.support}%` : "N/A" },
                ]
              )
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Vendor Documents Dialog */}
      {selectedVendor && (
        <VendorDocumentsDialog
          open={documentsDialogOpen}
          onOpenChange={setDocumentsDialogOpen}
          vendorName={selectedVendor.vendorName}
          documents={selectedVendor.documents || []}
        />
      )}
    </div>
  );
}
