import express from "express";
import cors from "cors";
import authRouter from "../routes/auth.js";
import onboardingRouter from "../routes/onboarding.js";
import meRouter from "../routes/me.js";
import rippleRouter from '../routes/ripples.js'
import actionsRouter from '../routes/actions.js'

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/", onboardingRouter); // /waves, /dream, /ripple/:id/join
app.use("/me", meRouter);
app.use("/ripple", rippleRouter)
app.use("/actions", actionsRouter)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running http://localhost:${PORT}`));
