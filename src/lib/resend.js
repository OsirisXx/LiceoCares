import { supabase } from "./supabase";

/** Queue a confirmation without exposing recipient, subject, or HTML controls. */
const queueTicketConfirmation = async ({ to, referenceNumber }) => {
  if (!to) return { success: false, error: "No recipient email" };
  if (!/^LDCU-[A-Z0-9]+-[A-Z0-9]+$/i.test(referenceNumber || "")) {
    return { success: false, error: "A valid ticket reference number is required" };
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { success: false, error: "Sign in is required to queue email" };
  }

  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "ticket-confirmation",
        referenceNumber: referenceNumber.toUpperCase(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data.error || "Failed to queue email" };
    }
    return { success: true, id: data.id, status: data.status };
  } catch (error) {
    console.error("Error queueing email:", error);
    return { success: false, error: "Unable to reach the email service" };
  }
};

export const sendTicketConfirmationEmail = queueTicketConfirmation;
