import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Wand2, CheckCircle2, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Step = 1 | 2 | 3 | 4;

export default function SmartRftBuilderPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [businessCaseName, setBusinessCaseName] = useState("");
  const [businessCaseDescription, setBusinessCaseDescription] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [businessCaseId, setBusinessCaseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generatedRftId, setGeneratedRftId] = useState("");
  const [generatedRft, setGeneratedRft] = useState<any>(null);

  // Fetch portfolios
  const { data: portfolios = [] } = useQuery<any[]>({
    queryKey: ["/api/portfolios"],
  });

  // Fetch active RFT templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/rft-templates/active"],
  });

  // Upload business case
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/business-cases/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: (data) => {
      setBusinessCaseId(data.id);
      toast({
        title: "Business Case Uploaded",
        description: "Successfully uploaded your business case document.",
      });
      setCurrentStep(2);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload business case. Please try again.",
      });
    },
  });

  // Create project
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/projects", {
        portfolioId: selectedPortfolio,
        name: businessCaseName,
        status: "draft",
        businessCaseId,
      }) as Promise<any>;
    },
    onSuccess: (data: any) => {
      setProjectId(data.id);
      setCurrentStep(3);
    },
  });

  // Generate RFT
  const generateRftMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/generate-rft", {
        businessCaseId,
        templateId: selectedTemplate,
        projectId,
      }) as Promise<any>;
    },
    onSuccess: (data: any) => {
      setGeneratedRftId(data.id);
      setGeneratedRft(data);
      toast({
        title: "RFT Generated Successfully!",
        description: `Generated ${(data.sections?.sections || []).length} sections using AI.`,
      });
      setCurrentStep(4);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate RFT. Please try again.",
      });
    },
  });

  // Publish RFT
  const publishMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/generated-rfts/${generatedRftId}/publish`, {}) as Promise<any>;
    },
    onSuccess: (data: any) => {
      toast({
        title: "RFT Published!",
        description: `Created ${data.requirementsCreated} requirements. Ready for vendor submissions.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !businessCaseName || !selectedPortfolio) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in all required fields.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("document", selectedFile);
    formData.append("portfolioId", selectedPortfolio);
    formData.append("name", businessCaseName);
    if (businessCaseDescription) {
      formData.append("description", businessCaseDescription);
    }

    uploadMutation.mutate(formData);
  };

  const handleSelectTemplate = () => {
    if (!selectedTemplate) {
      toast({
        variant: "destructive",
        title: "No Template Selected",
        description: "Please select an RFT template.",
      });
      return;
    }
    createProjectMutation.mutate();
  };

  const handleGenerate = () => {
    generateRftMutation.mutate();
  };

  const handlePublish = () => {
    publishMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Smart RFT Builder</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered RFT generation from your business case documents
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                currentStep >= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-indicator-${step}`}
            >
              {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
            </div>
            {step < 4 && (
              <div
                className={`w-24 h-1 mx-2 ${
                  currentStep > step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload Business Case */}
      {currentStep === 1 && (
        <Card data-testid="step-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Upload Business Case
            </CardTitle>
            <CardDescription>
              Upload your Lean Business Case document to start the RFT generation process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio">Portfolio *</Label>
              <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                <SelectTrigger id="portfolio" data-testid="select-portfolio">
                  <SelectValue placeholder="Select a portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((portfolio: any) => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Business Case Name *</Label>
              <Input
                id="name"
                value={businessCaseName}
                onChange={(e) => setBusinessCaseName(e.target.value)}
                placeholder="e.g., Digital Transformation Initiative 2025"
                data-testid="input-business-case-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={businessCaseDescription}
                onChange={(e) => setBusinessCaseDescription(e.target.value)}
                placeholder="Brief description of the business case"
                data-testid="textarea-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">Document *</Label>
              <Input
                id="document"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                data-testid="input-file"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
              className="w-full"
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Continue
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Template */}
      {currentStep === 2 && (
        <Card data-testid="step-template">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Step 2: Select RFT Template
            </CardTitle>
            <CardDescription>
              Choose a template that best matches your project type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {templates.map((template: any) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer hover-elevate ${
                    selectedTemplate === template.id ? "border-primary bg-accent" : ""
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                  data-testid={`template-${template.category}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{template.category}</Badge>
                        <Badge variant="secondary">
                          {(template.sections?.sections || []).length} sections
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                data-testid="button-back"
              >
                Back
              </Button>
              <Button
                onClick={handleSelectTemplate}
                disabled={createProjectMutation.isPending}
                className="flex-1"
                data-testid="button-select-template"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generate RFT */}
      {currentStep === 3 && (
        <Card data-testid="step-generate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Step 3: Generate RFT
            </CardTitle>
            <CardDescription>
              Our AI will analyze your business case and generate a comprehensive RFT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-accent p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Ready to Generate</h4>
              <p className="text-sm text-muted-foreground">
                AI will create structured RFT sections based on your business case including:
                business requirements, functional requirements, technical specifications,
                cybersecurity requirements, and evaluation criteria.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={generateRftMutation.isPending}
                data-testid="button-back-step3"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateRftMutation.isPending}
                className="flex-1"
                data-testid="button-generate"
              >
                {generateRftMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating RFT... This may take a minute
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate RFT with AI
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Publish */}
      {currentStep === 4 && generatedRft && (
        <Card data-testid="step-publish">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Step 4: Review & Publish
            </CardTitle>
            <CardDescription>
              Review the generated RFT and publish to start vendor submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{generatedRft.name}</h4>
                <Badge>{(generatedRft.sections?.sections || []).length} sections</Badge>
              </div>

              <Separator />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(generatedRft.sections?.sections || []).map((section: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <h5 className="font-medium">{section.title}</h5>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {section.content.substring(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  window.open(`/generated-rfts/${generatedRftId}`, "_blank");
                }}
                data-testid="button-view-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Full RFT
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="flex-1"
                data-testid="button-publish"
              >
                {publishMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Publish RFT
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
