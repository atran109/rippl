import { Router } from "express";
import { prisma } from "../src/db.js";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../src/env.js";

const router = Router();

const loginCreds = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerCreds = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6),
});

// POST /auth/register
router.post("/register", async (req, res) => {
  const parsed = registerCreds.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });

  const { email, username, password } = parsed.data;
  
  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return res.status(409).json({ error: "Email already in use" });

  // Check if username already exists
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ 
    data: { email, username, passwordHash } 
  });

  res.status(201).json({ 
    id: user.id, 
    email: user.email, 
    username: user.username 
  });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const parsed = loginCreds.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

export default router;
