import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /me/home
router.get("/home", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  // primary ripple
  const primary = await prisma.userRipple.findFirst({
    where: { userId, isActive: true, isPrimary: true },
    include: { ripple: { include: { wave: true } } },
  });

  if (!primary?.ripple) {
    return res.json({
      today_action: null,
      message: "No primary ripple yet. Set your Dream to get started.",
    });
  }

  // pick a random active micro-action in that ripple (MVP)
  const count = await prisma.microAction.count({
    where: { rippleId: primary.rippleId, status: "active" },
  });
  if (count === 0)
    return res.json({
      today_action: null,
      message: "No actions available in primary ripple.",
    });

  const skip = Math.floor(Math.random() * count);
  const ma = await prisma.microAction.findFirst({
    where: { rippleId: primary.rippleId, status: "active" },
    skip,
    take: 1,
  });

  res.json({
    primary_ripple: {
      id: primary.ripple.id,
      title: primary.ripple.title,
      wave: { id: primary.ripple.wave.id, name: primary.ripple.wave.name },
    },
    today_action: ma ? { id: ma.id, text: ma.text, bucket: ma.bucket } : null,
    // Impact chip is implemented later (after ActionLogs/Impact worker)
    impact_chip: null,
  });
});

export default router;
