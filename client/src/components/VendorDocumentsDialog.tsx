import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface VendorDocument {
  id: string;
  documentType: string;
  fileName: string;
  blobUrl?: string | null;
  createdAt: Date | string;
}

interface VendorDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorName: string;
  documents: VendorDocument[];
}

export function VendorDocumentsDialog({
  open,
  onOpenChange,
  vendorName,
  documents,
}: VendorDocumentsDialogProps) {
  const handleDownload = (doc: VendorDocument) => {
    if (doc.blobUrl) {
      window.open(doc.blobUrl, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-vendor-documents">
        <DialogHeader>
          <DialogTitle className="text-xl">{vendorName} - Detailed Evaluation</DialogTitle>
          <DialogDescription>
            View and download all submitted documents and questionnaire responses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No documents available for this vendor
                </p>
              </CardContent>
            </Card>
          ) : (
            documents.map((doc) => (
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
                          Uploaded: {format(new Date(doc.createdAt), "MMM d, yyyy h:mm a")}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
