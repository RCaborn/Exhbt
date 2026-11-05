import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

/** Records an upgrade click, then sends the visitor to pricing. */
export async function GET(req: NextRequest) {
  const from = new URL(req.url).searchParams.get("from")?.slice(0, 40) ?? "unknown";
  const user = await getCurrentUser();
  await getStore().logEvent("upgrade_clicked", user?.id ?? null, { from });
  return NextResponse.redirect(new URL("/pricing", req.url), 303);
}
