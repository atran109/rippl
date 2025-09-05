import { prisma } from '../db.js';
import { redis } from '../redis.js';

interface TrendingWeights {
  participants: number;
  actions_24h: number;
  actions_1h: number;
  new_participants_24h: number;
  boost: number;
  boost_half_life_seconds: number;
  min_participants: number;
  cooloff_days: number;
  cooloff_penalty: number;
}

// Default weights - make these configurable via env later
const DEFAULT_WEIGHTS: TrendingWeights = {
  participants: 1.0,
  actions_24h: 0.8,
  actions_1h: 1.5,
  new_participants_24h: 0.5,
  boost: 1.0,
  boost_half_life_seconds: 7200, // 2 hours
  min_participants: 8,
  cooloff_days: 7,
  cooloff_penalty: 0.7,
};

interface RippleSignals {
  rippleId: string;
  waveId: string;
  participants_total: number;
  actions_24h: number;
  actions_1h: number;
  new_participants_24h: number;
  boost: number;
  last_boost_ts: number;
}

export class TrendingWorker {
  private weights: TrendingWeights;
  
  constructor(weights: TrendingWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  async calculateTrendingScores(): Promise<void> {
    console.log('🔄 Calculating trending scores...');
    const startTime = Date.now();
    
    try {
      // Get all active ripples with their wave info and participant counts
      const ripples = await prisma.ripple.findMany({
        include: {
          wave: true,
          _count: {
            select: {
              memberships: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      // Get summaries separately to avoid the type issues
      const summaries = await prisma.rippleSummary.findMany();

      console.log(`📊 Processing ${ripples.length} ripples for trending...`);
      
      const now = Date.now();
      const hour_ago = now - (60 * 60 * 1000);
      const day_ago = now - (24 * 60 * 60 * 1000);
      
      const rippleScores: Array<{
        rippleId: string;
        waveId: string;
        score: number;
        signals: RippleSignals;
      }> = [];

      for (const ripple of ripples) {
        const rippleId = ripple.id;
        
        // Get time-windowed counts from Redis sorted sets
        const [actions_1h, actions_24h, new_participants_24h, boostData] = await Promise.all([
          redis.zcount(`ripple:${rippleId}:actions`, hour_ago, now),
          redis.zcount(`ripple:${rippleId}:actions`, day_ago, now),
          redis.zcount(`ripple:${rippleId}:joins`, day_ago, now),
          redis.hmget(`ripple:${rippleId}`, 'boost', 'last_boost_ts')
        ]);

        // Get participant count (from live count or summary fallback)
        const summary = summaries.find(s => s.rippleId === rippleId);
        const participants_total = ripple._count.memberships || summary?.participants || 0;
        
        // Skip ripples below minimum threshold
        if (participants_total < this.weights.min_participants) {
          continue;
        }

        // Parse boost data
        const boost_raw = parseFloat(boostData[0] || '0');
        const last_boost_ts = parseInt(boostData[1] || '0');
        
        // Apply boost decay
        const boost = this.applyBoostDecay(boost_raw, last_boost_ts, now);
        
        const signals: RippleSignals = {
          rippleId,
          waveId: ripple.waveId,
          participants_total,
          actions_24h,
          actions_1h,
          new_participants_24h,
          boost,
          last_boost_ts
        };

        // Calculate trending score
        const score = this.calculateScore(signals);
        
        rippleScores.push({
          rippleId,
          waveId: ripple.waveId,
          score,
          signals
        });
      }

      // Sort by score and update Redis leaderboards
      rippleScores.sort((a, b) => b.score - a.score);
      
      await this.updateLeaderboards(rippleScores);
      await this.updateRippleCards(rippleScores);
      await this.cleanupOldData();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Trending calculation complete in ${duration}ms. Top 5:`);
      
      rippleScores.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. Ripple ${r.rippleId} (score: ${r.score.toFixed(2)})`);
      });
      
    } catch (error) {
      console.error('❌ Trending calculation failed:', error);
      throw error;
    }
  }

  private applyBoostDecay(boost: number, last_boost_ts: number, now: number): number {
    if (!last_boost_ts || boost <= 0) return 0;
    
    const seconds_elapsed = (now - last_boost_ts) / 1000;
    const half_life = this.weights.boost_half_life_seconds;
    
    // Exponential decay: boost * (0.5 ^ (elapsed / half_life))
    return boost * Math.pow(0.5, seconds_elapsed / half_life);
  }

  private calculateScore(signals: RippleSignals): number {
    const {
      participants_total,
      actions_24h,
      actions_1h,
      new_participants_24h,
      boost
    } = signals;

    // Use logarithmic scaling to prevent large ripples from dominating
    const score = 
      this.weights.participants * Math.log10(participants_total + 1) +
      this.weights.actions_24h * Math.log1p(actions_24h) +
      this.weights.actions_1h * Math.log1p(actions_1h) +
      this.weights.new_participants_24h * new_participants_24h +
      this.weights.boost * boost;

    return Math.max(0, score); // Ensure non-negative
  }

  private async updateLeaderboards(rippleScores: Array<{rippleId: string; waveId: string; score: number}>): Promise<void> {
    const pipeline = redis.pipeline();
    
    // Clear existing leaderboards
    pipeline.del('trending:all');
    
    // Get unique wave IDs and clear their leaderboards
    const waveIds = [...new Set(rippleScores.map(r => r.waveId))];
    waveIds.forEach(waveId => {
      pipeline.del(`trending:wave:${waveId}`);
    });

    // Populate global leaderboard
    rippleScores.forEach(({ rippleId, score }) => {
      if (score > 0) {
        pipeline.zadd('trending:all', score, rippleId);
      }
    });

    // Populate per-wave leaderboards
    const byWave = rippleScores.reduce((acc, r) => {
      if (!acc[r.waveId]) acc[r.waveId] = [];
      acc[r.waveId].push(r);
      return acc;
    }, {} as Record<string, typeof rippleScores>);

    Object.entries(byWave).forEach(([waveId, ripples]) => {
      ripples.forEach(({ rippleId, score }) => {
        if (score > 0) {
          pipeline.zadd(`trending:wave:${waveId}`, score, rippleId);
        }
      });
    });

    // Set expiration (trending data shouldn't persist forever if worker stops)
    pipeline.expire('trending:all', 1800); // 30 minutes
    waveIds.forEach(waveId => {
      pipeline.expire(`trending:wave:${waveId}`, 1800);
    });

    await pipeline.exec();
  }

  private async updateRippleCards(rippleScores: Array<{rippleId: string; signals: RippleSignals}>): Promise<void> {
    // Create lightweight ripple cards for fast API responses
    const pipeline = redis.pipeline();
    
    const rippleData = await prisma.ripple.findMany({
      where: {
        id: { in: rippleScores.map(r => r.rippleId) }
      },
      include: {
        wave: {
          select: { id: true, name: true, icon: true }
        }
      }
    });

    const rippleSummaries = await prisma.rippleSummary.findMany({
      where: {
        rippleId: { in: rippleScores.map(r => r.rippleId) }
      },
      select: { rippleId: true, impactValue: true, impactUnit: true, impactSource: true }
    });

    const rippleMap = rippleData.reduce((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {} as Record<string, typeof rippleData[0]>);

    const summaryMap = rippleSummaries.reduce((acc, s) => {
      acc[s.rippleId] = s;
      return acc;
    }, {} as Record<string, typeof rippleSummaries[0]>);

    rippleScores.forEach(({ rippleId, signals }) => {
      const ripple = rippleMap[rippleId];
      if (!ripple) return;

      const summary = summaryMap[rippleId];
      
      const card = {
        id: rippleId,
        title: ripple.title,
        wave: {
          id: ripple.wave.id,
          name: ripple.wave.name,
          icon: ripple.wave.icon
        },
        participants: signals.participants_total,
        growth_today: signals.new_participants_24h,
        actions_24h: signals.actions_24h,
        impact_chip: summary ? {
          value: summary.impactValue,
          unit: summary.impactUnit,
          source: summary.impactSource
        } : null
      };

      pipeline.setex(`trending:card:${rippleId}`, 1800, JSON.stringify(card));
    });

    await pipeline.exec();
  }

  private async cleanupOldData(): Promise<void> {
    // Clean up old entries from time-windowed sorted sets
    const cutoff_24h = Date.now() - (24 * 60 * 60 * 1000);
    
    // Get all ripple IDs to clean
    const ripples = await prisma.ripple.findMany({ select: { id: true } });
    
    const pipeline = redis.pipeline();
    
    ripples.forEach(({ id }) => {
      // Keep only last 24h of actions and joins
      pipeline.zremrangebyscore(`ripple:${id}:actions`, '-inf', cutoff_24h);
      pipeline.zremrangebyscore(`ripple:${id}:joins`, '-inf', cutoff_24h);
    });

    await pipeline.exec();
  }
}

// Singleton instance
export const trendingWorker = new TrendingWorker();

// Helper function to run trending calculation
export async function runTrendingCalculation(): Promise<{
  success: boolean;
  processed: number;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await trendingWorker.calculateTrendingScores();
    
    // Get count of trending ripples
    const count = await redis.zcard('trending:all');
    
    return {
      success: true,
      processed: count,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}