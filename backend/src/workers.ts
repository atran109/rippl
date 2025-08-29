import { 
  calculateAllTrendingScores, 
  cacheTrendingResults, 
  decayAllBoosts, 
  resetCounters,
  updateRippleCounters,
  getRippleCounters 
} from "./trending.js";
import { updateRippleSummary, cacheImpactResults, calculateRippleImpact } from "./impact.js";
import { prisma } from "./db.js";

/**
 * Worker to update trending scores every 5 minutes
 */
export async function runTrendingWorker(): Promise<void> {
  console.log("[TrendingWorker] Starting trending calculation...");
  
  try {
    // Calculate all trending scores
    const allScores = await calculateAllTrendingScores();
    
    // Cache global trending results
    await cacheTrendingResults(allScores);
    
    // Cache trending results by wave
    const waves = await prisma.wave.findMany({ select: { id: true } });
    
    for (const wave of waves) {
      const waveScores = allScores.filter(score => 
        // We need to get the wave ID for each ripple
        // This is a simplified approach - in production you'd want to optimize this
        true // For now, we'll handle wave filtering in the API
      );
      await cacheTrendingResults(waveScores, wave.id);
    }
    
    console.log(`[TrendingWorker] Updated trending for ${allScores.length} ripples`);
  } catch (error) {
    console.error("[TrendingWorker] Error:", error);
  }
}

/**
 * Worker to decay boost scores every 15 minutes
 */
export async function runBoostDecayWorker(): Promise<void> {
  console.log("[BoostDecayWorker] Starting boost decay...");
  
  try {
    await decayAllBoosts();
    console.log("[BoostDecayWorker] Boost decay complete");
  } catch (error) {
    console.error("[BoostDecayWorker] Error:", error);
  }
}

/**
 * Worker to reset 1-hour counters every hour
 */
export async function runHourlyResetWorker(): Promise<void> {
  console.log("[HourlyResetWorker] Resetting 1h counters...");
  
  try {
    await resetCounters("1h");
    console.log("[HourlyResetWorker] 1h counters reset");
  } catch (error) {
    console.error("[HourlyResetWorker] Error:", error);
  }
}

/**
 * Worker to reset 24-hour counters every day
 */
export async function runDailyResetWorker(): Promise<void> {
  console.log("[DailyResetWorker] Resetting 24h counters...");
  
  try {
    await resetCounters("24h");
    console.log("[DailyResetWorker] 24h counters reset");
  } catch (error) {
    console.error("[DailyResetWorker] Error:", error);
  }
}

/**
 * Worker to update impact calculations and ripple summaries
 */
export async function runImpactWorker(): Promise<void> {
  console.log("[ImpactWorker] Starting impact calculations...");
  
  try {
    // Get all active ripples
    const ripples = await prisma.ripple.findMany({
      where: { status: "active" },
      select: { id: true }
    });
    
    let updated = 0;
    for (const ripple of ripples) {
      try {
        // Calculate and cache impact
        const impact = await calculateRippleImpact(ripple.id);
        await cacheImpactResults(ripple.id, impact);
        
        // Update ripple summary in database
        await updateRippleSummary(ripple.id);
        
        updated++;
      } catch (error) {
        console.error(`[ImpactWorker] Error updating ripple ${ripple.id}:`, error);
      }
    }
    
    console.log(`[ImpactWorker] Updated impact for ${updated}/${ripples.length} ripples`);
  } catch (error) {
    console.error("[ImpactWorker] Error:", error);
  }
}

/**
 * Worker to sync participant counts from database to Redis
 */
export async function runParticipantSyncWorker(): Promise<void> {
  console.log("[ParticipantSyncWorker] Syncing participant counts...");
  
  try {
    // Get all ripples with their participant counts
    const ripples = await prisma.ripple.findMany({
      select: {
        id: true,
        _count: {
          select: {
            memberships: {
              where: { isActive: true }
            }
          }
        }
      }
    });
    
    for (const ripple of ripples) {
      const participantCount = ripple._count.memberships;
      
      // Update Redis counter
      await updateRippleCounters(ripple.id, {
        participants_total: participantCount
      });
    }
    
    console.log(`[ParticipantSyncWorker] Synced ${ripples.length} ripple participant counts`);
  } catch (error) {
    console.error("[ParticipantSyncWorker] Error:", error);
  }
}

/**
 * Start all background workers with their respective intervals
 */
export function startAllWorkers(): void {
  console.log("[Workers] Starting all background workers...");
  
  // Trending calculations every 5 minutes
  setInterval(runTrendingWorker, 5 * 60 * 1000);
  
  // Boost decay every 15 minutes
  setInterval(runBoostDecayWorker, 15 * 60 * 1000);
  
  // Hourly counter reset
  setInterval(runHourlyResetWorker, 60 * 60 * 1000);
  
  // Daily counter reset (run at 00:00 UTC)
  const now = new Date();
  const msUntilMidnight = (24 * 60 * 60 * 1000) - (now.getTime() % (24 * 60 * 60 * 1000));
  setTimeout(() => {
    runDailyResetWorker();
    setInterval(runDailyResetWorker, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
  
  // Impact calculations every 30 minutes
  setInterval(runImpactWorker, 30 * 60 * 1000);
  
  // Participant sync every 10 minutes
  setInterval(runParticipantSyncWorker, 10 * 60 * 1000);
  
  // Run initial calculations
  setTimeout(runTrendingWorker, 1000);
  setTimeout(runImpactWorker, 5000);
  setTimeout(runParticipantSyncWorker, 2000);
  
  console.log("[Workers] All workers started");
}

/**
 * Manually trigger all workers (useful for development/testing)
 */
export async function runAllWorkersOnce(): Promise<void> {
  console.log("[Workers] Running all workers once...");
  
  await runParticipantSyncWorker();
  await runImpactWorker();
  await runTrendingWorker();
  await runBoostDecayWorker();
  
  console.log("[Workers] All workers completed");
}