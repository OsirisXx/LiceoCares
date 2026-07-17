/* global process */
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { queueEmail } from "./email-sender.js";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.DEV_APP_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    const idempotencyKey = req.get("Idempotency-Key");
    if (typeof to !== "string" || typeof subject !== "string" || typeof html !== "string" || !idempotencyKey) return res.status(400).json({ error: "Invalid email request." });
    const queued = await queueEmail({ to, subject, html, idempotencyKey, tags: { app: "liceo-cares", event: "ticket-confirmation", environment: "development" } });
    return res.status(202).json({ success: true, id: queued.id, status: queued.status });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Unable to queue email." });
  }
});

app.listen(3001, () => console.log("Email queue adapter listening on http://localhost:3001"));
