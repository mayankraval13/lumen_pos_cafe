import { Resend } from "resend";
import { normalizeSignupEmail } from "./signupOtpConfig";

export async function sendSignupOtpEmail(toEmail: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM must be set to send signup OTP emails");
  }

  const resend = new Resend(apiKey);
  const to = normalizeSignupEmail(toEmail);

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Your Lumen POS verification code",
    html: `
      <p style="font-family: system-ui, sans-serif; font-size: 16px; color: #111;">
        Your verification code is:
      </p>
      <p style="font-family: ui-monospace, monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: #2d2f2f;">
        ${code}
      </p>
      <p style="font-family: system-ui, sans-serif; font-size: 14px; color: #666;">
        This code expires in 10 minutes. If you did not request it, you can ignore this email.
      </p>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send verification email");
  }
}
