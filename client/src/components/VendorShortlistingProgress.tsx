import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import type { VendorShortlistingStage } from "@shared/schema";

const PROCUREMENT_STAGES = [
  { id: 1, name: "RFI Initiated", description: "Request for Information sent to vendors" },
  { id: 2, name: "RFI Response Received", description: "Vendors submitted initial responses" },
  { id: 3, name: "RFI Evaluation Completed", description: "Initial vendor screening completed" },
  { id: 4, name: "RFT Initiated", description: "Request for Tender published" },
  { id: 5, name: "RFT Response Received", description: "Detailed proposals received" },
  { id: 6, name: "Vendor Demo Completed", description: "Product demonstrations conducted" },
  { id: 7, name: "RFT Evaluation Completed", description: "Technical evaluation finalized" },
  { id: 8, name: "POC Initiated", description: "Proof of Concept started" },
  { id: 9, name: "SOW Submitted", description: "Statement of Work received" },
  { id: 10, name: "SOW Reviewed", description: "Final commercial review completed" },
];

interface VendorProgress {
  vendorName: string;
  currentStage: number;
  stageStatuses: Record<number, { status: string; date: string | null }>;
}

interface VendorShortlistingProgressProps {
  vendorStages: VendorProgress[];
  projectName: string;
  portfolioName: string;
}

function getStageStatus(
  stageId: number,
  currentStage: number,
  stageStatuses: Record<number, { status: string; date: string | null }>
): "completed" | "in_progress" | "pending" | "skipped" {
  if (stageStatuses[stageId]) {
    return stageStatuses[stageId].status as "completed" | "in_progress" | "pending" | "skipped";
  }
  if (stageId < currentStage) return "completed";
  if (stageId === currentStage) return "in_progress";
  return "pending";
}

function StageIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`icon-completed`} />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" data-testid={`icon-in-progress`} />;
    case "skipped":
      return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" data-testid={`icon-skipped`} />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" data-testid={`icon-pending`} />;
  }
}

function StageStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    completed: { variant: "default", label: "✓ Complete" },
    in_progress: { variant: "secondary", label: "In Progress" },
    pending: { variant: "outline", label: "Pending" },
    skipped: { variant: "outline", label: "Skipped" },
  };

  const config = variants[status] || variants.pending;
  return (
    <Badge variant={config.variant} className="text-xs" data-testid={`badge-${status}`}>
      {config.label}
    </Badge>
  );
}

export function VendorShortlistingProgress({ vendorStages, projectName, portfolioName }: VendorShortlistingProgressProps) {
  return (
    <Card data-testid="card-vendor-shortlisting-progress">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl" data-testid="title-vendor-shortlisting">Vendor Shortlisting Progress</CardTitle>
            <CardDescription data-testid="text-project-context">
              {portfolioName} → {projectName}
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-vendor-count">
            {vendorStages.length} {vendorStages.length === 1 ? "Vendor" : "Vendors"} in Pipeline
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Timeline Progress for Each Vendor */}
        {vendorStages.map((vendor) => (
          <div key={vendor.vendorName} className="space-y-4" data-testid={`vendor-progress-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
            {/* Vendor Header */}
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="font-semibold text-base" data-testid={`text-vendor-name-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                  {vendor.vendorName}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid={`text-stage-progress-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                  Stage {vendor.currentStage} of 10
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-primary" data-testid={`text-completion-percentage-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                  {Math.round((vendor.currentStage / 10) * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>

            {/* Stage Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {PROCUREMENT_STAGES.map((stage) => {
                const status = getStageStatus(stage.id, vendor.currentStage, vendor.stageStatuses);
                const stageData = vendor.stageStatuses[stage.id];
                
                return (
                  <div
                    key={stage.id}
                    className={`p-3 rounded-lg border transition-all ${
                      status === "completed"
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : status === "in_progress"
                        ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                        : "bg-card border-border"
                    }`}
                    data-testid={`stage-card-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}-${stage.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <StageIcon status={status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {stage.id}/10
                          </span>
                          <StageStatusBadge status={status} />
                        </div>
                        <h4 className="text-xs font-semibold leading-tight mb-1" data-testid={`text-stage-name-${stage.id}`}>
                          {stage.name}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-tight">
                          {stage.description}
                        </p>
                        {stageData?.date && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid={`text-stage-date-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}-${stage.id}`}>
                            {new Date(stageData.date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Stage Legend */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-3">Status Legend</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-muted-foreground">Skipped</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
