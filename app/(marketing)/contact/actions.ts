"use server";

import { env, isConfigured, optional } from "@/lib/env";

/**
 * The public contact form.
 *
 * This is the one endpoint in the application that an anonymous visitor can
 * use to make the server send an email, so it is treated accordingly:
 *
 *   - **The sender is fixed.** The visitor's address goes in `replyTo`, never
 *     in `from`, so the message cannot be made to look like it came from
 *     somebody else.
 *   - **A honeypot field.** A hidden input no human ever fills in; anything
 *     that fills it is dropped, and told it succeeded so the bot stops
 *     retrying.
 *   - **A minimum fill time.** A form submitted within two seconds of being
 *     rendered was not typed by a person.
 *   - **Hard length limits**, so the mailbox cannot be flooded by one request.
 *
 * What it deliberately does not claim to be is rate limiting. That needs
 * shared state this app does not have on the public path; put a WAF or
 * Vercel's firewall in front if the form starts attracting attention.
 */
export type ContactState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const LIMITS = { name: 120, email: 200, company: 160, message: 4000 } as const;
const MIN_FILL_MS = 2000;

export async function sendContactMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = text(formData, "name", LIMITS.name);
  const email = text(formData, "email", LIMITS.email).toLowerCase();
  const company = text(formData, "company", LIMITS.company);
  const message = text(formData, "message", LIMITS.message);

  // --- Silent drops -------------------------------------------------------
  // Both of these mean "not a person". Report success so an automated client
  // has nothing to learn from the response.
  if (text(formData, "website", 200)) return { ok: true };

  const renderedAt = Number(formData.get("renderedAt"));
  if (Number.isFinite(renderedAt) && Date.now() - renderedAt < MIN_FILL_MS) {
    return { ok: true };
  }

  // --- Validation ---------------------------------------------------------
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Tell us who you are.";
  if (!email) fieldErrors.email = "We need an address to reply to.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That does not look like an email address.";
  }
  if (!message) fieldErrors.message = "Tell us what you need.";
  else if (message.length < 20) {
    fieldErrors.message = "A sentence or two would help us answer properly.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // --- Delivery -----------------------------------------------------------
  const to = optional("CONTACT_EMAIL", "");
  if (!to || !env.resend.configured) {
    // Never pretend a message was sent when it was not. The form shows the
    // fallback address in this case.
    return {
      error:
        "The contact form is not configured yet. Please email us directly — the address is below.",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resend.apiKey);

    const { error } = await resend.emails.send({
      // A fixed, verified sender. The visitor's address is a reply-to only.
      from: `${env.resend.fromName} <${env.resend.fromEmail}>`,
      replyTo: email,
      to: [to],
      subject: `Tracky enquiry — ${name}${company ? ` (${company})` : ""}`,
      text: [
        `Name:    ${name}`,
        `Email:   ${email}`,
        company ? `Company: ${company}` : null,
        "",
        message,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });

    if (error) {
      console.error("[contact] send failed", error);
      return {
        error:
          "We could not send that just now. Please try again, or email us directly.",
      };
    }
  } catch (error) {
    console.error("[contact] send threw", error);
    return {
      error:
        "We could not send that just now. Please try again, or email us directly.",
    };
  }

  return { ok: true };
}

/** Whether the form can actually deliver, so the page can say so honestly. */
export async function contactIsConfigured(): Promise<boolean> {
  return isConfigured("CONTACT_EMAIL") && env.resend.configured;
}

/** The address to show as a fallback, if one is configured. */
export async function contactAddress(): Promise<string | null> {
  return optional("CONTACT_EMAIL", "") || null;
}

function text(formData: FormData, field: string, max: number): string {
  const value = formData.get(field);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
