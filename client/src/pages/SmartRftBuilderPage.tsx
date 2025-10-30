import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Wand2, CheckCircle2, Loader2, Download, Lightbulb, Edit, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Step = 1 | 2 | 3 | 4;
type BusinessCaseMethod = "generate" | "upload";

export default function SmartRftBuilderPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [businessCaseMethod, setBusinessCaseMethod] = useState<BusinessCaseMethod>("generate");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [businessCaseName, setBusinessCaseName] = useState("");
  const [businessCaseDescription, setBusinessCaseDescription] = useState("");
  const [selectedPortfolio, setSelectedPortfolio] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [businessCaseId, setBusinessCaseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generatedRftId, setGeneratedRftId] = useState("");
  const [generatedRft, setGeneratedRft] = useState<any>(null);
  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);
  const hasSeededTemplatesRef = useRef(false);
  
  // Fields for AI generation
  const [projectObjective, setProjectObjective] = useState("");
  const [projectScope, setProjectScope] = useState("");
  const [timeline, setTimeline] = useState("");
  const [budget, setBudget] = useState("");
  const [keyRequirements, setKeyRequirements] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  
  // RFT Document Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedSections, setEditedSections] = useState<any[]>([]);

  // Fetch portfolios
  const { data: portfolios = [] } = useQuery<any[]>({
    queryKey: ["/api/portfolios"],
  });

  // Fetch active RFT templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ["/api/rft-templates/active"],
  });

  // Auto-seed templates if empty
  useEffect(() => {
    const seedTemplates = async () => {
      if (templates && templates.length === 0 && !hasSeededTemplatesRef.current && !isSeedingTemplates) {
        hasSeededTemplatesRef.current = true;
        setIsSeedingTemplates(true);
        try {
          await apiRequest("POST", "/api/seed-rft-templates");
          await queryClient.refetchQueries({ queryKey: ["/api/rft-templates/active"] });
          toast({
            title: "Templates Loaded",
            description: "RFT templates are now available for selection.",
          });
        } catch (error) {
          console.error("Failed to seed RFT templates:", error);
          hasSeededTemplatesRef.current = false;
        } finally {
          setIsSeedingTemplates(false);
        }
      }
    };
    seedTemplates();
  }, [templates, isSeedingTemplates, toast]);

  // Generate business case with AI
  const generateBusinessCaseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/business-cases/generate", {
        portfolioId: selectedPortfolio,
        name: businessCaseName,
        description: businessCaseDescription,
        projectObjective,
        projectScope,
        timeline,
        budget,
        keyRequirements,
        successCriteria,
      });
    },
    onSuccess: (data: any) => {
      setBusinessCaseId(data.id);
      toast({
        title: "Business Case Generated",
        description: "AI has generated your lean business case document.",
      });
      setCurrentStep(2);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate business case. Please try again.",
      });
    },
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
      console.log("Creating project with:", { portfolioId: selectedPortfolio, name: businessCaseName, businessCaseId });
      return apiRequest("POST", "/api/projects", {
        portfolioId: selectedPortfolio,
        name: businessCaseName,
        status: "draft",
        businessCaseId,
      });
    },
    onSuccess: (data: any) => {
      console.log("Project created successfully:", data);
      if (!data || !data.id) {
        console.error("Invalid project data received:", data);
        toast({
          variant: "destructive",
          title: "Project Creation Error",
          description: "Project was created but invalid data was returned.",
        });
        return;
      }
      setProjectId(data.id);
      toast({
        title: "Project Created",
        description: "Project created successfully. Ready to generate RFT.",
      });
      setCurrentStep(3);
    },
    onError: (error: any) => {
      console.error("Error creating project:", error);
      toast({
        variant: "destructive",
        title: "Project Creation Failed",
        description: "Failed to create project. Please try again.",
      });
    },
  });

  // Generate RFT
  const generateRftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/generate-rft", {
        businessCaseId,
        templateId: selectedTemplate,
        projectId,
      });
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
      return apiRequest("POST", `/api/generated-rfts/${generatedRftId}/publish`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "RFT Published!",
        description: `Created ${data.requirementsCreated} requirements. Ready for vendor submissions.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  // Update RFT Document
  const updateRftMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/generated-rfts/${generatedRftId}`, {
        sections: { sections: editedSections },
      });
    },
    onSuccess: (data: any) => {
      setGeneratedRft(data);
      setIsEditDialogOpen(false);
      toast({
        title: "RFT Updated!",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to save changes. Please try again.",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFillSampleData = () => {
    setBusinessCaseName("Next-Generation Passenger Experience Platform");
    setProjectObjective("Transform the end-to-end passenger journey through an integrated digital ecosystem that delivers personalized, seamless travel experiences while reducing operational costs and increasing ancillary revenue opportunities.");
    setProjectScope("Comprehensive mobile-first platform including iOS/Android native applications, responsive web portal, airport kiosk integration, and backend microservices architecture supporting 10M+ annual passengers across 50+ destinations.");
    setTimeline("18 months - Phased rollout with MVP in 6 months, full deployment in 18 months");
    setBudget("$4.2M (Development: $2.5M, Infrastructure: $800K, Licenses: $400K, Contingency: $500K)");
    setKeyRequirements("Native mobile apps with offline capabilities, real-time flight status updates, digital boarding passes, biometric authentication, baggage tracking, seat selection, meal preferences, loyalty program integration, push notifications, multi-language support (English, Arabic, French), accessibility compliance (WCAG 2.1), payment gateway integration with 3D Secure");
    setSuccessCriteria("300K active users within 12 months, 4.7+ app store rating, 85% digital check-in adoption rate, 40% reduction in counter queue times, 25% increase in ancillary revenue per passenger, 95% uptime SLA, <2 second response time for critical operations");
    
    toast({
      title: "Sample Data Loaded",
      description: "All fields have been filled with sample aviation project data.",
    });
  };

  const handleGenerateBusinessCase = () => {
    if (!businessCaseName || !selectedPortfolio || !projectObjective) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill in required fields: name, portfolio, and project objective.",
      });
      return;
    }

    generateBusinessCaseMutation.mutate();
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

  const handleOpenEditDialog = () => {
    if (generatedRft?.sections?.sections) {
      setEditedSections([...generatedRft.sections.sections]);
      setIsEditDialogOpen(true);
    }
  };

  const handleSectionChange = (index: number, field: "title" | "content", value: string) => {
    const updated = [...editedSections];
    updated[index] = { ...updated[index], [field]: value };
    setEditedSections(updated);
  };

  const handleSaveEdits = () => {
    updateRftMutation.mutate();
  };

  const handleGenerate = () => {
    console.log("Generate button clicked", { businessCaseId, selectedTemplate, projectId });
    
    if (!businessCaseId) {
      toast({
        variant: "destructive",
        title: "Missing Business Case",
        description: "Business case ID is missing. Please upload your business case first.",
      });
      return;
    }
    
    if (!selectedTemplate) {
      toast({
        variant: "destructive",
        title: "Missing Template",
        description: "Please select an RFT template.",
      });
      return;
    }
    
    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Missing Project",
        description: "Project ID is missing. Please try selecting the template again.",
      });
      return;
    }
    
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

      {/* Step 1: Create Business Case */}
      {currentStep === 1 && (
        <Card data-testid="step-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Step 1: Create Business Case
            </CardTitle>
            <CardDescription>
              Generate a lean business case from your idea or upload an existing document
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={businessCaseMethod} onValueChange={(v) => setBusinessCaseMethod(v as BusinessCaseMethod)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="generate" data-testid="tab-generate">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Generate from Idea
                </TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Need sample data to test? Click to auto-fill with aviation project example
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFillSampleData}
                    data-testid="button-fill-sample"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Fill Sample Data
                  </Button>
                </div>

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
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={businessCaseName}
                    onChange={(e) => setBusinessCaseName(e.target.value)}
                    placeholder="e.g., Mobile Passenger App"
                    data-testid="input-business-case-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective">Business Objective *</Label>
                  <Textarea
                    id="objective"
                    value={projectObjective}
                    onChange={(e) => setProjectObjective(e.target.value)}
                    placeholder="e.g., Modernize passenger experience with digital services"
                    data-testid="textarea-objective"
                    className="min-h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Input
                      id="scope"
                      value={projectScope}
                      onChange={(e) => setProjectScope(e.target.value)}
                      placeholder="e.g., iOS/Android app"
                      data-testid="input-scope"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline</Label>
                    <Input
                      id="timeline"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      placeholder="e.g., 12 months"
                      data-testid="input-timeline"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g., $2M"
                    data-testid="input-budget"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Key Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={keyRequirements}
                    onChange={(e) => setKeyRequirements(e.target.value)}
                    placeholder="e.g., Offline mode, push notifications, biometric login"
                    data-testid="textarea-requirements"
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="success">Success Criteria</Label>
                  <Textarea
                    id="success"
                    value={successCriteria}
                    onChange={(e) => setSuccessCriteria(e.target.value)}
                    placeholder="e.g., 100K downloads, 4.5+ rating"
                    data-testid="textarea-success"
                    className="min-h-20"
                  />
                </div>

                <Button
                  onClick={handleGenerateBusinessCase}
                  disabled={generateBusinessCaseMutation.isPending}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {generateBusinessCaseMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Business Case...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate with AI & Continue
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portfolio-upload">Portfolio *</Label>
                  <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
                    <SelectTrigger id="portfolio-upload" data-testid="select-portfolio-upload">
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
                  <Label htmlFor="name-upload">Business Case Name *</Label>
                  <Input
                    id="name-upload"
                    value={businessCaseName}
                    onChange={(e) => setBusinessCaseName(e.target.value)}
                    placeholder="e.g., Digital Transformation Initiative 2025"
                    data-testid="input-business-case-name-upload"
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
              </TabsContent>
            </Tabs>
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
            {(templatesLoading || isSeedingTemplates) ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isSeedingTemplates ? "Loading RFT templates..." : "Loading..."}
                </p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No templates available</p>
              </div>
            ) : (
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
            )}

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
              Review the generated RFT and 4 Excel questionnaires, then publish
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* RFT Document Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg">RFT Document</h4>
                <Badge variant="secondary">{(generatedRft.sections?.sections || []).length} sections</Badge>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto p-3 bg-muted/30 rounded-lg">
                {(generatedRft.sections?.sections || []).map((section: any, idx: number) => (
                  <div key={idx} className="p-3 bg-background border rounded-md">
                    <h5 className="font-medium text-sm">{section.title}</h5>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {section.content.substring(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={handleOpenEditDialog}
                  data-testid="button-edit-rft"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Document
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/generated-rfts/${generatedRftId}/download/doc`, "_blank");
                  }}
                  data-testid="button-download-doc"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download DOC
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/generated-rfts/${generatedRftId}/download/pdf`, "_blank");
                  }}
                  data-testid="button-download-pdf"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>

            <Separator />

            {/* Questionnaires Section */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Excel Questionnaires</h4>
              <p className="text-sm text-muted-foreground">
                Four comprehensive questionnaires with dropdown compliance scoring (100%-Fully Met, 50%-Partially Met, 25%-Not Compliant, 0%-Not Applicable) and remarks column.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Product Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Product Questionnaire</h5>
                    <Badge variant="outline">30 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Product features, capabilities, roadmap, and vendor support
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/product`, "_blank");
                    }}
                    data-testid="button-download-product"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* NFR Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">NFR Questionnaire</h5>
                    <Badge variant="outline">50 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Non-functional requirements: performance, scalability, reliability
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/nfr`, "_blank");
                    }}
                    data-testid="button-download-nfr"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* Cybersecurity Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Cybersecurity Questionnaire</h5>
                    <Badge variant="outline">20 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Security, compliance, data protection, and certifications
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/cybersecurity`, "_blank");
                    }}
                    data-testid="button-download-cybersecurity"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>

                {/* Agile Delivery Questionnaire */}
                <div className="p-4 border rounded-lg space-y-2 hover-elevate">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Agile Delivery Questionnaire</h5>
                    <Badge variant="outline">20 Questions</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agile methodology, sprint planning, CI/CD, and team structure
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/questionnaires/download/${generatedRftId}/agile`, "_blank");
                    }}
                    data-testid="button-download-agile"
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Publish Section */}
            <div className="space-y-3">
              <div className="bg-accent p-4 rounded-lg">
                <h5 className="font-semibold mb-2">Ready to Publish</h5>
                <p className="text-sm text-muted-foreground">
                  Publishing will make the RFT document available to vendors and create evaluation criteria in the system.
                </p>
              </div>

              <Button
                onClick={handlePublish}
                disabled={publishMutation.isPending}
                className="w-full"
                data-testid="button-publish"
              >
                {publishMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing RFT...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Publish RFT to Vendors
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit RFT Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit RFT Document</DialogTitle>
            <DialogDescription>
              Review and edit each section of your RFT document. Changes will be saved to the database.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {editedSections.map((section: any, index: number) => (
              <div key={index} className="space-y-2 p-4 border rounded-lg">
                <Label htmlFor={`section-title-${index}`}>Section {index + 1} - Title</Label>
                <Input
                  id={`section-title-${index}`}
                  value={section.title}
                  onChange={(e) => handleSectionChange(index, "title", e.target.value)}
                  data-testid={`input-section-title-${index}`}
                />
                
                <Label htmlFor={`section-content-${index}`}>Content</Label>
                <Textarea
                  id={`section-content-${index}`}
                  value={section.content}
                  onChange={(e) => handleSectionChange(index, "content", e.target.value)}
                  className="min-h-32 font-mono text-sm"
                  data-testid={`textarea-section-content-${index}`}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateRftMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdits}
              disabled={updateRftMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateRftMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
