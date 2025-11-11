// Evaluation progress tracking service
// Provides real-time progress updates during multi-agent evaluation

export interface ProgressUpdate {
  projectId: string;
  vendorName: string;
  vendorIndex: number;
  totalVendors: number;
  agentRole: string;
  agentStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: number;
}

type ProgressListener = (update: ProgressUpdate) => void;

class EvaluationProgressService {
  private listeners: Map<string, Set<ProgressListener>> = new Map();
  private currentProgress: Map<string, ProgressUpdate[]> = new Map();

  // Subscribe to progress updates for a specific project
  subscribe(projectId: string, listener: ProgressListener): () => void {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set());
    }
    
    this.listeners.get(projectId)!.add(listener);
    
    // Send any existing progress immediately
    const existingProgress = this.currentProgress.get(projectId);
    if (existingProgress) {
      existingProgress.forEach(update => listener(update));
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(projectId)?.delete(listener);
      if (this.listeners.get(projectId)?.size === 0) {
        this.listeners.delete(projectId);
      }
    };
  }

  // Emit a progress update
  emitProgress(update: ProgressUpdate): void {
    const { projectId } = update;
    
    // Store the update
    if (!this.currentProgress.has(projectId)) {
      this.currentProgress.set(projectId, []);
    }
    
    const progress = this.currentProgress.get(projectId)!;
    
    // Find and update existing entry or add new one
    const existingIndex = progress.findIndex(
      p => p.vendorName === update.vendorName && p.agentRole === update.agentRole
    );
    
    if (existingIndex >= 0) {
      progress[existingIndex] = update;
    } else {
      progress.push(update);
    }
    
    // Notify all listeners for this project
    const listeners = this.listeners.get(projectId);
    if (listeners) {
      listeners.forEach(listener => listener(update));
    }
  }

  // Clear progress for a project (called when evaluation completes)
  clearProgress(projectId: string): void {
    this.currentProgress.delete(projectId);
    
    // Optionally keep listeners for next evaluation
    // or clear them: this.listeners.delete(projectId);
  }

  // Get current progress for a project
  getProgress(projectId: string): ProgressUpdate[] {
    return this.currentProgress.get(projectId) || [];
  }
}

export const evaluationProgressService = new EvaluationProgressService();
