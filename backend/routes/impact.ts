import { Router } from "express";
import { prisma } from "../src/db.js";
import { requireAuth } from "../middleware/auth.js";
import { 
  calculateRippleImpact,
  calculateUserImpact,
  calculateImpactIndex,
  getCachedImpact,
  cacheImpactResults,
  formatImpactValue,
  getImpactExplanation
} from "../src/impact.js";
import { z } from "zod";

const router = Router();

// GET /impact/ripple/:id - get impact calculation for specific ripple
router.get("/ripple/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    // Try cached first
    let impact = await getCachedImpact(id);
    
    if (!impact) {
      // Calculate fresh
      impact = await calculateRippleImpact(id);
      await cacheImpactResults(id, impact);
    }

    // Calculate impact index
    const impactIndex = await calculateImpactIndex(id);

    res.json({
      ripple_id: impact.rippleId,
      wave: {
        id: impact.waveId,
        name: impact.waveName
      },
      impact: {
        value: impact.impactValue,
        formatted: formatImpactValue(impact.impactValue, impact.impactUnit),
        unit: impact.impactUnit,
        source: impact.impactSource
      },
      actions: {
        total: impact.totalActions,
        eligible: impact.eligibleActions
      },
      impact_index: impactIndex.isVisible ? {
        value: impactIndex.index,
        visible: true,
        explanation: `${impactIndex.index.toFixed(2)}x the wave median`
      } : {
        visible: false,
        reason: "Not enough data (need ≥8 participants and ≥20 eligible actions)"
      },
      bucket_breakdown: Object.entries(impact.bucketBreakdown).map(([bucket, data]) => ({
        bucket,
        count: data.count,
        weight: data.weight,
        contribution: data.contribution,
        impact_value: Math.abs(data.contribution * impact.impactCoef)
      })),
      calculated_at: impact.calculatedAt
    });

  } catch (error) {
    console.error("Ripple impact error:", error);
    res.status(500).json({ error: "Failed to calculate ripple impact" });
  }
});

// GET /impact/user - get user's personal impact across all ripples
router.get("/user", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;

  try {
    const userImpact = await calculateUserImpact(userId);

    // Get user's activity history (last 30 actions)
    const recentActions = await prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        micro: { select: { text: true, bucket: true } },
        ripple: { select: { title: true } },
        wave: { select: { name: true, impactUnit: true, impactCoef: true } }
      }
    });

    // Calculate impact for each recent action
    const activityHistory = recentActions.map(action => {
      // Get bucket weight for this wave
      const waveName = action.wave.name;
      const bucketWeight = 1; // Simplified - you'd get this from BUCKET_WEIGHTS
      const actionImpact = Math.abs(bucketWeight * action.wave.impactCoef);

      return {
        date: action.createdAt.toISOString().split('T')[0],
        ripple_title: action.ripple.title,
        action_text: action.micro.text.slice(0, 80) + (action.micro.text.length > 80 ? "..." : ""),
        bucket: action.micro.bucket,
        impact: {
          value: actionImpact,
          formatted: formatImpactValue(actionImpact, action.wave.impactUnit),
          unit: action.wave.impactUnit
        },
        note: action.noteText ? action.noteText.slice(0, 80) + (action.noteText.length > 80 ? "..." : "") : null,
        note_full: action.noteText // Full note for expand
      };
    });

    res.json({
      individual_impact: {
        total_actions: userImpact.totalActions,
        eligible_actions: userImpact.totalEligibleActions,
        ripples_joined: userImpact.ripplesJoined,
        overall_impact_value: userImpact.totalImpact
      },
      impact_by_wave: Object.entries(userImpact.impactByWave).map(([waveName, data]) => ({
        wave_name: waveName,
        actions: data.actions,
        eligible_actions: data.eligible,
        impact: {
          value: data.impact,
          formatted: formatImpactValue(data.impact, data.unit),
          unit: data.unit
        }
      })),
      activity_history: activityHistory
    });

  } catch (error) {
    console.error("User impact error:", error);
    res.status(500).json({ error: "Failed to calculate user impact" });
  }
});

// GET /impact/explanation/:waveName - get impact calculation explanation
router.get("/explanation/:waveName", async (req, res) => {
  const { waveName } = req.params;

  try {
    const explanation = getImpactExplanation(decodeURIComponent(waveName));

    res.json({
      wave_name: waveName,
      explanation: {
        what_we_count: explanation.whatWeCcount,
        formula: explanation.formula,
        sources_and_caveats: explanation.sourcesAndCaveats
      }
    });

  } catch (error) {
    console.error("Impact explanation error:", error);
    res.status(500).json({ error: "Failed to get impact explanation" });
  }
});

// GET /impact/wave/:id/summary - get wave-level impact summary
router.get("/wave/:id/summary", requireAuth, async (req, res) => {
  const { id: waveId } = req.params;
  const userId = (req as any).userId as string;

  try {
    // Get wave info
    const wave = await prisma.wave.findUnique({
      where: { id: waveId }
    });

    if (!wave) {
      return res.status(404).json({ error: "Wave not found" });
    }

    // Get all ripples in wave that user is part of
    const userRipples = await prisma.userRipple.findMany({
      where: {
        userId,
        isActive: true,
        ripple: { waveId }
      },
      include: { ripple: true }
    });

    // Calculate total impact for user's ripples in this wave
    let totalWaveImpact = 0;
    let totalActions = 0;
    let totalEligibleActions = 0;

    const rippleImpacts = [];
    for (const userRipple of userRipples) {
      const impact = await calculateRippleImpact(userRipple.ripple.id);
      rippleImpacts.push({
        ripple_id: userRipple.ripple.id,
        ripple_title: userRipple.ripple.title,
        impact_value: impact.impactValue,
        actions: impact.totalActions,
        eligible_actions: impact.eligibleActions
      });

      totalWaveImpact += impact.impactValue;
      totalActions += impact.totalActions;
      totalEligibleActions += impact.eligibleActions;
    }

    res.json({
      wave: {
        id: wave.id,
        name: wave.name,
        icon: wave.icon,
        impact_unit: wave.impactUnit,
        impact_source: wave.impactSource
      },
      user_participation: {
        ripples_joined: userRipples.length,
        total_actions: totalActions,
        eligible_actions: totalEligibleActions,
        total_impact: {
          value: totalWaveImpact,
          formatted: formatImpactValue(totalWaveImpact, wave.impactUnit),
          unit: wave.impactUnit
        }
      },
      ripple_breakdown: rippleImpacts.map(ri => ({
        ...ri,
        impact_formatted: formatImpactValue(ri.impact_value, wave.impactUnit)
      }))
    });

  } catch (error) {
    console.error("Wave impact summary error:", error);
    res.status(500).json({ error: "Failed to get wave impact summary" });
  }
});

// POST /impact/refresh/:rippleId - manually refresh impact calculation
router.post("/refresh/:rippleId", requireAuth, async (req, res) => {
  const { rippleId } = req.params;

  try {
    const impact = await calculateRippleImpact(rippleId);
    await cacheImpactResults(rippleId, impact);

    res.json({
      ok: true,
      ripple_id: rippleId,
      impact_value: impact.impactValue,
      calculated_at: impact.calculatedAt
    });

  } catch (error) {
    console.error("Impact refresh error:", error);
    res.status(500).json({ error: "Failed to refresh impact calculation" });
  }
});

export default router;