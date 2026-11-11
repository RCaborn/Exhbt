import { NextResponse, type NextRequest } from "next/server";

/**
 * Account deletion moved to a same-origin server action (app/(app)/account/actions.ts).
 * Keep this path as a 405 so old cross-site form posts cannot delete an account.
 */
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/account", req.url), 303);
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/account", req.url), 303);
}
