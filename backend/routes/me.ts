import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

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
      message: "No primary ripple yet. Join a wave to get started.",
      has_wave: false,
      wave: null,
      primary_ripple: null,
    });
  }

  // pick a random active micro-action in that ripple (MVP)
  const count = await prisma.microAction.count({
    where: { rippleId: primary.rippleId, status: "active" },
  });
  if (count === 0)
    return res.json({
      primary_ripple: {
        id: primary.ripple.id,
        title: primary.ripple.title,
        wave: { id: primary.ripple.wave.id, name: primary.ripple.wave.name },
      },
      wave: {
        id: primary.ripple.wave.id,
        name: primary.ripple.wave.name,
        description: primary.ripple.wave.description,
        icon: primary.ripple.wave.icon,
        impactUnit: primary.ripple.wave.impactUnit,
        impactSource: primary.ripple.wave.impactSource,
      },
      today_action: null,
      message: "No actions available in primary ripple.",
      has_wave: true,
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
    wave: {
      id: primary.ripple.wave.id,
      name: primary.ripple.wave.name,
      description: primary.ripple.wave.description,
      icon: primary.ripple.wave.icon,
      impactUnit: primary.ripple.wave.impactUnit,
      impactSource: primary.ripple.wave.impactSource,
    },
    today_action: ma ? { id: ma.id, text: ma.text, bucket: ma.bucket } : null,
    // Impact chip is implemented later (after ActionLogs/Impact worker)
    impact_chip: null,
    has_wave: true,
  });
});

// GET /me/profile - Get user profile including dream and username
router.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      dream: true,
      createdAt: true,
    }
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json(user);
});

// PUT /me/dream - Update user's dream
const dreamSchema = z.object({
  dream: z.string().min(1).max(500).optional(),
});

router.put("/dream", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = dreamSchema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { dream } = parsed.data;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { dream },
    select: {
      id: true,
      email: true,
      dream: true,
    }
  });

  res.json(updatedUser);
});

// PUT /me/username - Update user's username
const usernameSchema = z.object({
  username: z.string().min(1).max(50),
});

router.put("/username", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = usernameSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { username } = parsed.data;

  try {
    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username },
      select: {
        id: true,
        email: true,
        username: true,
        dream: true,
        createdAt: true,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Username update error:", error);
    res.status(500).json({ error: "Failed to update username" });
  }
});

// GET /me/actions/history - Get user's past completed actions
router.get("/actions/history", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const actionLogs = await prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 actions
      include: {
        micro: {
          select: {
            text: true,
          }
        },
        wave: {
          select: {
            name: true,
            color: true,
          }
        },
        ripple: {
          select: {
            title: true,
          }
        }
      }
    });

    const formattedActions = actionLogs.map(log => ({
      id: log.id,
      action_text: log.micro.text,
      wave_name: log.wave.name,
      wave_color: log.wave.color,
      ripple_title: log.ripple.title,
      note: log.noteText,
      completed_at: log.createdAt.toISOString(),
    }));

    res.json(formattedActions);
  } catch (error) {
    console.error("Error fetching action history:", error);
    res.status(500).json({ error: "Failed to fetch action history" });
  }
});

// GET /me/stats - Get individual user statistics
router.get("/stats", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    // Count ripples joined
    const ripplesJoined = await prisma.userRipple.count({
      where: { userId, isActive: true }
    });

    // Count actions taken
    const actionsTaken = await prisma.actionLog.count({
      where: { userId }
    });

    // Calculate impact index (simplified calculation)
    // For now, we'll count each action as 1 impact point
    // In the future, this could be more sophisticated based on wave.impactCoef
    const impactIndex = actionsTaken * 0.36; // Simplified calculation

    res.json({
      ripples_joined: ripplesJoined,
      actions_taken: actionsTaken,
      impact_index: Math.round(impactIndex * 100) / 100, // Round to 2 decimal places
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Failed to fetch user statistics" });
  }
});

export default router;
