import { prisma } from '../db.js';
import { redis } from '../redis.js';

interface RippleImpactData {
  rippleId: string;
  waveId: string;
  impact30d: number;
  impactUnit: string;
  impactSource: string;
}

interface WaveImpactData {
  waveId: string;
  impact30d: number;
  impactUnit: string;
  impactSource: string;
  medianRippleImpact: number;
  rippleCount: number;
}

export class ImpactWorker {
  
  async calculateImpacts(): Promise<void> {
    console.log('🔄 Calculating 30-day impacts...');
    const startTime = Date.now();
    
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Get all waves with their buckets and coefficients
      const waves = await prisma.wave.findMany({
        include: {
          waveBuckets: {
            select: { name: true, weight: true }
          }
        }
      });
      
      const waveImpactData: WaveImpactData[] = [];
      
      for (const wave of waves) {
        console.log(`📊 Processing wave: ${wave.name}...`);
        
        // Get all ripples in this wave
        const ripples = await prisma.ripple.findMany({
          where: { waveId: wave.id },
          select: { id: true }
        });
        
        const rippleImpacts: RippleImpactData[] = [];
        
        for (const ripple of ripples) {
          // Calculate 30-day impact for this ripple
          const impact30d = await this.calculateRippleImpact30d(
            ripple.id, 
            wave.id, 
            wave.impactCoef,
            wave.waveBuckets,
            thirtyDaysAgo
          );
          
          // Update RippleSummary with 30-day impact
          await prisma.rippleSummary.upsert({
            where: { rippleId: ripple.id },
            update: { 
              impact30d,
              updatedAt: new Date()
            },
            create: {
              rippleId: ripple.id,
              participants: 0, // Will be updated by other workers
              actionsTotal: 0,
              impactValue: 0,
              impact30d,
              impactUnit: wave.impactUnit,
              impactSource: wave.impactSource
            }
          });
          
          rippleImpacts.push({
            rippleId: ripple.id,
            waveId: wave.id,
            impact30d,
            impactUnit: wave.impactUnit,
            impactSource: wave.impactSource
          });
        }
        
        // Calculate wave-level aggregations
        const validRippleImpacts = rippleImpacts
          .filter(r => Math.abs(r.impact30d) > 0.001) // Filter out near-zero impacts
          .map(r => Math.abs(r.impact30d)); // Use absolute values for median calc
        
        const waveTotal30d = rippleImpacts.reduce((sum, r) => sum + r.impact30d, 0);
        const medianRippleImpact = this.calculateMedian(validRippleImpacts);
        
        const waveData: WaveImpactData = {
          waveId: wave.id,
          impact30d: waveTotal30d,
          impactUnit: wave.impactUnit,
          impactSource: wave.impactSource,
          medianRippleImpact,
          rippleCount: validRippleImpacts.length
        };
        
        waveImpactData.push(waveData);
        
        // Cache wave impact data in Redis
        await redis.setex(
          `impact:wave:${wave.id}:30d`,
          1800, // 30 minutes TTL
          JSON.stringify(waveData)
        );
        
        console.log(`  ✅ ${ripples.length} ripples, total impact: ${waveTotal30d.toFixed(3)} ${wave.impactUnit}`);
      }
      
      // Cache ripple impact cards for fast API reads
      await this.cacheRippleImpactCards();
      
      const duration = Date.now() - startTime;
      const totalRipples = waveImpactData.reduce((sum, w) => sum + w.rippleCount, 0);
      
      console.log(`✅ Impact calculation complete in ${duration}ms. Processed ${totalRipples} ripples across ${waves.length} waves.`);
      
    } catch (error) {
      console.error('❌ Impact calculation failed:', error);
      throw error;
    }
  }
  
  private async calculateRippleImpact30d(
    rippleId: string, 
    waveId: string,
    impactCoef: number,
    buckets: Array<{name: string, weight: number}>,
    thirtyDaysAgo: Date
  ): Promise<number> {
    // Get action logs for the last 30 days, grouped by bucket
    const actionCounts = await prisma.actionLog.groupBy({
      by: ['bucket'],
      where: {
        rippleId,
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: { id: true }
    });
    
    // Calculate eligible actions using bucket weights
    let eligibleActions = 0;
    
    actionCounts.forEach(({ bucket, _count }) => {
      const bucketData = buckets.find(b => b.name === bucket);
      if (bucketData) {
        eligibleActions += _count.id * bucketData.weight;
      }
    });
    
    // Calculate impact: eligible actions × coefficient
    return eligibleActions * impactCoef;
  }
  
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
  
  private async cacheRippleImpactCards(): Promise<void> {
    // Cache lightweight ripple impact data for API responses
    const ripples = await prisma.ripple.findMany({
      include: {
        wave: {
          select: { impactUnit: true, impactSource: true }
        }
      }
    });
    
    const summaries = await prisma.rippleSummary.findMany({
      select: { rippleId: true, impactValue: true, impact30d: true }
    });
    
    const summaryMap = summaries.reduce((acc, s) => {
      acc[s.rippleId] = s;
      return acc;
    }, {} as Record<string, typeof summaries[0]>);
    
    const pipeline = redis.pipeline();
    
    ripples.forEach(ripple => {
      const summary = summaryMap[ripple.id];
      if (summary) {
        const card = {
          id: ripple.id,
          title: ripple.title,
          impactLifetime: {
            value: summary.impactValue,
            unit: ripple.wave.impactUnit,
            source: ripple.wave.impactSource
          },
          impact30d: {
            value: summary.impact30d,
            unit: ripple.wave.impactUnit
          }
        };
        
        pipeline.setex(`impact:ripple:${ripple.id}:card`, 1800, JSON.stringify(card));
      }
    });
    
    await pipeline.exec();
  }
  
  // Helper method to get impact index for a ripple
  async calculateImpactIndex(rippleId: string): Promise<number | null> {
    try {
      const ripple = await prisma.ripple.findUnique({
        where: { id: rippleId },
        select: { waveId: true }
      });
      
      const summary = await prisma.rippleSummary.findUnique({
        where: { rippleId },
        select: { impact30d: true }
      });
      
      if (!ripple || !summary) return null;
      
      // Get wave median from cache
      const waveDataStr = await redis.get(`impact:wave:${ripple.waveId}:30d`);
      if (!waveDataStr) return null;
      
      const waveData: WaveImpactData = JSON.parse(waveDataStr);
      
      // Skip if not enough data for meaningful comparison
      if (waveData.rippleCount < 5 || waveData.medianRippleImpact === 0) {
        return null;
      }
      
      const rippleImpact = Math.abs(summary.impact30d);
      const index = rippleImpact / waveData.medianRippleImpact;
      
      // Clamp to reasonable bounds and hide if too close to 1.0
      const clampedIndex = Math.min(Math.max(index, 0.5), 3.0);
      
      return Math.abs(clampedIndex - 1.0) > 0.2 ? clampedIndex : null;
      
    } catch (error) {
      console.warn('Failed to calculate impact index:', error);
      return null;
    }
  }
}

// Singleton instance
export const impactWorker = new ImpactWorker();

// Helper function to run impact calculation
export async function runImpactCalculation(): Promise<{
  success: boolean;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await impactWorker.calculateImpacts();
    
    return {
      success: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to get user's personal impact (cached)
export async function getUserImpact30d(userId: string): Promise<{
  value: number;
  unit: string;
  actions: number;
} | null> {
  try {
    // Check cache first
    const cached = await redis.get(`impact:user:${userId}:30d`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Calculate on demand
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get user's actions with wave/bucket info
    const userActions = await prisma.actionLog.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo }
      },
      include: {
        wave: {
          select: { impactCoef: true, impactUnit: true }
        }
      }
    });
    
    if (userActions.length === 0) return null;
    
    // Group by wave and calculate impact
    const impactsByWave: Record<string, { impact: number; unit: string; actions: number }> = {};
    
    for (const action of userActions) {
      const waveId = action.waveId;
      
      if (!impactsByWave[waveId]) {
        impactsByWave[waveId] = {
          impact: 0,
          unit: action.wave.impactUnit,
          actions: 0
        };
      }
      
      // Get bucket weight
      const bucketWeight = await prisma.waveBucket.findUnique({
        where: {
          waveId_name: { waveId, name: action.bucket }
        },
        select: { weight: true }
      });
      
      if (bucketWeight) {
        const deltaImpact = bucketWeight.weight * action.wave.impactCoef;
        impactsByWave[waveId].impact += deltaImpact;
        impactsByWave[waveId].actions += 1;
      }
    }
    
    // For now, return the wave with the most activity (MVP)
    // Later you could combine or show multiple waves
    const primaryWave = Object.entries(impactsByWave)
      .sort(([,a], [,b]) => b.actions - a.actions)[0];
    
    if (!primaryWave) return null;
    
    const result = {
      value: primaryWave[1].impact,
      unit: primaryWave[1].unit,
      actions: primaryWave[1].actions
    };
    
    // Cache for 15 minutes
    await redis.setex(`impact:user:${userId}:30d`, 900, JSON.stringify(result));
    
    return result;
    
  } catch (error) {
    console.warn('Failed to get user impact:', error);
    return null;
  }
}