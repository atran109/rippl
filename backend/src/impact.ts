import { prisma } from "./db.js";
import { redis } from "./redis.js";

/**
 * Bucket weights for impact calculation by wave
 * Each bucket has a weight that determines how much it contributes to the impact metric
 */
export const BUCKET_WEIGHTS: Record<string, Record<string, number>> = {
  "Mental Health": {
    conversation_checkin: 1.0,
    share_resources: 0.35,
    self_care_moment: 0.0,
    workplace_advocacy: 0.8
  },
  "Environment": {
    pick_up_litter: 1.0,
    bring_reusable: 0.0,
    recycle_correctly: 0.0,
    conserve_energy_short: 0.0
  },
  "Community & Equity": {
    conscious_purchase: 1.0,
    donate_small: 1.0,
    share_opportunity: 1.0,
    support_bipoc: 1.0
  }
};

export interface ImpactCalculation {
  rippleId: string;
  waveId: string;
  waveName: string;
  eligibleActions: number;
  totalActions: number;
  impactValue: number;
  impactUnit: string;
  impactSource: string;
  impactCoef: number;
  bucketBreakdown: Record<string, { count: number; weight: number; contribution: number }>;
  calculatedAt: Date;
}

export interface ImpactIndex {
  rippleId: string;
  index: number; // 0.50-3.00, clamped
  isVisible: boolean; // false until enough data
  medianImpact30d: number;
  rippleImpact30d: number;
}

/**
 * Calculate eligible actions for impact based on bucket weights
 */
export function calculateEligibleActions(
  actionsByBucket: Record<string, number>,
  waveName: string
): { eligible: number; breakdown: Record<string, { count: number; weight: number; contribution: number }> } {
  const weights = BUCKET_WEIGHTS[waveName] || {};
  const breakdown: Record<string, { count: number; weight: number; contribution: number }> = {};
  let totalEligible = 0;

  for (const [bucket, count] of Object.entries(actionsByBucket)) {
    const weight = weights[bucket] || 0;
    const contribution = count * weight;
    
    breakdown[bucket] = {
      count,
      weight,
      contribution
    };
    
    totalEligible += contribution;
  }

  return { eligible: totalEligible, breakdown };
}

/**
 * Format impact value for display
 */
export function formatImpactValue(value: number, unit: string): string {
  if (unit.includes("kg")) {
    if (value < 0.1) {
      return `${Math.round(value * 1000)}g`;
    } else {
      return `${value.toFixed(1)}kg`;
    }
  } else if (unit.includes("index") || unit.includes("points")) {
    return value.toFixed(2);
  } else {
    return Math.round(value).toString();
  }
}

/**
 * Calculate impact for a specific ripple
 */
export async function calculateRippleImpact(rippleId: string, timeframe?: { start: Date; end: Date }): Promise<ImpactCalculation> {
  // Get ripple and wave info
  const ripple = await prisma.ripple.findUnique({
    where: { id: rippleId },
    include: { wave: true }
  });

  if (!ripple) {
    throw new Error(`Ripple ${rippleId} not found`);
  }

  // Build date filter
  const dateFilter = timeframe ? {
    createdAt: { gte: timeframe.start, lte: timeframe.end }
  } : {};

  // Get action counts by bucket
  const actionLogs = await prisma.actionLog.groupBy({
    by: ['bucket'],
    where: {
      rippleId,
      ...dateFilter
    },
    _count: { bucket: true }
  });

  const actionsByBucket: Record<string, number> = {};
  let totalActions = 0;

  for (const log of actionLogs) {
    actionsByBucket[log.bucket] = log._count.bucket;
    totalActions += log._count.bucket;
  }

  // Calculate eligible actions
  const { eligible, breakdown } = calculateEligibleActions(actionsByBucket, ripple.wave.name);

  // Calculate impact using wave coefficient
  const impactValue = eligible * ripple.wave.impactCoef;

  return {
    rippleId,
    waveId: ripple.wave.id,
    waveName: ripple.wave.name,
    eligibleActions: eligible,
    totalActions,
    impactValue: Math.abs(impactValue), // Take absolute value for display
    impactUnit: ripple.wave.impactUnit,
    impactSource: ripple.wave.impactSource,
    impactCoef: ripple.wave.impactCoef,
    bucketBreakdown: breakdown,
    calculatedAt: new Date()
  };
}

/**
 * Calculate impact index for a ripple (relative to median in wave)
 */
export async function calculateImpactIndex(rippleId: string): Promise<ImpactIndex> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Get ripple's 30-day impact
  const rippleImpact = await calculateRippleImpact(rippleId, {
    start: thirtyDaysAgo,
    end: new Date()
  });

  // Get all ripples in the same wave for median calculation
  const waveRipples = await prisma.ripple.findMany({
    where: { waveId: rippleImpact.waveId },
    select: { id: true }
  });

  // Calculate 30-day impact for all ripples in wave
  const waveImpacts: number[] = [];
  for (const r of waveRipples) {
    const impact = await calculateRippleImpact(r.id, {
      start: thirtyDaysAgo,
      end: new Date()
    });
    waveImpacts.push(impact.impactValue);
  }

  // Calculate median
  waveImpacts.sort((a, b) => a - b);
  const median = waveImpacts.length % 2 === 0
    ? (waveImpacts[waveImpacts.length / 2 - 1] + waveImpacts[waveImpacts.length / 2]) / 2
    : waveImpacts[Math.floor(waveImpacts.length / 2)];

  // Calculate index (ripple impact / median impact)
  const rawIndex = median > 0 ? rippleImpact.impactValue / median : 1;
  const clampedIndex = Math.max(0.50, Math.min(3.00, rawIndex));

  // Check visibility criteria
  const participants = await prisma.userRipple.count({
    where: { rippleId, isActive: true }
  });
  
  const isVisible = participants >= 8 && rippleImpact.eligibleActions >= 20;

  return {
    rippleId,
    index: clampedIndex,
    isVisible,
    medianImpact30d: median,
    rippleImpact30d: rippleImpact.impactValue
  };
}

/**
 * Calculate user's personal impact across all their ripples
 */
export async function calculateUserImpact(userId: string): Promise<{
  totalActions: number;
  totalEligibleActions: number;
  totalImpact: number;
  ripplesJoined: number;
  impactByWave: Record<string, { actions: number; eligible: number; impact: number; unit: string }>;
}> {
  // Get user's ripple memberships
  const memberships = await prisma.userRipple.findMany({
    where: { userId, isActive: true },
    include: { ripple: { include: { wave: true } } }
  });

  // Get user's action logs
  const actionLogs = await prisma.actionLog.groupBy({
    by: ['waveId', 'bucket'],
    where: { userId },
    _count: { bucket: true }
  });

  const impactByWave: Record<string, { actions: number; eligible: number; impact: number; unit: string }> = {};
  let totalActions = 0;
  let totalEligibleActions = 0;
  let totalImpact = 0;

  // Group actions by wave
  const actionsByWave: Record<string, Record<string, number>> = {};
  for (const log of actionLogs) {
    if (!actionsByWave[log.waveId]) {
      actionsByWave[log.waveId] = {};
    }
    actionsByWave[log.waveId][log.bucket] = log._count.bucket;
    totalActions += log._count.bucket;
  }

  // Calculate impact for each wave
  for (const membership of memberships) {
    const wave = membership.ripple.wave;
    const waveActions = actionsByWave[wave.id] || {};
    
    if (Object.keys(waveActions).length === 0) continue;

    const { eligible } = calculateEligibleActions(waveActions, wave.name);
    const impact = Math.abs(eligible * wave.impactCoef);

    impactByWave[wave.name] = {
      actions: Object.values(waveActions).reduce((sum, count) => sum + count, 0),
      eligible,
      impact,
      unit: wave.impactUnit
    };

    totalEligibleActions += eligible;
    totalImpact += impact;
  }

  return {
    totalActions,
    totalEligibleActions,
    totalImpact,
    ripplesJoined: memberships.length,
    impactByWave
  };
}

/**
 * Update ripple summary with latest impact data
 */
export async function updateRippleSummary(rippleId: string): Promise<void> {
  const impact = await calculateRippleImpact(rippleId);
  
  const participants = await prisma.userRipple.count({
    where: { rippleId, isActive: true }
  });

  await prisma.rippleSummary.upsert({
    where: { rippleId },
    create: {
      rippleId,
      participants,
      actionsTotal: impact.totalActions,
      impactValue: impact.impactValue,
      impactUnit: impact.impactUnit,
      impactSource: impact.impactSource
    },
    update: {
      participants,
      actionsTotal: impact.totalActions,
      impactValue: impact.impactValue,
      updatedAt: new Date()
    }
  });
}

/**
 * Cache impact calculation results
 */
export async function cacheImpactResults(rippleId: string, impact: ImpactCalculation): Promise<void> {
  const key = `impact:ripple:${rippleId}`;
  await redis.setex(key, 30 * 60, JSON.stringify(impact)); // 30 minute TTL
}

/**
 * Get cached impact results
 */
export async function getCachedImpact(rippleId: string): Promise<ImpactCalculation | null> {
  const key = `impact:ripple:${rippleId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

/**
 * Get impact explanation for "How we estimate" modal
 */
export function getImpactExplanation(waveName: string): {
  whatWeCcount: string;
  formula: string;
  sourcesAndCaveats: string;
} {
  const explanations = {
    "Mental Health": {
      whatWeCcount: "Eligible conversations and resource sharing that contribute to stigma reduction",
      formula: "eligible_actions × -0.006 stigma index points per action",
      sourcesAndCaveats: "Based on WHO 2024 research. Conversation check-ins count fully, resource sharing at 35%. Self-care moments don't count toward stigma metric."
    },
    "Environment": {
      whatWeCcount: "Physical litter removal actions with verified impact",
      formula: "eligible_actions × 0.09 kg per item removed (conservative average)",
      sourcesAndCaveats: "EPA 2023 data. Only direct litter pickup counts. Other actions help but aren't included in weight metric."
    },
    "Community & Equity": {
      whatWeCcount: "All eligible actions (beta metric during development)",
      formula: "eligible_actions × 1 per action (placeholder)",
      sourcesAndCaveats: "MVP beta tracking. Will switch to 'local $ directed' when verification system is built."
    }
  };

  return explanations[waveName] || {
    whatWeCcount: "Actions in this category",
    formula: "Under development",
    sourcesAndCaveats: "Impact measurement in development"
  };
}