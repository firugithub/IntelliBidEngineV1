import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Edit, X, FileText, Users, FileCheck, Download } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface DraftSection {
  sectionId: string;
  sectionTitle: string;
  content: string;
  assignedTo: string;
  category: string;
  reviewStatus: "pending" | "in_review" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  comments?: string;
}

interface RftDraft {
  id: string;
  projectId: string;
  businessCaseId: string;
  templateId: string | null;
  generationMode: "ai_generation" | "template_merge";
  generatedSections: DraftSection[];
  status: "draft" | "in_review" | "approved" | "finalized";
  approvalProgress: {
    totalSections: number;
    approvedSections: number;
    pendingSections: number;
  };
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

const STAKEHOLDER_ROLES = [
  { id: "all", name: "All Stakeholders", color: "#6B7280" },
  { id: "technical_pm", name: "Technical PM", color: "#3B82F6" },
  { id: "solution_architect", name: "Solution Architect", color: "#8B5CF6" },
  { id: "cybersecurity_analyst", name: "Cybersecurity Analyst", color: "#EF4444" },
  { id: "engineering_lead", name: "Engineering Lead", color: "#10B981" },
  { id: "procurement_specialist", name: "Procurement Specialist", color: "#F59E0B" },
  { id: "product_owner", name: "Product Owner", color: "#EC4899" },
  { id: "compliance_officer", name: "Compliance Officer", color: "#6366F1" }
];

export default function RftDraftReviewPage() {
  const { toast } = useToast();
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [selectedStakeholder, setSelectedStakeholder] = useState<string>("all");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [finalizationError, setFinalizationError] = useState<string | null>(null);

  // Fetch all drafts
  const { data: drafts = [], isLoading: isLoadingDrafts } = useQuery<RftDraft[]>({
    queryKey: ["/api/rft/drafts"]
  });

  // Fetch selected draft details
  const { data: selectedDraft, isLoading: isLoadingDraft } = useQuery<RftDraft>({
    queryKey: [`/api/rft/drafts/${selectedDraftId}`],
    enabled: !!selectedDraftId
  });

  // Set first draft as selected by default
  useEffect(() => {
    if (drafts.length > 0 && !selectedDraftId) {
      setSelectedDraftId(drafts[0].id);
    }
  }, [drafts, selectedDraftId]);

  // Filter sections by stakeholder
  const filteredSections = selectedDraft?.generatedSections.filter(section => {
    if (selectedStakeholder === "all") return true;
    // Match the selected role ID to the section's assignedTo (which contains role ID)
    return section.assignedTo === selectedStakeholder;
  }) || [];

  // Update section content mutation
  const updateSectionMutation = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: string }) => {
      return await apiRequest("PATCH", `/api/rft/drafts/${selectedDraftId}/sections/${sectionId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rft/drafts/${selectedDraftId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rft/drafts"] });
      toast({ title: "Section updated successfully" });
      setEditingSectionId(null);
      setEditedContent("");
    },
    onError: () => {
      toast({ title: "Failed to update section", variant: "destructive" });
    }
  });


  // Finalize draft mutation
  const finalizeDraftMutation = useMutation({
    mutationFn: async () => {
      setFinalizationError(null); // Clear previous errors
      return await apiRequest("POST", `/api/rft/drafts/${selectedDraftId}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rft/drafts/${selectedDraftId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/rft/drafts"] });
      setFinalizationError(null);
      toast({ title: "Draft finalized successfully", description: "The RFT document has been generated." });
    },
    onError: (error: any) => {
      let errorMessage = "An error occurred while finalizing the draft.";
      let errorHint = "Please check that the template is accessible.";
      
      if (error.message) {
        try {
          const match = error.message.match(/^\d+:\s*(.+)$/);
          if (match) {
            const jsonPart = match[1];
            const parsed = JSON.parse(jsonPart);
            if (parsed.error) {
              errorMessage = parsed.error;
            }
            if (parsed.hint) {
              errorHint = parsed.hint;
            }
          }
        } catch (e) {
          errorMessage = error.message;
        }
      }
      
      // Set inline error for display
      setFinalizationError(`${errorMessage}\n\n${errorHint}`);
      
      toast({ 
        title: "Failed to finalize draft", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  });

  const handleEditSection = (section: DraftSection) => {
    setEditingSectionId(section.sectionId);
    setEditedContent(section.content);
  };

  const handleSaveSection = () => {
    if (!editingSectionId) return;
    updateSectionMutation.mutate({ sectionId: editingSectionId, content: editedContent });
  };



  const getRoleColor = (assignedTo: string) => {
    const role = STAKEHOLDER_ROLES.find(r => r.id === assignedTo);
    return role?.color || "#6B7280";
  };

  const getRoleName = (assignedTo: string) => {
    const role = STAKEHOLDER_ROLES.find(r => r.id === assignedTo);
    return role?.name || assignedTo;
  };

  if (isLoadingDrafts) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg">Loading drafts...</div>
        </div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Drafts Found</CardTitle>
            <CardDescription>
              Create an RFT draft from the Smart RFT Builder to start collaborative review.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
          RFT Draft Review
        </h1>
        <p className="text-muted-foreground">
          Collaborative review workflow with stakeholder-based section assignments
        </p>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Draft Selection & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Draft Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Draft</label>
              <Select value={selectedDraftId} onValueChange={setSelectedDraftId}>
                <SelectTrigger data-testid="select-draft">
                  <SelectValue placeholder="Select a draft" />
                </SelectTrigger>
                <SelectContent>
                  {drafts.map((draft) => (
                    <SelectItem key={draft.id} value={draft.id}>
                      Draft {draft.id.slice(0, 8)} - {draft.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stakeholder Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Stakeholder</label>
              <Select value={selectedStakeholder} onValueChange={setSelectedStakeholder}>
                <SelectTrigger data-testid="select-stakeholder-filter">
                  <SelectValue placeholder="Select stakeholder" />
                </SelectTrigger>
                <SelectContent>
                  {STAKEHOLDER_ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft Actions */}
      {selectedDraft && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Draft Actions
              </div>
              <Badge variant={selectedDraft.status === "finalized" ? "default" : "secondary"}>
                {selectedDraft.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Download Merged Document Button */}
            {selectedDraft.generationMode === "template_merge" && selectedDraft.metadata?.mergedDocumentUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const url = selectedDraft.metadata.mergedDocumentUrl;
                  window.open(url, '_blank');
                }}
                data-testid="button-download-merged-document"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Merged DOCX
                {selectedDraft.metadata?.templateName && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({selectedDraft.metadata.templateName})
                  </span>
                )}
              </Button>
            )}

            {selectedDraft.status !== "finalized" && (
              <Button
                onClick={() => finalizeDraftMutation.mutate()}
                disabled={finalizeDraftMutation.isPending}
                className="w-full"
                data-testid="button-finalize-draft"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                {finalizeDraftMutation.isPending ? "Finalizing..." : "Finalize Draft"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sections List */}
      {isLoadingDraft ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="text-lg">Loading sections...</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Sections ({filteredSections.length})
            </h2>
          </div>

          {filteredSections.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No sections found for the selected stakeholder filter
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSections.map((section) => (
                <Card 
                  key={section.sectionId} 
                  data-testid={`card-section-${section.sectionId}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <CardTitle>{section.sectionTitle}</CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: getRoleColor(section.assignedTo),
                              color: getRoleColor(section.assignedTo)
                            }}
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {getRoleName(section.assignedTo)}
                          </Badge>
                          {section.category && (
                            <Badge variant="secondary">{section.category}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditSection(section)}
                          data-testid={`button-edit-${section.sectionId}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Section Dialog */}
      <Dialog open={editingSectionId !== null} onOpenChange={(open) => !open && setEditingSectionId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Section Content</DialogTitle>
            <DialogDescription>
              Make changes to the section content below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={15}
              className="font-mono text-sm"
              data-testid="textarea-edit-content"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingSectionId(null)}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveSection}
              disabled={updateSectionMutation.isPending}
              data-testid="button-save-edit"
            >
              <Check className="h-4 w-4 mr-2" />
              {updateSectionMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
