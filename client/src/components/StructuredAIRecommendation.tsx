import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp, Shield, Package, Truck, Code, DollarSign, Archive } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { createElement } from "react";

interface RoleSection {
  role: string;
  icon: any;
  content: string;
  score?: number;
}

interface StructuredAIRecommendationProps {
  aiRationale: string;
  vendorName: string;
  overallScore: number;
}

const getRiskLevel = (score: number | undefined): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any } => {
  if (!score) return { label: "Unknown", variant: "outline", icon: AlertCircle };
  if (score >= 75) return { label: "Low Risk", variant: "default", icon: CheckCircle2 };
  if (score >= 55) return { label: "Medium Risk", variant: "secondary", icon: AlertTriangle };
  return { label: "High Risk", variant: "destructive", icon: AlertCircle };
};

const parseAIRationale = (rationale: string): RoleSection[] => {
  const sections: RoleSection[] = [];
  
  const rolePatterns = [
    { name: "Delivery", icon: Truck, pattern: /Delivery:\s*([^.]*(?:\.[^.]*){0,5})/i },
    { name: "Product", icon: Package, pattern: /Product:\s*([^.]*(?:\.[^.]*){0,5})/i },
    { name: "Architecture", icon: Archive, pattern: /Architecture:\s*([^.]*(?:\.[^.]*){0,5})/i },
    { name: "Engineering", icon: Code, pattern: /Engineering:\s*([^.]*(?:\.[^.]*){0,5})/i },
    { name: "Procurement", icon: DollarSign, pattern: /Procurement:\s*([^.]*(?:\.[^.]*){0,5})/i },
    { name: "Security", icon: Shield, pattern: /Security:\s*([^.]*(?:\.[^.]*){0,5})/i },
  ];

  rolePatterns.forEach(({ name, icon, pattern }) => {
    const match = rationale.match(pattern);
    if (match && match[1]) {
      let content = match[1].trim();
      
      // Extract score if present (e.g., "Engineering readiness score: 55/100")
      const scoreMatch = content.match(/(\w+)\s+(?:readiness\s+)?score:\s*(\d+)\/100/i);
      let score: number | undefined;
      
      if (scoreMatch) {
        score = parseInt(scoreMatch[2]);
      }
      
      sections.push({
        role: name,
        icon,
        content,
        score
      });
    }
  });

  return sections;
};

export function StructuredAIRecommendation({ aiRationale, vendorName, overallScore }: StructuredAIRecommendationProps) {
  const sections = parseAIRationale(aiRationale);

  if (sections.length === 0) {
    // Fallback to simple display if parsing fails
    return (
      <Card className="bg-primary/5 border-primary/20" data-testid="card-structured-ai-recommendation">
        <CardHeader>
          <CardTitle data-testid="text-ai-recommendation-title">AI Recommendation</CardTitle>
          <CardDescription>
            AI-generated recommendation based on weighted scoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {aiRationale || `Based on the comprehensive multi-criteria evaluation, ${vendorName} is recommended as the preferred vendor with an overall fit score of ${overallScore}%.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-primary/5 border-primary/20" data-testid="card-structured-ai-recommendation">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2" data-testid="text-ai-recommendation-title">
              <TrendingUp className="h-5 w-5" />
              AI Recommendation
            </CardTitle>
            <CardDescription>
              Comprehensive multi-role analysis for {vendorName}
            </CardDescription>
          </div>
          <Badge variant="default" className="text-lg px-3 py-1" data-testid="badge-overall-score">
            {overallScore}% Overall
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {sections.map((section, index) => {
            const risk = getRiskLevel(section.score);
            const Icon = section.icon;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">{section.role}</h4>
                  </div>
                  {section.score !== undefined && (
                    <div className="flex items-center gap-2">
                      <Badge variant={risk.variant} className="gap-1">
                        {createElement(risk.icon, { className: "h-3 w-3" })}
                        {risk.label}
                      </Badge>
                      <span className="text-sm font-mono font-semibold">
                        {section.score}/100
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                  {section.content}
                </p>
                {index < sections.length - 1 && <Separator className="mt-3" />}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Recommended Next Steps:
          </h4>
          <ol className="space-y-1 text-sm list-decimal list-inside pl-6 text-muted-foreground">
            <li>Schedule technical deep-dive with {vendorName}</li>
            <li>Request detailed pricing breakdown and contract terms</li>
            <li>Conduct proof of concept for critical integration points</li>
            <li>Obtain executive approval for budget allocation</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
