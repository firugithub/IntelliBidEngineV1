import type { IStorage } from "../storage";

interface SyncVendorStagesOptions {
  evaluatedStage?: number; // Default 7 (RFT Evaluation Completed)
  allowVariance?: boolean; // For mock data - adds ±1 stage variation
}

/**
 * Synchronizes vendor shortlisting stages after evaluations complete.
 * Creates new stage records or updates existing ones to reflect evaluation progress.
 * 
 * @param storage - Storage instance
 * @param projectId - Project ID
 * @param options - Configuration options
 * @returns Count of vendors created/updated
 */
export async function synchronizeVendorStages(
  storage: IStorage,
  projectId: string,
  options: SyncVendorStagesOptions = {}
): Promise<{ created: number; updated: number; vendors: string[] }> {
  const { evaluatedStage = 7, allowVariance = false } = options;
  
  let created = 0;
  let updated = 0;
  const vendors: string[] = [];
  
  try {
    // Get all proposals for this project
    const proposals = await storage.getProposalsByProject(projectId);
    
    if (proposals.length === 0) {
      console.log(`No proposals found for project ${projectId}, skipping vendor stage sync`);
      return { created, updated, vendors };
    }
    
    // Extract unique vendor names
    const vendorNameSet = new Set(proposals.map(p => p.vendorName));
    const uniqueVendorNames = Array.from(vendorNameSet);
    
    // Get existing vendor stages for this project
    const existingStages = await storage.getVendorStagesByProject(projectId);
    const existingStageMap = new Map(existingStages.map(s => [s.vendorName, s]));
    
    console.log(`Synchronizing vendor stages for ${uniqueVendorNames.length} vendors in project ${projectId}`);
    
    // Process each vendor
    for (let i = 0; i < uniqueVendorNames.length; i++) {
      const vendorName = uniqueVendorNames[i];
      const existingStage = existingStageMap.get(vendorName);
      
      // Determine current stage
      let currentStage = evaluatedStage;
      
      // Add variance for mock data (±1 stage)
      if (allowVariance) {
        const stageVariation = [-1, 0, 0, 1][i % 4];
        currentStage = Math.max(2, Math.min(10, evaluatedStage + stageVariation));
      }
      
      // Create stage status object: { status: string, date: string | null }
      const stageStatuses: Record<string, any> = {};
      for (let stage = 1; stage <= 10; stage++) {
        stageStatuses[stage.toString()] = {
          status: currentStage > stage ? 'completed' : (currentStage === stage ? 'in_progress' : 'pending'),
          date: currentStage > stage ? new Date().toISOString() : null
        };
      }
      
      if (existingStage) {
        // Update existing stage only if new stage is higher
        if (currentStage > existingStage.currentStage) {
          await storage.updateVendorStage(existingStage.id, {
            currentStage,
            stageStatuses
          });
          updated++;
          vendors.push(vendorName);
          console.log(`  ✓ Updated ${vendorName}: stage ${existingStage.currentStage} → ${currentStage}`);
        } else {
          console.log(`  ℹ Skipped ${vendorName}: already at stage ${existingStage.currentStage}`);
        }
      } else {
        // Create new stage record
        await storage.createVendorStage({
          projectId,
          vendorName,
          currentStage,
          stageStatuses
        });
        created++;
        vendors.push(vendorName);
        console.log(`  ✓ Created ${vendorName} at stage ${currentStage}`);
      }
    }
    
    console.log(`Vendor stage sync complete: ${created} created, ${updated} updated`);
    return { created, updated, vendors };
    
  } catch (error) {
    console.error(`Error synchronizing vendor stages for project ${projectId}:`, error);
    throw error;
  }
}
