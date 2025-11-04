import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  Package, 
  Network, 
  Code, 
  DollarSign, 
  Shield,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react";

interface Evaluation {
  vendorName: string;
  overallScore: number;
  status: "recommended" | "under-review" | "risk-flagged";
  roleInsights: {
    delivery?: string[];
    product?: string[];
    architecture?: string[];
    engineering?: string[];
    procurement?: string[];
    security?: string[];
  };
}

interface StakeholderComparisonTableProps {
  evaluations: Evaluation[];
}

const roleConfig = [
  {
    key: "delivery" as const,
    label: "Delivery Manager",
    icon: Truck,
    color: "text-blue-500",
  },
  {
    key: "product" as const,
    label: "Product Manager",
    icon: Package,
    color: "text-purple-500",
  },
  {
    key: "architecture" as const,
    label: "Solution Architect",
    icon: Network,
    color: "text-green-500",
  },
  {
    key: "engineering" as const,
    label: "Engineering Lead",
    icon: Code,
    color: "text-orange-500",
  },
  {
    key: "procurement" as const,
    label: "Procurement",
    icon: DollarSign,
    color: "text-yellow-500",
  },
  {
    key: "security" as const,
    label: "Cybersecurity",
    icon: Shield,
    color: "text-red-500",
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "recommended":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "under-review":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "risk-flagged":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

export function StakeholderComparisonTable({ evaluations }: StakeholderComparisonTableProps) {
  // Helper to ensure role insights are arrays
  const ensureArray = (value: string[] | string | null | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [value];
    return [];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stakeholder Perspective Comparison</CardTitle>
        <CardDescription>
          Vendor recommendations and rationale from each stakeholder's viewpoint
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold sticky left-0 bg-background z-10 min-w-[200px]">
                  Stakeholder Role
                </th>
                {evaluations.map((evaluation) => (
                  <th
                    key={evaluation.vendorName}
                    className="text-left p-4 min-w-[280px]"
                    data-testid={`header-vendor-${evaluation.vendorName}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(evaluation.status)}
                        <span className="font-semibold">{evaluation.vendorName}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Score: {evaluation.overallScore}%
                      </Badge>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleConfig.map((role) => {
                const RoleIcon = role.icon;
                return (
                  <tr
                    key={role.key}
                    className="border-b hover-elevate transition-colors"
                    data-testid={`row-role-${role.key}`}
                  >
                    <td className="p-4 font-medium sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <RoleIcon className={`h-5 w-5 ${role.color}`} />
                        <span>{role.label}</span>
                      </div>
                    </td>
                    {evaluations.map((evaluation) => {
                      const insights = ensureArray(evaluation.roleInsights[role.key]);
                      return (
                        <td
                          key={evaluation.vendorName}
                          className="p-4 align-top"
                          data-testid={`cell-${role.key}-${evaluation.vendorName}`}
                        >
                          {insights.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                              {insights.map((insight, idx) => (
                                <li
                                  key={idx}
                                  className="flex gap-2"
                                  data-testid={`insight-${role.key}-${evaluation.vendorName}-${idx}`}
                                >
                                  <span className="text-muted-foreground mt-1">•</span>
                                  <span className="text-muted-foreground">{insight}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">
                              No specific insights
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
