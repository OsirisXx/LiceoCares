/* global process */
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import sendEmailHandler from "../api/send-email.js";

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 3001);
const host = "127.0.0.1";
const origin = process.env.DEV_APP_ORIGIN || "https://localhost:5174";
app.disable("x-powered-by");
app.use(cors({ origin, methods: ["POST"], allowedHeaders: ["Authorization", "Content-Type"] }));
app.use(express.json({ limit: "2kb", strict: true }));
app.post("/api/send-email", sendEmailHandler);

app.listen(port, host, () => console.log(`Email queue adapter listening on http://${host}:${port}`));
