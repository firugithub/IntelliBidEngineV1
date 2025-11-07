import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

interface ProgressUpdate {
  projectId: string;
  vendorName: string;
  vendorIndex: number;
  totalVendors: number;
  agentRole: string;
  agentStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: number;
}

interface VendorProgress {
  vendorName: string;
  vendorIndex: number;
  agents: Map<string, ProgressUpdate>;
}

interface EvaluationProgressProps {
  projectId: string;
}

const AGENT_ORDER = [
  "Delivery Manager",
  "Product Manager",
  "Solution Architect",
  "Engineering Lead",
  "Procurement",
  "Cybersecurity"
];

export function EvaluationProgress({ projectId }: EvaluationProgressProps) {
  const [vendorProgress, setVendorProgress] = useState<Map<string, VendorProgress>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/projects/${projectId}/evaluation-progress`);

    eventSource.onopen = () => {
      console.log('📡 SSE connection opened');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('📡 SSE connected to project:', data.projectId);
          return;
        }

        if (data.type === 'progress') {
          const update: ProgressUpdate = data;
          
          setVendorProgress(prev => {
            const newProgress = new Map(prev);
            
            if (!newProgress.has(update.vendorName)) {
              newProgress.set(update.vendorName, {
                vendorName: update.vendorName,
                vendorIndex: update.vendorIndex,
                agents: new Map(),
              });
            }
            
            const vendor = newProgress.get(update.vendorName)!;
            vendor.agents.set(update.agentRole, update);
            
            return newProgress;
          });
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('📡 SSE connection error');
      setIsConnected(false);
    };

    return () => {
      console.log('📡 Closing SSE connection');
      eventSource.close();
    };
  }, [projectId]);

  // Sort vendors by index
  const sortedVendors = Array.from(vendorProgress.values()).sort((a, b) => a.vendorIndex - b.vendorIndex);

  if (sortedVendors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="evaluation-progress">
      {sortedVendors.map((vendor) => {
        const agents = AGENT_ORDER.map(role => vendor.agents.get(role));
        const completedCount = agents.filter(a => a?.agentStatus === 'completed').length;
        const failedCount = agents.filter(a => a?.agentStatus === 'failed').length;
        const inProgressCount = agents.filter(a => a?.agentStatus === 'in_progress').length;
        
        return (
          <Card key={vendor.vendorName} data-testid={`progress-vendor-${vendor.vendorIndex}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {inProgressCount > 0 && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {inProgressCount === 0 && completedCount === agents.length && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                Evaluating {vendor.vendorName}
              </CardTitle>
              <CardDescription>
                {completedCount} / {agents.length} agents completed
                {failedCount > 0 && ` (${failedCount} failed)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {AGENT_ORDER.map((role) => {
                  const agent = vendor.agents.get(role);
                  const status = agent?.agentStatus || 'pending';
                  
                  return (
                    <div
                      key={role}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50"
                      data-testid={`agent-${role.toLowerCase().replace(/\s+/g, '-')}-${status}`}
                    >
                      {status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                      {status === 'in_progress' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                      <span className={`text-sm ${status === 'completed' ? 'text-foreground' : status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
