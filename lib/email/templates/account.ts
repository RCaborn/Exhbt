/**
 * Emails for the two moments that still need a link: confirming a new address,
 * and setting a password on an account that doesn't have one yet.
 * Everyday login does not send this.
 */

const C = { ink: "#0e0f12", ink2: "#3e4044", sky: "#f6f7f8", mint: "#4fe9b4" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COPY = {
  confirm: {
    subject: "Confirm your email for Exhbt",
    preheader: "One tap to confirm your address. After that, use your password.",
    heading: "Confirm your email",
    body: "Tap the button to confirm this address and open your account. Next time, log in with your email or username and the password you chose.",
    button: "Confirm email",
    after: "The link works once and expires after an hour. If you didn't create an account, you can ignore this email.",
    reason: "You're getting this because someone created an Exhbt account with this address.",
  },
  reset: {
    subject: "Set your Exhbt password",
    preheader: "Use this link once to choose a password.",
    heading: "Set your password",
    body: "You asked to set a password. The button opens a page where you choose one. After that, log in with your email or username and the password.",
    button: "Set a password",
    after: "The link works once and expires after an hour. If you didn't ask for this, you can ignore this email.",
    reason: "You're getting this because someone asked to set a password for Exhbt with this address.",
  },
} as const;

export function accountEmail(opts: {
  kind: keyof typeof COPY;
  url: string;
  privacyUrl: string;
  logoUrl?: string;
}): { subject: string; html: string; text: string } {
  const { kind, url, privacyUrl, logoUrl } = opts;
  const c = COPY[kind];

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font:800 22px/1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.5px">
${logoUrl ? `<img src="${esc(logoUrl)}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0">` : ""}<span style="vertical-align:middle;letter-spacing:-1px">exhbt</span></td></tr>
<tr><td style="padding:24px 32px 0;font:800 28px/1.15 Arial,sans-serif;color:${C.ink};letter-spacing:-0.8px">${esc(c.heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">${esc(c.body)}</td></tr>
<tr><td style="padding:24px 32px 0"><a href="${esc(url)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 16px/1 Arial,sans-serif;text-decoration:none;background:${C.mint};color:${C.ink};border:1.5px solid ${C.mint}">${esc(c.button)}</a></td></tr>
<tr><td style="padding:20px 32px 32px;font:400 14px/1.6 Arial,sans-serif;color:${C.ink2}">${esc(c.after)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font:400 12px/1.6 Arial,sans-serif;color:${C.ink2}">
${esc(c.reason)} <a href="${esc(privacyUrl)}" style="color:${C.ink2}">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [c.heading, "", `${c.body} ${url}`, "", c.after, "", `Privacy: ${privacyUrl}`].join("\n");
  return { subject: c.subject, html, text };
}
