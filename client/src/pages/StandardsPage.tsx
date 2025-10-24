import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Standard } from "@shared/schema";

interface Section {
  id: string;
  name: string;
  description: string;
}

export default function StandardsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sections: [] as Section[],
  });

  const [newSection, setNewSection] = useState({
    name: "",
    description: "",
  });

  const { data: standards = [], isLoading } = useQuery<Standard[]>({
    queryKey: ["/api/standards"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; sections: Section[] }) => {
      return await apiRequest("POST", "/api/standards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standards"] });
      toast({ title: "Standard created successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create standard", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; description: string; sections: Section[] }> }) => {
      return await apiRequest("PATCH", `/api/standards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/standards"] });
      toast({ title: "Standard updated successfully" });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update standard", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
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

  const resetForm = () => {
    setFormData({ name: "", description: "", sections: [] });
    setNewSection({ name: "", description: "" });
    setEditingStandard(null);
  };

  const handleEdit = (standard: Standard) => {
    setEditingStandard(standard);
    setFormData({
      name: standard.name,
      description: standard.description || "",
      sections: (standard.sections as Section[]) || [],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "Please enter a standard name", variant: "destructive" });
      return;
    }

    if (formData.sections.length === 0) {
      toast({ title: "Please add at least one section", variant: "destructive" });
      return;
    }

    if (editingStandard) {
      updateMutation.mutate({
        id: editingStandard.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
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

    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, section],
    }));

    setNewSection({ name: "", description: "" });
  };

  const handleRemoveSection = (sectionId: string) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
    }));
  };

  const toggleExpanded = (standardId: string) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading standards...</p>
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
                Define organization standards for vendor evaluation and compliance
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
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
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Standard Name</label>
                    <Input
                      placeholder="e.g., IT Security Framework"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-standard-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      placeholder="Describe the purpose of this standard..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      data-testid="input-standard-description"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Compliance Sections</label>
                      <p className="text-xs text-muted-foreground">
                        {formData.sections.length} section{formData.sections.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {formData.sections.length > 0 && (
                      <div className="space-y-2">
                        {formData.sections.map((section) => (
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

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-standard"
                    >
                      {editingStandard ? "Update" : "Create"} Standard
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {standards.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                No standards defined yet. Create your first compliance standard to get started.
              </p>
              <Button
                onClick={() => setIsDialogOpen(true)}
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
                            onClick={() => toggleExpanded(standard.id)}
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
                            onClick={() => handleEdit(standard)}
                            data-testid={`button-edit-${standard.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(standard.id)}
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
      </div>
    </div>
  );
}
