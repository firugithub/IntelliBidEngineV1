import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, FileText, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
}

interface Project {
  id: string;
  portfolioId: string;
  name: string;
  initiativeName: string | null;
  vendorList: string[] | null;
  status: string;
  createdAt: string;
}

export default function PortfolioPage() {
  const params = useParams();
  const portfolioId = params.id;
  const [, setLocation] = useLocation();

  const { data: portfolio, isLoading: portfolioLoading } = useQuery<Portfolio>({
    queryKey: ["/api/portfolios", portfolioId],
    enabled: !!portfolioId,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/portfolios", portfolioId, "projects"],
    enabled: !!portfolioId,
  });

  if (portfolioLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Portfolio not found</p>
          <Button onClick={() => setLocation("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-chart-2 text-white">Completed</Badge>;
      case "analyzing":
        return <Badge className="bg-chart-1 text-white">Analyzing</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2 mb-2" data-testid="button-back-home">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Portfolios
                </Button>
              </Link>
              <h1 className="text-3xl font-bold">{portfolio.name}</h1>
              {portfolio.description && (
                <p className="text-muted-foreground">{portfolio.description}</p>
              )}
            </div>
            <Button
              onClick={() => setLocation(`/portfolio/${portfolioId}/new-project`)}
              className="gap-2"
              data-testid="button-new-project"
            >
              <Plus className="h-4 w-4" />
              New Vendor Shortlist
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Vendor Shortlisting Projects</h2>
          <p className="text-muted-foreground">
            {projects && projects.length > 0
              ? `${projects.length} project${projects.length > 1 ? "s" : ""} found`
              : "No projects yet. Create your first vendor shortlisting project."}
          </p>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/${project.id}`}
                data-testid={`link-project-${project.id}`}
              >
                <Card className="h-full hover-elevate active-elevate-2 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {getStatusBadge(project.status)}
                    </div>
                    {project.initiativeName && (
                      <CardDescription className="text-sm">
                        {project.initiativeName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.vendorList && project.vendorList.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>Vendors ({project.vendorList.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {project.vendorList.slice(0, 3).map((vendor, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {vendor}
                            </Badge>
                          ))}
                          {project.vendorList.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{project.vendorList.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <Calendar className="h-3 w-3" />
                      <span>Created {format(new Date(project.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start your first vendor shortlisting project for {portfolio.name}
                </p>
                <Button
                  onClick={() => setLocation(`/portfolio/${portfolioId}/new-project`)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create First Project
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
