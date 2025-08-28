import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateMicroActionForPrimary } from '../src/services/generator.js';

const router = Router();

// POST /actions/generate  → returns a fresh micro-action for user's primary ripple
router.post('/actions/generate', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const action = await generateMicroActionForPrimary(userId);
    if (!action) return res.status(404).json({ error: 'No action could be generated' });
    res.json({ today_action: action });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Generation failed' });
  }
});

export default router;