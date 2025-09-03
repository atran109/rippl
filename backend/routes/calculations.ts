import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { impactCalculationService } from "../src/services/impact/ImpactCalculationService.js";
import { trendingCalculationService } from "../src/services/trending/TrendingCalculationService.js";
import { calculationScheduler } from "../src/services/CalculationScheduler.js";

const router = Router();

// Manual trigger endpoints (for testing and admin use)

/**
 * POST /calculations/impact/all
 * Manually trigger impact calculations for all ripples and users
 */
router.post("/impact/all", requireAuth, async (req, res) => {
  try {
    console.log('🚀 Manual trigger: calculating all impacts...');
    
    await impactCalculationService.calculateAllRippleImpacts();
    await impactCalculationService.calculateAllUserImpacts();
    
    res.json({ 
      ok: true, 
      message: "Impact calculations completed for all ripples and users" 
    });
  } catch (error) {
    console.error('❌ Error in manual impact calculation:', error);
    res.status(500).json({ 
      error: "Failed to calculate impacts", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /calculations/trending/all
 * Manually trigger trending calculations for all ripples
 */
router.post("/trending/all", requireAuth, async (req, res) => {
  try {
    console.log('🚀 Manual trigger: calculating all trending scores...');
    
    await trendingCalculationService.runTrendingCalculationCycle();
    
    res.json({ 
      ok: true, 
      message: "Trending calculations completed for all ripples" 
    });
  } catch (error) {
    console.error('❌ Error in manual trending calculation:', error);
    res.status(500).json({ 
      error: "Failed to calculate trending scores", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /calculations/all
 * Manually trigger all calculations (impact + trending)
 */
router.post("/all", requireAuth, async (req, res) => {
  try {
    console.log('🚀 Manual trigger: running all calculations...');
    
    await calculationScheduler.runAllCalculations();
    
    res.json({ 
      ok: true, 
      message: "All calculations completed successfully" 
    });
  } catch (error) {
    console.error('❌ Error in manual calculation trigger:', error);
    res.status(500).json({ 
      error: "Failed to run calculations", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /calculations/impact/user/:userId
 * Calculate impact for a specific user
 */
router.post("/impact/user/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🚀 Manual trigger: calculating impact for user ${userId}...`);
    
    await impactCalculationService.calculateUserImpactSummary(userId);
    
    res.json({ 
      ok: true, 
      message: `Impact calculation completed for user ${userId}` 
    });
  } catch (error) {
    console.error(`❌ Error calculating impact for user ${req.params.userId}:`, error);
    res.status(500).json({ 
      error: "Failed to calculate user impact", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /calculations/impact/ripple/:rippleId
 * Calculate impact for a specific ripple
 */
router.post("/impact/ripple/:rippleId", requireAuth, async (req, res) => {
  try {
    const { rippleId } = req.params;
    console.log(`🚀 Manual trigger: calculating impact for ripple ${rippleId}...`);
    
    await impactCalculationService.calculateRippleImpact(rippleId);
    await impactCalculationService.calculateImpactIndex(rippleId);
    
    res.json({ 
      ok: true, 
      message: `Impact calculation completed for ripple ${rippleId}` 
    });
  } catch (error) {
    console.error(`❌ Error calculating impact for ripple ${req.params.rippleId}:`, error);
    res.status(500).json({ 
      error: "Failed to calculate ripple impact", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /calculations/trending/top
 * Get current top trending ripples
 */
router.get("/trending/top", async (req, res) => {
  try {
    const { wave, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 10;
    
    const trending = await trendingCalculationService.getTrendingRipples(
      wave as string, 
      limitNum
    );
    
    res.json({ 
      ok: true, 
      trending,
      count: trending.length 
    });
  } catch (error) {
    console.error('❌ Error getting trending ripples:', error);
    res.status(500).json({ 
      error: "Failed to get trending ripples", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /calculations/trending/decay
 * Manually trigger trending counter decay
 */
router.post("/trending/decay", requireAuth, async (req, res) => {
  try {
    console.log('🚀 Manual trigger: decaying trending counters...');
    
    await trendingCalculationService.decayTrendingCounters();
    
    res.json({ 
      ok: true, 
      message: "Trending counter decay completed" 
    });
  } catch (error) {
    console.error('❌ Error in trending decay:', error);
    res.status(500).json({ 
      error: "Failed to decay trending counters", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
