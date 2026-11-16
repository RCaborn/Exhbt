import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APEX, canonicalRedirectUrl, parseHost, toolRedirectUrl } from "@/lib/hosts";
import { isPhase2Enabled as phase2 } from "@/lib/site";

/**
 * 0. The apex redirects to www (308, path and query kept).
 * 1. Hosts (docs/decisions/0001): alex.exhbt.co.uk is rewritten to the portfolio route group
 *    (/p/alex/...), with no sign-in cookies on that host. Reserved or malformed names 404.
 *    www and the apex send /login, /roadmap and /auth to app.exhbt.co.uk (docs/phase-2.md).
 * 2. Keeps the Supabase session cookie fresh on the routes that read it. A no-op when
 *    Supabase is not configured (local dev).
 */

/** Routes that read the session. Marketing pages stay static and fast. */
const SESSION_PATHS = [
  "/admin",
  "/roadmap",
  "/account",
  "/api/account",
  "/api/roadmap",
  "/auth",
  "/login",
  "/exhbts",
  "/api/exhbts",
  "/api/files",
  "/api/username",
  "/job-links",
  "/team",
];

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

export async function middleware(req: NextRequest) {
  const rawHost = req.headers.get("host");
  // The apex goes to www first, so there is one host (and one host-only session cookie).
  // 308 keeps the method and body, which POSTs to /api/pv need. Register the Stripe webhook
  // on www.exhbt.co.uk: a redirect on the apex would be followed by Stripe only rarely.
  const canonical = canonicalRedirectUrl(rawHost, req.nextUrl.pathname, req.nextUrl.search);
  if (canonical) return NextResponse.redirect(canonical, 308);
  const host = parseHost(rawHost);
  const { pathname } = req.nextUrl;

  if (host.kind === "unknown") return notFound();
  if (host.kind === "portfolio") {
    if (!phase2()) return notFound();
    // Only portfolio pages live on a person's host: no app, no API, no sign-in.
    if (pathname.startsWith("/api/") || pathname.startsWith("/p/")) return notFound();
    const url = req.nextUrl.clone();
    url.pathname = `/p/${host.username}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  // On our real domains, portfolios are only reachable on their own host, never as /p/<name>.
  if (pathname.startsWith("/p/") && (rawHost ?? "").replace(/:\d+$/, "").endsWith(APEX)) return notFound();
  if (pathname.startsWith("/p/") && !phase2()) return notFound();

  const tool = toolRedirectUrl(rawHost, pathname, req.nextUrl.search);
  if (tool) return NextResponse.redirect(tool, 307);

  if (!SESSION_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request: req });
  if (!url || !key) return res;

  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = {
  // Every page and route except static files, so hosts can be routed.
  matcher: ["/((?!_next/|favicon.ico|icon.svg|apple-icon.png|brand/|robots.txt).*)"],
};
