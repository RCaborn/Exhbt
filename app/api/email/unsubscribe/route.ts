import { NextResponse, type NextRequest } from "next/server";
import { verify } from "@/lib/access";
import { getStore } from "@/lib/store";

/**
 * Unsubscribe from marketing email. GET from the link in an email, or POST from a
 * mail client's one-click button (List-Unsubscribe-Post). The token is signed, so
 * nobody can unsubscribe someone else.
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const payload = await verify(url.searchParams.get("token") ?? undefined);
  if (!payload?.startsWith("unsub:")) return NextResponse.redirect(new URL("/unsubscribed?error=1", url.origin), 303);
  const email = payload.slice("unsub:".length);
  const store = getStore();
  await store.setMarketingOptIn(email, false);
  await store.logEvent("unsubscribed", null);
  return NextResponse.redirect(new URL("/unsubscribed", url.origin), 303);
}

export const GET = handle;
export const POST = handle;
