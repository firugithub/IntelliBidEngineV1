import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

const PROCUREMENT_STAGES = [
  { id: 1, short: "RFI Init", name: "RFI Initiated" },
  { id: 2, short: "RFI Recv", name: "RFI Response" },
  { id: 3, short: "RFI Eval", name: "RFI Eval Done" },
  { id: 4, short: "RFT Init", name: "RFT Initiated" },
  { id: 5, short: "RFT Recv", name: "RFT Response" },
  { id: 6, short: "Demo", name: "Demo Done" },
  { id: 7, short: "RFT Eval", name: "RFT Eval Done" },
  { id: 8, short: "POC", name: "POC Started" },
  { id: 9, short: "SOW Sub", name: "SOW Submitted" },
  { id: 10, short: "SOW Rev", name: "SOW Reviewed" },
];

interface VendorProgress {
  vendorName: string;
  currentStage: number;
  stageStatuses: Record<number, { status: string; date: string | null }>;
}

interface VendorStageGridProps {
  vendorStages: VendorProgress[];
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

function StageCell({ status, date }: { status: string; date: string | null }) {
  const getIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/30" />;
    }
  };

  const bgClass = () => {
    switch (status) {
      case "completed":
        return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800";
      case "in_progress":
        return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800";
      case "skipped":
        return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-card border-border/50";
    }
  };

  return (
    <div
      className={`flex items-center justify-center p-2 rounded border ${bgClass()} transition-all hover-elevate`}
      title={date ? `Completed: ${new Date(date).toLocaleDateString()}` : status.toUpperCase()}
      data-testid={`cell-${status}`}
    >
      {getIcon()}
    </div>
  );
}

export function VendorStageGrid({ vendorStages }: VendorStageGridProps) {
  return (
    <Card data-testid="card-vendor-stage-grid">
      <CardHeader>
        <CardTitle className="text-lg" data-testid="title-stage-matrix">Vendor Stage Matrix</CardTitle>
        <CardDescription data-testid="text-matrix-description">Quick overview of all vendors across procurement stages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" data-testid="table-vendor-stages">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold text-sm sticky left-0 bg-background z-10" data-testid="header-vendor">
                  Vendor
                </th>
                <th className="text-center p-3 font-semibold text-sm" data-testid="header-progress">
                  Progress
                </th>
                {PROCUREMENT_STAGES.map((stage) => (
                  <th
                    key={stage.id}
                    className="text-center p-2 text-xs font-semibold min-w-[80px]"
                    title={stage.name}
                    data-testid={`header-stage-${stage.id}`}
                  >
                    <div className="text-muted-foreground mb-1">{stage.id}</div>
                    <div className="text-foreground">{stage.short}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorStages.map((vendor) => (
                <tr key={vendor.vendorName} className="border-b hover-elevate" data-testid={`row-vendor-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                  <td className="p-3 font-medium sticky left-0 bg-background z-10" data-testid={`cell-vendor-name-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="text-sm">{vendor.vendorName}</div>
                    <div className="text-xs text-muted-foreground">
                      Stage {vendor.currentStage}/10
                    </div>
                  </td>
                  <td className="p-3 text-center" data-testid={`cell-progress-${vendor.vendorName.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="text-lg font-bold font-mono text-primary">
                      {Math.round((vendor.currentStage / 10) * 100)}%
                    </div>
                  </td>
                  {PROCUREMENT_STAGES.map((stage) => {
                    const status = getStageStatus(stage.id, vendor.currentStage, vendor.stageStatuses);
                    const stageData = vendor.stageStatuses[stage.id];
                    return (
                      <td key={stage.id} className="p-1">
                        <StageCell status={status} date={stageData?.date || null} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-muted-foreground/30" />
            <span className="text-muted-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-muted-foreground">Skipped</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
