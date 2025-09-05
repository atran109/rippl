import { Router } from 'express';
import { prisma } from '../src/db.js';
import { requireAuth } from '../middleware/auth.js';
import { runStoriesJob } from '../src/stories/generateStories.js';
import { z } from 'zod';

const router = Router();

// GET /stories/:rippleId - Get stories for a specific ripple
router.get('/stories/:rippleId', requireAuth, async (req, res) => {
  const { rippleId } = req.params;
  const userId = (req as any).userId as string;
  
  // Verify user has access to this ripple
  const membership = await prisma.userRipple.findUnique({
    where: {
      userId_rippleId: { userId, rippleId }
    }
  });
  
  if (!membership || !membership.isActive) {
    return res.status(403).json({ error: 'Access denied to this ripple' });
  }
  
  const stories = await prisma.rippleActivity.findMany({
    where: { rippleId },
    orderBy: { createdAt: 'desc' },
    take: 50, // Limit to recent stories
    select: {
      id: true,
      city: true,
      blurb: true,
      createdAt: true
    }
  });
  
  res.json(stories);
});

// GET /stories/community - Get community-wide stories (all user's ripples)
router.get('/community', requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  
  // Get all user's active ripples
  const userRipples = await prisma.userRipple.findMany({
    where: { userId, isActive: true },
    select: { rippleId: true }
  });
  
  const rippleIds = userRipples.map(ur => ur.rippleId);
  
  if (rippleIds.length === 0) {
    return res.json([]);
  }
  
  const stories = await prisma.rippleActivity.findMany({
    where: { 
      rippleId: { in: rippleIds } 
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Limit for performance
    select: {
      id: true,
      city: true,
      blurb: true,
      createdAt: true,
      ripple: {
        select: {
          id: true,
          title: true,
          wave: {
            select: {
              name: true,
              icon: true
            }
          }
        }
      }
    }
  });
  
  res.json(stories);
});

// POST /admin/generate-stories - Manual story generation (admin/dev use)
router.post('/admin/generate-stories', async (req, res) => {
  try {
    const result = await runStoriesJob();
    res.json({ 
      success: true, 
      message: 'Stories generated successfully',
      ...result 
    });
  } catch (error) {
    console.error('Story generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate stories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const testStoriesSchema = z.object({
  rippleId: z.string(),
  count: z.number().int().min(1).max(10).default(3)
});

// POST /admin/test-stories - Create test stories for development
router.post('/admin/test-stories', async (req, res) => {
  const parsed = testStoriesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  
  const { rippleId, count } = parsed.data;
  
  // Verify ripple exists
  const ripple = await prisma.ripple.findUnique({
    where: { id: rippleId }
  });
  
  if (!ripple) {
    return res.status(404).json({ error: 'Ripple not found' });
  }
  
  const testStories = [
    'Boston • 5 people asked coworkers how they\'re really doing',
    'New York • 8 people shared mental health resources',
    'Seattle • 3 people took mindful breaks',
    'Austin • 4 people picked up litter',
    'Portland • 6 people brought reusable items',
    'Denver • 7 people made conscious purchases',
    'Chicago • 9 people supported local businesses',
    'Miami • 4 people donated to community causes',
    'San Francisco • 5 people shared opportunities',
    'Los Angeles • 3 people advocated for healthier work norms'
  ];
  
  const createdStories = [];
  for (let i = 0; i < Math.min(count, testStories.length); i++) {
    const story = await prisma.rippleActivity.create({
      data: {
        rippleId,
        city: testStories[i].split(' • ')[0],
        blurb: testStories[i]
      }
    });
    createdStories.push(story);
  }
  
  res.json({ 
    success: true,
    message: `Created ${createdStories.length} test stories`,
    stories: createdStories
  });
});

export default router;