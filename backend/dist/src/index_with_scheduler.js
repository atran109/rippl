import express from "express";
import cors from "cors";
import authRouter from "../routes/auth.js";
import onboardingRouter from "../routes/onboarding.js";
import meRouter from "../routes/me.js";
import rippleRouter from '../routes/ripples.js';
import actionsRouter from '../routes/actions.js';
import generationRouter from '../routes/generation.js';
import { calculationScheduler } from "./services/CalculationScheduler.js";
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/", onboardingRouter); // /waves, /join-wave, /ripple/:id/join
app.use("/me", meRouter);
app.use("/ripple", rippleRouter);
app.use("/actions", actionsRouter);
app.use("/", generationRouter);
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
    console.log(`API running http://localhost:${PORT}`);
    // ✨ Start the calculation scheduler for background jobs
    try {
        calculationScheduler.start();
        console.log('🚀 Impact & Trending calculation scheduler started');
    }
    catch (error) {
        console.error('❌ Error starting calculation scheduler:', error);
    }
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    calculationScheduler.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    calculationScheduler.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
