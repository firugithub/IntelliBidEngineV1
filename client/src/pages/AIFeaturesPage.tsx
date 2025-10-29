import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  HelpCircle, 
  BarChart3, 
  FileText, 
  MessageSquare,
  Loader2,
  Download,
  CheckCircle,
  XCircle
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AIFeaturesPage() {
  const params = useParams();
  const projectId = params.id;
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("gaps");
  const [selectedProposalId, setSelectedProposalId] = useState<string>("");
  const [chatMessage, setChatMessage] = useState("");

  // Fetch proposals for the project
  const { data: proposals } = useQuery({
    queryKey: ["/api/projects", projectId, "proposals"],
    enabled: !!projectId,
  });

  // Fetch compliance gaps
  const { data: gapsData, isLoading: gapsLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "compliance-gaps"],
    enabled: !!projectId && activeTab === "gaps",
  });

  // Fetch follow-up questions
  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "followup-questions"],
    enabled: !!projectId && activeTab === "questions",
  });

  // Fetch comparisons
  const { data: comparisons, isLoading: comparisonsLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "comparisons"],
    enabled: !!projectId && activeTab === "comparison",
  });

  // Fetch briefings
  const { data: briefings, isLoading: briefingsLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "briefings"],
    enabled: !!projectId && activeTab === "briefing",
  });

  // Fetch chat sessions
  const { data: chatSessions } = useQuery({
    queryKey: ["/api/projects", projectId, "chat", "sessions"],
    enabled: !!projectId && activeTab === "chat",
  });

  // Analyze gaps mutation
  const analyzeGaps = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest(`/api/projects/${projectId}/proposals/${proposalId}/analyze-gaps`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "compliance-gaps"] });
      toast({ title: "Compliance gaps analyzed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to analyze compliance gaps", variant: "destructive" });
    }
  });

  // Generate questions mutation
  const generateQuestions = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest(`/api/projects/${projectId}/proposals/${proposalId}/generate-questions`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "followup-questions"] });
      toast({ title: "Follow-up questions generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate questions", variant: "destructive" });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-2">AI Features</h1>
          <p className="text-muted-foreground">
            Advanced AI-powered analysis and insights for vendor evaluation
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="gaps" className="gap-2" data-testid="tab-compliance-gaps">
              <AlertTriangle className="h-4 w-4" />
              Compliance Gaps
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2" data-testid="tab-followup-questions">
              <HelpCircle className="h-4 w-4" />
              Follow-up Questions
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2" data-testid="tab-comparison">
              <BarChart3 className="h-4 w-4" />
              Vendor Comparison
            </TabsTrigger>
            <TabsTrigger value="briefing" className="gap-2" data-testid="tab-briefings">
              <FileText className="h-4 w-4" />
              Executive Briefings
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2" data-testid="tab-chat">
              <MessageSquare className="h-4 w-4" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          {/* Compliance Gaps Tab */}
          <TabsContent value="gaps" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Gap Analysis</CardTitle>
                <CardDescription>
                  AI-powered identification of missing requirements, vague answers, and incomplete information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={selectedProposalId} onValueChange={setSelectedProposalId}>
                    <SelectTrigger className="w-64" data-testid="select-proposal">
                      <SelectValue placeholder="Select a proposal" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposals?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.vendorName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => selectedProposalId && analyzeGaps.mutate(selectedProposalId)}
                    disabled={!selectedProposalId || analyzeGaps.isPending}
                    data-testid="button-analyze-gaps"
                  >
                    {analyzeGaps.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Analyze Gaps
                  </Button>
                </div>

                {gapsData?.summary && (
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{gapsData.summary.totalGaps}</div>
                        <p className="text-sm text-muted-foreground">Total Gaps</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-destructive">{gapsData.summary.bySeverity?.critical || 0}</div>
                        <p className="text-sm text-muted-foreground">Critical</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-destructive">{gapsData.summary.bySeverity?.high || 0}</div>
                        <p className="text-sm text-muted-foreground">High</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{gapsData.summary.unresolvedCount}</div>
                        <p className="text-sm text-muted-foreground">Unresolved</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-4">
                  {gapsLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
                  {gapsData?.gaps?.map((gap: any) => (
                    <Card key={gap.id} className="border-l-4" style={{ borderLeftColor: gap.severity === "critical" || gap.severity === "high" ? "hsl(var(--destructive))" : "hsl(var(--border))" }}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{gap.description}</CardTitle>
                            <div className="flex gap-2">
                              <Badge variant={getSeverityColor(gap.severity)} data-testid={`badge-severity-${gap.severity}`}>
                                {gap.severity}
                              </Badge>
                              <Badge variant="outline">{gap.gapType.replace('_', ' ')}</Badge>
                            </div>
                          </div>
                          {gap.isResolved === "true" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">{gap.aiRationale}</p>
                        <Alert>
                          <AlertDescription className="text-sm">
                            <strong>Suggested Action:</strong> {gap.suggestedAction}
                          </AlertDescription>
                        </Alert>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Follow-up Questions Tab */}
          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Auto-Generated Follow-up Questions</CardTitle>
                <CardDescription>
                  Vendor-specific clarification questions across technical, delivery, cost, and compliance areas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Select value={selectedProposalId} onValueChange={setSelectedProposalId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a proposal" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposals?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.vendorName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => selectedProposalId && generateQuestions.mutate(selectedProposalId)}
                    disabled={!selectedProposalId || generateQuestions.isPending}
                    data-testid="button-generate-questions"
                  >
                    {generateQuestions.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Questions
                  </Button>
                </div>

                {questionsData?.summary && (
                  <div className="grid grid-cols-5 gap-4">
                    {Object.entries(questionsData.summary.byCategory || {}).map(([category, count]: [string, any]) => (
                      <Card key={category}>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">{count}</div>
                          <p className="text-sm text-muted-foreground capitalize">{category}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  {questionsLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
                  {questionsData?.questions?.map((q: any) => (
                    <Card key={q.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex gap-2">
                              <Badge variant={getPriorityColor(q.priority)}>{q.priority}</Badge>
                              <Badge variant="outline">{q.category}</Badge>
                            </div>
                            <CardTitle className="text-base">{q.question}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{q.context}</p>
                        {q.answer && (
                          <Alert>
                            <AlertDescription>
                              <strong>Answer:</strong> {q.answer}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendor Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Smart Vendor Comparison Matrix</CardTitle>
                <CardDescription>
                  AI-generated side-by-side analysis with key differentiators and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparisonsLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
                {comparisons?.map((comparison: any) => (
                  <Card key={comparison.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{comparison.title}</CardTitle>
                          <CardDescription>{new Date(comparison.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{comparison.comparisonData?.executiveSummary}</p>
                      <Alert>
                        <AlertDescription>
                          <strong>Top Choice:</strong> {comparison.comparisonData?.recommendations?.topChoice || comparison.highlights?.topChoice}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
                {!comparisonsLoading && comparisons?.length === 0 && (
                  <Alert>
                    <AlertDescription>No comparisons generated yet. Use the comparison API to create vendor comparisons.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executive Briefings Tab */}
          <TabsContent value="briefing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Executive Briefings</CardTitle>
                <CardDescription>
                  Role-specific one-page summaries for C-level stakeholders
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {briefingsLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>}
                {briefings?.map((briefing: any) => (
                  <Card key={briefing.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {briefing.title}
                            <Badge>{briefing.stakeholderRole}</Badge>
                          </CardTitle>
                          <CardDescription>{new Date(briefing.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm">{briefing.content}</pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!briefingsLoading && briefings?.length === 0 && (
                  <Alert>
                    <AlertDescription>No briefings generated yet. Use the briefing API to create role-specific executive summaries.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Chat Assistant Tab */}
          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Assistant</CardTitle>
                <CardDescription>
                  Ask questions about vendor proposals, evaluations, and get AI-powered insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    AI Chat Assistant feature is available. Create a chat session via the API to start conversations about vendor evaluations.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
