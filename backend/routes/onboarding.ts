import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { redis } from "../src/redis.js";
import { z } from "zod";

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

const joinWaveSchema = z.object({
  waveId: z.string().cuid(),
});

// POST /join-wave  (join a wave and auto-join starter ripple)
router.post("/join-wave", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = joinWaveSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });

  const { waveId } = parsed.data;

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

  // Redis trending signal: track join in time-windowed sorted set
  const now = Date.now();
  await redis.zadd(`ripple:${starter.id}:joins`, now, `${now}-${userId}`);

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

  // if no primary, set this as primary
  const hasPrimary = await prisma.userRipple.findFirst({
    where: { userId, isPrimary: true },
  });
  if (!hasPrimary)
    await prisma.userRipple.update({
      where: { id: up.id },
      data: { isPrimary: true },
    });

  // Redis trending signal: track join in time-windowed sorted set
  const now = Date.now();
  await redis.zadd(`ripple:${id}:joins`, now, `${now}-${userId}`);

  res.json({ ok: true });
});

export default router;
