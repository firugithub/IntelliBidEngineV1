import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings, AlertCircle, CheckCircle2, XCircle, Trash2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminConfigPage() {
  const { toast } = useToast();

  const testConnectivityMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/test-azure-connectivity", {});
    },
    onSuccess: (data: any) => {
      console.log("Azure connectivity test results:", data);
      if (data.success) {
        toast({
          title: "Success!",
          description: data.message,
        });
      } else if (data.partialSuccess) {
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: data.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: data.message,
        });
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: "Failed to test Azure connectivity. Please try again.",
      });
      console.error("Test error:", error);
    },
  });

  const wipeDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/wipe-data", {});
    },
    onSuccess: (data: any) => {
      console.log("Wipe data results:", data);
      const dbTotal = Object.values(data.summary?.database || {}).reduce((a, b) => (a as number) + (b as number), 0);
      toast({
        title: "Data Wiped Successfully",
        description: `Deleted all application data and Azure resources. Database: ${dbTotal} items. Azure: ${data.summary?.azure?.blobDocuments || 0} blobs, ${data.summary?.azure?.searchDocuments || 0} search docs.`,
      });
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Wipe Failed",
        description: "Failed to wipe data. Please try again.",
      });
      console.error("Wipe error:", error);
    },
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Admin Configuration</h1>
        </div>
        <p className="text-muted-foreground">
          Manage Azure connectivity and application data
        </p>
      </div>

      <Alert className="mb-6 border-blue-500/50 bg-blue-500/10" data-testid="alert-config-info">
        <Info className="w-4 h-4 text-blue-500" />
        <AlertDescription className="text-foreground">
          <strong>Configuration is now managed through Replit Secrets only.</strong>
          <br />
          Database configuration has been removed for security and simplicity. All Azure credentials and API keys must be set in Replit Secrets:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_OPENAI_ENDPOINT</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_OPENAI_KEY</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_OPENAI_DEPLOYMENT</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_OPENAI_EMBEDDING_DEPLOYMENT</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_OPENAI_API_VERSION</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_SEARCH_ENDPOINT</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_SEARCH_KEY</code></li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">AZURE_STORAGE_CONNECTION_STRING</code></li>
          </ul>
          <p className="mt-2 text-sm">
            To access Replit Secrets: Click <strong>Tools</strong> → <strong>Secrets</strong> in the left sidebar, or use the search bar and type "Secrets".
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Azure Connectivity Test</CardTitle>
            <CardDescription>
              Verify that all Azure services are properly configured and accessible with your current environment variables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => testConnectivityMutation.mutate()}
              disabled={testConnectivityMutation.isPending}
              data-testid="button-test-azure-connectivity"
              className="w-full"
            >
              {testConnectivityMutation.isPending ? (
                <>Testing Connectivity...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Test Azure Connectivity
                </>
              )}
            </Button>
            {testConnectivityMutation.data && (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold">Test Results:</div>
                {testConnectivityMutation.data.results && (
                  <div className="space-y-2">
                    <ConnectivityResult
                      name="Azure OpenAI (Embeddings)"
                      result={testConnectivityMutation.data.results.azureOpenAI}
                    />
                    <ConnectivityResult
                      name="Azure AI Search"
                      result={testConnectivityMutation.data.results.azureSearch}
                    />
                    <ConnectivityResult
                      name="Azure Blob Storage"
                      result={testConnectivityMutation.data.results.azureStorage}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete all application data and Azure resources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  data-testid="button-wipe-data"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Wipe All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All portfolios, projects, RFTs, and proposals</li>
                      <li>All vendor evaluations and shortlisting data</li>
                      <li>All documents from Azure Blob Storage</li>
                      <li>All indexed documents from Azure AI Search</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-wipe">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => wipeDataMutation.mutate()}
                    disabled={wipeDataMutation.isPending}
                    data-testid="button-confirm-wipe"
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {wipeDataMutation.isPending ? "Wiping..." : "Yes, wipe everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectivityResult({ name, result }: { name: string; result: any }) {
  const isConfigured = result?.configured !== false;
  const isWorking = result?.working === true;

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
      <div className="mt-0.5">
        {isWorking ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{name}</div>
        {!isConfigured && (
          <div className="text-xs text-muted-foreground mt-1">
            Not configured - please set environment variables in Replit Secrets
          </div>
        )}
        {isConfigured && !isWorking && result.error && (
          <div className="text-xs text-destructive mt-1">
            Error: {result.error}
          </div>
        )}
        {isWorking && result.details && (
          <div className="text-xs text-muted-foreground mt-1">
            {result.details.embeddingDimensions && `Dimensions: ${result.details.embeddingDimensions}`}
            {result.details.documentCount !== undefined && `Documents: ${result.details.documentCount}`}
            {result.details.indexName && `Index: ${result.details.indexName}`}
          </div>
        )}
      </div>
    </div>
  );
}
