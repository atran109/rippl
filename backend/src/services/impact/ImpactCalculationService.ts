import { prisma } from "../../db.js";
import { redis } from "../../redis.js";

export interface BucketBreakdown {
  [bucket: string]: {
    count: number;
    weight: number;
    contribution: number;
  };
}

export interface ImpactCalculationResult {
  totalActions: number;
  eligibleActions: number;
  impactValue: number;
  bucketBreakdown: BucketBreakdown;
}

export class ImpactCalculationService {
  /**
   * Calculate impact for a specific ripple within a timeframe
   * Logic: ActionLog × WaveBucket.weight × Wave.impactCoef = final impact
   */
  async calculateRippleImpact(
    rippleId: string,
    timeframe: string | null = null,
    calculationType: 'realtime' | 'daily' | 'monthly' | 'custom' = 'realtime'
  ): Promise<ImpactCalculationResult> {
    console.log(`�� Calculating impact for ripple ${rippleId}, timeframe: ${timeframe || 'all-time'}`);

    // Build date filter for timeframe
    const dateFilter = this.buildDateFilter(timeframe);

    // Get all action logs for this ripple within timeframe
    const actionLogs = await prisma.actionLog.findMany({
      where: {
        rippleId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      include: {
        wave: true,
        waveBucket: true, // This gives us the weight directly from merged model!
      },
    });

    if (actionLogs.length === 0) {
      return {
        totalActions: 0,
        eligibleActions: 0,
        impactValue: 0,
        bucketBreakdown: {},
      };
    }

    const wave = actionLogs[0].wave;
    let totalActions = actionLogs.length;
    let eligibleActions = 0;
    let bucketBreakdown: BucketBreakdown = {};

    // Calculate weighted impact for each action
    for (const action of actionLogs) {
      const bucketWeight = action.waveBucket.weight; // Get weight from WaveBucket
      const eligible = bucketWeight; // Weighted action count
      
      eligibleActions += eligible;

      // Track by bucket for detailed breakdown
      if (!bucketBreakdown[action.bucket]) {
        bucketBreakdown[action.bucket] = {
          count: 0,
          weight: bucketWeight,
          contribution: 0,
        };
      }
      
      bucketBreakdown[action.bucket].count += 1;
      bucketBreakdown[action.bucket].contribution += eligible * wave.impactCoef;
    }

    // Final impact = eligible actions × wave coefficient
    const impactValue = eligibleActions * wave.impactCoef;

    // Store the calculation for caching
    await prisma.impactCalculation.create({
      data: {
        rippleId,
        waveId: wave.id,
        calculationType: calculationType === "realtime" ? "SEVEN_DAY" : calculationType === "daily" ? "THIRTY_DAY" : "ALL_TIME",
        totalImpact: impactValue,
        actionCount: totalActions,
        participantCount: new Set(actionLogs.map(log => log.userId)).size,
      },
    });

    console.log(`✅ Ripple impact calculated: ${impactValue.toFixed(2)} (${totalActions} actions)`);

    return {
      totalActions,
      eligibleActions,
      impactValue,
      bucketBreakdown,
    };
  }

  /**
   * Calculate and update impact index for a ripple (performance vs median)
   * Logic: Compare ripple's 30d impact to median of all ripples in same wave
   */
  async calculateImpactIndex(rippleId: string): Promise<void> {
    console.log(`📊 Calculating impact index for ripple ${rippleId}`);

    // Get the ripple and its wave
    const ripple = await prisma.ripple.findUnique({
      where: { id: rippleId },
      include: { wave: true },
    });

    if (!ripple) {
      throw new Error(`Ripple ${rippleId} not found`);
    }

    // Calculate 30-day impact for this ripple
    const rippleImpact = await this.calculateRippleImpact(rippleId, '30d', 'daily');

    // Get all ripples in the same wave for median calculation
    const allRipplesInWave = await prisma.ripple.findMany({
      where: { waveId: ripple.waveId },
      select: { id: true },
    });

    // Calculate 30-day impact for all ripples in this wave
    const allImpacts: number[] = [];
    for (const r of allRipplesInWave) {
      const impact = await this.calculateRippleImpact(r.id, '30d', 'daily');
      allImpacts.push(impact.impactValue);
    }

    // Calculate median impact across all ripples in wave
    allImpacts.sort((a, b) => a - b);
    const medianImpact30d = this.calculateMedian(allImpacts);

    // Calculate index value (0.5x to 3.0x, clamped)
    let indexValue = medianImpact30d > 0 ? rippleImpact.impactValue / medianImpact30d : 1.0;
    indexValue = Math.min(Math.max(indexValue, 0.5), 3.0);

    // Get participant count
    const participants = await prisma.userRipple.count({
      where: { rippleId, isActive: true },
    });

    // Determine visibility (needs minimum participants and actions)
    const isVisible = participants >= 1 && rippleImpact.totalActions >= 3;

    // Create or update impact index
    await prisma.impactIndex.upsert({
      where: { rippleId },
      update: {
        indexScore: indexValue,
        medianImpact: medianImpact30d,
        rippleImpact: rippleImpact.impactValue,
        participantCount: participants,
        aboveMedianRipples: 1,
        totalActiveRipples: 1,
        calculatedAt: new Date(),
      },
      create: {
        rippleId,
        waveId: ripple.waveId,
        indexScore: indexValue,
        medianImpact: medianImpact30d,
        rippleImpact: rippleImpact.impactValue,
        participantCount: participants,
        aboveMedianRipples: 1,
        totalActiveRipples: 1,
      },
    });

    console.log(`✅ Impact index calculated: ${indexValue.toFixed(2)}x (${isVisible ? 'visible' : 'hidden'})`);
  }

  /**
   * Calculate and update user impact summary
   * Logic: Aggregate all user's actions across all waves and ripples
   */
  async calculateUserImpactSummary(userId: string): Promise<void> {
    console.log(`👤 Calculating impact summary for user ${userId}`);

    // Get all user's action logs across all ripples and waves
    const actionLogs = await prisma.actionLog.findMany({
      where: { userId },
      include: {
        wave: true,
        waveBucket: true,
      },
    });

    if (actionLogs.length === 0) {
      // User has no actions, delete summary if it exists
      await prisma.userImpactSummary.deleteMany({
        where: { userId },
      });
      console.log(`✅ User has no actions, summary cleared`);
      return;
    }

    let totalActions = actionLogs.length;
    let totalEligibleActions = 0;
    let totalImpact = 0;
    let impactByWave: Record<string, any> = {};

    // Get ripples joined count
    const ripplesJoined = await prisma.userRipple.count({
      where: { userId, isActive: true },
    });

    // Calculate impact for each action
    for (const action of actionLogs) {
      const bucketWeight = action.waveBucket.weight;
      const eligible = bucketWeight;
      const impact = eligible * action.wave.impactCoef;

      totalEligibleActions += eligible;
      totalImpact += impact;

      // Track by wave for detailed breakdown
      if (!impactByWave[action.wave.name]) {
        impactByWave[action.wave.name] = {
          actions: 0,
          eligible: 0,
          impact: 0,
          unit: action.wave.impactUnit,
        };
      }

      impactByWave[action.wave.name].actions += 1;
      impactByWave[action.wave.name].eligible += eligible;
      impactByWave[action.wave.name].impact += impact;
    }

    // Create or update user impact summary
    await prisma.userImpactSummary.upsert({
      where: { userId },
      update: {
        actionCountAllTime: totalActions,
        totalImpactAllTime: totalImpact,
        activeRipples: ripplesJoined,

        calculatedAt: new Date(),
      },
      create: {
        userId,
        actionCountAllTime: totalActions,
        totalImpactAllTime: totalImpact,
        activeRipples: ripplesJoined,

      },
    });

    console.log(`✅ User impact summary calculated: ${totalImpact.toFixed(2)} total impact`);
  }

  /**
   * Run impact calculations for all active ripples
   */
  async calculateAllRippleImpacts(): Promise<void> {
    console.log('🚀 Calculating impact for all active ripples...');

    const activeRipples = await prisma.ripple.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const ripple of activeRipples) {
      try {
        // Calculate multiple timeframes
        await this.calculateRippleImpact(ripple.id, null, 'realtime'); // All-time
        await this.calculateRippleImpact(ripple.id, '7d', 'daily');
        await this.calculateRippleImpact(ripple.id, '30d', 'daily');
        await this.calculateImpactIndex(ripple.id);
      } catch (error) {
        console.error(`❌ Error calculating impact for ripple ${ripple.id}:`, error);
      }
    }

    console.log('✅ All ripple impacts calculated');
  }

  /**
   * Run impact calculations for all users with actions
   */
  async calculateAllUserImpacts(): Promise<void> {
    console.log('👥 Calculating impact for all users...');

    const usersWithActions = await prisma.actionLog.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of usersWithActions) {
      try {
        await this.calculateUserImpactSummary(userId);
      } catch (error) {
        console.error(`❌ Error calculating impact for user ${userId}:`, error);
      }
    }

    console.log('✅ All user impacts calculated');
  }

  /**
   * Trigger impact calculations after a user completes an action
   * This is called from the actions route
   */
  async onActionCompleted(userId: string, rippleId: string): Promise<void> {
    try {
      // Update user impact summary immediately
      await this.calculateUserImpactSummary(userId);
      
      // Schedule ripple impact calculation (could be async in production)
      setTimeout(async () => {
        try {
          await this.calculateRippleImpact(rippleId, null, 'realtime');
          await this.calculateImpactIndex(rippleId);
        } catch (error) {
          console.error(`❌ Error in delayed ripple impact calculation:`, error);
        }
      }, 1000); // 1 second delay to avoid blocking the response
      
    } catch (error) {
      console.error(`❌ Error in onActionCompleted:`, error);
      // Don't throw - we don't want to break the action completion
    }
  }

  // Helper methods
  private buildDateFilter(timeframe: string | null) {
    if (!timeframe) return null;

    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return null;
    }

    return { gte: startDate };
  }

  private calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
}

// Export singleton instance
export const impactCalculationService = new ImpactCalculationService();
