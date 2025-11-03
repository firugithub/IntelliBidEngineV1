import { Home, FolderKanban, BookOpen, Settings, Database, Trash2, Wand2, Bot, Sparkles as SparklesIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const navigationItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Smart RFT Builder",
    url: "/smart-rft-builder",
    icon: Wand2,
  },
  {
    title: "Knowledge Base",
    url: "/standards",
    icon: BookOpen,
  },
  {
    title: "KB Chatbot",
    url: "/kb-chatbot",
    icon: Bot,
  },
  {
    title: "Generate Mock Data",
    url: "/generate-mock-data",
    icon: SparklesIcon,
  },
  {
    title: "Admin Config",
    url: "/admin-config",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [isWipeDialogOpen, setIsWipeDialogOpen] = useState(false);
  const { state } = useSidebar();

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
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">IntelliBid</span>
              <span className="text-xs text-muted-foreground">AI Vendor Evaluation</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Data Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-2 px-2">
              <AlertDialog open={isWipeDialogOpen} onOpenChange={setIsWipeDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-2 hover:bg-destructive/10 hover:text-destructive"
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
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {state === "expanded" && (
          <div className="px-4 py-2">
            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
