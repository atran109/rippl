import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { getTrendingInfo } from "./trending.js";
import { getImpactIndex } from "./impact.js";

const router = Router();
//Returns hero stats (from RippleSummary), membership, and 3-5 recent blurbs

router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const ripple = await prisma.ripple.findUnique({
    where: { id },
    include: {
      wave: true,
      // Summary may be null if your worker hasn't run yet
      // (we'll fall back to zeros)
    },
  });
  if (!ripple) return res.status(404).json({ error: "Not found" });

  const summary = await prisma.rippleSummary.findUnique({
    where: { rippleId: id },
  });

  const membership = await prisma.userRipple.findUnique({
    where: { userId_rippleId: { userId, rippleId: id } },
  });

  // Recent 3–5 activity blurbs (simple MVP feed)
  const recent = await prisma.rippleActivity.findMany({
    where: { rippleId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Get trending info if ripple is in top 10
  const trending = await getTrendingInfo(id);
  
  // Get impact index if available
  const impactIndex = await getImpactIndex(id);

  res.json({
    id: ripple.id,
    title: ripple.title,
    wave: { id: ripple.wave.id, name: ripple.wave.name },
    stats: summary
      ? {
          participants: summary.participants,
          actions_total: summary.actionsTotal,
          impact: {
            value: summary.impactValue,
            unit: summary.impactUnit,
            source: summary.impactSource,
          },
        }
      : {
          participants: 0,
          actions_total: 0,
          impact: {
            value: 0,
            unit: ripple.wave.impactUnit,
            source: ripple.wave.impactSource,
          },
        },
    user_status: {
      is_member: !!membership?.isActive,
      is_primary: !!membership?.isPrimary,
    },
    recent_activity: recent.map((r) => ({ city: r.city, blurb: r.blurb })),
    ...(trending && { trending }),
    ...(impactIndex && { impact_index: impactIndex }),
    ...(summary && summary.impact30d !== 0 && { 
      impact_30d: { 
        value: summary.impact30d, 
        unit: summary.impactUnit 
      } 
    })
  });
});

export default router;
