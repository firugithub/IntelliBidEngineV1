import { useState, useEffect } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function UploadPage() {
  const params = useParams();
  const departmentId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [requirementsFiles, setRequirementsFiles] = useState<File[]>([]);
  const [proposalFiles, setProposalFiles] = useState<File[]>([]);
  const [projectData, setProjectData] = useState<any>(null);

  useEffect(() => {
    // Get project data from session storage
    const data = sessionStorage.getItem("newProjectData");
    if (data) {
      setProjectData(JSON.parse(data));
    } else {
      // Redirect back if no project data
      setLocation(`/department/${departmentId}/new-project`);
    }
  }, [departmentId, setLocation]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!projectData) throw new Error("No project data found");

      // Create project with details
      const projectResponse = await apiRequest("POST", "/api/projects", {
        departmentId: projectData.departmentId,
        name: projectData.projectName,
        initiativeName: projectData.initiativeName,
        vendorList: projectData.vendorList,
      });

      const createdProject = await projectResponse.json();
      const projectId = createdProject.id;

      // Upload requirements
      const requirementsFormData = new FormData();
      requirementsFiles.forEach((file) => {
        requirementsFormData.append("files", file);
      });

      await fetch(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        body: requirementsFormData,
      });

      // Upload proposals
      const proposalsFormData = new FormData();
      proposalFiles.forEach((file) => {
        proposalsFormData.append("files", file);
      });

      await fetch(`/api/projects/${projectId}/proposals`, {
        method: "POST",
        body: proposalsFormData,
      });

      // Trigger analysis
      await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });

      return projectId;
    },
    onSuccess: (projectId) => {
      // Clear session storage
      sessionStorage.removeItem("newProjectData");
      
      toast({
        title: "Analysis Complete",
        description: "Your vendor shortlisting report is ready!",
      });
      setLocation(`/dashboard/${projectId}`);
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze documents",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const canAnalyze = requirementsFiles.length > 0 && proposalFiles.length > 0 && !analyzeMutation.isPending;

  if (!projectData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/department/${departmentId}/new-project`)}
            className="gap-2 mb-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project Details
          </Button>
          <h1 className="text-3xl font-bold mb-2">Upload Documents</h1>
          <p className="text-muted-foreground">
            {projectData.projectName}
            {projectData.initiativeName && ` • ${projectData.initiativeName}`}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {projectData.vendorList && projectData.vendorList.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Vendors to Evaluate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {projectData.vendorList.map((vendor: string) => (
                  <Badge key={vendor} variant="secondary">
                    {vendor}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Requirements Documents</CardTitle>
              <CardDescription>
                Upload your RFT, BRD, EPIC, or other requirement documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                title="Drop Requirements Here"
                description="PDF, Word, or Excel files supported"
                onFilesChange={setRequirementsFiles}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Proposals</CardTitle>
              <CardDescription>
                Upload 2-3 vendor or partner proposals for comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                title="Drop Proposals Here"
                description="Upload multiple vendor proposals for evaluation"
                onFilesChange={setProposalFiles}
              />
            </CardContent>
          </Card>

          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="gap-2"
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Analyze with AI
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>

          {!canAnalyze && !analyzeMutation.isPending && (
            <p className="text-center text-sm text-muted-foreground">
              Upload at least one requirements document and one vendor proposal to continue
            </p>
          )}

          {analyzeMutation.isPending && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Parsing documents and running AI analysis...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 30-60 seconds depending on document size
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
