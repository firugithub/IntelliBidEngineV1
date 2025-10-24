import { useState, useEffect } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface VendorDocuments {
  sow: File[];
  productQuestionnaire: File[];
  functionalRequirement: File[];
  nonFunctionalRequirement: File[];
  csocSheet: File[];
}

export default function UploadPage() {
  const params = useParams();
  const departmentId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rftFiles, setRftFiles] = useState<File[]>([]);
  const [vendorDocuments, setVendorDocuments] = useState<Record<string, VendorDocuments>>({});
  const [projectData, setProjectData] = useState<any>(null);

  useEffect(() => {
    const data = sessionStorage.getItem("newProjectData");
    if (data) {
      const parsed = JSON.parse(data);
      setProjectData(parsed);
      
      // Initialize vendor documents structure
      const initialDocs: Record<string, VendorDocuments> = {};
      parsed.vendorList?.forEach((vendor: string) => {
        initialDocs[vendor] = {
          sow: [],
          productQuestionnaire: [],
          functionalRequirement: [],
          nonFunctionalRequirement: [],
          csocSheet: [],
        };
      });
      setVendorDocuments(initialDocs);
    } else {
      setLocation(`/department/${departmentId}/new-project`);
    }
  }, [departmentId, setLocation]);

  const updateVendorDocuments = (vendor: string, docType: keyof VendorDocuments, files: File[]) => {
    setVendorDocuments(prev => ({
      ...prev,
      [vendor]: {
        ...prev[vendor],
        [docType]: files,
      },
    }));
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!projectData) throw new Error("No project data found");

      // Create project
      const projectResponse = await apiRequest("POST", "/api/projects", {
        departmentId: projectData.departmentId,
        name: projectData.projectName,
        initiativeName: projectData.initiativeName,
        vendorList: projectData.vendorList,
      });

      const createdProject = await projectResponse.json();
      const projectId = createdProject.id;

      // Upload RFT requirements
      if (rftFiles.length > 0) {
        const rftFormData = new FormData();
        rftFiles.forEach((file) => {
          rftFormData.append("files", file);
        });
        rftFormData.append("documentType", "RFT");

        await fetch(`/api/projects/${projectId}/requirements`, {
          method: "POST",
          body: rftFormData,
        });
      }

      // Upload vendor-specific documents
      for (const vendor of projectData.vendorList) {
        const docs = vendorDocuments[vendor];
        
        // Upload SOW
        if (docs.sow.length > 0) {
          const formData = new FormData();
          docs.sow.forEach(file => formData.append("files", file));
          formData.append("vendorName", vendor);
          formData.append("documentType", "SOW");
          await fetch(`/api/projects/${projectId}/proposals`, {
            method: "POST",
            body: formData,
          });
        }

        // Upload Product Questionnaire
        if (docs.productQuestionnaire.length > 0) {
          const formData = new FormData();
          docs.productQuestionnaire.forEach(file => formData.append("files", file));
          formData.append("vendorName", vendor);
          formData.append("documentType", "Product Questionnaire");
          await fetch(`/api/projects/${projectId}/proposals`, {
            method: "POST",
            body: formData,
          });
        }

        // Upload Functional Requirement
        if (docs.functionalRequirement.length > 0) {
          const formData = new FormData();
          docs.functionalRequirement.forEach(file => formData.append("files", file));
          formData.append("vendorName", vendor);
          formData.append("documentType", "Functional Requirement");
          await fetch(`/api/projects/${projectId}/proposals`, {
            method: "POST",
            body: formData,
          });
        }

        // Upload Non-Functional Requirement
        if (docs.nonFunctionalRequirement.length > 0) {
          const formData = new FormData();
          docs.nonFunctionalRequirement.forEach(file => formData.append("files", file));
          formData.append("vendorName", vendor);
          formData.append("documentType", "Non-Functional Requirement");
          await fetch(`/api/projects/${projectId}/proposals`, {
            method: "POST",
            body: formData,
          });
        }

        // Upload CSOC Sheet
        if (docs.csocSheet.length > 0) {
          const formData = new FormData();
          docs.csocSheet.forEach(file => formData.append("files", file));
          formData.append("vendorName", vendor);
          formData.append("documentType", "CSOC Sheet");
          await fetch(`/api/projects/${projectId}/proposals`, {
            method: "POST",
            body: formData,
          });
        }
      }

      // Trigger analysis
      await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });

      return projectId;
    },
    onSuccess: (projectId) => {
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

  // Check if at least RFT and one vendor document is uploaded
  const hasMinimumDocuments = () => {
    if (rftFiles.length === 0) return false;
    
    return projectData?.vendorList?.some((vendor: string) => {
      const docs = vendorDocuments[vendor];
      return docs && (
        docs.sow.length > 0 ||
        docs.productQuestionnaire.length > 0 ||
        docs.functionalRequirement.length > 0 ||
        docs.nonFunctionalRequirement.length > 0 ||
        docs.csocSheet.length > 0
      );
    });
  };

  const canAnalyze = hasMinimumDocuments() && !analyzeMutation.isPending;

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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-8">
          {/* RFT Requirements Section */}
          <Card>
            <CardHeader>
              <CardTitle>RFT (Request for Tender)</CardTitle>
              <CardDescription>
                Upload your RFT document containing project requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadZone
                title="Drop RFT Document Here"
                description="PDF, Word, or Excel files supported"
                onFilesChange={setRftFiles}
              />
            </CardContent>
          </Card>

          {/* Vendor Documents Section with Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Proposals</CardTitle>
              <CardDescription>
                Upload documents for each vendor across different categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={projectData.vendorList?.[0]} className="w-full">
                <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${projectData.vendorList?.length || 1}, 1fr)` }}>
                  {projectData.vendorList?.map((vendor: string) => (
                    <TabsTrigger key={vendor} value={vendor} data-testid={`tab-${vendor}`}>
                      {vendor}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {projectData.vendorList?.map((vendor: string) => (
                  <TabsContent key={vendor} value={vendor} className="space-y-6 mt-6">
                    <div className="grid gap-6">
                      {/* SOW */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">Statement of Work (SOW)</h3>
                          <p className="text-xs text-muted-foreground">Upload SOW documents from {vendor}</p>
                        </div>
                        <FileUploadZone
                          title="Drop SOW Here"
                          description="PDF, Word, or Excel files"
                          onFilesChange={(files) => updateVendorDocuments(vendor, "sow", files)}
                        />
                      </div>

                      {/* Product Questionnaire */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">Product Questionnaire</h3>
                          <p className="text-xs text-muted-foreground">Upload product questionnaire from {vendor}</p>
                        </div>
                        <FileUploadZone
                          title="Drop Product Questionnaire Here"
                          description="PDF, Word, or Excel files"
                          onFilesChange={(files) => updateVendorDocuments(vendor, "productQuestionnaire", files)}
                        />
                      </div>

                      {/* Functional Requirement Sheet */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">Functional Requirement Sheet</h3>
                          <p className="text-xs text-muted-foreground">Upload functional requirements from {vendor}</p>
                        </div>
                        <FileUploadZone
                          title="Drop Functional Requirement Sheet Here"
                          description="PDF, Word, or Excel files"
                          onFilesChange={(files) => updateVendorDocuments(vendor, "functionalRequirement", files)}
                        />
                      </div>

                      {/* Non-Functional Requirement Sheet */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">Non-Functional Requirement Sheet</h3>
                          <p className="text-xs text-muted-foreground">Upload non-functional requirements from {vendor}</p>
                        </div>
                        <FileUploadZone
                          title="Drop Non-Functional Requirement Sheet Here"
                          description="PDF, Word, or Excel files"
                          onFilesChange={(files) => updateVendorDocuments(vendor, "nonFunctionalRequirement", files)}
                        />
                      </div>

                      {/* CSOC Sheet */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold mb-1">CSOC Sheet</h3>
                          <p className="text-xs text-muted-foreground">Upload CSOC sheet from {vendor}</p>
                        </div>
                        <FileUploadZone
                          title="Drop CSOC Sheet Here"
                          description="PDF, Word, or Excel files"
                          onFilesChange={(files) => updateVendorDocuments(vendor, "csocSheet", files)}
                        />
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
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
              Upload at least the RFT document and one vendor document to continue
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
