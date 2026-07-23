/* global process */
const error = (status, message) => Object.assign(new Error(message), { status });

function config() {
  const url = process.env.EMAIL_SENDER_URL?.replace(/\/$/, "");
  const projectKey = process.env.EMAIL_SENDER_PROJECT_KEY;
  const from = process.env.EMAIL_SENDER_FROM;
  if (!url || !projectKey || !from) throw error(500, "Email queue is not configured.");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) throw error(500, "Email queue URL must use HTTPS.");
  return { url, projectKey, from };
}

function textFromHtml(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10000);
}

export async function queueEmail({ to, subject, html, idempotencyKey, tags }) {
  if (typeof to !== "string" || to.length > 254 || typeof subject !== "string" || subject.length > 200 || typeof html !== "string" || html.length > 20000 || typeof idempotencyKey !== "string" || idempotencyKey.length > 160) throw error(400, "Invalid queued email.");
  const { url, projectKey, from } = config();
  const response = await fetch(`${url}/api/v1/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${projectKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], subject, text: textFromHtml(html), html, tags }),
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw error(response.status, payload.error || "Email queue rejected the request.");
  return payload;
}
