import jwt from "jsonwebtoken";
import { env } from "../src/env.js";
export function requireAuth(req, res, next) {
    const header = req.headers.authorization; // "Bearer <token>"
    const token = header?.split(" ")[1];
    if (!token)
        return res.status(401).json({ error: "Missing token" });
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        req.userId = payload.sub;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
