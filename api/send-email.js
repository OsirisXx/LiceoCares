// Vercel Serverless Function to send emails via Resend SDK

import { Resend } from "resend";

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
        console.error("RESEND_API_KEY not configured");
        return res.status(500).json({ 
            error: "Email service not configured. RESEND_API_KEY is missing.",
            debug: "Please add RESEND_API_KEY to your Vercel environment variables"
        });
    }

    try {
        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({ error: "Missing required fields: to, subject, html" });
        }

        // Initialize Resend with API key
        const resend = new Resend(apiKey);

        // Use environment variable for sender, fallback to default
        const fromEmail = process.env.RESEND_FROM || "Liceo Cares <noreply@raijintech.dev>";
        
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        });

        if (error) {
            console.error("Resend API error:", error);
            return res.status(500).json({ error: error.message || "Failed to send email" });
        }

        console.log("Email sent successfully:", data.id);
        return res.status(200).json({ success: true, id: data.id });
    } catch (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: error.message || "Unknown error occurred" });
    }
}
