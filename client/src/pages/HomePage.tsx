import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, FileText, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface Project {
  id: string;
  departmentId: string;
  name: string;
  status: string;
}

export default function HomePage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const hasSeededRef = useRef(false);
  
  const { data: departments, isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Seed departments on first load if empty (one-shot)
  useEffect(() => {
    const seedDepartments = async () => {
      if (departments && departments.length === 0 && !hasSeededRef.current) {
        hasSeededRef.current = true;
        setIsSeeding(true);
        try {
          await apiRequest("POST", "/api/seed-departments");
          // Refetch departments to get the seeded data
          await queryClient.refetchQueries({ queryKey: ["/api/departments"] });
        } catch (error) {
          console.error("Failed to seed departments:", error);
          hasSeededRef.current = false; // Reset flag on error to allow retry
        } finally {
          setIsSeeding(false);
        }
      }
    };
    
    seedDepartments();
  }, [departments]);

  if (departmentsLoading || isSeeding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {isSeeding ? "Setting up departments..." : "Loading departments..."}
          </p>
        </div>
      </div>
    );
  }

  const getDepartmentStats = (deptId: string) => {
    const deptProjects = projects?.filter(p => p.departmentId === deptId) || [];
    const totalProjects = deptProjects.length;
    const completedProjects = deptProjects.filter(p => p.status === "completed").length;
    const activeProjects = deptProjects.filter(p => p.status === "analyzing").length;

    return { totalProjects, completedProjects, activeProjects };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">IntelliBid</h1>
              <p className="text-lg text-muted-foreground">
                AI-Powered Vendor Shortlisting for Enterprise Teams
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Departments</h2>
          <p className="text-muted-foreground">
            Select a department to view projects and start vendor shortlisting
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments?.map((department) => {
            const stats = getDepartmentStats(department.id);
            
            return (
              <Link
                key={department.id}
                href={`/department/${department.id}`}
                data-testid={`link-department-${department.id}`}
              >
                <Card className="h-full hover-elevate active-elevate-2 cursor-pointer transition-all">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <CardTitle className="text-lg" data-testid={`text-dept-${department.id}`}>
                            {department.name}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-sm">
                          {department.description}
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
                        <p className="text-xl font-bold font-mono" data-testid={`stat-total-${department.id}`}>
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
