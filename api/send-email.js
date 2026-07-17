/* global process */
import { queueEmail } from "../server/email-sender.js";

const fail = (status, message) => Object.assign(new Error(message), { status });
const appUrl = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function authenticatedUser(req) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) throw fail(401, "Sign in is required to queue email.");
  const response = await fetch(`${appUrl()}/auth/v1/user`, { headers: { apikey: anonKey(), Authorization: authorization } });
  if (!response.ok) throw fail(401, "Your session is no longer valid.");
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { to, subject, html } = req.body || {};
    const idempotencyKey = req.headers["idempotency-key"];
    if (!appUrl() || !anonKey()) throw fail(500, "Supabase server configuration is missing.");
    if (typeof to !== "string" || typeof subject !== "string" || typeof html !== "string" || !idempotencyKey || idempotencyKey.length > 160) throw fail(400, "Invalid email request.");
    const user = await authenticatedUser(req);
    if (!user.email || user.email.toLowerCase() !== to.toLowerCase()) throw fail(403, "Confirmation emails can only be sent to your signed-in email address.");
    const queued = await queueEmail({ to, subject, html, idempotencyKey, tags: { app: "liceo-cares", event: "ticket-confirmation" } });
    return res.status(202).json({ success: true, id: queued.id, status: queued.status });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Unable to queue email." });
  }
}
