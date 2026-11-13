"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/use-hydrated";
import { slugify } from "@/lib/exhbt/slug";
import { createJobLink, readListing } from "../actions";

/**
 * The create step. The description is pasted (the main path) or read from a link; read text is
 * shown in full to check and edit before anything is matched. Then the address style, and
 * "Pick my exhbts" opens the edit screen with the picks.
 */

type Source = "paste" | "link";
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
const MIN_WORDS = 60;

export function NewJobLinkForm() {
  const router = useRouter();
  const ready = useHydrated();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState<Source>("paste");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [readFrom, setReadFrom] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [style, setStyle] = useState<"suffix" | "clean">("suffix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const example = slugify(company.trim() || "lloyds");
  const showDescription = source === "paste" || readFrom !== null;
  const words = countWords(description);

  async function read() {
    setReading(true);
    setReadError(null);
    try {
      const res = await readListing(url);
      if (res.ok) {
        setDescription(res.text);
        setReadFrom(res.url);
      } else {
        setReadError(res.reason);
      }
    } catch {
      setReadError("We couldn't reach the server. Check your connection, or paste the description instead.");
    } finally {
      setReading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!company.trim()) return setError("Add the company's name.");
    if (!role.trim()) return setError("Add the role title.");
    if (words < MIN_WORDS) return setError("Paste the whole job description: what the role involves and what they're looking for.");
    setBusy(true);
    try {
      const res = await createJobLink({
        company,
        roleTitle: role,
        description,
        listingUrl: source === "link" ? readFrom : null,
        slugStyle: style,
      });
      if (res.ok) {
        router.push(`/job-links/${res.id}`);
        return;
      }
      setError(res.error);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate data-ready={ready ? "true" : undefined} className="mt-8 space-y-6">
      <div>
        <label htmlFor="company" className="label">
          Company
        </label>
        <input id="company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="organization" readOnly={!ready} className="field mt-2" />
      </div>
      <div>
        <label htmlFor="role" className="label">
          Role title
        </label>
        <input id="role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} readOnly={!ready} className="field mt-2" />
      </div>

      <fieldset>
        <legend className="label">The job description</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="source" checked={source === "paste"} onChange={() => setSource("paste")} className="size-4 accent-jade" />
            Paste the job description
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="source" checked={source === "link"} onChange={() => setSource("link")} className="size-4 accent-jade" />
            Use a link
          </label>
        </div>
      </fieldset>

      {source === "link" && (
        <div>
          <label htmlFor="listing-url" className="label">
            Link to the advert
          </label>
          <p id="listing-url-hint" className="hint mt-1">
            Many company career sites work. LinkedIn, Indeed and some other boards usually don&apos;t let us read them, so you may need to paste.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="listing-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setReadFrom(null);
                setReadError(null);
              }}
              aria-describedby="listing-url-hint"
              readOnly={!ready}
              className="field"
            />
            <Button onClick={() => void read()} loading={reading} disabled={reading || !url.trim()} label="Read the page">
              {reading ? "Reading…" : "Read the page"}
            </Button>
          </div>
          {readError && (
            <div role="alert" className="mt-3 rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3">
              <p className="text-error">{readError}</p>
              <div className="mt-3">
                <Button size="sm" onClick={() => { setSource("paste"); setReadError(null); }}>
                  Paste it instead
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDescription && (
        <div>
          <label htmlFor="description" className="label">
            {readFrom ? "The description we read" : "Job description"}
          </label>
          <p id="description-hint" className="hint mt-1">
            {readFrom
              ? "Check it, and take out anything that isn't the advert. We match against exactly this text."
              : "Paste the whole advert: what the role involves and what they're looking for."}
          </p>
          <textarea
            id="description"
            rows={12}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby="description-hint"
            readOnly={!ready}
            className="field mt-2"
          />
          <p className="mt-1 text-sm text-graphite" aria-live="polite">
            {words.toLocaleString("en-GB")} words
          </p>
        </div>
      )}

      <fieldset>
        <legend className="label">The address</legend>
        <div className="mt-2 space-y-3">
          <label className="flex items-start gap-3">
            <input type="radio" name="style" checked={style === "suffix"} onChange={() => setStyle("suffix")} className="mt-1.5 size-4 accent-jade" />
            <span>
              <span className="font-semibold">With a short code</span> <span className="font-mono text-sm">/{example}-x7k2</span>
              <span className="block text-sm text-graphite">The company is readable, but nobody can guess the address. Recommended.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="radio" name="style" checked={style === "clean"} onChange={() => setStyle("clean")} className="mt-1.5 size-4 accent-jade" />
            <span>
              <span className="font-semibold">Clean</span> <span className="font-mono text-sm">/{example}</span>
              <span className="block text-sm text-graphite">Tidier, but anyone could find it by trying company names.</span>
            </span>
          </label>
        </div>
        <p className="mt-2 text-sm text-graphite">Either way, search engines never list it, and you can switch it off.</p>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-[var(--radius)] border border-error/40 bg-surface px-4 py-3 text-error">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-line pt-6">
        <Button type="submit" variant="primary" size="lg" label="Pick my exhbts" disabled={!ready || busy || !showDescription} loading={busy}>
          {busy ? "Picking…" : "Pick my exhbts"} <ArrowRight aria-hidden size={18} strokeWidth={2.5} />
        </Button>
      </div>
    </form>
  );
}
