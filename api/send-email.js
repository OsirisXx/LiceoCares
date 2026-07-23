/* global process */
import { queueEmail } from "../server/email-sender.js";

const fail = (status, message) => Object.assign(new Error(message), { status });
const appUrl = () => (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/$/, "");
const anonKey = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const referencePattern = /^LDCU-[A-Z0-9]+-[A-Z0-9]+$/;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

async function authenticatedUser(authorization) {
  if (!authorization?.startsWith("Bearer ")) throw fail(401, "Sign in is required to queue email.");
  const response = await fetch(`${appUrl()}/auth/v1/user`, { headers: { apikey: anonKey(), Authorization: authorization } });
  if (!response.ok) throw fail(401, "Your session is no longer valid.");
  return response.json();
}

async function supabaseGet(path, authorization) {
  const response = await fetch(`${appUrl()}${path}`, { headers: { apikey: anonKey(), Authorization: authorization } });
  if (!response.ok) throw fail(403, "You are not authorized to access this ticket.");
  return response.json();
}

function confirmationHtml(complaint) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#333"><h2 style="color:#800020">Feedback received</h2><p>Thank you for submitting your feedback to Liceo Cares.</p><p><strong>Reference:</strong> ${escapeHtml(complaint.reference_number)}</p><p><strong>Category:</strong> ${escapeHtml(complaint.category)}</p><p><strong>Description:</strong><br>${escapeHtml(complaint.description).slice(0, 1000)}</p><p>You can use your reference number to track its progress.</p></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!appUrl() || !anonKey()) throw fail(500, "Supabase server configuration is missing.");
    if (JSON.stringify(req.body || {}).length > 1000) throw fail(413, "Request is too large.");
    const { event, referenceNumber } = req.body || {};
    if (event !== "ticket-confirmation" || typeof referenceNumber !== "string" || !referencePattern.test(referenceNumber)) throw fail(400, "Invalid notification request.");

    const authorization = req.headers.authorization;
    const user = await authenticatedUser(authorization);
    const email = (user.email || "").toLowerCase();
    if (!email.endsWith("@liceo.edu.ph") || user.app_metadata?.provider !== "google") throw fail(403, "Only signed-in Liceo students can queue confirmations.");

    const select = "id,reference_number,user_id,email,category,description,status";
    const [complaint] = await supabaseGet(`/rest/v1/complaints?select=${select}&reference_number=eq.${encodeURIComponent(referenceNumber)}`, authorization);
    if (!complaint || complaint.user_id !== user.id || (complaint.email || "").toLowerCase() !== email) throw fail(403, "This ticket does not belong to your account.");
    if (complaint.status !== "submitted") throw fail(409, "A confirmation can only be queued for a newly submitted ticket.");

    const subject = `[Liceo Cares] Feedback Received - ${complaint.reference_number}`;
    const idempotencyKey = `liceo-cares:${complaint.id}:ticket-confirmation`;
    const queued = await queueEmail({ to: complaint.email, subject, html: confirmationHtml(complaint), idempotencyKey, tags: { app: "liceo-cares", event } });
    return res.status(202).json({ success: true, id: queued.id, status: queued.status });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Unable to queue email." });
  }
}
