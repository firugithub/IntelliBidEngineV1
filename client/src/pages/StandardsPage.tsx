import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, ArrowLeft, Power, PowerOff, Link as LinkIcon, Upload, Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Standard, McpConnector } from "@shared/schema";

interface Section {
  id: string;
  name: string;
  description: string;
}

export default function StandardsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");
  
  // Standards state
  const [isStandardDialogOpen, setIsStandardDialogOpen] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [standardFormData, setStandardFormData] = useState({
    name: "",
    description: "",
    sections: [] as Section[],
    tags: [] as string[],
    file: null as File | null,
  });
  const [newSection, setNewSection] = useState({
    name: "",
    description: "",
  });
  const [newTag, setNewTag] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // MCP Connectors state
  const [isConnectorDialogOpen, setIsConnectorDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<McpConnector | null>(null);
  const [connectorFormData, setConnectorFormData] = useState({
    name: "",
    description: "",
    serverUrl: "",
    apiKey: "",
  });

  // Standards queries
  const { data: standards = [], isLoading: standardsLoading } = useQuery<Standard[]>({
    queryKey: ["/api/standards"],
  });

  // MCP Connectors queries
  const { data: connectors = [], isLoading: connectorsLoading } = useQuery<McpConnector[]>({
    queryKey: ["/api/mcp-connectors"],
  });

  // Standards mutations
  const createStandardMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/standards/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to create standard");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standards"] });
      toast({ title: "Standard created successfully" });
      resetStandardForm();
      setIsStandardDialogOpen(false);
      setIsExtracting(false);
    },
    onError: () => {
      toast({ title: "Failed to create standard", variant: "destructive" });
      setIsExtracting(false);
    },
  });

  const updateStandardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; description: string; sections: Section[] }> }) => {
      return await apiRequest("PATCH", `/api/standards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standards"] });
      toast({ title: "Standard updated successfully" });
      resetStandardForm();
      setIsStandardDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update standard", variant: "destructive" });
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/standards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standards"] });
      toast({ title: "Standard deactivated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to deactivate standard", variant: "destructive" });
    },
  });

  // MCP Connectors mutations
  const createConnectorMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; serverUrl: string; apiKey: string }) => {
      return await apiRequest("POST", "/api/mcp-connectors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-connectors"] });
      toast({ title: "MCP connector created successfully" });
      resetConnectorForm();
      setIsConnectorDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create MCP connector", variant: "destructive" });
    },
  });

  const updateConnectorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; description: string; serverUrl: string; apiKey: string; isActive: string }> }) => {
      return await apiRequest("PATCH", `/api/mcp-connectors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-connectors"] });
      toast({ title: "MCP connector updated successfully" });
      resetConnectorForm();
      setIsConnectorDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update MCP connector", variant: "destructive" });
    },
  });

  const deleteConnectorMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/mcp-connectors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-connectors"] });
      toast({ title: "MCP connector deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete MCP connector", variant: "destructive" });
    },
  });

  const toggleConnectorMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: string }) => {
      return await apiRequest("PATCH", `/api/mcp-connectors/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mcp-connectors"] });
      toast({ title: "MCP connector status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update connector status", variant: "destructive" });
    },
  });

  // Standards handlers
  const resetStandardForm = () => {
    setStandardFormData({ name: "", description: "", sections: [], tags: [], file: null });
    setNewSection({ name: "", description: "" });
    setNewTag("");
    setEditingStandard(null);
  };

  const handleEditStandard = (standard: Standard) => {
    setEditingStandard(standard);
    setStandardFormData({
      name: standard.name,
      description: standard.description || "",
      sections: (standard.sections as Section[]) || [],
      tags: (standard.tags as string[]) || [],
      file: null,
    });
    setIsStandardDialogOpen(true);
  };

  const handleSubmitStandard = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!standardFormData.name.trim()) {
      toast({ title: "Please enter a standard name", variant: "destructive" });
      return;
    }

    if (editingStandard) {
      updateStandardMutation.mutate({
        id: editingStandard.id,
        data: {
          name: standardFormData.name,
          description: standardFormData.description,
          sections: standardFormData.sections,
        },
      });
    } else {
      // For new standards, require file upload
      if (!standardFormData.file) {
        toast({ title: "Please upload a compliance document", variant: "destructive" });
        return;
      }

      setIsExtracting(true);
      const formData = new FormData();
      formData.append("file", standardFormData.file);
      formData.append("name", standardFormData.name);
      formData.append("description", standardFormData.description);
      formData.append("tags", JSON.stringify(standardFormData.tags));
      
      createStandardMutation.mutate(formData);
    }
  };

  const handleAddSection = () => {
    if (!newSection.name.trim()) {
      toast({ title: "Please enter a section name", variant: "destructive" });
      return;
    }

    const section: Section = {
      id: `section-${Date.now()}`,
      name: newSection.name,
      description: newSection.description,
    };

    setStandardFormData(prev => ({
      ...prev,
      sections: [...prev.sections, section],
    }));

    setNewSection({ name: "", description: "" });
  };

  const handleRemoveSection = (sectionId: string) => {
    setStandardFormData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
  };

  const handleAddTag = () => {
    if (!newTag.trim()) {
      return;
    }
    if (standardFormData.tags.includes(newTag.trim())) {
      toast({ title: "Tag already added", variant: "destructive" });
      return;
    }
    setStandardFormData(prev => ({
      ...prev,
      tags: [...prev.tags, newTag.trim()],
    }));
    setNewTag("");
  };

  const handleRemoveTag = (tag: string) => {
    setStandardFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStandardFormData(prev => ({ ...prev, file }));
    }
  };

  const toggleExpandedStandard = (standardId: string) => {
    setExpandedStandards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(standardId)) {
        newSet.delete(standardId);
      } else {
        newSet.add(standardId);
      }
      return newSet;
    });
  };

  // MCP Connector handlers
  const resetConnectorForm = () => {
    setConnectorFormData({ name: "", description: "", serverUrl: "", apiKey: "" });
    setEditingConnector(null);
  };

  const handleEditConnector = (connector: McpConnector) => {
    setEditingConnector(connector);
    setConnectorFormData({
      name: connector.name,
      description: connector.description || "",
      serverUrl: connector.serverUrl,
      apiKey: "", // Don't populate redacted API key, let user enter new one if needed
    });
    setIsConnectorDialogOpen(true);
  };

  const handleSubmitConnector = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connectorFormData.name.trim()) {
      toast({ title: "Please enter a connector name", variant: "destructive" });
      return;
    }

    if (!connectorFormData.serverUrl.trim()) {
      toast({ title: "Please enter a server URL", variant: "destructive" });
      return;
    }

    if (editingConnector) {
      // Only include apiKey in update if user entered a new one
      const updateData = {
        name: connectorFormData.name,
        description: connectorFormData.description,
        serverUrl: connectorFormData.serverUrl,
        ...(connectorFormData.apiKey && { apiKey: connectorFormData.apiKey }),
      };
      updateConnectorMutation.mutate({
        id: editingConnector.id,
        data: updateData,
      });
    } else {
      createConnectorMutation.mutate(connectorFormData);
    }
  };

  const handleToggleConnector = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "true" ? "false" : "true";
    toggleConnectorMutation.mutate({ id, isActive: newStatus });
  };

  if (standardsLoading || connectorsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 mb-4"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Standards & Compliance</h1>
              <p className="text-muted-foreground">
                Manage compliance standards and MCP connectors for vendor evaluation
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6" data-testid="tabs-list">
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="mcp-connectors" data-testid="tab-mcp-connectors">MCP Connectors</TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Define compliance standards with specific sections for vendor evaluation
              </p>
              <Dialog open={isStandardDialogOpen} onOpenChange={(open) => {
                setIsStandardDialogOpen(open);
                if (!open) resetStandardForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-new-standard">
                    <Plus className="h-4 w-4" />
                    New Standard
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingStandard ? "Edit Standard" : "Create New Standard"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitStandard} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Standard Name</label>
                      <Input
                        placeholder="e.g., IT Security Framework"
                        value={standardFormData.name}
                        onChange={(e) => setStandardFormData(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-standard-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Describe the purpose of this standard..."
                        value={standardFormData.description}
                        onChange={(e) => setStandardFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        data-testid="input-standard-description"
                      />
                    </div>

                    {/* Show file upload for new standards, show sections for editing */}
                    {!editingStandard ? (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Upload Compliance Document</label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Upload a PDF or text document. AI will automatically extract compliance sections.
                          </p>
                          <Input
                            type="file"
                            accept=".pdf,.txt,.doc,.docx"
                            onChange={handleFileChange}
                            data-testid="input-standard-file"
                          />
                          {standardFormData.file && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Selected: {standardFormData.file.name}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tags (Optional)</label>
                          <p className="text-xs text-muted-foreground">
                            Add tags to categorize this standard
                          </p>
                          {standardFormData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {standardFormData.tags.map((tag) => (
                                <div
                                  key={tag}
                                  className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-xs"
                                  data-testid={`tag-${tag}`}
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="hover:text-destructive"
                                    data-testid={`button-remove-tag-${tag}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input
                              placeholder="e.g., ISO27001, GDPR, SOC2"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              data-testid="input-new-tag"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleAddTag}
                              data-testid="button-add-tag"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Compliance Sections</label>
                          <p className="text-xs text-muted-foreground">
                            {standardFormData.sections.length} section{standardFormData.sections.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {standardFormData.sections.length > 0 && (
                          <div className="space-y-2">
                            {standardFormData.sections.map((section) => (
                              <Card key={section.id} className="p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm" data-testid={`text-section-${section.id}`}>
                                      {section.name}
                                    </p>
                                    {section.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {section.description}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveSection(section.id)}
                                    data-testid={`button-remove-section-${section.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        <Card className="p-4 bg-muted/50">
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Add New Section</p>
                            <Input
                              placeholder="Section name (e.g., Data Encryption)"
                              value={newSection.name}
                              onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
                              data-testid="input-new-section-name"
                            />
                            <Textarea
                              placeholder="Section description (optional)"
                              value={newSection.description}
                              onChange={(e) => setNewSection(prev => ({ ...prev, description: e.target.value }))}
                              rows={2}
                              data-testid="input-new-section-description"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleAddSection}
                              className="w-full gap-2"
                              data-testid="button-add-section"
                            >
                              <Plus className="h-4 w-4" />
                              Add Section
                            </Button>
                          </div>
                        </Card>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsStandardDialogOpen(false);
                          resetStandardForm();
                        }}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createStandardMutation.isPending || updateStandardMutation.isPending || isExtracting}
                        data-testid="button-save-standard"
                      >
                        {isExtracting ? "Analyzing Document..." : editingStandard ? "Update" : "Create"} Standard
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {standards.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    No standards defined yet. Create your first compliance standard to get started.
                  </p>
                  <Button
                    onClick={() => setIsStandardDialogOpen(true)}
                    className="gap-2"
                    data-testid="button-create-first-standard"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Standard
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {standards.map((standard) => {
                  const sections = (standard.sections as Section[]) || [];
                  const isExpanded = expandedStandards.has(standard.id);
                  const isActive = standard.isActive === "true";

                  return (
                    <Card
                      key={standard.id}
                      className={`${!isActive ? "opacity-60" : ""}`}
                      data-testid={`card-standard-${standard.id}`}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleExpandedStandard(standard.id)}
                                data-testid={`button-toggle-${standard.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <h2 className="text-xl font-bold" data-testid={`text-standard-name-${standard.id}`}>
                                {standard.name}
                              </h2>
                              {!isActive && (
                                <span className="text-xs px-2 py-1 bg-muted rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {standard.description && (
                              <p className="text-sm text-muted-foreground ml-12">
                                {standard.description}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-2 ml-12">
                              {sections.length} compliance section{sections.length !== 1 ? 's' : ''}
                            </p>

                            {isExpanded && sections.length > 0 && (
                              <div className="mt-4 ml-12 space-y-2">
                                {sections.map((section) => (
                                  <Card key={section.id} className="p-3 bg-muted/50">
                                    <p className="font-medium text-sm">{section.name}</p>
                                    {section.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {section.description}
                                      </p>
                                    )}
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditStandard(standard)}
                                data-testid={`button-edit-${standard.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteStandardMutation.mutate(standard.id)}
                              disabled={!isActive}
                              data-testid={`button-delete-${standard.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* MCP Connectors Tab */}
          <TabsContent value="mcp-connectors" className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Configure Model Context Protocol connectors to integrate external data sources
              </p>
              <Dialog open={isConnectorDialogOpen} onOpenChange={(open) => {
                setIsConnectorDialogOpen(open);
                if (!open) resetConnectorForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-new-connector">
                    <Plus className="h-4 w-4" />
                    New Connector
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingConnector ? "Edit MCP Connector" : "Create New MCP Connector"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitConnector} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Connector Name</label>
                      <Input
                        placeholder="e.g., GitHub Repository"
                        value={connectorFormData.name}
                        onChange={(e) => setConnectorFormData(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-connector-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        placeholder="Describe what this connector does..."
                        value={connectorFormData.description}
                        onChange={(e) => setConnectorFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        data-testid="input-connector-description"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Server URL</label>
                      <Input
                        placeholder="https://mcp-server.example.com"
                        value={connectorFormData.serverUrl}
                        onChange={(e) => setConnectorFormData(prev => ({ ...prev, serverUrl: e.target.value }))}
                        data-testid="input-connector-url"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        API Key {editingConnector ? "(Leave blank to keep existing)" : "(Optional)"}
                      </label>
                      <Input
                        type="password"
                        placeholder={editingConnector ? "Enter new API key to update" : "Enter API key if required"}
                        value={connectorFormData.apiKey}
                        onChange={(e) => setConnectorFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                        data-testid="input-connector-apikey"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsConnectorDialogOpen(false);
                          resetConnectorForm();
                        }}
                        data-testid="button-cancel-connector"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createConnectorMutation.isPending || updateConnectorMutation.isPending}
                        data-testid="button-save-connector"
                      >
                        {editingConnector ? "Update" : "Create"} Connector
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {connectors.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    No MCP connectors configured yet. Add your first connector to get started.
                  </p>
                  <Button
                    onClick={() => setIsConnectorDialogOpen(true)}
                    className="gap-2"
                    data-testid="button-create-first-connector"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Connector
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {connectors.map((connector) => {
                  const isActive = connector.isActive === "true";

                  return (
                    <Card
                      key={connector.id}
                      className={`p-6 ${!isActive ? "opacity-60" : ""}`}
                      data-testid={`card-connector-${connector.id}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <h3 className="font-semibold text-lg truncate" data-testid={`text-connector-name-${connector.id}`}>
                                {connector.name}
                              </h3>
                            </div>
                            {connector.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {connector.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleConnector(connector.id, connector.isActive)}
                            data-testid={`button-toggle-connector-${connector.id}`}
                          >
                            {isActive ? (
                              <Power className="h-4 w-4 text-green-500" />
                            ) : (
                              <PowerOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Server URL</p>
                            <p className="text-sm font-mono truncate">{connector.serverUrl}</p>
                          </div>
                          {connector.apiKey && (
                            <div>
                              <p className="text-xs text-muted-foreground">API Key</p>
                              <p className="text-sm font-mono">••••••••</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditConnector(connector)}
                            disabled={!isActive}
                            className="flex-1 gap-2"
                            data-testid={`button-edit-connector-${connector.id}`}
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteConnectorMutation.mutate(connector.id)}
                            className="flex-1 gap-2"
                            data-testid={`button-delete-connector-${connector.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
