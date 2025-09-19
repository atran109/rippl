import { Router } from 'express';
import { redis } from '../src/redis.js';
import { prisma } from '../src/db.js';
import { requireAuth } from '../middleware/auth.js';
import { runTrendingCalculation } from '../src/trending/trendingWorker.js';
import { z } from 'zod';

const router = Router();

const trendingQuerySchema = z.object({
  scope: z.enum(['my_waves', 'all']).default('my_waves'),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

// GET /community/trending - Get trending ripples
router.get('/community/trending', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const parsed = trendingQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues });
    }
    
    const { scope, limit } = parsed.data;
    let leaderboardKey = 'trending:all';
    
    // If scope is 'my_waves', filter to user's waves
    if (scope === 'my_waves') {
      // Get user's active ripples to determine their waves
      const userRipples = await prisma.userRipple.findMany({
        where: { userId, isActive: true },
        include: {
          ripple: {
            select: { waveId: true }
          }
        }
      });
      
      const userWaveIds = [...new Set(userRipples.map(ur => ur.ripple.waveId))];
      
      if (userWaveIds.length === 0) {
        return res.json([]); // No waves, no trending
      }
      
      // Get trending from each of user's waves and merge
      const waveScores: Array<{rippleId: string, score: number}> = [];
      
      for (const waveId of userWaveIds) {
        const ripples = await redis.zrevrange(`trending:wave:${waveId}`, 0, limit - 1, 'WITHSCORES');
        
        for (let i = 0; i < ripples.length; i += 2) {
          waveScores.push({
            rippleId: ripples[i],
            score: parseFloat(ripples[i + 1])
          });
        }
      }
      
      // Sort merged results by score and take top N
      waveScores.sort((a, b) => b.score - a.score);
      const topRippleIds = waveScores.slice(0, limit).map(r => r.rippleId);
      
      return res.json(await hydrateRippleCards(topRippleIds));
    }
    
    // Global trending
    const topRippleIds = await redis.zrevrange(leaderboardKey, 0, limit - 1);
    const results = await hydrateRippleCards(topRippleIds);
    
    res.json(results);
    
  } catch (error) {
    console.error('Trending API error:', error);
    res.status(500).json({ error: 'Failed to get trending ripples' });
  }
});

// GET /ripple/:id - Add trending info to existing ripple endpoint
// (This modifies the existing ripples.ts route, but we'll add a helper here)
export async function getTrendingInfo(rippleId: string): Promise<{rank: number, scope: string} | null> {
  try {
    // Check global ranking
    const globalRank = await redis.zrevrank('trending:all', rippleId);
    
    if (globalRank !== null && globalRank < 10) {
      return { rank: globalRank + 1, scope: 'global' };
    }
    
    // Check wave ranking
    const ripple = await prisma.ripple.findUnique({
      where: { id: rippleId },
      select: { waveId: true }
    });
    
    if (ripple) {
      const waveRank = await redis.zrevrank(`trending:wave:${ripple.waveId}`, rippleId);
      
      if (waveRank !== null && waveRank < 10) {
        return { rank: waveRank + 1, scope: 'wave' };
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get trending info for ripple:', rippleId, error);
    return null;
  }
}

// POST /admin/calculate-trending - Manual trending calculation
router.post('/admin/calculate-trending', async (req, res) => {
  try {
    const result = await runTrendingCalculation();
    
    res.json({
      ...result,
      message: result.success 
        ? `Processed ${result.processed} ripples in ${result.duration}ms`
        : `Failed: ${result.error}`
    });
  } catch (error) {
    console.error('Manual trending calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /admin/trending/debug - Debug trending data
router.get('/admin/trending/debug', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Get top trending globally with scores
    const globalTrending = await redis.zrevrange('trending:all', 0, limit - 1, 'WITHSCORES');
    const global = [];
    
    for (let i = 0; i < globalTrending.length; i += 2) {
      const rippleId = globalTrending[i];
      const score = parseFloat(globalTrending[i + 1]);
      
      // Get ripple info
      const ripple = await prisma.ripple.findUnique({
        where: { id: rippleId },
        select: { title: true, waveId: true }
      });
      
      // Get Redis signals
      const [actions1h, actions24h, joins24h, boostData] = await Promise.all([
        redis.zcount(`ripple:${rippleId}:actions`, Date.now() - 3600000, Date.now()),
        redis.zcount(`ripple:${rippleId}:actions`, Date.now() - 86400000, Date.now()),
        redis.zcount(`ripple:${rippleId}:joins`, Date.now() - 86400000, Date.now()),
        redis.hmget(`ripple:${rippleId}`, 'boost', 'last_boost_ts')
      ]);
      
      global.push({
        rank: (i / 2) + 1,
        rippleId,
        title: ripple?.title || 'Unknown',
        waveId: ripple?.waveId || 'Unknown',
        score: score.toFixed(3),
        signals: {
          actions_1h: actions1h,
          actions_24h: actions24h,
          joins_24h: joins24h,
          boost: parseFloat(boostData[0] || '0').toFixed(2),
          last_boost_ts: boostData[1]
        }
      });
    }
    
    res.json({
      global,
      timestamp: new Date().toISOString(),
      redis_keys: {
        global_count: await redis.zcard('trending:all'),
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Helper function to hydrate ripple cards from Redis or DB fallback
async function hydrateRippleCards(rippleIds: string[]): Promise<any[]> {
  if (rippleIds.length === 0) return [];
  
  const results = [];
  
  for (let i = 0; i < rippleIds.length; i++) {
    const rippleId = rippleIds[i];
    
    try {
      // Try to get cached card from Redis first
      const cachedCard = await redis.get(`trending:card:${rippleId}`);
      
      if (cachedCard) {
        const card = JSON.parse(cachedCard);
        results.push({
          rank: i + 1,
          ripple: { id: card.id, title: card.title },
          wave: card.wave,
          participants: card.participants,
          growth_today: card.growth_today,
          actions_24h: card.actions_24h,
          score: 0, // Don't expose raw scores to frontend
          impact_chip: card.impact_chip
        });
      } else {
        // Fallback to DB query if card not cached
        const ripple = await prisma.ripple.findUnique({
          where: { id: rippleId },
          include: {
            wave: {
              select: { id: true, name: true, icon: true }
            },
            _count: {
              select: {
                memberships: { where: { isActive: true } }
              }
            }
          }
        });
        
        const summary = await prisma.rippleSummary.findUnique({
          where: { rippleId },
          select: { participants: true, impactValue: true, impactUnit: true, impactSource: true }
        });
        
        if (ripple) {
          const now = Date.now();
          const day_ago = now - (24 * 60 * 60 * 1000);
          const [actions_24h, joins_24h] = await Promise.all([
            redis.zcount(`ripple:${rippleId}:actions`, day_ago, now),
            redis.zcount(`ripple:${rippleId}:joins`, day_ago, now)
          ]);

          results.push({
            rank: i + 1,
            ripple: { id: ripple.id, title: ripple.title },
            wave: {
              id: ripple.wave.id,
              name: ripple.wave.name,
              icon: ripple.wave.icon
            },
            participants: ripple._count.memberships || summary?.participants || 0,
            growth_today: joins_24h,
            actions_24h,
            score: 0,
            impact_chip: summary ? {
              value: summary.impactValue,
              unit: summary.impactUnit,
              source: summary.impactSource
            } : null
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to hydrate ripple ${rippleId}:`, error);
    }
  }
  
  return results;
}

export default router;
