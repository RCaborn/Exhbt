/**
 * "Your first exhbt is live" email: sent once per person, when their first exhbt goes live at a public address
 * (lib/publish-follow-up.ts). Table layout and inline styles because email clients ignore most CSS. Colours are
 * the brand kit's (docs/brand.md) as plain hex. It follows the account emails: one button, a line saying why
 * it came, and a Privacy link; it is not a list, so it has no unsubscribe.
 */

const C = { ink: "#0e0f12", ink2: "#3e4044", sky: "#f6f7f8", mint: "#4fe9b4" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COPY = {
  subject: "Your first exhbt is live",
  preheader: "It has its own link now, and anyone you send it to can read it.",
  heading: "Your first exhbt is live",
  body: "Anyone with the link can read it now, with no account needed.",
  use: "Send it with an application, or put it on your CV or your LinkedIn profile, so an employer can see the work behind the claim.",
  button: "Open my exhbt",
  after: "If you change it later and publish again, the link stays the same.",
  reason: "You're getting this once, because you published your first exhbt on Exhbt.",
} as const;

export function firstExhbtLiveEmail(opts: {
  /** The exhbt's own address, on the person's portfolio host. */
  exhbtUrl: string;
  /** The portfolio's address. */
  portfolioUrl: string;
  privacyUrl: string;
  /** Absolute URL of public/brand/exhbt-mark.png. Without it the header is the wordmark alone. */
  logoUrl?: string;
}): { subject: string; html: string; text: string } {
  const { exhbtUrl, portfolioUrl, privacyUrl, logoUrl } = opts;
  const c = COPY;

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font:800 22px/1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.5px">
${logoUrl ? `<img src="${esc(logoUrl)}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0">` : ""}<span style="vertical-align:middle;letter-spacing:-1px">exhbt</span></td></tr>
<tr><td style="padding:24px 32px 0;font:800 28px/1.15 Arial,sans-serif;color:${C.ink};letter-spacing:-0.8px">${esc(c.heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">${esc(c.body)} <a href="${esc(exhbtUrl)}" style="color:${C.ink}">${esc(exhbtUrl)}</a></td></tr>
<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">${esc(c.use)}</td></tr>
<tr><td style="padding:24px 32px 0"><a href="${esc(exhbtUrl)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 16px/1 Arial,sans-serif;text-decoration:none;background:${C.mint};color:${C.ink};border:1.5px solid ${C.mint}">${esc(c.button)}</a></td></tr>
<tr><td style="padding:20px 32px 0;font:400 14px/1.6 Arial,sans-serif;color:${C.ink2}">Your portfolio, which lists every exhbt you publish, is at <a href="${esc(portfolioUrl)}" style="color:${C.ink}">${esc(portfolioUrl)}</a>. ${esc(c.after)}</td></tr>
<tr><td style="height:32px"></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font:400 12px/1.6 Arial,sans-serif;color:${C.ink2}">
${esc(c.reason)} <a href="${esc(privacyUrl)}" style="color:${C.ink2}">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    c.heading,
    "",
    `${c.body} ${exhbtUrl}`,
    "",
    c.use,
    "",
    `Your portfolio, which lists every exhbt you publish, is at ${portfolioUrl}. ${c.after}`,
    "",
    c.reason,
    `Privacy: ${privacyUrl}`,
  ].join("\n");

  return { subject: c.subject, html, text };
}
