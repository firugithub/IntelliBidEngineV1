import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface Portfolio {
  id: string;
  name: string;
}

export default function NewProjectPage() {
  const params = useParams();
  const portfolioId = params.id;
  const [, setLocation] = useLocation();

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ["/api/portfolios", portfolioId],
    enabled: !!portfolioId,
  });

  const [projectName, setProjectName] = useState("");
  const [initiativeName, setInitiativeName] = useState("");
  const [vendorInput, setVendorInput] = useState("");
  const [vendorList, setVendorList] = useState<string[]>([]);

  // Rehydrate form from sessionStorage on mount
  useEffect(() => {
    const savedData = sessionStorage.getItem("newProjectData");
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        if (data.portfolioId === portfolioId) {
          setProjectName(data.projectName || "");
          setInitiativeName(data.initiativeName || "");
          setVendorList(data.vendorList || []);
        }
      } catch (error) {
        console.error("Failed to parse saved project data:", error);
      }
    }
  }, [portfolioId]);

  const handleAddVendor = () => {
    if (vendorInput.trim() && !vendorList.includes(vendorInput.trim())) {
      setVendorList([...vendorList, vendorInput.trim()]);
      setVendorInput("");
    }
  };

  const handleRemoveVendor = (vendor: string) => {
    setVendorList(vendorList.filter(v => v !== vendor));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddVendor();
    }
  };

  const handleProceed = () => {
    // Store project details in session storage to use in upload page
    const projectData = {
      portfolioId,
      projectName,
      initiativeName,
      vendorList,
    };
    sessionStorage.setItem("newProjectData", JSON.stringify(projectData));
    setLocation(`/portfolio/${portfolioId}/upload`);
  };

  const canProceed = projectName.trim() && vendorList.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/portfolio/${portfolioId}`)}
            className="gap-2 mb-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {portfolio?.name}
          </Button>
          <h1 className="text-3xl font-bold">New Vendor Shortlisting Project</h1>
          <p className="text-muted-foreground mt-1">
            Provide project details before uploading documents
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Enter basic information about this vendor evaluation project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectName">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectName"
                  placeholder="e.g., Cloud Infrastructure Vendor Selection"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  data-testid="input-project-name"
                />
                <p className="text-xs text-muted-foreground">
                  Give this shortlisting project a clear, descriptive name
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initiativeName">Initiative Name (Optional)</Label>
                <Input
                  id="initiativeName"
                  placeholder="e.g., Digital Transformation 2025"
                  value={initiativeName}
                  onChange={(e) => setInitiativeName(e.target.value)}
                  data-testid="input-initiative-name"
                />
                <p className="text-xs text-muted-foreground">
                  Link this project to a broader business initiative
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendorList">
                  Vendor List <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="vendorList"
                    placeholder="Enter vendor name and press Enter"
                    value={vendorInput}
                    onChange={(e) => setVendorInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    data-testid="input-vendor"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddVendor}
                    disabled={!vendorInput.trim()}
                    data-testid="button-add-vendor"
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add vendors you'll be evaluating (minimum 1 required)
                </p>

                {vendorList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 p-3 rounded-lg bg-muted/50">
                    {vendorList.map((vendor) => (
                      <Badge
                        key={vendor}
                        variant="secondary"
                        className="gap-1 pr-1"
                        data-testid={`badge-vendor-${vendor}`}
                      >
                        {vendor}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => handleRemoveVendor(vendor)}
                          data-testid={`button-remove-${vendor}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/portfolio/${portfolioId}`)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProceed}
                  disabled={!canProceed}
                  className="gap-2"
                  data-testid="button-proceed"
                >
                  Proceed to Upload Documents
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
