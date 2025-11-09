import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, FileText, CheckCircle2, Shield, Download, FileDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
}

interface Project {
  id: string;
  portfolioId: string;
  name: string;
  status: string;
}

interface PortfolioRftStats {
  totalRfts: number;
  active: number;
  evaluationInProgress: number;
}

export default function HomePage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const hasSeededRef = useRef(false);
  
  const { data: portfolios, isLoading: portfoliosLoading } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Seed portfolios on first load if empty (one-shot)
  useEffect(() => {
    const seedPortfolios = async () => {
      if (portfolios && portfolios.length === 0 && !hasSeededRef.current) {
        hasSeededRef.current = true;
        setIsSeeding(true);
        try {
          await apiRequest("POST", "/api/seed-portfolios");
          // Refetch portfolios to get the seeded data
          await queryClient.refetchQueries({ queryKey: ["/api/portfolios"] });
        } catch (error) {
          console.error("Failed to seed portfolios:", error);
          hasSeededRef.current = false; // Reset flag on error to allow retry
        } finally {
          setIsSeeding(false);
        }
      }
    };
    
    seedPortfolios();
  }, [portfolios]);

  if (portfoliosLoading || isSeeding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {isSeeding ? "Setting up portfolios..." : "Loading portfolios..."}
          </p>
        </div>
      </div>
    );
  }

  // Component for fetching and displaying portfolio stats
  const PortfolioCard = ({ portfolio }: { portfolio: Portfolio }) => {
    const { data: stats } = useQuery<PortfolioRftStats>({
      queryKey: ["/api/portfolios", portfolio.id, "rft-stats"],
      queryFn: async () => {
        const response = await fetch(`/api/portfolios/${portfolio.id}/rft-stats`);
        if (!response.ok) throw new Error("Failed to fetch stats");
        return response.json();
      },
    });

    return (
      <Link
        href={`/portfolio/${portfolio.id}`}
        data-testid={`link-portfolio-${portfolio.id}`}
      >
        <Card className="h-full hover-elevate active-elevate-2 cursor-pointer transition-all group">
          <CardHeader className="pb-4 relative">
            <div className="absolute inset-0 gradient-primary-soft opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-lg pointer-events-none"></div>
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg gradient-primary p-2">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-portfolio-${portfolio.id}`}>
                    {portfolio.name}
                  </CardTitle>
                </div>
                <CardDescription className="text-sm">
                  {portfolio.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 h-3" />
                  Total
                </div>
                <div className="text-2xl font-bold" data-testid={`stat-total-${portfolio.id}`}>
                  {stats?.totalRfts ?? 0}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`stat-active-${portfolio.id}`}>
                  {stats?.active ?? 0}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  In Progress
                </div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid={`stat-progress-${portfolio.id}`}>
                  {stats?.evaluationInProgress ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient Hero Section */}
      <div className="border-b relative overflow-hidden">
        <div className="absolute inset-0 gradient-accent-soft opacity-70"></div>
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-5xl font-bold gradient-text-accent">IntelliBid</h1>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  Nujum Air
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground font-medium">
                AI-Powered Vendor Shortlisting for Middle East's Largest Airline
              </p>
            </div>
            <Link href="/standards">
              <Button variant="outline" className="gap-2 backdrop-blur-sm" data-testid="button-standards">
                <Shield className="h-4 w-4" />
                Knowledge Pack
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Portfolios</h2>
          <p className="text-muted-foreground">
            Select a portfolio to create RFTs or evaluate vendor proposals
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios?.map((portfolio) => (
            <PortfolioCard key={portfolio.id} portfolio={portfolio} />
          ))}
        </div>
      </div>
    </div>
  );
}
