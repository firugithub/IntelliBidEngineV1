import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import PortfolioPage from "@/pages/PortfolioPage";
import NewProjectPage from "@/pages/NewProjectPage";
import UploadPage from "@/pages/UploadPage";
import DashboardPage from "@/pages/DashboardPage";
import StandardsPage from "@/pages/StandardsPage";
import AdminConfigPage from "@/pages/AdminConfigPage";
import DeepDivePage from "@/pages/DeepDivePage";
import { Sparkles, Database, Trash2, Settings, Home } from "lucide-react";
import { Link } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/admin-config" component={AdminConfigPage} />
      <Route path="/standards" component={StandardsPage} />
      <Route path="/portfolio/:id" component={PortfolioPage} />
      <Route path="/portfolio/:id/new-project" component={NewProjectPage} />
      <Route path="/portfolio/:id/upload" component={UploadPage} />
      <Route path="/dashboard/:id" component={DashboardPage} />
      <Route path="/project/:id" component={DashboardPage} />
      <Route path="/evaluation/:id/deep-dive" component={DeepDivePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function DataManagementButtons() {
  const { toast } = useToast();
  const [isWipeDialogOpen, setIsWipeDialogOpen] = useState(false);

  const generateMockDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/generate-mock-data");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries();
      toast({ title: "Mock data generated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to generate mock data", variant: "destructive" });
    },
  });

  const wipeDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/wipe-data");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries();
      setIsWipeDialogOpen(false);
      toast({ title: "All data wiped successfully" });
    },
    onError: () => {
      toast({ title: "Failed to wipe data", variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => generateMockDataMutation.mutate()}
        disabled={generateMockDataMutation.isPending}
        className="gap-2"
        data-testid="button-generate-mock-data"
      >
        <Database className="h-4 w-4" />
        {generateMockDataMutation.isPending ? "Generating..." : "Generate Mock Data"}
      </Button>

      <AlertDialog open={isWipeDialogOpen} onOpenChange={setIsWipeDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 hover:bg-destructive/10 hover:text-destructive"
            data-testid="button-wipe-data"
          >
            <Trash2 className="h-4 w-4" />
            Wipe All Data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all portfolios, projects, proposals, evaluations, standards, and MCP connectors. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => wipeDataMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={wipeDataMutation.isPending}
            >
              {wipeDataMutation.isPending ? "Wiping..." : "Yes, Wipe All Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <div className="relative min-h-screen">
            <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-card-border">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">IntelliBid</span>
              </div>
              <Link href="/">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="button-home"
                >
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <Link href="/admin-config">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="button-admin-config"
                >
                  <Settings className="h-4 w-4" />
                  Admin Config
                </Button>
              </Link>
              <DataManagementButtons />
              <ThemeToggle />
            </div>
            <Router />
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
