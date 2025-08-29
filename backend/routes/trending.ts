import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { getCachedTrending, calculateAllTrendingScores, cacheTrendingResults } from "../src/trending.js";
import { z } from "zod";

const router = Router();

// GET /trending?wave=waveId&limit=20
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  
  const query = z.object({
    wave: z.string().cuid().optional(),
    limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(50)).default("20"),
    my_waves: z.string().transform(val => val === "true").default("true")
  }).safeParse(req.query);

  if (!query.success) {
    return res.status(400).json({ error: query.error.issues });
  }

  const { wave: waveId, limit, my_waves } = query.data;

  try {
    // Get user's waves if filtering by my_waves
    let userWaveIds: string[] = [];
    if (my_waves) {
      const userRipples = await prisma.userRipple.findMany({
        where: { userId, isActive: true },
        include: { ripple: { select: { waveId: true } } }
      });
      userWaveIds = [...new Set(userRipples.map(ur => ur.ripple.waveId))];
    }

    // Try to get cached results first
    let trendingScores = await getCachedTrending(waveId);
    
    // If no cache, calculate fresh
    if (!trendingScores) {
      trendingScores = await calculateAllTrendingScores();
      await cacheTrendingResults(trendingScores, waveId);
    }

    // Get ripple details for the trending scores
    const rippleIds = trendingScores.slice(0, limit * 2).map(s => s.rippleId); // Get extra for filtering
    const ripples = await prisma.ripple.findMany({
      where: { 
        id: { in: rippleIds },
        ...(waveId ? { waveId } : {}),
        ...(my_waves && userWaveIds.length > 0 ? { waveId: { in: userWaveIds } } : {})
      },
      include: {
        wave: { select: { id: true, name: true, icon: true } },
        _count: {
          select: {
            memberships: { where: { isActive: true } }
          }
        }
      }
    });

    // Create lookup map
    const rippleMap = new Map(ripples.map(r => [r.id, r]));

    // Build response with filtering applied
    const results = trendingScores
      .filter(score => rippleMap.has(score.rippleId))
      .slice(0, limit)
      .map(score => {
        const ripple = rippleMap.get(score.rippleId)!;
        const participants = ripple._count.memberships;
        
        // Calculate growth indicator
        const growthToday = score.newParticipants24h;
        
        return {
          id: ripple.id,
          title: ripple.title,
          wave: {
            id: ripple.wave.id,
            name: ripple.wave.name,
            icon: ripple.wave.icon
          },
          participants,
          growth_today: growthToday,
          trending_score: Math.round(score.score * 100) / 100, // Round to 2 decimals
          actions_24h: score.actions24h,
          // User membership status
          user_is_member: false // Will be set below
        };
      });

    // Check user membership for displayed ripples
    if (results.length > 0) {
      const memberships = await prisma.userRipple.findMany({
        where: {
          userId,
          rippleId: { in: results.map(r => r.id) },
          isActive: true
        },
        select: { rippleId: true }
      });
      
      const memberRippleIds = new Set(memberships.map(m => m.rippleId));
      results.forEach(r => {
        r.user_is_member = memberRippleIds.has(r.id);
      });
    }

    res.json({
      ripples: results,
      filters: {
        wave_id: waveId || null,
        my_waves_only: my_waves
      },
      meta: {
        total_available: trendingScores.length,
        returned: results.length
      }
    });

  } catch (error) {
    console.error("Trending error:", error);
    res.status(500).json({ error: "Failed to get trending data" });
  }
});

// GET /trending/waves - get trending stats per wave for user's waves
router.get("/waves", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    // Get user's waves
    const userRipples = await prisma.userRipple.findMany({
      where: { userId, isActive: true },
      include: { 
        ripple: { 
          include: { 
            wave: { select: { id: true, name: true, icon: true } }
          } 
        } 
      }
    });

    const userWaves = new Map();
    userRipples.forEach(ur => {
      const wave = ur.ripple.wave;
      if (!userWaves.has(wave.id)) {
        userWaves.set(wave.id, {
          id: wave.id,
          name: wave.name,
          icon: wave.icon,
          user_ripple_count: 0
        });
      }
      userWaves.get(wave.id).user_ripple_count++;
    });

    // Get trending data for each wave
    const waveStats = [];
    for (const wave of userWaves.values()) {
      const trendingScores = await getCachedTrending(wave.id);
      const topRipples = trendingScores ? trendingScores.slice(0, 3) : [];
      
      waveStats.push({
        ...wave,
        top_trending_count: topRipples.length,
        total_trending_score: topRipples.reduce((sum, s) => sum + s.score, 0)
      });
    }

    // Sort by total trending score
    waveStats.sort((a, b) => b.total_trending_score - a.total_trending_score);

    res.json({ waves: waveStats });

  } catch (error) {
    console.error("Trending waves error:", error);
    res.status(500).json({ error: "Failed to get wave trending data" });
  }
});

// POST /trending/refresh - manually refresh trending (dev/admin only)
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const scores = await calculateAllTrendingScores();
    await cacheTrendingResults(scores);
    
    res.json({ 
      ok: true, 
      updated: scores.length,
      message: "Trending scores refreshed" 
    });
  } catch (error) {
    console.error("Trending refresh error:", error);
    res.status(500).json({ error: "Failed to refresh trending" });
  }
});

export default router;