import "server-only";
import { cookies, headers } from "next/headers";
import type { RoadmapRecord } from "./store";
import type { SessionUser } from "./auth";

/**
 * Who may see a roadmap: its signed-in owner, or the browser that created it.
 * The browser keeps an HMAC-signed list of roadmap ids in an httpOnly cookie,
 * so possessing a URL alone is never enough.
 */

const COOKIE = "exhbt_rm";
const MAX_IDS = 10;

function secret() {
  const s = process.env.EXHBT_COOKIE_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("Set EXHBT_COOKIE_SECRET in production.");
  return s ?? "dev-only-secret-change-me";
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Signs any short payload. Also used for unsubscribe tokens. */
export async function sign(payload: string): Promise<string> {
  return `${Buffer.from(payload).toString("base64url")}.${await hmac(payload)}`;
}

/** Returns the payload if the signature is valid, otherwise null. */
export async function verify(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const payload = Buffer.from(body, "base64url").toString();
  return (await hmac(payload)) === sig ? payload : null;
}

async function readIds(): Promise<string[]> {
  const payload = await verify((await cookies()).get(COOKIE)?.value);
  return payload ? payload.split(",").filter(Boolean) : [];
}

/** Remember that this browser created the roadmap. Call from a server action or route handler. */
export async function grantBrowserAccess(roadmapId: string) {
  const ids = [roadmapId, ...(await readIds()).filter((i) => i !== roadmapId)].slice(0, MAX_IDS);
  (await cookies()).set(COOKIE, await sign(ids.join(",")), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function canView(roadmap: RoadmapRecord, user: SessionUser | null): Promise<boolean> {
  if (user && roadmap.userId === user.id) return true;
  return (await readIds()).includes(roadmap.id);
}

/** A one-way hash of the caller's IP, for rate limiting without storing the address. */
export async function callerIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return hmac(`ip:${ip}`);
}
