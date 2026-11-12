import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APEX, parseHost } from "@/lib/hosts";
import { isPhase2Enabled as phase2 } from "@/lib/site";

/**
 * 1. Hosts (docs/decisions/0001): alex.exhbt.co.uk is rewritten to the portfolio route group
 *    (/p/alex/...), with no sign-in cookies on that host. Reserved or malformed names 404.
 * 2. Keeps the Supabase session cookie fresh on the routes that read it. A no-op when
 *    Supabase is not configured (local dev).
 */

/** Routes that read the session. Marketing pages stay static and fast. */
const SESSION_PATHS = ["/roadmap", "/account", "/api/account", "/api/roadmap", "/auth", "/login", "/exhbts", "/api/exhbts", "/api/files", "/api/username"];

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });

export async function middleware(req: NextRequest) {
  const rawHost = req.headers.get("host");
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
