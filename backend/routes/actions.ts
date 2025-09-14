import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { redis } from "../src/redis.js";

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
    where: { id: microActionId }
  });
  if (!ma) return res.status(404).json({ error: "Micro-action not found" });

  // Get ripple with wave and summary info for impact calculation
  const ripple = await prisma.ripple.findUnique({
    where: { id: ma.rippleId },
    include: { 
      wave: {
        select: {
          impactCoef: true,
          impactUnit: true,
          impactSource: true
        }
      }
    }
  });
  if (!ripple) return res.status(404).json({ error: "Ripple not found" });

  // Get ripple summary separately
  const summary = await prisma.rippleSummary.findUnique({
    where: { rippleId: ma.rippleId }
  });

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
      waveId: ripple.waveId,
      bucket: ma.bucket,
      city,
      noteText: note_text,
      shareAnon: !!share_anonymously,
    },
  });

  // Calculate and increment impact (lifetime)
  try {
    // Get the bucket weight for impact eligibility
    const bucketWeight = await prisma.waveBucket.findUnique({
      where: {
        waveId_name: {
          waveId: ripple.waveId,
          name: ma.bucket
        }
      },
      select: { weight: true }
    });
    
    if (bucketWeight) {
      // Calculate impact delta: weight * coefficient
      const deltaImpact = bucketWeight.weight * ripple.wave.impactCoef;
      
      // Update RippleSummary lifetime impact
      if (summary) {
        await prisma.rippleSummary.update({
          where: { rippleId: ma.rippleId },
          data: { 
            impactValue: { increment: deltaImpact },
            actionsTotal: { increment: 1 }
          }
        });
      } else {
        // Create summary if it doesn't exist
        await prisma.rippleSummary.create({
          data: {
            rippleId: ma.rippleId,
            participants: 0, // Will be updated by workers
            actionsTotal: 1,
            impactValue: deltaImpact,
            impact30d: 0, // Will be computed by worker
            impactUnit: ripple.wave.impactUnit,
            impactSource: ripple.wave.impactSource
          }
        });
      }
      
      // Invalidate 30-day impact caches for user, ripple, and wave
      await redis.del(`impact:user:${userId}:30d`);
      await redis.del(`impact:ripple:${ma.rippleId}:30d`);
      await redis.del(`impact:wave:${ripple.waveId}:30d`);
    }
  } catch (error) {
    console.warn('Impact calculation failed (non-blocking):', error);
    // Don't fail the action if impact calculation fails
  }

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

  // Redis trending signals using sorted sets (time windows) + boost
  const now = Date.now();
  const rippleId = ma.rippleId;
  
  // Track action in time-windowed sorted set
  await redis.zadd(`ripple:${rippleId}:actions`, now, `${now}-${userId}`);
  
  // Boost impulse with decay tracking
  await redis.hincrbyfloat(`ripple:${rippleId}`, "boost", 10);
  await redis.hset(`ripple:${rippleId}`, "last_boost_ts", now);

  res.json({ ok: true });
});

export default router;
