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
import { Sparkles } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/standards" component={StandardsPage} />
      <Route path="/portfolio/:id" component={PortfolioPage} />
      <Route path="/portfolio/:id/new-project" component={NewProjectPage} />
      <Route path="/portfolio/:id/upload" component={UploadPage} />
      <Route path="/dashboard/:id" component={DashboardPage} />
      <Route component={NotFound} />
    </Switch>
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
