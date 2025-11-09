import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import PortfolioPage from "@/pages/PortfolioPage";
import NewProjectPage from "@/pages/NewProjectPage";
import UploadPage from "@/pages/UploadPage";
import DashboardPage from "@/pages/DashboardPage";
import StandardsPage from "@/pages/StandardsPage";
import AdminConfigPage from "@/pages/AdminConfigPage";
import DeepDivePage from "@/pages/DeepDivePage";
import AIFeaturesPage from "@/pages/AIFeaturesPage";
import SmartRftBuilderPage from "@/pages/SmartRftBuilderPage";
import KnowledgeBaseChatbotPage from "@/pages/KnowledgeBaseChatbotPage";
import GenerateMockDataPage from "@/pages/GenerateMockDataPage";
import ExecutiveSummaryPage from "@/pages/ExecutiveSummaryPage";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

// Check if running in development mode
const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/executive-summary" component={ExecutiveSummaryPage} />
      <Route path="/admin-config" component={AdminConfigPage} />
      <Route path="/standards" component={StandardsPage} />
      <Route path="/portfolio/:id" component={PortfolioPage} />
      <Route path="/portfolio/:id/new-project" component={NewProjectPage} />
      <Route path="/portfolio/:id/upload" component={UploadPage} />
      <Route path="/dashboard/:id" component={DashboardPage} />
      <Route path="/project/:id" component={DashboardPage} />
      <Route path="/project/:id/ai-features" component={AIFeaturesPage} />
      <Route path="/evaluation/:id/deep-dive" component={DeepDivePage} />
      <Route path="/smart-rft-builder" component={SmartRftBuilderPage} />
      <Route path="/kb-chatbot" component={KnowledgeBaseChatbotPage} />
      <Route path="/generate-mock-data" component={GenerateMockDataPage} />
      {/* Development-only routes - none currently */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-border/50 backdrop-blur-sm relative overflow-hidden">
                  <div className="absolute inset-0 gradient-primary-soft opacity-60"></div>
                  <SidebarTrigger data-testid="button-sidebar-toggle" className="relative z-10" />
                  <div className="relative z-10">
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
