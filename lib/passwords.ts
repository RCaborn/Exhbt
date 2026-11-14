import "server-only";
import { z } from "zod/v4";
import { usernameProblem } from "./hosts";

/**
 * Password rules shared by signup and "set a password".
 * Supabase stores the real password (bcrypt, 72 bytes). This file only checks
 * the length, and hashes a copy for the in-memory store used when Supabase is off.
 */

const PBKDF2_ITERATIONS = 100_000;

export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Use at most 72 characters.";
  if (email && password.toLowerCase() === email.toLowerCase()) return "Don't use your email address as the password.";
  return null;
}

/**
 * A login field is an email address or a username. Null when the shape is fine.
 * An unknown name is not a shape error: that comes back as a failed sign-in.
 */
export function loginIdentifierProblem(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return "Enter your email address or username.";
  if (s.includes("@")) {
    return z.email().safeParse(s).success ? null : "Enter a valid email address, or your username.";
  }
  return usernameProblem(s) ? "Enter a valid email address, or your username." : null;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hexStr: string): Uint8Array | null {
  if (hexStr.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hexStr)) return null;
  const out = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Hash for the development store. Production passwords stay in Supabase Auth. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${hex(salt)}$${hex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, rounds, saltHex, hashHex] = stored.split("$");
  if (kind !== "pbkdf2" || rounds !== String(PBKDF2_ITERATIONS)) return false;
  const salt = saltHex ? fromHex(saltHex) : null;
  const expected = hashHex ? fromHex(hashHex) : null;
  if (!salt || !expected) return false;
  const bits = await pbkdf2(password, salt);
  return safeEqual(bits, expected);
}

type Slot = { hash: string };
const g = globalThis as unknown as { __exhbtPasswords?: Map<string, Slot> };
const passwords = () => (g.__exhbtPasswords ??= new Map<string, Slot>());

export function devPassword(email: string): string | null {
  return passwords().get(email)?.hash ?? null;
}

export function setDevPassword(email: string, hash: string) {
  passwords().set(email, { hash });
}

export function forgetDevPassword(email: string) {
  passwords().delete(email);
}

let dummy: Promise<string> | null = null;

/** Wrong password and unknown email take the same time. */
export async function passwordMatches(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    dummy ??= hashPassword("not-a-real-password");
    await verifyPassword(password, await dummy);
    return false;
  }
  return verifyPassword(password, stored);
}

type Reset = { email: string; exp: number };
const resetsGlobal = globalThis as unknown as { __exhbtResets?: Map<string, Reset> };
const resets = () => (resetsGlobal.__exhbtResets ??= new Map<string, Reset>());

/** One-hour token for the development password-reset link. Not used when Supabase is on. */
export function issueDevReset(email: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = hex(bytes);
  resets().set(token, { email, exp: Date.now() + 60 * 60 * 1000 });
  return token;
}

export function peekDevReset(token: string): string | null {
  const row = resets().get(token);
  if (!row || row.exp < Date.now()) {
    if (row) resets().delete(token);
    return null;
  }
  return row.email;
}

export function consumeDevReset(token: string) {
  resets().delete(token);
}
