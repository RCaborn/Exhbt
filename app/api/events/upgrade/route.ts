import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { HOUR, rateLimited } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

const UPGRADE_LOGS_PER_IP_PER_HOUR = 30;

/** Records an upgrade click, then sends the visitor to pricing. */
export async function GET(req: NextRequest) {
  const from = new URL(req.url).searchParams.get("from")?.slice(0, 40) ?? "unknown";
  // Always send them to pricing; only skip the log when this IP is flooding it.
  if (!(await rateLimited("upgrade-event", UPGRADE_LOGS_PER_IP_PER_HOUR, HOUR))) {
    const user = await getCurrentUser();
    await getStore().logEvent("upgrade_clicked", user?.id ?? null, { from });
  }
  return NextResponse.redirect(new URL("/pricing", req.url), 303);
}
