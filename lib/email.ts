import { Resend } from "resend";
import nodemailer from "nodemailer";

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using whichever provider is configured:
 *   1. Resend      (if RESEND_API_KEY is set)
 *   2. SMTP        (if SMTP_HOST is set — e.g. local Mailpit/Mailhog)
 *   3. Log-only    (otherwise — prints the email to the server console)
 *
 * Always resolves; never throws into the request flow. Notifications are
 * best-effort and must not block the interest/accept/decline actions.
 */
export async function sendEmail(input: EmailInput): Promise<{ ok: boolean; via: string }> {
  const from = process.env.EMAIL_FROM || "Rent & Flatmate Finder <onboarding@resend.dev>";

  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      if (error) throw error;
      return { ok: true, via: "resend" };
    }

    if (process.env.SMTP_HOST) {
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 1025),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      return { ok: true, via: "smtp" };
    }

    // Log-only fallback so the notification flow is observable in dev.
    console.log(
      `\n📧 [email:log-only] To: ${input.to}\n   Subject: ${input.subject}\n   ${stripHtml(
        input.html
      )}\n`
    );
    return { ok: true, via: "log" };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false, via: "error" };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---- Templated notifications -------------------------------------------------

export function highScoreInterestEmail(args: {
  ownerName: string | null;
  tenantName: string | null;
  listingTitle: string;
  score: number;
}): { subject: string; html: string } {
  return {
    subject: `Strong match (${args.score}/100) interested in "${args.listingTitle}"`,
    html: `
      <div style="font-family:sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">New high-compatibility interest</h2>
        <p>Hi ${args.ownerName ?? "there"},</p>
        <p><strong>${args.tenantName ?? "A tenant"}</strong> just expressed interest in your listing
        <strong>"${args.listingTitle}"</strong> with a compatibility score of
        <strong>${args.score}/100</strong>.</p>
        <p>Log in to review and accept or decline the request.</p>
      </div>`,
  };
}

export function interestDecisionEmail(args: {
  tenantName: string | null;
  listingTitle: string;
  status: "accepted" | "declined";
}): { subject: string; html: string } {
  const accepted = args.status === "accepted";
  return {
    subject: `Your interest in "${args.listingTitle}" was ${args.status}`,
    html: `
      <div style="font-family:sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">Interest ${args.status}</h2>
        <p>Hi ${args.tenantName ?? "there"},</p>
        <p>The owner has <strong>${args.status}</strong> your interest in
        <strong>"${args.listingTitle}"</strong>.</p>
        ${
          accepted
            ? `<p>You can now chat with the owner in real time from your Interests page.</p>`
            : `<p>Keep browsing — there are more rooms that match your preferences.</p>`
        }
      </div>`,
  };
}
