import { exhbtOf, sample } from "@/components/lab/samples";
import { labEnabled } from "@/components/lab/server";
import { headlineFor } from "@/lib/exhbt/headline";
import { portfolioHost } from "@/lib/hosts";
import { projectCard } from "@/lib/og/card";

/**
 * The link preview of one of the sample person's exhbts, for the finish screen (/lab/design/finish):
 * the picture LinkedIn, WhatsApp and the rest show when the exhbt's link is pasted.
 *
 * It is the real picture, drawn by the real renderer (`projectCard` in lib/og/card.tsx) with the same
 * fields the live route passes (app/(portfolio)/p/[username]/[slug]/preview.png/route.tsx). The live
 * route reads a portfolio from the database; the lab has none, so this one reads the sample instead.
 *
 * A route handler isn't drawn inside the lab's layout, so it carries the lab's gate itself: not found
 * wherever the lab is switched off (labEnabled, components/lab/server.ts).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!labEnabled()) return new Response("Not found", { status: 404 });
  const e = exhbtOf(new URL(req.url).searchParams.get("slug"));
  return projectCard({
    name: sample.owner.name,
    // The sample person has no photo, so the card shows her initials, as a real one would.
    photo: null,
    host: `${portfolioHost(sample.owner.username)}/${e.slug}`,
    title: e.doc.title,
    headline: headlineFor(e.doc),
    skills: e.doc.skills,
  });
}
