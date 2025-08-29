import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { updateRippleCounters } from "../src/trending.js";

const router = Router();

// GET /waves  (for onboarding UI list)
router.get("/waves", async (_req, res) => {
  const waves = await prisma.wave.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      impactUnit: true,
      impactSource: true,
    },
  });
  res.json(waves);
});

const dreamSchema = z.object({
  title: z.string().min(3),
  waveId: z.string().cuid(),
});

// POST /dream  (set or update user's dream + auto-join starter ripple)
router.post("/dream", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = dreamSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });

  const { title, waveId } = parsed.data;

  // upsert Dream
  await prisma.dream.upsert({
    where: { userId },
    create: { userId, waveId, title },
    update: { waveId, title },
  });

  // find starter ripple in that wave (fallback: first ripple)
  let starter = await prisma.ripple.findFirst({
    where: { waveId, isStarter: true },
  });
  if (!starter) {
    starter = await prisma.ripple.findFirst({
      where: { waveId },
      orderBy: { title: "asc" },
    });
  }
  if (!starter)
    return res.status(400).json({ error: "No ripple available for this wave" });

  // upsert membership; ensure one primary
  const up = await prisma.userRipple.upsert({
    where: { userId_rippleId: { userId, rippleId: starter.id } },
    update: { isActive: true },
    create: { userId, rippleId: starter.id, isActive: true },
  });

  // Check if this is a new membership to update counters
  const isNewMembership = up.joinedAt.getTime() > (Date.now() - 60000); // Within last minute
  if (isNewMembership) {
    // Update trending counters for new participant using Redis directly
    const { redis } = await import("../src/redis.js");
    await redis.hincrby(`ripple:${starter.id}`, "new_participants_24h", 1);
  }

  // if user has no primary, set this one
  const hasPrimary = await prisma.userRipple.findFirst({
    where: { userId, isPrimary: true },
  });
  if (!hasPrimary) {
    await prisma.userRipple.update({
      where: { id: up.id },
      data: { isPrimary: true },
    });
  }

  res.json({ ok: true, primary_ripple_id: starter.id });
});

// POST /ripple/:id/join  (manual join from UI; optional but handy now)
router.post("/ripple/:id/join", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const up = await prisma.userRipple.upsert({
    where: { userId_rippleId: { userId, rippleId: id } },
    update: { isActive: true },
    create: { userId, rippleId: id, isActive: true },
  });

  // Check if this is a new membership to update counters
  const isNewMembership = up.joinedAt.getTime() > (Date.now() - 60000); // Within last minute
  if (isNewMembership) {
    // Update trending counters for new participant using Redis directly
    const { redis } = await import("../src/redis.js");
    await redis.hincrby(`ripple:${id}`, "new_participants_24h", 1);
  }

  // if no primary, set this as primary
  const hasPrimary = await prisma.userRipple.findFirst({
    where: { userId, isPrimary: true },
  });
  if (!hasPrimary)
    await prisma.userRipple.update({
      where: { id: up.id },
      data: { isPrimary: true },
    });

  res.json({ ok: true });
});

export default router;
