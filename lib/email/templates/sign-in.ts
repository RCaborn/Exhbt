/**
 * The "sign in to Exhbt" email sent from /login. Same layout and colours as
 * roadmap-ready.ts. The link is a hashed-token link to /auth/confirm (signInLinkFor in
 * lib/auth.ts), so it works on any device, not only the browser that asked for it.
 */

const C = { ink: "#0e0f12", ink2: "#3e4044", sky: "#f6f7f8", mint: "#4fe9b4" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function signInEmail(opts: {
  signInUrl: string;
  privacyUrl: string;
  /** Absolute URL of public/brand/exhbt-mark.png. Without it the header is the wordmark alone. */
  logoUrl?: string;
}): { subject: string; html: string; text: string } {
  const { signInUrl, privacyUrl, logoUrl } = opts;
  const subject = "Your sign-in link for Exhbt";

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden">Tap the button to sign in. No password needed.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font:800 22px/1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.5px">
${logoUrl ? `<img src="${esc(logoUrl)}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0">` : ""}<span style="vertical-align:middle;letter-spacing:-1px">exhbt</span></td></tr>
<tr><td style="padding:24px 32px 0;font:800 28px/1.15 Arial,sans-serif;color:${C.ink};letter-spacing:-0.8px">Sign in to Exhbt</td></tr>
<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">Tap the button to sign in. It works on any device, and there&rsquo;s no password.</td></tr>
<tr><td style="padding:24px 32px 0"><a href="${esc(signInUrl)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 16px/1 Arial,sans-serif;text-decoration:none;background:${C.mint};color:${C.ink};border:1.5px solid ${C.mint}">Sign in</a></td></tr>
<tr><td style="padding:20px 32px 32px;font:400 14px/1.6 Arial,sans-serif;color:${C.ink2}">The link works once and expires after an hour. If you didn&rsquo;t ask to sign in, you can ignore this email.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font:400 12px/1.6 Arial,sans-serif;color:${C.ink2}">
You're getting this because someone asked to sign in to Exhbt with this address. <a href="${esc(privacyUrl)}" style="color:${C.ink2}">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    "Sign in to Exhbt",
    "",
    `Open this link to sign in. It works on any device, and there's no password: ${signInUrl}`,
    "",
    "The link works once and expires after an hour. If you didn't ask to sign in, you can ignore this email.",
    "",
    `Privacy: ${privacyUrl}`,
  ].join("\n");

  return { subject, html, text };
}
