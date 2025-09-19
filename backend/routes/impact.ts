import { Router } from 'express';
import { prisma } from '../src/db.js';
import { redis } from '../src/redis.js';
import { requireAuth } from '../middleware/auth.js';
import { runImpactCalculation, getUserImpact30d, impactWorker } from '../src/impact/impactWorker.js';
import { z } from 'zod';

const router = Router();

// GET /ripple/:id/impact - Get formatted impact data for UI display (public)
router.get('/ripple/:id/impact', async (req, res) => {
  try {
    const { id: rippleId } = req.params;
    
    // Get ripple with wave info
    const ripple = await prisma.ripple.findUnique({
      where: { id: rippleId },
      include: {
        wave: {
          select: {
            impactUnit: true,
            impactSource: true,
            impactVersion: true
          }
        }
      }
    });

    if (!ripple) {
      return res.status(404).json({ error: 'Ripple not found' });
    }

    // Get impact summary
    const summary = await prisma.rippleSummary.findUnique({
      where: { rippleId }
    });

    if (!summary) {
      return res.json({
        lifetime: {
          value: 0,
          display: "0",
          unit: ripple.wave.impactUnit,
          source: ripple.wave.impactSource,
          version: ripple.wave.impactVersion
        }
      });
    }

    // Format lifetime impact
    const lifetimeFormatted = formatImpactValue(summary.impactValue, ripple.wave.impactUnit);
    
    const result: any = {
      lifetime: {
        value: summary.impactValue,
        display: lifetimeFormatted.display,
        unit: ripple.wave.impactUnit,
        source: ripple.wave.impactSource,
        version: ripple.wave.impactVersion
      }
    };

    // Add 30-day impact if available and non-zero
    if (summary.impact30d && Math.abs(summary.impact30d) > 0.001) {
      const thirtyDayFormatted = formatImpactValue(summary.impact30d, ripple.wave.impactUnit);
      result.thirtyDay = {
        value: summary.impact30d,
        display: thirtyDayFormatted.display,
        unit: ripple.wave.impactUnit
      };
    }

    // Add impact index if available
    const impactIndex = await getImpactIndex(rippleId);
    if (impactIndex) {
      result.impactIndex = impactIndex;
    }

    res.json(result);
    
  } catch (error) {
    console.error('Get ripple impact error:', error);
    res.status(500).json({ error: 'Failed to get impact data' });
  }
});

// GET /me/impact - Get user's personal impact (30-day)
router.get('/me/impact', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    
    const impact = await getUserImpact30d(userId);
    
    if (!impact) {
      return res.json({ 
        impact_chip: null,
        message: "Complete some actions to see your impact!" 
      });
    }
    
    // Format for display
    const formattedValue = formatImpactValue(impact.value, impact.unit);
    
    res.json({
      impact_chip: {
        value: formattedValue.value,
        display: formattedValue.display,
        unit: impact.unit,
        window: "30d",
        actions: impact.actions
      }
    });
    
  } catch (error) {
    console.error('Get user impact error:', error);
    res.status(500).json({ error: 'Failed to get impact data' });
  }
});

// GET /waves/:id/impact - Get wave-level impact data
router.get('/waves/:id/impact', async (req, res) => {
  try {
    const { id: waveId } = req.params;
    
    // Get cached wave impact data
    const cached = await redis.get(`impact:wave:${waveId}:30d`);
    if (cached) {
      const waveData = JSON.parse(cached);
      const formattedValue = formatImpactValue(waveData.impact30d, waveData.impactUnit);
      
      return res.json({
        impact_30d: {
          value: formattedValue.value,
          display: formattedValue.display,
          unit: waveData.impactUnit,
          source: waveData.impactSource
        },
        median_ripple_impact: waveData.medianRippleImpact,
        active_ripples: waveData.rippleCount,
        updated_at: new Date().toISOString()
      });
    }
    
    // Fallback: get wave info and return structure
    const wave = await prisma.wave.findUnique({
      where: { id: waveId },
      select: { impactUnit: true, impactSource: true }
    });
    
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }
    
    res.json({
      impact_30d: {
        value: 0,
        display: "0",
        unit: wave.impactUnit,
        source: wave.impactSource
      },
      median_ripple_impact: 0,
      active_ripples: 0,
      updated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get wave impact error:', error);
    res.status(500).json({ error: 'Failed to get wave impact' });
  }
});

// GET /admin/impact/config - Get all wave impact configurations  
router.get('/admin/impact/config', async (req, res) => {
  try {
    const waves = await prisma.wave.findMany({
      select: {
        id: true,
        name: true,
        impactCoef: true,
        impactUnit: true,
        impactSource: true,
        impactVersion: true,
        waveBuckets: {
          select: {
            name: true,
            weight: true
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ waves });
  } catch (error) {
    console.error('Get impact config error:', error);
    res.status(500).json({ error: 'Failed to get impact configuration' });
  }
});

const updateWaveImpactSchema = z.object({
  impactCoef: z.number().optional(),
  impactUnit: z.string().min(1).optional(),
  impactSource: z.string().min(1).optional(),
  impactVersion: z.string().min(1).optional(),
  bucketWeights: z.record(z.string(), z.number().min(0).max(1)).optional()
});

// PUT /admin/wave/:id/impact - Update wave impact configuration
router.put('/admin/wave/:id/impact', async (req, res) => {
  try {
    const { id: waveId } = req.params;
    const parsed = updateWaveImpactSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues });
    }
    
    const { impactCoef, impactUnit, impactSource, impactVersion, bucketWeights } = parsed.data;
    
    // Check if wave exists
    const wave = await prisma.wave.findUnique({ where: { id: waveId } });
    if (!wave) {
      return res.status(404).json({ error: 'Wave not found' });
    }
    
    // Update wave impact properties if provided
    const updateData: any = {};
    if (impactCoef !== undefined) updateData.impactCoef = impactCoef;
    if (impactUnit !== undefined) updateData.impactUnit = impactUnit;
    if (impactSource !== undefined) updateData.impactSource = impactSource;
    if (impactVersion !== undefined) updateData.impactVersion = impactVersion;
    
    if (Object.keys(updateData).length > 0) {
      await prisma.wave.update({
        where: { id: waveId },
        data: updateData
      });
    }
    
    // Update bucket weights if provided
    if (bucketWeights) {
      for (const [bucketName, weight] of Object.entries(bucketWeights)) {
        await prisma.waveBucket.upsert({
          where: {
            waveId_name: { waveId, name: bucketName }
          },
          update: { weight },
          create: {
            waveId,
            name: bucketName,
            weight
          }
        });
      }
    }
    
    // Clear related caches
    await redis.del(`impact:wave:${waveId}:30d`);
    const ripples = await prisma.ripple.findMany({
      where: { waveId },
      select: { id: true }
    });
    
    const pipeline = redis.pipeline();
    ripples.forEach(ripple => {
      pipeline.del(`impact:ripple:${ripple.id}:card`);
    });
    await pipeline.exec();
    
    res.json({ 
      success: true, 
      message: 'Impact configuration updated successfully',
      changes: {
        waveUpdates: Object.keys(updateData),
        bucketUpdates: bucketWeights ? Object.keys(bucketWeights) : []
      }
    });
    
  } catch (error) {
    console.error('Update wave impact error:', error);
    res.status(500).json({ error: 'Failed to update impact configuration' });
  }
});

// POST /admin/impact/recalculate - Recalculate 30-day impacts after config changes
router.post('/admin/impact/recalculate', async (req, res) => {
  try {
    const waveId = req.query.waveId as string;
    
    if (waveId) {
      // Recalculate specific wave
      const wave = await prisma.wave.findUnique({ where: { id: waveId } });
      if (!wave) {
        return res.status(404).json({ error: 'Wave not found' });
      }
      
      // Clear wave cache and trigger recalculation
      await redis.del(`impact:wave:${waveId}:30d`);
      
      res.json({ 
        success: true, 
        message: `Recalculation queued for wave: ${wave.name}. Run full impact calculation to complete.`
      });
    } else {
      // Full recalculation
      const result = await runImpactCalculation();
      
      res.json({
        ...result,
        message: result.success 
          ? `Full impact recalculation completed in ${result.duration}ms`
          : `Recalculation failed: ${result.error}`
      });
    }
    
  } catch (error) {
    console.error('Impact recalculation error:', error);
    res.status(500).json({ error: 'Failed to trigger recalculation' });
  }
});

// POST /admin/calculate-impact - Manual impact calculation
router.post('/admin/calculate-impact', async (req, res) => {
  try {
    const result = await runImpactCalculation();
    
    res.json({
      ...result,
      message: result.success 
        ? `Impact calculation completed in ${result.duration}ms`
        : `Failed: ${result.error}`
    });
  } catch (error) {
    console.error('Manual impact calculation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /admin/impact/debug - Debug impact data
router.get('/admin/impact/debug', async (req, res) => {
  try {
    const waveId = req.query.wave as string;
    
    if (waveId) {
      // Debug specific wave
      const waveData = await redis.get(`impact:wave:${waveId}:30d`);
      const rippleSummaries = await prisma.rippleSummary.findMany({
        where: { 
          ripple: { waveId }
        },
        include: {
          ripple: {
            select: { title: true, waveId: true }
          }
        },
        orderBy: { impact30d: 'desc' },
        take: 10
      });
      
      res.json({
        wave_cache: waveData ? JSON.parse(waveData) : null,
        top_ripples: rippleSummaries.map(s => ({
          id: s.rippleId,
          title: s.ripple.title,
          impact_lifetime: s.impactValue,
          impact_30d: s.impact30d,
          actions_total: s.actionsTotal,
          participants: s.participants
        }))
      });
    } else {
      // Debug overview
      const waves = await prisma.wave.findMany({
        select: { id: true, name: true, impactUnit: true }
      });
      
      const waveData = await Promise.all(
        waves.map(async wave => {
          const cached = await redis.get(`impact:wave:${wave.id}:30d`);
          return {
            id: wave.id,
            name: wave.name,
            unit: wave.impactUnit,
            cached_data: cached ? JSON.parse(cached) : null
          };
        })
      );
      
      res.json({
        waves: waveData,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Debug impact error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// Helper function for impact index
export async function getImpactIndex(rippleId: string): Promise<{
  index: number;
  description: string;
} | null> {
  try {
    const index = await impactWorker.calculateImpactIndex(rippleId);
    
    if (!index) return null;
    
    let description = '';
    if (index > 1.2) {
      description = 'Above average impact';
    } else if (index < 0.8) {
      description = 'Growing impact';
    } else {
      return null; // Too close to average to show
    }
    
    return { index, description };
    
  } catch (error) {
    console.warn('Failed to get impact index:', error);
    return null;
  }
}

// Helper function to format impact values for display
function formatImpactValue(value: number, unit: string): { value: number; display: string } {
  const absValue = Math.abs(value);
  
  if (unit.includes('stigma') || unit.includes('index')) {
    // Index values: 2 decimals, with direction indicator
    const formatted = value.toFixed(2);
    const display = value < 0 ? `↓${formatted.slice(1)}` : `↑${formatted}`;
    return { value: parseFloat(formatted), display };
  }
  
  if (unit === 'kg') {
    if (absValue < 0.1) {
      // Show in grams for small values
      const grams = Math.round(absValue * 1000);
      return { value: absValue, display: `${grams}g` };
    } else {
      // Show in kg with 1 decimal
      const formatted = absValue.toFixed(1);
      return { value: absValue, display: `${formatted} kg` };
    }
  }
  
  // Default formatting
  if (absValue < 1) {
    return { value, display: value.toFixed(2) };
  } else if (absValue < 10) {
    return { value, display: value.toFixed(1) };
  } else {
    return { value, display: Math.round(value).toString() };
  }
}

export default router;
