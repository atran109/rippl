import { Router } from "express";
import { prisma } from "../src/db.js";

const router = Router();

// GET /waves - Get all available waves
router.get("/", async (req, res) => {
  try {
    const waves = await prisma.wave.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        impactCoef: true,
        impactUnit: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(waves);
  } catch (error) {
    console.error("Error fetching waves:", error);
    res.status(500).json({ error: "Failed to fetch waves" });
  }
});

export default router;
