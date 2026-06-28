// Resend Email Service for Liceo Cares Ticketing System
// Uses Resend API to send email notifications

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = "Liceo Cares <noreply@raijintech.dev>";

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
 * Send email - uses /api/send-email endpoint
 * In development: Vite proxies to local dev server (localhost:3001)
 * In production: Vercel serverless function handles the request
 */
export const sendEmail = async ({ to, subject, html }) => {
  if (!to) {
    console.log("No recipient email provided, skipping email notification");
    return { success: false, error: "No recipient email" };
  }

  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        html,
      }),
    });

    // Check if response has content before parsing JSON
    const text = await response.text();
    if (!text) {
      console.error("Empty response from email API");
      return { success: false, error: "Empty response from server" };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse response:", text);
      return { success: false, error: "Invalid response from server" };
    }

    if (!response.ok) {
      console.error("Email API error:", data);
      return { success: false, error: data.error || "Failed to send email" };
    }

    console.log("Email sent successfully:", data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error("Error sending email:", error);
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
