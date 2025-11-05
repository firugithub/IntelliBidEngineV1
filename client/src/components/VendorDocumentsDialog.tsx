import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FileText, Download, ExternalLink, Save, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VendorDocument {
  id: string;
  documentType: string;
  fileName: string;
  blobUrl?: string | null;
  createdAt: Date | string;
}

interface QuestionnaireQuestion {
  section: string;
  question: string;
  complianceScore: string;
  remarks: string;
}

interface VendorDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  documents: VendorDocument[];
  roleFilter?: 'delivery' | 'product' | 'architecture' | 'engineering' | 'security' | 'procurement';
}

const COMPLIANCE_SCORES = ["Full", "Partial", "Not Applicable", "None"];

// Role to questionnaire type mapping
const ROLE_TO_QUESTIONNAIRE_MAP: Record<string, string> = {
  delivery: 'Agile',
  product: 'Product',
  architecture: 'NFR',
  security: 'Cybersecurity',
  engineering: 'NFR', // Engineering also uses NFR questionnaires
  procurement: 'Product', // Procurement uses Product questionnaires
};

export function VendorDocumentsDialog({
  open,
  onOpenChange,
  vendorName,
  documents,
  roleFilter,
}: VendorDocumentsDialogProps) {
  const { toast } = useToast();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<QuestionnaireQuestion[]>([]);

  // Filter Excel documents based on role
  const filterDocumentsByRole = (docs: VendorDocument[]) => {
    if (!roleFilter) return docs;
    
    const questionnaireType = ROLE_TO_QUESTIONNAIRE_MAP[roleFilter];
    if (!questionnaireType) return docs;
    
    return docs.filter(doc => {
      const fileName = doc.fileName.toLowerCase();
      return fileName.includes(questionnaireType.toLowerCase()) && fileName.endsWith('.xlsx');
    });
  };

  const allExcelDocuments = documents.filter(doc => doc.fileName.toLowerCase().endsWith('.xlsx'));
  const excelDocuments = roleFilter ? filterDocumentsByRole(allExcelDocuments) : allExcelDocuments;
  const otherDocuments = documents.filter(doc => !doc.fileName.toLowerCase().endsWith('.xlsx'));

  const selectedDocument = excelDocuments.find(doc => doc.id === selectedDocumentId);

  const { data: questionnaireData, isLoading } = useQuery({
    queryKey: ['/api/proposals', selectedDocumentId, 'parse-excel'],
    enabled: !!selectedDocumentId,
  });

  const saveMutation = useMutation({
    mutationFn: async (questions: QuestionnaireQuestion[]) => {
      const response = await fetch(`/api/proposals/${selectedDocumentId}/save-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save questionnaire');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Questionnaire updated successfully",
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/proposals', selectedDocumentId, 'parse-excel'] 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save questionnaire",
        variant: "destructive",
      });
    },
  });

  const handleDocumentClick = (docId: string) => {
    setSelectedDocumentId(docId);
    setEditedQuestions([]);
  };

  const handleScoreChange = (index: number, newScore: string) => {
    const questions = (questionnaireData as any)?.questions || [];
    const updated = [...(editedQuestions.length > 0 ? editedQuestions : questions)];
    updated[index] = { ...updated[index], complianceScore: newScore };
    setEditedQuestions(updated);
  };

  const handleRemarksChange = (index: number, newRemarks: string) => {
    const questions = (questionnaireData as any)?.questions || [];
    const updated = [...(editedQuestions.length > 0 ? editedQuestions : questions)];
    updated[index] = { ...updated[index], remarks: newRemarks };
    setEditedQuestions(updated);
  };

  const handleSave = () => {
    if (editedQuestions.length > 0) {
      saveMutation.mutate(editedQuestions);
    }
  };

  const handleDownload = (doc: VendorDocument) => {
    if (doc.blobUrl) {
      window.open(doc.blobUrl, "_blank");
    }
  };

  const displayQuestions = editedQuestions.length > 0 ? editedQuestions : ((questionnaireData as any)?.questions || []);
  const hasChanges = editedQuestions.length > 0;

  const getRoleLabel = () => {
    if (!roleFilter) return null;
    const questionnaireType = ROLE_TO_QUESTIONNAIRE_MAP[roleFilter];
    return questionnaireType ? `${questionnaireType} Questionnaire` : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" data-testid="dialog-vendor-documents">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-xl">{vendorName} - Detailed Evaluation</DialogTitle>
              <DialogDescription>
                View and edit submitted questionnaire responses
                {roleFilter && getRoleLabel() && (
                  <span className="ml-2 text-primary font-medium">
                    ({getRoleLabel()})
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="questionnaires" className="mt-4">
          <TabsList>
            <TabsTrigger value="questionnaires" data-testid="tab-questionnaires">
              Questionnaires ({excelDocuments.length})
            </TabsTrigger>
            <TabsTrigger value="other" data-testid="tab-other-documents">
              Other Documents ({otherDocuments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questionnaires" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Questionnaire</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {excelDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questionnaires available</p>
                  ) : (
                    excelDocuments.map((doc) => (
                      <Button
                        key={doc.id}
                        variant={selectedDocumentId === doc.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => handleDocumentClick(doc.id)}
                        data-testid={`button-select-questionnaire-${doc.id}`}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        <div className="text-left flex-1">
                          <div className="font-medium text-sm">{doc.documentType}</div>
                          <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                        </div>
                      </Button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-base">Questionnaire Details</CardTitle>
                  {selectedDocument && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(selectedDocument)}
                        data-testid="button-download-excel"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedDocument ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span className="font-medium">{selectedDocument.documentType}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">File:</span>{" "}
                        <span className="font-medium">{selectedDocument.fileName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Uploaded:</span>{" "}
                        <span className="font-medium">
                          {format(new Date(selectedDocument.createdAt), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      {questionnaireData && (questionnaireData as any)?.questions && (
                        <div>
                          <span className="text-muted-foreground">Questions:</span>{" "}
                          <span className="font-medium">{((questionnaireData as any)?.questions || []).length}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a questionnaire to view details</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedDocumentId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                  <CardTitle className="text-base">Compliance Responses</CardTitle>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || saveMutation.isPending}
                    data-testid="button-save-changes"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : displayQuestions.length > 0 ? (
                    <div className="border rounded-md max-h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="w-[150px]">Section</TableHead>
                            <TableHead className="w-[400px]">Question</TableHead>
                            <TableHead className="w-[180px]">Compliance Score</TableHead>
                            <TableHead>Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayQuestions.map((q: QuestionnaireQuestion, index: number) => (
                            <TableRow key={index} data-testid={`row-question-${index}`}>
                              <TableCell className="font-medium text-sm">{q.section}</TableCell>
                              <TableCell className="text-sm">{q.question}</TableCell>
                              <TableCell>
                                <Select
                                  value={q.complianceScore}
                                  onValueChange={(value) => handleScoreChange(index, value)}
                                >
                                  <SelectTrigger className="w-full" data-testid={`select-score-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COMPLIANCE_SCORES.map((score) => (
                                      <SelectItem key={score} value={score}>
                                        {score}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={q.remarks}
                                  onChange={(e) => handleRemarksChange(index, e.target.value)}
                                  placeholder="Enter remarks"
                                  className="w-full"
                                  data-testid={`input-remarks-${index}`}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No questions found in this questionnaire
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            {otherDocuments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No other documents available for this vendor
                  </p>
                </CardContent>
              </Card>
            ) : (
              otherDocuments.map((doc) => (
                <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="font-semibold text-sm" data-testid="text-document-type">
                            {doc.documentType}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid="text-file-name">
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded: {format(new Date(doc.createdAt), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {doc.blobUrl ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(doc)}
                              data-testid="button-download-document"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => window.open(doc.blobUrl!, "_blank")}
                              data-testid="button-view-document"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            No URL Available
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
