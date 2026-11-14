import { INVITE_DAYS } from "@/lib/team-rules";

/**
 * Team emails (decision 0013): an invite to join an exhbt, a request to join sent to an
 * exhbt's owner, and the note that a request was approved. Same layout and colours as
 * sign-in.ts: table layout, inline styles, one mint button with ink text.
 */

const C = { ink: "#0e0f12", ink2: "#3e4044", sky: "#f6f7f8", mint: "#4fe9b4" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Common = {
  privacyUrl: string;
  /** Absolute URL of public/brand/exhbt-mark.png. Without it the header is the wordmark alone. */
  logoUrl?: string;
};

type Mail = { subject: string; html: string; text: string };

/** One email: a heading, paragraphs, one button, a note under it, and the footer line. Values are escaped here. */
function layout(o: Common & { subject: string; preview: string; heading: string; paragraphs: string[]; button: { href: string; label: string }; note: string; why: string }): string {
  const p = (s: string) => `<tr><td style="padding:12px 32px 0;font:400 16px/1.55 Arial,sans-serif;color:${C.ink2}">${esc(s)}</td></tr>`;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.sky}">
<div style="display:none;max-height:0;overflow:hidden">${esc(o.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sky}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 32px 0;font:800 22px/1 Arial,sans-serif;color:${C.ink};letter-spacing:-0.5px">
${o.logoUrl ? `<img src="${esc(o.logoUrl)}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;margin-right:7px;border:0">` : ""}<span style="vertical-align:middle;letter-spacing:-1px">exhbt</span></td></tr>
<tr><td style="padding:24px 32px 0;font:800 26px/1.2 Arial,sans-serif;color:${C.ink};letter-spacing:-0.6px">${esc(o.heading)}</td></tr>
${o.paragraphs.map(p).join("\n")}
<tr><td style="padding:24px 32px 0"><a href="${esc(o.button.href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 16px/1 Arial,sans-serif;text-decoration:none;background:${C.mint};color:${C.ink};border:1.5px solid ${C.mint}">${esc(o.button.label)}</a></td></tr>
<tr><td style="padding:20px 32px 32px;font:400 14px/1.6 Arial,sans-serif;color:${C.ink2}">${esc(o.note)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font:400 12px/1.6 Arial,sans-serif;color:${C.ink2}">
${esc(o.why)} <a href="${esc(o.privacyUrl)}" style="color:${C.ink2}">Privacy</a>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

const titled = (title: string) => (title.trim() ? `“${title.trim()}”` : "an untitled exhbt");

/** To the person invited. The link opens the accept page; they sign in with this address to accept. */
export function teamInviteEmail(o: Common & { ownerName: string; title: string; role: string; acceptUrl: string }): Mail {
  const subject = `${o.ownerName} invited you to a project on Exhbt`;
  const project = titled(o.title);
  const paragraphs = [
    `${o.ownerName} is writing up ${project} on Exhbt and wants to add you as a teammate${o.role ? `, as “${o.role}”` : ""}.`,
    "If you accept, your name, photo and role show on the project when it's published. You can leave it at any time.",
  ];
  const note = `The link works for ${INVITE_DAYS} days. To accept, sign in with this email address. If you don't know ${o.ownerName}, ignore this email.`;
  const why = "You're getting this because someone typed this address into an invite on Exhbt.";
  return {
    subject,
    html: layout({ ...o, subject, preview: `Accept to have your name on ${project}.`, heading: "Join a team project", paragraphs, button: { href: o.acceptUrl, label: "Accept the invite" }, note, why }),
    text: ["Join a team project", "", ...paragraphs, "", `Accept the invite: ${o.acceptUrl}`, "", note, "", `Privacy: ${o.privacyUrl}`].join("\n"),
  };
}

/**
 * To an exhbt's owner, when someone whose upload matched a file on it asks to join. The owner
 * sees who is asking; the person asking has seen nothing about the owner.
 */
export function joinRequestEmail(o: Common & { requesterName: string; requesterEmail: string; role: string | null; title: string; reviewUrl: string }): Mail {
  const project = titled(o.title);
  const subject = `${o.requesterName} asked to join ${project}`;
  const paragraphs = [
    `${o.requesterName} (${o.requesterEmail}) uploaded a file that's also on your exhbt ${project}, and says you worked on the project together.${o.role ? ` Their part: “${o.role}”.` : ""}`,
    "If that's right, add them as a teammate. If not, decline. Nothing changes on your exhbt, and they won't find out who you are.",
  ];
  const note = "Files are matched only when they're identical. Group projects often share files, so a match on its own isn't a problem.";
  const why = "You're getting this because a file on one of your exhbts matched someone's upload.";
  return {
    subject,
    html: layout({ ...o, subject, preview: "Someone says they worked on this project with you.", heading: "A request to join your exhbt", paragraphs, button: { href: o.reviewUrl, label: "Review the request" }, note, why }),
    text: ["A request to join your exhbt", "", ...paragraphs, "", `Review the request: ${o.reviewUrl}`, "", note, "", `Privacy: ${o.privacyUrl}`].join("\n"),
  };
}

/** To the person who asked to join, once the owner says yes. Only now do they learn whose exhbt it is. */
export function joinApprovedEmail(o: Common & { ownerName: string; title: string; url: string }): Mail {
  const project = titled(o.title);
  const subject = `You're on ${project} as a teammate`;
  const paragraphs = [
    `${o.ownerName} added you as a teammate on ${project}. Your name, photo and role show on it when it's published.`,
    "You can make your own exhbt from the project too, with its files ready to draft from.",
  ];
  const note = "You can leave the project at any time from Your exhbts.";
  const why = "You're getting this because you asked to join this project on Exhbt.";
  return {
    subject,
    html: layout({ ...o, subject, preview: `${o.ownerName} added you to the project.`, heading: "You're on the team", paragraphs, button: { href: o.url, label: "See your team projects" }, note, why }),
    text: ["You're on the team", "", ...paragraphs, "", `See your team projects: ${o.url}`, "", note, "", `Privacy: ${o.privacyUrl}`].join("\n"),
  };
}
