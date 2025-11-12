import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Download, Trash2, Settings, Star, Eye, EyeOff, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrganizationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateType: string;
  blobUrl: string;
  uploadedAt: string;
  isActive: string;
  isDefault: string;
  sectionMappings: SectionMapping[];
}

interface SectionMapping {
  sectionId: string;
  sectionTitle: string;
  defaultAssignee: string;
  category: string;
}

interface StakeholderRole {
  roleId: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
}

// Stakeholder roles from stakeholderConfig.ts
const stakeholderRoles: StakeholderRole[] = [
  {
    roleId: "technical_pm",
    name: "Technical PM",
    description: "Product & Requirements",
    category: "functional",
    icon: "Target",
    color: "#3B82F6"
  },
  {
    roleId: "solution_architect",
    name: "Solution Architect",
    description: "Architecture & Design",
    category: "technical",
    icon: "Layout",
    color: "#8B5CF6"
  },
  {
    roleId: "cybersecurity_analyst",
    name: "Cybersecurity Analyst",
    description: "Security & Compliance",
    category: "security",
    icon: "Shield",
    color: "#EF4444"
  },
  {
    roleId: "engineering_lead",
    name: "Engineering Lead",
    description: "Development & Tech Stack",
    category: "technical",
    icon: "Code",
    color: "#10B981"
  },
  {
    roleId: "procurement_specialist",
    name: "Procurement Specialist",
    description: "Commercial & Contracts",
    category: "commercial",
    icon: "DollarSign",
    color: "#F59E0B"
  },
  {
    roleId: "product_owner",
    name: "Product Owner",
    description: "Product Vision & Roadmap",
    category: "functional",
    icon: "Lightbulb",
    color: "#06B6D4"
  },
  {
    roleId: "compliance_officer",
    name: "Compliance Officer",
    description: "Regulatory & Standards",
    category: "compliance",
    icon: "FileCheck",
    color: "#EC4899"
  }
];

const categoryOptions = [
  { value: "aviation", label: "Aviation" },
  { value: "defense", label: "Defense" },
  { value: "technology", label: "Technology" },
  { value: "general", label: "General" }
];

export default function TemplateManagementPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    name: "",
    description: "",
    category: "aviation",
    file: null as File | null
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploadedTemplate, setUploadedTemplate] = useState<OrganizationTemplate | null>(null);
  
  // Configuration state
  const [configTemplateId, setConfigTemplateId] = useState<string | null>(null);
  const [configSections, setConfigSections] = useState<SectionMapping[]>([]);

  // Fetch templates list
  const { data: templates = [], isLoading } = useQuery<OrganizationTemplate[]>({
    queryKey: ["/api/templates"]
  });

  // Fetch template details for configuration modal
  const { data: templateDetails, isLoading: isLoadingDetails } = useQuery<OrganizationTemplate>({
    queryKey: [`/api/templates/${configTemplateId}`],
    enabled: !!configTemplateId
  });

  // Upload template mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("POST", "/api/templates/upload", formData);
    },
    onSuccess: (data: OrganizationTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      // Show extraction summary instead of immediately closing
      setUploadedTemplate(data);
      setUploadFormData({ name: "", description: "", category: "aviation", file: null });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload template",
        variant: "destructive"
      });
    }
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("DELETE", `/api/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("PATCH", `/api/templates/${templateId}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Default template updated" });
    },
    onError: () => {
      toast({ title: "Failed to set default template", variant: "destructive" });
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("PATCH", `/api/templates/${templateId}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update template status", variant: "destructive" });
    }
  });

  // Configure sections mutation
  const configureSectionsMutation = useMutation({
    mutationFn: async ({ templateId, sectionMappings }: { templateId: string; sectionMappings: SectionMapping[] }) => {
      return await apiRequest("PATCH", `/api/templates/${templateId}/configure`, { sectionMappings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setConfigTemplateId(null);
      toast({ title: "Section mappings configured successfully" });
    },
    onError: () => {
      toast({ title: "Failed to configure sections", variant: "destructive" });
    }
  });

  // File drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.docx')) {
      toast({
        title: "Invalid file type",
        description: "Only DOCX templates are supported in this release",
        variant: "destructive"
      });
      return;
    }
    setUploadFormData(prev => ({ ...prev, file }));
  };

  const handleUploadSubmit = () => {
    if (!uploadFormData.file || !uploadFormData.name) {
      toast({
        title: "Missing required fields",
        description: "Please provide template name and file",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFormData.file);
    formData.append("name", uploadFormData.name);
    formData.append("description", uploadFormData.description);
    formData.append("category", uploadFormData.category);

    uploadMutation.mutate(formData);
  };

  const handleDownloadTemplate = async (template: OrganizationTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Template downloaded" });
    } catch (error) {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const openConfigureDialog = async (template: OrganizationTemplate) => {
    setConfigTemplateId(template.id);
    setConfigSections([]); // Reset sections when opening
    // Force fresh data fetch for this template
    await queryClient.invalidateQueries({ queryKey: [`/api/templates/${template.id}`] });
  };

  // Update configSections when templateDetails loads
  useEffect(() => {
    if (templateDetails && configTemplateId) {
      setConfigSections(templateDetails.sectionMappings || []);
    }
  }, [templateDetails, configTemplateId]);

  const updateSectionAssignee = (sectionId: string, assignee: string) => {
    setConfigSections(prev =>
      prev.map(section =>
        section.sectionId === sectionId
          ? { ...section, defaultAssignee: assignee }
          : section
      )
    );
  };

  const handleSaveConfiguration = () => {
    if (!configTemplateId) return;
    configureSectionsMutation.mutate({
      templateId: configTemplateId,
      sectionMappings: configSections
    });
  };

  const handleCloseUploadDialog = () => {
    setIsUploadDialogOpen(false);
    setUploadedTemplate(null);
    toast({ title: "Template uploaded successfully" });
  };

  const getRoleInfo = (roleId: string) => {
    return stakeholderRoles.find(r => r.roleId === roleId) || stakeholderRoles[0];
  };

  const configuredTemplate = templateDetails || templates.find(t => t.id === configTemplateId);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Template Management</h1>
            <p className="text-muted-foreground mt-1">
              Upload and configure DOCX templates for collaborative RFT generation
            </p>
          </div>
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-template">
                <Upload className="h-4 w-4 mr-2" />
                Upload Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {uploadedTemplate ? "Upload Complete" : "Upload DOCX Template"}
                </DialogTitle>
                <DialogDescription>
                  {uploadedTemplate 
                    ? "Template uploaded successfully. Review extracted sections below."
                    : "Upload your organization's RFT template in DOCX format"
                  }
                </DialogDescription>
              </DialogHeader>
              
              {uploadedTemplate ? (
                /* Extraction Summary View */
                <div className="space-y-4 mt-4 flex-1 overflow-auto">
                  <Alert className="bg-green-500/10 border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>
                      <strong>{uploadedTemplate.name}</strong> uploaded successfully
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Extracted Sections</CardTitle>
                      <CardDescription>
                        {uploadedTemplate.sectionMappings?.length || 0} sections detected in template
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {uploadedTemplate.sectionMappings && uploadedTemplate.sectionMappings.length > 0 ? (
                        <div className="space-y-2">
                          {uploadedTemplate.sectionMappings.map((section, index) => {
                            const assignedRole = getRoleInfo(section.defaultAssignee);
                            return (
                              <div
                                key={section.sectionId || index}
                                className="flex items-center justify-between p-3 border rounded-lg"
                                data-testid={`summary-section-${section.sectionId}`}
                              >
                                <div>
                                  <p className="text-sm font-medium">{section.sectionTitle}</p>
                                  <p className="text-xs text-muted-foreground">{section.sectionId}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {section.category}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: assignedRole.color }} />
                                    <span className="text-xs text-muted-foreground">{assignedRole.name}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No sections extracted. You can configure them manually.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      You can configure stakeholder assignments later by clicking "Configure" on the template.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button onClick={handleCloseUploadDialog} data-testid="button-close-summary">
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                /* Upload Form View */
                <div className="space-y-4 mt-4">
                  {/* File Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    data-testid="dropzone-template"
                  >
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">
                      {uploadFormData.file ? uploadFormData.file.name : "Drop your DOCX template here"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx"
                      onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                      className="hidden"
                      data-testid="input-file-template"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-browse-file"
                    >
                      Browse Files
                    </Button>
                  </div>

                  {/* Metadata Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="template-name">Template Name *</Label>
                      <Input
                        id="template-name"
                        value={uploadFormData.name}
                        onChange={(e) => setUploadFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Emirates RFT Template 2025"
                        data-testid="input-template-name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="template-description">Description</Label>
                      <Textarea
                        id="template-description"
                        value={uploadFormData.description}
                        onChange={(e) => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Standard RFT template for aviation procurement projects"
                        rows={3}
                        data-testid="input-template-description"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="template-category">Category</Label>
                      <Select
                        value={uploadFormData.category}
                        onValueChange={(value) => setUploadFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger id="template-category" data-testid="select-template-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Only DOCX templates are supported. XLSX templates will be rejected.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setIsUploadDialogOpen(false)}
                      disabled={uploadMutation.isPending}
                      data-testid="button-cancel-upload"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadSubmit}
                      disabled={uploadMutation.isPending || !uploadFormData.file || !uploadFormData.name}
                      data-testid="button-submit-upload"
                    >
                      {uploadMutation.isPending ? "Uploading..." : "Upload Template"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Templates</CardTitle>
            <CardDescription>
              Manage DOCX templates and configure stakeholder section assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">No templates yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Upload your first DOCX template to get started
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Sections Configured</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{template.name}</p>
                              {template.description && (
                                <p className="text-xs text-muted-foreground">{template.description}</p>
                              )}
                            </div>
                            {template.isDefault === "true" && (
                              <Badge variant="default" className="ml-2">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {template.sectionMappings?.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm">{template.sectionMappings.length} sections</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not configured</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {template.isActive === "true" ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-500">
                              <Eye className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(template.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openConfigureDialog(template)}
                              data-testid={`button-configure-${template.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownloadTemplate(template)}
                              data-testid={`button-download-${template.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDefaultMutation.mutate(template.id)}
                              disabled={template.isDefault === "true"}
                              data-testid={`button-set-default-${template.id}`}
                            >
                              <Star className={`h-4 w-4 ${template.isDefault === "true" ? "fill-current" : ""}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleActiveMutation.mutate(template.id)}
                              data-testid={`button-toggle-active-${template.id}`}
                            >
                              {template.isActive === "true" ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(template.id)}
                              disabled={template.isDefault === "true"}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section Configuration Dialog */}
        <Dialog open={configTemplateId !== null} onOpenChange={(open) => !open && setConfigTemplateId(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Configure Section Assignments</DialogTitle>
              <DialogDescription>
                Map each RFT section to the stakeholder role responsible for review
              </DialogDescription>
            </DialogHeader>
            
            {configuredTemplate && (
              <div className="space-y-4 flex-1 overflow-auto">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>{configuredTemplate.name}</strong> - Assign stakeholder roles to {configSections.length} sections
                  </AlertDescription>
                </Alert>

                {configSections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sections available to configure
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-[300px]">Assigned Stakeholder Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {configSections.map((section, index) => {
                          const assignedRole = getRoleInfo(section.defaultAssignee);
                          return (
                            <TableRow key={section.sectionId || index} data-testid={`row-section-${section.sectionId}`}>
                              <TableCell>
                                <p className="font-medium text-sm">{section.sectionTitle}</p>
                                <p className="text-xs text-muted-foreground">{section.sectionId}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {section.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={section.defaultAssignee}
                                  onValueChange={(value) => updateSectionAssignee(section.sectionId, value)}
                                >
                                  <SelectTrigger data-testid={`select-assignee-${section.sectionId}`}>
                                    <SelectValue>
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: assignedRole.color }} />
                                        <span className="text-sm">{assignedRole.name}</span>
                                      </div>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stakeholderRoles.map(role => (
                                      <SelectItem key={role.roleId} value={role.roleId}>
                                        <div className="flex items-center gap-2">
                                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                                          <div>
                                            <p className="text-sm font-medium">{role.name}</p>
                                            <p className="text-xs text-muted-foreground">{role.description}</p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Stakeholder Legend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Stakeholder Roles Reference</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    {stakeholderRoles.map(role => (
                      <div key={role.roleId} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                        <div>
                          <p className="text-xs font-medium">{role.name}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setConfigTemplateId(null)}
                disabled={configureSectionsMutation.isPending}
                data-testid="button-cancel-configure"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfiguration}
                disabled={configureSectionsMutation.isPending}
                data-testid="button-save-configuration"
              >
                {configureSectionsMutation.isPending ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
