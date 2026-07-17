import { supabase } from "./supabase";

// Liceo Cares notification templates. Delivery is queued through the server-only EmailSender adapter.

// Liceo de Cagayan University Colors
const COLORS = {
  maroon: "#800020",
  gold: "#FFD700",
  lightMaroon: "#A0334D",
  darkGold: "#D4AF37",
};

/**
 * Generate HTML email template with Liceo branding
 */
const generateEmailTemplate = ({ title, greeting, content, footer }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${COLORS.maroon} 0%, ${COLORS.lightMaroon} 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: ${COLORS.gold}; font-size: 28px; font-weight: bold;">
                🎓 Liceo Cares
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Liceo de Cagayan University Feedback Management System
              </p>
            </td>
          </tr>
          
          <!-- Title Banner -->
          <tr>
            <td style="background-color: ${COLORS.gold}; padding: 15px 40px; text-align: center;">
              <h2 style="margin: 0; color: ${COLORS.maroon}; font-size: 18px; font-weight: 600;">
                ${title}
              </h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 25px 40px; border-top: 1px solid #eee;">
              ${footer || `
                <p style="margin: 0; color: #666; font-size: 13px; text-align: center;">
                  This is an automated message from Liceo Cares Feedback Management System.<br>
                  Please do not reply to this email.
                </p>
                <p style="margin: 15px 0 0 0; color: #999; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} Liceo de Cagayan University. All rights reserved.
                </p>
              `}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Generate ticket reference box HTML
 */
const ticketReferenceBox = (referenceNumber) => `
  <div style="background: linear-gradient(135deg, ${COLORS.maroon} 0%, ${COLORS.lightMaroon} 100%); border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
      Tracking Number
    </p>
    <p style="margin: 0; color: ${COLORS.gold}; font-size: 24px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 2px;">
      ${referenceNumber}
    </p>
  </div>
`;

/**
 * Queue a transactional email through the same-origin server adapter.
 * The central EmailSender project key remains server-side; the signed-in user
 * can queue confirmations only for their own email address.
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!to) return { success: false, error: "No recipient email" };

  const referenceNumber = subject.match(/\bLDCU-[A-Z0-9]+-[A-Z0-9]+\b/i)?.[0]?.toUpperCase();
  if (!referenceNumber) return { success: false, error: "A ticket reference number is required" };

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) return { success: false, error: "Sign in is required to queue email" };

  const idempotencyKey = `liceo-cares:${referenceNumber}:${subject}`.slice(0, 160);
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ to, subject, html, referenceNumber }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { success: false, error: data.error || "Failed to queue email" };
    console.log("Email queued successfully:", data.id);
    return { success: true, id: data.id, status: data.status };
  } catch (error) {
    console.error("Error queueing email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ticket confirmation email
 */
export const sendTicketConfirmationEmail = async ({
  to,
  referenceNumber,
  category,
  description,
}) => {
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
  const truncatedDesc =
    description.length > 200
      ? description.substring(0, 200) + "..."
      : description;

  const html = generateEmailTemplate({
    title: "Feedback Submitted Successfully",
    greeting: "Thank you for submitting your feedback to Liceo Cares.",
    content: `
      <p style="margin: 0 0 15px 0; color: #555; font-size: 15px; line-height: 1.6;">
        We have received your feedback and it is now pending review by the VP Admin. 
        You will receive email updates as your feedback progresses through our system.
      </p>
      
      ${ticketReferenceBox(referenceNumber)}
      
      <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;">
          <strong>Category:</strong> ${categoryLabel}
        </p>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          <strong>Description:</strong><br>
          ${truncatedDesc}
        </p>
      </div>
      
      <p style="margin: 20px 0 0 0; color: #555; font-size: 14px;">
        <strong>What happens next?</strong>
      </p>
      <ol style="margin: 10px 0; padding-left: 20px; color: #666; font-size: 14px; line-height: 1.8;">
        <li>Your feedback will be reviewed by the VP Admin</li>
        <li>If verified, it will be assigned to the appropriate department</li>
        <li>The department will work on resolving your concern</li>
        <li>You'll receive updates at each step of the process</li>
      </ol>
      
      <p style="margin: 20px 0 0 0; color: #888; font-size: 13px; text-align: center;">
        Save your tracking number to check the status of your feedback anytime.
      </p>
    `,
  });

  return sendEmail({
    to,
    subject: `[Liceo Cares] Feedback Received - ${referenceNumber}`,
    html,
  });
};
