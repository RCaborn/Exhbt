import "server-only";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adds a List-Unsubscribe header (marketing-capable mail). */
  unsubscribeUrl?: string;
};

export type OutboxEntry = Email & { id: string; sentAt: string; via: "resend" | "outbox" };

const g = globalThis as unknown as { __exhbtOutbox?: OutboxEntry[] };

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/**
 * Sends one email. With RESEND_API_KEY set it uses Resend's HTTP API; otherwise the
 * message goes to an in-memory outbox you can read at /dev/emails (development only).
 * Throws on a provider error so callers can decide whether that should fail the flow.
 */
export async function sendEmail(email: Email): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    ...email,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    via: isEmailConfigured() ? "resend" : "outbox",
  };

  if (!isEmailConfigured()) {
    (g.__exhbtOutbox ??= []).unshift(entry);
    console.info(`[email:outbox] to=${email.to} subject="${email.subject}" (view at /dev/emails)`);
    return entry;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Exhbt <hello@exhbt.example>",
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.unsubscribeUrl
        ? { "List-Unsubscribe": `<${email.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
  return entry;
}

/** Development outbox, newest first. Empty in production. */
export function outbox(): OutboxEntry[] {
  return g.__exhbtOutbox ?? [];
}
