import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, Edit, X, FileText, Users, FileCheck, Download, Archive, Upload, Image } from "lucide-react";
import { useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { marked } from "marked";

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
  const [, setLocation] = useLocation();
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [selectedStakeholder, setSelectedStakeholder] = useState<string>("all");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPackStatusRef = useRef<string | null>(null);

  // Fetch all drafts
  const { data: drafts = [], isLoading: isLoadingDrafts } = useQuery<RftDraft[]>({
    queryKey: ["/api/rft/drafts"]
  });

  // Fetch selected draft details
  const { data: selectedDraft, isLoading: isLoadingDraft, refetch: refetchDraft } = useQuery<RftDraft>({
    queryKey: [`/api/rft/drafts/${selectedDraftId}`],
    enabled: !!selectedDraftId
  });

  // Set first draft as selected by default
  useEffect(() => {
    if (drafts.length > 0 && !selectedDraftId) {
      setSelectedDraftId(drafts[0].id);
    }
  }, [drafts, selectedDraftId]);

  // Auto-refresh polling when pack is generating
  useEffect(() => {
    // Reset status ref when switching drafts or when pack is not available
    if (!selectedDraft || !selectedDraft.metadata?.pack) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      lastPackStatusRef.current = null;
      return;
    }
    
    const packStatus = selectedDraft.metadata.pack.status;
    
    // Only react to actual status changes (not every render)
    if (packStatus === lastPackStatusRef.current) {
      return;
    }
    
    lastPackStatusRef.current = packStatus;
    
    // If pack is complete or errored, stop polling
    if (packStatus !== "pending" && packStatus !== "generating") {
      if (pollingIntervalRef.current) {
        console.log("[Auto-refresh] Pack complete, stopping polling");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }
    
    // Start polling (only runs once when status changes to generating/pending)
    if (!pollingIntervalRef.current) {
      console.log("[Auto-refresh] Starting polling for pack generation...");
      
      pollingIntervalRef.current = setInterval(async () => {
        console.log("[Auto-refresh] Polling draft status...");
        try {
          await refetchDraft();
        } catch (error) {
          console.error("[Auto-refresh] Refetch failed:", error);
          toast({
            variant: "destructive",
            title: "Failed to refresh pack status",
            description: "Will retry automatically..."
          });
        }
      }, 5000); // Poll every 5 seconds
    }
    
    // Cleanup: reset status ref to allow fresh polling on next draft
    return () => {
      if (pollingIntervalRef.current) {
        console.log("[Auto-refresh] Cleanup: stopping polling");
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      lastPackStatusRef.current = null;
    };
  }, [selectedDraft?.metadata?.pack?.status, selectedDraftId, refetchDraft, toast]);

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

  // Publish draft to portfolio mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/drafts/${selectedDraftId}/publish`, {});
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "RFT Published Successfully!",
        description: "Your RFT is now available in the Portfolio RFT Tab"
      });
      // Invalidate portfolio queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      
      // Redirect to portfolio page if portfolioId is provided
      if (data.portfolioId) {
        setLocation(`/portfolio/${data.portfolioId}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Publish RFT",
        description: error.message || "Please ensure the RFT pack is completed first",
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

      {/* RFT Pack Downloads */}
      {selectedDraft && selectedDraft.metadata?.pack && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                RFT Pack Downloads
              </div>
              <Badge variant={selectedDraft.metadata.pack.status === "completed" ? "default" : "secondary"}>
                {selectedDraft.metadata.pack.status || "generating"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(selectedDraft.metadata.pack.status === "generating" || selectedDraft.metadata.pack.status === "pending") && (
              <div className="space-y-4 p-4">
                <div className="text-center text-muted-foreground">
                  <div className="font-medium mb-2">Generating RFT Pack...</div>
                  <div className="text-sm">Creating DOCX, PDF, and 4 Excel questionnaires</div>
                </div>
                <Progress value={selectedDraft.metadata.pack.progress || 33} className="h-2" />
                <div className="text-xs text-center text-muted-foreground">
                  This usually takes 30-60 seconds. The page will auto-refresh when complete.
                </div>
              </div>
            )}
            
            {selectedDraft.metadata.pack.status === "completed" && selectedDraft.metadata.pack.files && (
              <>
                {/* Download All Button */}
                <Button
                  className="w-full"
                  onClick={() => window.open(`/api/drafts/${selectedDraftId}/pack/download-all`, '_blank')}
                  data-testid="button-download-all"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Download All as ZIP
                </Button>
                
                {/* Publish to Portfolio Button */}
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  data-testid="button-publish-to-portfolio"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {publishMutation.isPending ? "Publishing..." : "Publish to Portfolio"}
                </Button>
                
                <Separator className="my-4" />
                
                <div className="text-sm text-muted-foreground mb-2">Or download individual files:</div>
                {/* DOCX Document */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.docx.url, '_blank')}
                  data-testid="button-download-docx"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  RFT Document (DOCX)
                </Button>

                {/* PDF Document */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.pdf.url, '_blank')}
                  data-testid="button-download-pdf"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  RFT Document (PDF)
                </Button>

                {/* Product Technical Questionnaire (if available) */}
                {selectedDraft.metadata.pack.files.productTechnical && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => window.open(selectedDraft.metadata.pack.files.productTechnical.url, '_blank')}
                    data-testid="button-download-product-technical"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Product Technical Questionnaire (DOCX)
                  </Button>
                )}

                {/* Context Architecture Diagram (if available) */}
                {selectedDraft.metadata.pack.files.contextDiagram && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => window.open(selectedDraft.metadata.pack.files.contextDiagram.url, '_blank')}
                    data-testid="button-download-context-diagram"
                  >
                    <Image className="h-4 w-4 mr-2" />
                    Context Architecture Diagram (PNG)
                  </Button>
                )}

                {/* Product Questionnaire */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.questionnaires.product.url, '_blank')}
                  data-testid="button-download-product"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Product Questionnaire (XLSX)
                </Button>

                {/* NFR Questionnaire */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.questionnaires.nfr.url, '_blank')}
                  data-testid="button-download-nfr"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  NFR Questionnaire (XLSX)
                </Button>

                {/* Cybersecurity Questionnaire */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.questionnaires.cybersecurity.url, '_blank')}
                  data-testid="button-download-cybersecurity"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Cybersecurity Questionnaire (XLSX)
                </Button>

                {/* Agile Questionnaire */}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.open(selectedDraft.metadata.pack.files.questionnaires.agile.url, '_blank')}
                  data-testid="button-download-agile"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Agile Questionnaire (XLSX)
                </Button>
              </>
            )}
            
            {selectedDraft.metadata.pack.status === "error" && (
              <div className="p-4 space-y-2">
                <div className="text-destructive font-medium">Error Generating RFT Pack</div>
                {selectedDraft.metadata.pack.error && (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedDraft.metadata.pack.error}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Please check the template for syntax errors or try using AI generation mode instead.
                </div>
              </div>
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
                    <div 
                      className="prose dark:prose-invert max-w-none text-sm prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-border prose-td:p-2"
                      dangerouslySetInnerHTML={{ __html: marked(section.content || '') }}
                    />
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
