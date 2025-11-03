import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, FileText, Calendar, Download, FileDown, Upload } from "lucide-react";
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

interface GeneratedRft {
  id: string;
  projectId: string;
  businessCaseId: string;
  name: string;
  status: string;
  createdAt: string;
  sections?: any;
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

  const { data: rfts, isLoading: rftsLoading } = useQuery<GeneratedRft[]>({
    queryKey: ["/api/portfolios", portfolioId, "rfts"],
    enabled: !!portfolioId,
  });

  if (portfolioLoading || projectsLoading || rftsLoading) {
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
          <div className="space-y-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4" />
                Back to Portfolios
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{portfolio.name}</h1>
              {portfolio.description && (
                <p className="text-muted-foreground mt-1">{portfolio.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="rft-creation" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="rft-creation" data-testid="tab-rft-creation">
              RFT Creation
            </TabsTrigger>
            <TabsTrigger value="rft-evaluation" data-testid="tab-rft-evaluation">
              RFT Evaluation
            </TabsTrigger>
          </TabsList>

          {/* RFT Creation Tab */}
          <TabsContent value="rft-creation" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Request for Technology Documents</h2>
                <p className="text-muted-foreground">
                  {rfts && rfts.length > 0
                    ? `${rfts.length} RFT${rfts.length > 1 ? "s" : ""} created`
                    : "No RFTs yet. Create your first RFT document."}
                </p>
              </div>
              <Button
                onClick={() => setLocation("/rft-builder")}
                className="gap-2"
                data-testid="button-create-rft"
              >
                <Plus className="h-4 w-4" />
                Create New RFT
              </Button>
            </div>

            {rfts && rfts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rfts.map((rft) => (
                  <Card key={rft.id} className="h-full hover-elevate" data-testid={`card-rft-${rft.id}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle className="text-lg" data-testid={`text-rft-${rft.id}`}>
                            {rft.name}
                          </CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {rft.sections?.sections?.length || 0} sections
                          </CardDescription>
                        </div>
                        <Badge variant={rft.status === "published" ? "default" : "secondary"}>
                          {rft.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-xs text-muted-foreground">
                        Created {format(new Date(rft.createdAt), "MMM d, yyyy")}
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
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">No RFTs yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first Request for Technology document for {portfolio.name}
                    </p>
                    <Button
                      onClick={() => setLocation("/rft-builder")}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create First RFT
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* RFT Evaluation Tab */}
          <TabsContent value="rft-evaluation" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Vendor Evaluation Projects</h2>
                <p className="text-muted-foreground">
                  {projects && projects.length > 0
                    ? `${projects.length} project${projects.length > 1 ? "s" : ""} found`
                    : "No evaluation projects yet. Create your first vendor shortlisting project."}
                </p>
              </div>
              <Button
                onClick={() => setLocation(`/portfolio/${portfolioId}/new-project`)}
                className="gap-2"
                data-testid="button-new-project"
              >
                <Plus className="h-4 w-4" />
                New Evaluation
              </Button>
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
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">No evaluation projects yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start your first vendor evaluation project for {portfolio.name}
                    </p>
                    <Button
                      onClick={() => setLocation(`/portfolio/${portfolioId}/new-project`)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Evaluation
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
