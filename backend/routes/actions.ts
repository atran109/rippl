import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { redis } from "../src/redis.js";
import { impactCalculationService } from "../src/services/impact/ImpactCalculationService.js";
import { trendingCalculationService } from "../src/services/trending/TrendingCalculationService.js";

//writes ActionLog, bumps Redis counters, optional note with length and toxicity checks, drops a simple RippleActivity row

// --- Notes guardrails ---
const MAX_NOTE = 120;
const BAD_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "slur1",
  "slur2", // expand later
];

function isToxic(note: string) {
  const s = note.toLowerCase();
  return BAD_WORDS.some((w) => s.includes(w));
}

// Per-user 3 notes/day using Redis (UTC)
function todayKey(userId: string) {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return `notes:count:${userId}:${d}`;
}

//rate limit to avoid scam
async function incNotesToday(userId: string) {
  const key = todayKey(userId);
  const n = await redis.incr(key);
  if (n === 1) {
    // set TTL to expire in ~26h just in case clock skew; good enough for MVP
    await redis.expire(key, 26 * 3600);
  }
  return n;
}

const router = Router();

const bodySchema = z.object({
  microActionId: z.string().cuid(),
  city: z.string().max(64).optional(),
  note_text: z.string().max(MAX_NOTE).optional(),
  share_anonymously: z.boolean().optional(),
});

router.post("/complete", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });

  const { microActionId, city, note_text, share_anonymously } = parsed.data;

  // Validate micro-action + look up ripple/wave/bucket
  const ma = await prisma.microAction.findUnique({
    where: { id: microActionId },
    include: { ripple: { include: { wave: true } } },
  });
  if (!ma) return res.status(404).json({ error: "Micro-action not found" });

  // Notes guardrails
  if (note_text && note_text.length > MAX_NOTE) {
    return res.status(400).json({ error: `Note too long (max ${MAX_NOTE})` });
  }
  if (note_text && isToxic(note_text)) {
    return res.status(400).json({ error: "Note contains disallowed language" });
  }
  if (note_text) {
    const count = await incNotesToday(userId);
    if (count > 3) {
      return res
        .status(429)
        .json({ error: "Daily note limit reached (3/day)" });
    }
  }

  // Write ActionLog
  await prisma.actionLog.create({
    data: {
      userId,
      microActionId: ma.id,
      rippleId: ma.rippleId,
      waveId: ma.ripple.waveId,
      bucket: ma.bucket,
      city,
      noteText: note_text,
      shareAnon: !!share_anonymously,
    },
  });

  // Very lightweight activity blurb (worker will aggregate later)
  // minimal phrasing by bucket; expand later
  const phraseMap: Record<string, string> = {
    conversation_checkin: "checked in on someone",
    share_resources: "shared therapy resources",
    self_care_moment: "took a short mindful break",
    workplace_advocacy: "nudged for a healthier work norm",
    pick_up_litter: "picked up litter",
    bring_reusable: "brought a reusable",
    recycle_correctly: "sorted recycling",
    conserve_energy_short: "saved a bit of energy",
    conscious_purchase: "made a conscious purchase",
    donate_small: "donated a small amount",
    share_opportunity: "shared an opportunity",
    support_bipoc: "supported a local business",
  };
  const phrase = phraseMap[ma.bucket] ?? "completed an action";

  await prisma.rippleActivity.create({
    data: {
      rippleId: ma.rippleId,
      city,
      blurb: `${phrase}.`,
    },
  });

  // ✨ NEW: Trigger impact and trending calculations
  try {
    // Update trending counters (Redis + database sync)
    await trendingCalculationService.onActionCompleted(ma.rippleId);
    
    // Update impact calculations (user summary + ripple impact)
    await impactCalculationService.onActionCompleted(userId, ma.rippleId);
    
    console.log(`✅ Action completed and calculations triggered for user ${userId}, ripple ${ma.rippleId}`);
  } catch (error) {
    console.error(`❌ Error in post-action calculations:`, error);
    // Don't fail the request - calculations are not critical for action completion
  }

  res.json({ ok: true });
});

export default router;
