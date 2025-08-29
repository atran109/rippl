import { redis } from "./redis.js";
import { prisma } from "./db.js";

export interface TrendingScore {
  rippleId: string;
  score: number;
  participants: number;
  actions24h: number;
  actions1h: number;
  newParticipants24h: number;
  boost: number;
  isTopTen: boolean;
  topTenDays: number;
}

export interface RippleCounters {
  participants_total: number;
  actions_24h: number;
  actions_1h: number;
  new_participants_24h: number;
  boost: number;
  top_ten_since?: string; // ISO date when it first entered top 10
}

/**
 * Calculate trending score for a ripple
 * Formula: 1.0 * log10(participants_total + 1) + 0.8 * log1p(actions_24h) + 
 *          1.5 * log1p(actions_1h) + 0.5 * new_participants_24h + 1.0 * boost
 */
export function calculateTrendingScore(counters: RippleCounters): number {
  const participantScore = Math.log10(counters.participants_total + 1);
  const actions24hScore = Math.log1p(counters.actions_24h);
  const actions1hScore = Math.log1p(counters.actions_1h);
  const newParticipantsScore = counters.new_participants_24h;
  const boostScore = counters.boost;

  return (
    1.0 * participantScore +
    0.8 * actions24hScore +
    1.5 * actions1hScore +
    0.5 * newParticipantsScore +
    1.0 * boostScore
  );
}

/**
 * Apply boost decay (2-hour half-life)
 */
export function applyBoostDecay(currentBoost: number, minutesElapsed: number): number {
  const halfLifeMinutes = 120; // 2 hours
  const decayFactor = Math.pow(0.5, minutesElapsed / halfLifeMinutes);
  return currentBoost * decayFactor;
}

/**
 * Get ripple counters from Redis with fallback to database
 */
export async function getRippleCounters(rippleId: string): Promise<RippleCounters> {
  const key = `ripple:${rippleId}`;
  const redisData = await redis.hgetall(key);

  // If no Redis data, initialize from database
  if (Object.keys(redisData).length === 0) {
    const participants = await prisma.userRipple.count({
      where: { rippleId, isActive: true }
    });

    const actions24h = await prisma.actionLog.count({
      where: {
        rippleId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    const actions1h = await prisma.actionLog.count({
      where: {
        rippleId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });

    const newParticipants24h = await prisma.userRipple.count({
      where: {
        rippleId,
        isActive: true,
        joinedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    return {
      participants_total: participants,
      actions_24h: actions24h,
      actions_1h: actions1h,
      new_participants_24h: newParticipants24h,
      boost: 0
    };
  }

  return {
    participants_total: parseInt(redisData.participants_total || "0"),
    actions_24h: parseInt(redisData.actions_24h || "0"),
    actions_1h: parseInt(redisData.actions_1h || "0"),
    new_participants_24h: parseInt(redisData.new_participants_24h || "0"),
    boost: parseFloat(redisData.boost || "0"),
    top_ten_since: redisData.top_ten_since
  };
}

/**
 * Update ripple counters in Redis
 */
export async function updateRippleCounters(rippleId: string, updates: Partial<RippleCounters>): Promise<void> {
  const key = `ripple:${rippleId}`;
  const pipeline = redis.pipeline();

  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) {
      pipeline.hset(key, field, value.toString());
    }
  }

  // Set expiry for 7 days to prevent indefinite growth
  pipeline.expire(key, 7 * 24 * 60 * 60);
  await pipeline.exec();
}

/**
 * Calculate trending scores for all active ripples
 */
export async function calculateAllTrendingScores(): Promise<TrendingScore[]> {
  // Get all active ripples
  const ripples = await prisma.ripple.findMany({
    where: { status: "active" },
    select: { id: true }
  });

  const scores: TrendingScore[] = [];

  for (const ripple of ripples) {
    const counters = await getRippleCounters(ripple.id);
    
    // Apply guardrails: hide ripples with <8 participants
    if (counters.participants_total < 8) {
      continue;
    }

    const baseScore = calculateTrendingScore(counters);
    let finalScore = baseScore;

    // Apply cool-off for ripples that have been in top 10 for >7 days
    const topTenDays = counters.top_ten_since ? 
      Math.floor((Date.now() - new Date(counters.top_ten_since).getTime()) / (24 * 60 * 60 * 1000)) : 0;
    
    const isTopTen = topTenDays > 0;
    if (topTenDays > 7) {
      finalScore *= 0.7; // 30% penalty
    }

    scores.push({
      rippleId: ripple.id,
      score: finalScore,
      participants: counters.participants_total,
      actions24h: counters.actions_24h,
      actions1h: counters.actions_1h,
      newParticipants24h: counters.new_participants_24h,
      boost: counters.boost,
      isTopTen,
      topTenDays
    });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Update top 10 tracking
  await updateTopTenTracking(scores.slice(0, 10));

  return scores;
}

/**
 * Update tracking for ripples that are currently in top 10
 */
async function updateTopTenTracking(topTen: TrendingScore[]): Promise<void> {
  const now = new Date().toISOString();
  
  for (const score of topTen) {
    const counters = await getRippleCounters(score.rippleId);
    
    // If not already tracked as top 10, start tracking
    if (!counters.top_ten_since) {
      await updateRippleCounters(score.rippleId, {
        top_ten_since: now
      });
    }
  }
}

/**
 * Apply boost decay to all ripples (called periodically)
 */
export async function decayAllBoosts(): Promise<void> {
  // Get all ripple keys
  const keys = await redis.keys("ripple:*");
  
  for (const key of keys) {
    const boostStr = await redis.hget(key, "boost");
    const lastDecayStr = await redis.hget(key, "last_decay");
    
    if (!boostStr || parseFloat(boostStr) === 0) continue;
    
    const currentBoost = parseFloat(boostStr);
    const lastDecay = lastDecayStr ? new Date(lastDecayStr).getTime() : Date.now();
    const minutesElapsed = (Date.now() - lastDecay) / (60 * 1000);
    
    const newBoost = applyBoostDecay(currentBoost, minutesElapsed);
    
    // Update if significant change (avoid tiny updates)
    if (Math.abs(newBoost - currentBoost) > 0.01) {
      await redis.hmset(key, {
        boost: newBoost.toString(),
        last_decay: new Date().toISOString()
      });
    }
  }
}

/**
 * Reset 24h and 1h counters (called daily/hourly)
 */
export async function resetCounters(type: "24h" | "1h"): Promise<void> {
  const keys = await redis.keys("ripple:*");
  const field = type === "24h" ? "actions_24h" : "actions_1h";
  const participantField = type === "24h" ? "new_participants_24h" : null;
  
  for (const key of keys) {
    const pipeline = redis.pipeline();
    pipeline.hset(key, field, "0");
    if (participantField) {
      pipeline.hset(key, participantField, "0");
    }
    await pipeline.exec();
  }
}

/**
 * Cache trending results in Redis
 */
export async function cacheTrendingResults(scores: TrendingScore[], waveId?: string): Promise<void> {
  const key = waveId ? `trending:wave:${waveId}` : "trending:global";
  
  // Store top 50 results with TTL of 5 minutes
  await redis.setex(key, 5 * 60, JSON.stringify(scores.slice(0, 50)));
}

/**
 * Get cached trending results
 */
export async function getCachedTrending(waveId?: string): Promise<TrendingScore[] | null> {
  const key = waveId ? `trending:wave:${waveId}` : "trending:global";
  const cached = await redis.get(key);
  
  return cached ? JSON.parse(cached) : null;
}