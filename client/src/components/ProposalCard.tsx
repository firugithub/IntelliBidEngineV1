import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, TrendingDown, AlertTriangle, Trophy } from "lucide-react";

interface ProposalCardProps {
  vendorName: string;
  overallScore: number;
  functionalFit: number;
  technicalFit: number;
  deliveryRisk: number;
  cost: string;
  compliance: number;
  status: "recommended" | "under-review" | "risk-flagged";
  rank?: number;
  onViewDetails?: () => void;
}

export function ProposalCard({
  vendorName,
  overallScore,
  functionalFit,
  technicalFit,
  deliveryRisk,
  cost,
  compliance,
  status,
  rank,
  onViewDetails,
}: ProposalCardProps) {
  const getRankBadge = () => {
    if (!rank) return null;
    
    const rankColors = {
      1: "bg-amber-500 text-white",
      2: "bg-slate-400 text-white",
      3: "bg-orange-600 text-white",
    };
    
    const color = rankColors[rank as keyof typeof rankColors] || "bg-muted text-muted-foreground";
    
    return (
      <Badge className={`${color} font-semibold`} data-testid={`badge-rank-${rank}`}>
        {rank === 1 && <Trophy className="h-3 w-3 mr-1" />}
        Rank #{rank}
      </Badge>
    );
  };

  const getStatusBadge = () => {
    switch (status) {
      case "recommended":
        return (
          <Badge className="bg-chart-2 text-white" data-testid="badge-recommended">
            <TrendingUp className="h-3 w-3 mr-1" />
            Recommended
          </Badge>
        );
      case "under-review":
        return (
          <Badge className="bg-chart-1 text-white" data-testid="badge-under-review">
            Under Review
          </Badge>
        );
      case "risk-flagged":
        return (
          <Badge className="bg-chart-3 text-white" data-testid="badge-risk-flagged">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Risk Flagged
          </Badge>
        );
    }
  };

  const getRiskIndicator = () => {
    if (deliveryRisk < 30) {
      return <TrendingDown className="h-4 w-4 text-chart-2" />;
    } else if (deliveryRisk > 60) {
      return <TrendingUp className="h-4 w-4 text-chart-3" />;
    }
    return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="hover-elevate" data-testid="card-proposal">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="rounded-lg bg-muted p-2 flex-shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-lg truncate" data-testid="text-vendor-name">
                {vendorName}
              </h3>
              <p className="text-sm text-muted-foreground">{cost}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {getStatusBadge()}
            {getRankBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Fit</span>
            <span
              className="text-2xl font-bold font-mono"
              data-testid="text-overall-score"
            >
              {overallScore}%
            </span>
          </div>
          <Progress value={overallScore} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Functional Fit</span>
              <span className="text-sm font-mono font-semibold">{functionalFit}%</span>
            </div>
            <Progress value={functionalFit} className="h-1" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Technical Fit</span>
              <span className="text-sm font-mono font-semibold">{technicalFit}%</span>
            </div>
            <Progress value={technicalFit} className="h-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Compliance</span>
              <span className="text-sm font-mono font-semibold">{compliance}%</span>
            </div>
            <Progress value={compliance} className="h-1" />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-medium">Delivery Risk</span>
          <div className="flex items-center gap-2">
            {getRiskIndicator()}
            <span className="text-sm font-mono font-semibold">{deliveryRisk}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant="outline"
          onClick={onViewDetails}
          data-testid="button-view-details"
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
