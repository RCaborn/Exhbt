import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { BRICOLAGE_600, INTER_400, INTER_600 } from "./fonts";

/**
 * Link-preview images (Open Graph, 1200×630) for a portfolio and each project, drawn with
 * next/og. The brand band: ink ground, white and #C9CBCF text, mint only for the mark and the
 * result number (mint on ink is 12.4:1). Fonts are bundled (lib/og/fonts.ts) so this runs on the
 * Cloudflare Worker. Keep it light: no remote fonts, one optional photo fetch.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const INK = "#0E0F12";
const MINT = "#4FE9B4";
const SOFT = "#C9CBCF";
const EDGE = "rgba(255,255,255,0.25)";

const buf = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

let fonts: { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[] | undefined;
const loadFonts = () =>
  (fonts ??= [
    { name: "Inter", data: buf(INTER_400), weight: 400, style: "normal" },
    { name: "Inter", data: buf(INTER_600), weight: 600, style: "normal" },
    { name: "Bricolage", data: buf(BRICOLAGE_600), weight: 600, style: "normal" },
  ]);

/** The image types the renderer can draw, by their first bytes. WebP and others: null (initials instead). */
function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

/** This request's origin, to resolve the relative /dev/files links used in development. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The person's photo (its signed URL, from loadPortfolio) as a data URL, or null: no photo, a
 * type the renderer can't draw, or the fetch failed. Then the card shows initials.
 */
export async function photoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(new URL(url, await origin()), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 2 * 1024 * 1024) return null;
    const type = imageType(bytes);
    if (!type) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220">
      <rect width="220" height="220" rx="55" fill={MINT} />
      <path d="M50 100V65a15 15 0 0 1 15-15h35M170 120v35a15 15 0 0 1-15 15h-35" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
      <circle cx="110" cy="110" r="16" fill={INK} />
    </svg>
  );
}

function Face({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>.
    return <img src={photo} width={size} height={size} alt="" style={{ borderRadius: size * 0.25, objectFit: "cover" }} />;
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: MINT,
        color: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: size * 0.36,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function Frame({ host, children }: { host: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: "white", padding: "64px 72px", fontFamily: "Inter" }}>
      {children}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", border: `2px solid ${EDGE}`, borderRadius: 999, padding: "8px 22px", fontSize: 26, color: "white" }}>{host}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Mark size={44} />
          <span style={{ fontFamily: "Bricolage", fontWeight: 600, fontSize: 40, letterSpacing: "-0.04em" }}>exhbt</span>
        </div>
      </div>
    </div>
  );
}

/** The glance page: photo (or initials), name, headline. */
export function portfolioCard({ name, headline, photo, host }: { name: string; headline: string | null; photo: string | null; host: string }) {
  return new ImageResponse(
    (
      <Frame host={host}>
        <div style={{ display: "flex", alignItems: "center", gap: 48, marginTop: 40 }}>
          <Face name={name} photo={photo} size={220} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontFamily: "Bricolage", fontWeight: 600, fontSize: 84, lineHeight: 1.02, letterSpacing: "-0.03em" }}>{clip(name, 40)}</div>
            {headline && <div style={{ marginTop: 20, fontSize: 36, lineHeight: 1.3, color: SOFT }}>{clip(headline, 90)}</div>}
            <div style={{ marginTop: 28, fontSize: 26, color: SOFT }}>Portfolio of checked project work</div>
          </div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: loadFonts() },
  );
}

/** One project: whose it is, the title, the headline number and up to three skills. */
export function projectCard({
  name,
  photo,
  host,
  title,
  headline,
  skills,
}: {
  name: string;
  photo: string | null;
  host: string;
  title: string;
  headline: { value: string; label: string } | null;
  skills: string[];
}) {
  return new ImageResponse(
    (
      <Frame host={host}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Face name={name} photo={photo} size={64} />
          <span style={{ fontSize: 30, fontWeight: 600 }}>{clip(name, 50)}</span>
        </div>
        <div style={{ marginTop: 34, fontFamily: "Bricolage", fontWeight: 600, fontSize: title.length > 50 ? 56 : 66, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          {clip(title, 80)}
        </div>
        {headline && (
          <div style={{ marginTop: 28, display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontFamily: "Bricolage", fontWeight: 600, fontSize: 96, lineHeight: 1, color: MINT, letterSpacing: "-0.03em" }}>{clip(headline.value, 14)}</span>
            <span style={{ fontSize: 32, color: SOFT }}>{clip(headline.label, 48)}</span>
          </div>
        )}
        {skills.length > 0 && (
          <div style={{ marginTop: 30, display: "flex", gap: 12 }}>
            {skills.slice(0, 3).map((s) => (
              <span key={s} style={{ border: `2px solid ${EDGE}`, borderRadius: 10, padding: "6px 16px", fontSize: 24, color: "white" }}>
                {clip(s, 32)}
              </span>
            ))}
          </div>
        )}
      </Frame>
    ),
    { ...OG_SIZE, fonts: loadFonts() },
  );
}
