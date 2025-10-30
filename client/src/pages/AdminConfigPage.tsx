import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, Cloud, Brain, Save, AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SystemConfig {
  id: string;
  category: string;
  key: string;
  value: string | null;
  isEncrypted: string;
  description: string | null;
}

export default function AdminConfigPage() {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});

  const { data: configs = [], isLoading } = useQuery<SystemConfig[]>({
    queryKey: ["/api/system-config"],
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { category: string; key: string; value: string; isEncrypted?: string; description?: string }) => {
      return apiRequest("POST", "/api/system-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
      toast({
        title: "Configuration saved",
        description: "Your configuration has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save configuration. Please try again.",
      });
      console.error("Save error:", error);
    },
  });

  const testConnectivityMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test-azure-connectivity", {});
    },
    onSuccess: (data: any) => {
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
      console.log("Azure connectivity test results:", data);
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

  const getConfigValue = (key: string): string => {
    if (localConfig[key] !== undefined) {
      return localConfig[key];
    }
    const config = configs.find(c => c.key === key);
    return config?.value || "";
  };

  const setConfigValue = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveConfig = (category: string, key: string, isEncrypted: boolean, description?: string) => {
    const value = localConfig[key];
    if (!value) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a value before saving.",
      });
      return;
    }

    saveConfigMutation.mutate({
      category,
      key,
      value,
      isEncrypted: isEncrypted ? "true" : "false",
      description,
    });
  };

  const saveAllAzureSearch = () => {
    const configs = [
      { key: "AZURE_SEARCH_ENDPOINT", category: "azure_search", isEncrypted: false, description: "Azure AI Search service endpoint" },
      { key: "AZURE_SEARCH_KEY", category: "azure_search", isEncrypted: true, description: "Azure AI Search admin API key" },
    ];

    configs.forEach(config => {
      const value = localConfig[config.key];
      if (value) {
        saveConfigMutation.mutate({
          category: config.category,
          key: config.key,
          value,
          isEncrypted: config.isEncrypted ? "true" : "false",
          description: config.description,
        });
      }
    });
  };

  const saveAllAzureStorage = () => {
    const value = localConfig["AZURE_STORAGE_CONNECTION_STRING"];
    if (value) {
      saveConfigMutation.mutate({
        category: "azure_storage",
        key: "AZURE_STORAGE_CONNECTION_STRING",
        value,
        isEncrypted: "true",
        description: "Azure Blob Storage connection string",
      });
    }
  };

  const saveAllAzureOpenAI = () => {
    const configs = [
      { key: "AZURE_OPENAI_ENDPOINT", category: "azure_openai", isEncrypted: false, description: "Azure OpenAI service endpoint" },
      { key: "AZURE_OPENAI_KEY", category: "azure_openai", isEncrypted: true, description: "Azure OpenAI API key" },
      { key: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT", category: "azure_openai", isEncrypted: false, description: "Embedding model deployment name" },
    ];

    configs.forEach(config => {
      const value = localConfig[config.key];
      if (value) {
        saveConfigMutation.mutate({
          category: config.category,
          key: config.key,
          value,
          isEncrypted: config.isEncrypted ? "true" : "false",
          description: config.description,
        });
      }
    });
  };

  const saveAllAgentsOpenAI = () => {
    const configs = [
      { key: "AGENTS_OPENAI_ENDPOINT", category: "agents_openai", isEncrypted: false, description: "OpenAI endpoint for multi-agent evaluation" },
      { key: "AGENTS_OPENAI_API_KEY", category: "agents_openai", isEncrypted: true, description: "OpenAI API key for multi-agent evaluation" },
    ];

    configs.forEach(config => {
      const value = localConfig[config.key];
      if (value) {
        saveConfigMutation.mutate({
          category: config.category,
          key: config.key,
          value,
          isEncrypted: config.isEncrypted ? "true" : "false",
          description: config.description,
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-6 h-6" />
          <h1 className="text-3xl font-bold">Admin Configuration</h1>
        </div>
        <p className="text-muted-foreground">
          Configure Azure services and RAG system settings
        </p>
      </div>

      <Alert className="mb-6" data-testid="alert-security-notice">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          Encrypted credentials are securely stored and never displayed in full. Changes take effect immediately after saving.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="agents-openai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="agents-openai" data-testid="tab-agents-openai">
            <Users className="w-4 h-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="azure-search" data-testid="tab-azure-search">
            <Database className="w-4 h-4 mr-2" />
            AI Search
          </TabsTrigger>
          <TabsTrigger value="azure-storage" data-testid="tab-azure-storage">
            <Cloud className="w-4 h-4 mr-2" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="azure-openai" data-testid="tab-azure-openai">
            <Brain className="w-4 h-4 mr-2" />
            Azure OpenAI
          </TabsTrigger>
          <TabsTrigger value="rag-settings" data-testid="tab-rag-settings">
            <Settings className="w-4 h-4 mr-2" />
            RAG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents-openai">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Configuration for Multi-Agent Evaluation</CardTitle>
              <CardDescription>
                Configure OpenAI endpoint and API key for the 6 specialized agents (Delivery, Product, Architecture, Engineering, Procurement, Security)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agents-openai-endpoint">OpenAI Endpoint</Label>
                <Input
                  id="agents-openai-endpoint"
                  data-testid="input-agents-openai-endpoint"
                  placeholder="https://api.openai.com/v1"
                  value={getConfigValue("AGENTS_OPENAI_ENDPOINT")}
                  onChange={(e) => setConfigValue("AGENTS_OPENAI_ENDPOINT", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  OpenAI API endpoint (default: https://api.openai.com/v1)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agents-openai-key">OpenAI API Key</Label>
                <Input
                  id="agents-openai-key"
                  data-testid="input-agents-openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={getConfigValue("AGENTS_OPENAI_API_KEY")}
                  onChange={(e) => setConfigValue("AGENTS_OPENAI_API_KEY", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Your OpenAI API key from platform.openai.com
                </p>
              </div>

              <Alert data-testid="alert-agents-info">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  The 6 agents use GPT-4o for evaluation. If not configured, the system will fall back to environment variables.
                </AlertDescription>
              </Alert>

              <Button
                onClick={saveAllAgentsOpenAI}
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-agents-openai"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Agents OpenAI Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="azure-search">
          <Card>
            <CardHeader>
              <CardTitle>Azure AI Search Configuration</CardTitle>
              <CardDescription>
                Configure your Azure AI Search service for vector database and hybrid search
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="azure-search-endpoint">Search Endpoint</Label>
                <Input
                  id="azure-search-endpoint"
                  data-testid="input-azure-search-endpoint"
                  placeholder="https://your-service.search.windows.net"
                  value={getConfigValue("AZURE_SEARCH_ENDPOINT")}
                  onChange={(e) => setConfigValue("AZURE_SEARCH_ENDPOINT", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Found in Azure Portal → AI Search → Overview
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="azure-search-key">Admin API Key</Label>
                <Input
                  id="azure-search-key"
                  data-testid="input-azure-search-key"
                  type="password"
                  placeholder="Enter your admin API key"
                  value={getConfigValue("AZURE_SEARCH_KEY")}
                  onChange={(e) => setConfigValue("AZURE_SEARCH_KEY", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Found in Azure Portal → AI Search → Keys
                </p>
              </div>

              <Button
                onClick={saveAllAzureSearch}
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-azure-search"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Azure AI Search Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="azure-storage">
          <Card>
            <CardHeader>
              <CardTitle>Azure Blob Storage Configuration</CardTitle>
              <CardDescription>
                Configure Azure Blob Storage for document storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="azure-storage-connection">Connection String</Label>
                <Input
                  id="azure-storage-connection"
                  data-testid="input-azure-storage-connection"
                  type="password"
                  placeholder="DefaultEndpointsProtocol=https;AccountName=..."
                  value={getConfigValue("AZURE_STORAGE_CONNECTION_STRING")}
                  onChange={(e) => setConfigValue("AZURE_STORAGE_CONNECTION_STRING", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Found in Azure Portal → Storage Account → Access keys
                </p>
              </div>

              <Button
                onClick={saveAllAzureStorage}
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-azure-storage"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Azure Storage Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="azure-openai">
          <Card>
            <CardHeader>
              <CardTitle>Azure OpenAI Configuration</CardTitle>
              <CardDescription>
                Configure Azure OpenAI for embeddings generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="azure-openai-endpoint">OpenAI Endpoint</Label>
                <Input
                  id="azure-openai-endpoint"
                  data-testid="input-azure-openai-endpoint"
                  placeholder="https://your-openai.openai.azure.com"
                  value={getConfigValue("AZURE_OPENAI_ENDPOINT")}
                  onChange={(e) => setConfigValue("AZURE_OPENAI_ENDPOINT", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Found in Azure Portal → Azure OpenAI → Overview
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="azure-openai-key">API Key</Label>
                <Input
                  id="azure-openai-key"
                  data-testid="input-azure-openai-key"
                  type="password"
                  placeholder="Enter your API key"
                  value={getConfigValue("AZURE_OPENAI_KEY")}
                  onChange={(e) => setConfigValue("AZURE_OPENAI_KEY", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Found in Azure Portal → Azure OpenAI → Keys and Endpoint
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="azure-openai-deployment">Embedding Deployment Name</Label>
                <Input
                  id="azure-openai-deployment"
                  data-testid="input-azure-openai-deployment"
                  placeholder="text-embedding-ada-002"
                  value={getConfigValue("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")}
                  onChange={(e) => setConfigValue("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  The deployment name you created for your embedding model
                </p>
              </div>

              <Button
                onClick={saveAllAzureOpenAI}
                disabled={saveConfigMutation.isPending}
                data-testid="button-save-azure-openai"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Azure OpenAI Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rag-settings">
          <Card>
            <CardHeader>
              <CardTitle>RAG System Settings</CardTitle>
              <CardDescription>
                Configure RAG system behavior and performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert data-testid="alert-rag-coming-soon">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  RAG settings configuration coming soon. Additional settings for chunk size, overlap, retrieval count, and re-ranking will be available here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Test Azure Connectivity</CardTitle>
          <CardDescription>
            Verify that Azure OpenAI and Azure AI Search are configured correctly and accessible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => testConnectivityMutation.mutate()}
            disabled={testConnectivityMutation.isPending}
            data-testid="button-test-connectivity"
            className="w-full"
          >
            {testConnectivityMutation.isPending ? "Testing..." : "Test Azure Connectivity"}
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            This will test both Azure OpenAI embeddings and Azure AI Search services. Check the console for detailed results.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
