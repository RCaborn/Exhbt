import { NextResponse, type NextRequest } from "next/server";
import { runInBackground } from "@/lib/background";
import { APEX, parseHost } from "@/lib/hosts";
import { allowView, cleanPath, cleanReferrerHost, isBot } from "@/lib/page-views";
import { getStore } from "@/lib/store";

/**
 * Records one anonymous page view (decision 0021). Called by the small beacon in the root layout
 * (components/site/PageViewBeacon.tsx), including from a person's portfolio host, which posts here
 * on the main site because that host serves no API. Always answers 204 and says nothing about
 * why a view was not counted.
 *
 * Nothing about the visitor is stored: not the IP, the user agent, a cookie or the signed-in
 * account. The connection address is used only as a key in a per-minute counter in this
 * process's memory, to stop one connection filling the table.
 */
const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  if (isBot(req.headers.get("user-agent"))) return done();

  // The page's own origin tells us which host it was on, and keeps other sites from posting here.
  let origin: URL;
  try {
    origin = new URL(req.headers.get("origin") ?? "");
  } catch {
    return done();
  }
  const ownHost = req.headers.get("host") ?? "";
  const originHost = origin.host.toLowerCase();
  const bare = originHost.replace(/:\d+$/, "");
  if (originHost !== ownHost.toLowerCase() && bare !== APEX && !bare.endsWith(`.${APEX}`) && !bare.endsWith(".localhost")) return done();

  const key = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = Number(process.env.EXHBT_PV_PER_MINUTE) || 60;
  if (!allowView(key, limit)) return done();

  let body: { p?: unknown; r?: unknown };
  try {
    body = JSON.parse((await req.text()).slice(0, 1000));
  } catch {
    return done();
  }
  const view = cleanPath(body.p, parseHost(originHost).kind === "portfolio");
  if (!view) return done();

  runInBackground(
    getStore().logEvent("page_view", null, {
      path: view.path,
      referrer: cleanReferrerHost(body.r, bare),
      is_portfolio: view.isPortfolio,
    }),
  );
  return done();
}
