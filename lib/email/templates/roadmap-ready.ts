import type { Roadmap } from "@/lib/ai/schemas";

/**
 * "Your roadmap is ready" email. Table layout and inline styles because email clients
 * ignore most CSS. Colours mirror DESIGN.md as plain hex (email clients don't do oklch).
 */

const C = {
  ink: "#0f2240",
  ink2: "#4a5d78",
  sky: "#eef5fc",
  blue: "#a9d4f5",
  edge: "#4f86c6",
  rule: "#dbe5f0",
  green: "#3fc46f",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function roadmapReadyEmail(opts: {
  roadmap: Roadmap;
  viewUrl: string;
  signInUrl: string;
  unsubscribeUrl: string;
  privacyUrl: string;
  /** Absolute URL of public/brand/exhbt-mark.png. Without it the header is the wordmark alone. */
  logoUrl?: string;
}): { subject: string; html: string; text: string } {
  const { roadmap: r, viewUrl, signInUrl, unsubscribeUrl, privacyUrl, logoUrl } = opts;
  const role = r.targetRole || "your target role";
  const gaps = r.gaps.slice(0, 3);
  const projects = r.projects.slice(0, 2);
  const subject = `Your roadmap to ${role}`;

  const gapRows = gaps
    .map(
      (g) => `<tr><td style="padding:12px 0;border-top:1px solid ${C.rule};font:600 15px/1.4 Arial,sans-serif;color:${C.ink}">${esc(g.skill)}<div style="font:400 14px/1.5 Arial,sans-serif;color:${C.ink2};margin-top:2px">${esc(g.whyItMatters)}</div></td></tr>`,
    )
    .join("");

  const projectRows = projects
    .map(
      (p) => `<tr><td style="padding:14px 16px;background:${C.sky};border-radius:10px;font:600 15px/1.4 Arial,sans-serif;color:${C.ink}">${esc(p.title)}<div style="font:400 14px/1.5 Arial,sans-serif;color:${C.ink2};margin-top:4px">${esc(p.brief)}</div><div style="font:400 13px/1.5 Arial,sans-serif;color:${C.ink};margin-top:6px">You end up with: ${esc(p.deliverable)} &middot; ${p.weeks} ${p.weeks === 1 ? "week" : "weeks"}</div></td></tr><tr><td style="height:10px"></td></tr>`,
    )
    .join("");

  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 16px/1 Arial,sans-serif;text-decoration:none;${
      primary
        ? `background:${C.blue};color:${C.ink};border:1.5px solid ${C.edge}`
        : `background:#ffffff;color:${C.ink};border:1.5px solid ${C.ink}`
    }">${label}</a>`;

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden">${esc(r.summary || `The skills to build next for ${role}, and projects that prove them.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font:800 22px/1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.5px">
${logoUrl ? `<img src="${esc(logoUrl)}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0">` : ""}<span style="vertical-align:middle;letter-spacing:-1px">exhbt</span></td></tr>
<tr><td style="padding:24px 32px 0;font:800 30px/1.1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.8px">Your roadmap to ${esc(role)}</td></tr>
${r.summary ? `<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">${esc(r.summary)}</td></tr>` : ""}
<tr><td style="padding:24px 32px 0">${button(signInUrl, "See your full roadmap", true)}</td></tr>
${gaps.length ? `<tr><td style="padding:32px 32px 4px;font:800 18px/1.2 Arial,sans-serif;color:${C.ink}">Gaps to close</td></tr><tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${gapRows}</table></td></tr>` : ""}
${projects.length ? `<tr><td style="padding:28px 32px 12px;font:800 18px/1.2 Arial,sans-serif;color:${C.ink}">Projects that would prove them</td></tr><tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${projectRows}</table></td></tr>` : ""}
<tr><td style="padding:24px 32px 0">${button(signInUrl, "Open my full roadmap", false)}</td></tr>
<tr><td style="padding:16px 32px 32px;font:400 14px/1.6 Arial,sans-serif;color:${C.ink2}">These buttons sign you in and save the roadmap to your account, so you can open it on any device. No password needed. If the link has expired, go to <a href="${esc(viewUrl)}" style="color:${C.ink}">${esc(viewUrl)}</a> and log in with this email address.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font:400 12px/1.6 Arial,sans-serif;color:${C.ink2}">
You're getting this because you asked for a roadmap on Exhbt. <a href="${esc(unsubscribeUrl)}" style="color:${C.ink2}">Unsubscribe from updates</a> &middot; <a href="${esc(privacyUrl)}" style="color:${C.ink2}">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    `Your roadmap to ${role}`,
    r.summary,
    "",
    `See your full roadmap (signs you in, no password): ${signInUrl}`,
    "",
    gaps.length ? "Gaps to close" : "",
    ...gaps.map((g) => `- ${g.skill}: ${g.whyItMatters}`),
    "",
    projects.length ? "Projects that would prove them" : "",
    ...projects.map((p) => `- ${p.title} (${p.weeks} weeks): ${p.brief} You end up with: ${p.deliverable}`),
    "",
    `If that link has expired, go to ${viewUrl} and log in with this email address.`,
    "",
    `Unsubscribe from updates: ${unsubscribeUrl}`,
    `Privacy: ${privacyUrl}`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  return { subject, html, text };
}
