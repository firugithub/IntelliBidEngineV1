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

interface GeneratedRft {
  id: string;
  projectId: string;
  businessCaseId: string;
  name: string;
  status: string;
  createdAt: Date;
  sections?: any;
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

  const { data: generatedRfts } = useQuery<GeneratedRft[]>({
    queryKey: ["/api/generated-rfts"],
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

  const getPortfolioStats = (portfolioId: string) => {
    const portfolioProjects = projects?.filter(p => p.portfolioId === portfolioId) || [];
    const totalProjects = portfolioProjects.length;
    const completedProjects = portfolioProjects.filter(p => p.status === "completed").length;
    const activeProjects = portfolioProjects.filter(p => p.status === "analyzing").length;

    return { totalProjects, completedProjects, activeProjects };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">IntelliBid</h1>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  Nujum Air
                </Badge>
              </div>
              <p className="text-lg text-muted-foreground">
                AI-Powered Vendor Shortlisting for Middle East's Largest Airline
              </p>
            </div>
            <Link href="/standards">
              <Button variant="outline" className="gap-2" data-testid="button-standards">
                <Shield className="h-4 w-4" />
                Knowledge Pack
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* My RFTs Section */}
        {generatedRfts && generatedRfts.length > 0 && (
          <div className="mb-12">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">My RFTs</h2>
              <p className="text-muted-foreground">
                Recently created Request for Technology documents
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedRfts.slice(0, 6).map((rft) => (
                <Card key={rft.id} className="h-full hover-elevate" data-testid={`card-rft-${rft.id}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-lg" data-testid={`text-rft-${rft.id}`}>
                          {rft.name}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {rft.sections?.sections?.length || 0} sections • {rft.status}
                        </CardDescription>
                      </div>
                      <Badge variant={rft.status === "published" ? "default" : "secondary"}>
                        {rft.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(rft.createdAt).toLocaleDateString()}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(`/api/generated-rfts/${rft.id}/download/doc`, "_blank");
                        }}
                        data-testid={`button-download-doc-${rft.id}`}
                      >
                        <FileDown className="w-3 h-3 mr-1" />
                        DOC
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(`/api/generated-rfts/${rft.id}/download/pdf`, "_blank");
                        }}
                        data-testid={`button-download-pdf-${rft.id}`}
                      >
                        <FileDown className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                    </div>
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        window.open(`/api/generated-rfts/${rft.id}/download/all`, "_blank");
                      }}
                      data-testid={`button-download-all-${rft.id}`}
                      className="w-full"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download All (ZIP)
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Portfolios</h2>
          <p className="text-muted-foreground">
            Select a portfolio to view projects and start vendor shortlisting
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios?.map((portfolio) => {
            const stats = getPortfolioStats(portfolio.id);
            
            return (
              <Link
                key={portfolio.id}
                href={`/portfolio/${portfolio.id}`}
                data-testid={`link-portfolio-${portfolio.id}`}
              >
                <Card className="h-full hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Building2 className="h-5 w-5 text-primary" />
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
                          <FileText className="h-3 w-3" />
                          <span>Total</span>
                        </div>
                        <p className="text-xl font-bold font-mono" data-testid={`stat-total-${portfolio.id}`}>
                          {stats.totalProjects}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          <span>Active</span>
                        </div>
                        <p className="text-xl font-bold font-mono text-chart-1">
                          {stats.activeProjects}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Done</span>
                        </div>
                        <p className="text-xl font-bold font-mono text-chart-2">
                          {stats.completedProjects}
                        </p>
                      </div>
                    </div>

                    {stats.completedProjects > 0 && (
                      <div className="pt-2 border-t">
                        <Badge variant="secondary" className="text-xs">
                          {Math.round((stats.completedProjects / stats.totalProjects) * 100)}% completion rate
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
