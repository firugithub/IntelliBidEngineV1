import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EvaluationCriteria } from "@shared/schema";

const SCORE_OPTIONS = [
  { value: 100, label: "Fully met through standard functionality", color: "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100" },
  { value: 50, label: "Partially met through standard or custom extensions", color: "bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100" },
  { value: 25, label: "Not Compliant - Can be developed", color: "bg-orange-100 dark:bg-orange-900 text-orange-900 dark:text-orange-100" },
  { value: 0, label: "Not applicable", color: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100" },
];

export default function DeepDivePage() {
  const { id } = useParams() as { id: string };
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Get role from query params
  const searchParams = new URLSearchParams(window.location.search);
  const role = searchParams.get("role") || "product";
  const vendorName = searchParams.get("vendor") || "";
  const projectId = searchParams.get("project") || "";

  // Fetch evaluation criteria
  const { data: criteria, isLoading } = useQuery<EvaluationCriteria[]>({
    queryKey: [`/api/evaluations/${id}/criteria?role=${role}`],
    enabled: !!id,
  });

  // Update criteria mutation
  const updateCriteria = useMutation({
    mutationFn: async ({ criteriaId, score, scoreLabel }: { criteriaId: string; score: number; scoreLabel: string }) => {
      return await apiRequest("PATCH", `/api/evaluation-criteria/${criteriaId}`, { score, scoreLabel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/evaluations/${id}/criteria?role=${role}`] });
      toast({
        title: "Criteria updated",
        description: "The evaluation criteria has been updated successfully.",
      });
    },
  });

  // Group criteria by section
  const groupedCriteria = criteria?.reduce((acc, criterion) => {
    if (!acc[criterion.section]) {
      acc[criterion.section] = [];
    }
    acc[criterion.section].push(criterion);
    return acc;
  }, {} as Record<string, EvaluationCriteria[]>) || {};

  // Calculate average score
  const averageScore = criteria && criteria.length > 0
    ? Math.round(criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length)
    : 0;

  const handleScoreChange = (criteriaId: string, scoreValue: string) => {
    const score = parseInt(scoreValue);
    const option = SCORE_OPTIONS.find(opt => opt.value === score);
    if (option) {
      updateCriteria.mutate({
        criteriaId,
        score,
        scoreLabel: option.label,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">Loading evaluation criteria...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/project/${projectId}`)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Evaluation
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {role === "product" ? "Product" : "Architecture"} Deep Dive
                </h1>
                <p className="text-sm text-muted-foreground">{vendorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Average Score</div>
                <div className="text-2xl font-bold">{averageScore}%</div>
              </div>
              <Badge
                variant={averageScore >= 75 ? "default" : averageScore >= 50 ? "secondary" : "destructive"}
                className="h-8"
              >
                {averageScore >= 75 ? "Strong Fit" : averageScore >= 50 ? "Moderate Fit" : "Weak Fit"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Instructions</CardTitle>
            <CardDescription>
              After the product demonstration, update each criterion score based on your evaluation.
              Changes will automatically recalculate the overall recommendation.
            </CardDescription>
          </CardHeader>
        </Card>

        {Object.entries(groupedCriteria).map(([section, sectionCriteria]) => (
          <Card key={section} data-testid={`section-${section.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{section}</CardTitle>
                <Badge variant="outline">
                  {sectionCriteria.filter(c => c.score === 100).length} / {sectionCriteria.length} Fully Met
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sectionCriteria.map((criterion) => {
                const scoreOption = SCORE_OPTIONS.find(opt => opt.value === criterion.score);
                return (
                  <div
                    key={criterion.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover-elevate"
                    data-testid={`criterion-${criterion.id}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium mb-2">{criterion.question}</div>
                      <Select
                        value={criterion.score.toString()}
                        onValueChange={(value) => handleScoreChange(criterion.id, value)}
                      >
                        <SelectTrigger
                          className={`w-full ${scoreOption?.color || ""}`}
                          data-testid={`select-score-${criterion.id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCORE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value.toString()}
                              data-testid={`option-${option.value}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{option.value}%</span>
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {criterion.score === 100 && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {criteria && criteria.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No evaluation criteria available for this vendor.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
