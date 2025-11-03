import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Package, FileSpreadsheet, BarChart3, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const RFT_TOPICS = [
  {
    id: "pss-upgrade",
    title: "Passenger Service System Upgrade",
    description: "Modern PSS platform with NDC capabilities and mobile experience"
  },
  {
    id: "loyalty-platform",
    title: "Loyalty Platform Modernization",
    description: "Next-gen frequent flyer program with personalization and digital wallet"
  },
  {
    id: "mobile-app",
    title: "Mobile App Development",
    description: "iOS/Android app for booking, check-in, and real-time flight updates"
  },
  {
    id: "revenue-management",
    title: "Revenue Management System",
    description: "AI-powered pricing and yield optimization platform"
  },
  {
    id: "crew-management",
    title: "Crew Management System",
    description: "Integrated crew scheduling, training, and compliance tracking"
  },
  {
    id: "maintenance-tracking",
    title: "Aircraft Maintenance Tracking",
    description: "Predictive maintenance and MRO management solution"
  },
  {
    id: "baggage-handling",
    title: "Baggage Handling System",
    description: "RFID-enabled baggage tracking with automated routing"
  },
  {
    id: "ancillary-revenue",
    title: "Ancillary Revenue Platform",
    description: "Dynamic pricing for seats, meals, baggage, and upgrades"
  },
  {
    id: "data-analytics",
    title: "Enterprise Data Analytics Platform",
    description: "Big data analytics for operational insights and customer intelligence"
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity Operations Center",
    description: "24/7 SOC with threat intelligence and incident response"
  }
];

export default function GenerateMockDataPage() {
  const { toast } = useToast();
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [generatedRftId, setGeneratedRftId] = useState<string | null>(null);

  const generateRftMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return await apiRequest("POST", "/api/mock-data/generate-rft", { topicId });
    },
    onSuccess: (data: any) => {
      setGeneratedRftId(data.rftId);
      toast({ title: "RFT Generated Successfully!", description: `RFT "${data.name}" has been created.` });
      // Invalidate portfolio queries to update statistics
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      toast({ title: "Failed to generate RFT", variant: "destructive" });
    },
  });

  const generatePackMutation = useMutation({
    mutationFn: async () => {
      if (!generatedRftId) throw new Error("No RFT selected");
      return await apiRequest("POST", "/api/mock-data/generate-pack", { rftId: generatedRftId });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "RFT Pack Generated!", 
        description: `Complete package with ${data.filesCount} files uploaded to: ${data.folder}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({ title: "Failed to generate RFT pack", variant: "destructive" });
    },
  });

  const generateResponsesMutation = useMutation({
    mutationFn: async () => {
      if (!generatedRftId) throw new Error("No RFT selected");
      return await apiRequest("POST", "/api/mock-data/generate-responses", { rftId: generatedRftId });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Vendor Responses Generated!", 
        description: `${data.vendorCount} vendor responses uploaded to: ${data.folder}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({ title: "Failed to generate vendor responses", variant: "destructive" });
    },
  });

  const generateEvaluationMutation = useMutation({
    mutationFn: async () => {
      if (!generatedRftId) throw new Error("No RFT selected");
      return await apiRequest("POST", "/api/mock-data/generate-evaluation", { rftId: generatedRftId });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Evaluation Generated!", 
        description: `Evaluation report for ${data.proposalsCount} vendors uploaded to: ${data.folder}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
    onError: () => {
      toast({ title: "Failed to generate evaluation", variant: "destructive" });
    },
  });

  const selectedTopicData = RFT_TOPICS.find(t => t.id === selectedTopic);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Generate Mock RFT Data</h1>
            <p className="text-muted-foreground">
              Create complete RFT scenarios with documents, vendor responses, and evaluations
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Step 1: Select RFT Topic */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Select RFT Topic</CardTitle>
            <CardDescription>
              Choose from 10 pre-defined airline technology RFT scenarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger className="w-full" data-testid="select-rft-topic">
                <SelectValue placeholder="Select an RFT topic..." />
              </SelectTrigger>
              <SelectContent>
                {RFT_TOPICS.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTopicData && (
              <div className="p-4 bg-muted rounded-md">
                <h3 className="font-semibold mb-1">{selectedTopicData.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedTopicData.description}</p>
              </div>
            )}

            <Button
              onClick={() => generateRftMutation.mutate(selectedTopic)}
              disabled={!selectedTopic || generateRftMutation.isPending}
              className="w-full gap-2"
              data-testid="button-generate-rft"
            >
              {generateRftMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating RFT...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Generate RFT
                </>
              )}
            </Button>

            {generatedRftId && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                RFT Generated Successfully! You can now generate the pack, responses, and evaluation.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generation Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Generate RFT Pack */}
          <Card className={!generatedRftId ? "opacity-50" : ""}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Generate RFT Pack</CardTitle>
                  <CardDescription className="text-sm">
                    Complete ZIP package with all RFT documents
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generatePackMutation.mutate()}
                disabled={!generatedRftId || generatePackMutation.isPending}
                className="w-full gap-2"
                data-testid="button-generate-pack"
              >
                {generatePackMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Generate Pack
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Uploads to: Azure Blob / RFT Generated
              </p>
            </CardContent>
          </Card>

          {/* Generate Vendor Responses */}
          <Card className={!generatedRftId ? "opacity-50" : ""}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Generate Vendor Responses</CardTitle>
                  <CardDescription className="text-sm">
                    3 vendors with complete Excel responses
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generateResponsesMutation.mutate()}
                disabled={!generatedRftId || generateResponsesMutation.isPending}
                className="w-full gap-2"
                data-testid="button-generate-responses"
              >
                {generateResponsesMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    Generate Responses
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Uploads to: Azure Blob / RFT Responses
              </p>
            </CardContent>
          </Card>

          {/* Generate Evaluation */}
          <Card className={`md:col-span-2 ${!generatedRftId ? "opacity-50" : ""}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Generate RFT Evaluation</CardTitle>
                  <CardDescription className="text-sm">
                    Complete evaluation report with AI-powered analysis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generateEvaluationMutation.mutate()}
                disabled={!generatedRftId || generateEvaluationMutation.isPending}
                className="w-full gap-2"
                data-testid="button-generate-evaluation"
              >
                {generateEvaluationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating Evaluation...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    Generate Evaluation
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Uploads to: Azure Blob / RFT Evaluation
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
