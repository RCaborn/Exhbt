"use client";

import { useState, type ReactNode } from "react";
import { publishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { Button } from "@/components/ui/Button";
import { useEnv, useIssues, useSave, useUi } from "../context";
import { useFilesController } from "../files";
import { noteSaved } from "../pending";
import { useStoreInternal } from "../store";
import { Sheet } from "../ui/Sheet";

/*
 * "Review and publish" (decision 0026, "What the page does not draw"). I's: this is G's stub, the tick
 * and the Publish button, calling publishExhbt as the classic editor does: after any save in flight,
 * with the doc as it is now; on success the server has this doc and it is the live copy.
 */
export function PublishSheet(): ReactNode {
  return (
    <Sheet name="publish" title="Review and publish">
      <PublishBody />
    </Sheet>
  );
}

function PublishBody() {
  const env = useEnv();
  const ui = useUi();
  const save = useSave();
  const issues = useIssues();
  const files = useFilesController();
  const store = useStoreInternal();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; slug: string } | { ok: false; lines: string[] } | null>(null);
  const published = env.status === "published";

  async function publish() {
    issues.setTried(true);
    setBusy(true);
    setResult(null);
    try {
      await save.settled();
      const doc = store.get();
      const r = await publishExhbt(env.id, doc, ui.confirmed);
      if (r.ok) {
        save.markSaved(doc);
        noteSaved(doc);
        files.markPublished(doc);
        setResult({ ok: true, slug: r.slug });
      } else setResult({ ok: false, lines: r.reasons });
    } catch {
      setResult({ ok: false, lines: ["Couldn't reach the server. Try again in a moment."] });
    } finally {
      setBusy(false);
    }
  }

  const liveUrl = result?.ok && env.liveBase ? `${env.liveBase}/${result.slug}` : null;
  return (
    <div className="space-y-4">
      {!env.canGoLive && <p className="text-graphite">This exhbt is a preview only: nobody else can see it.</p>}
      {issues.all.length > 0 && <p className="text-sm text-graphite">{issues.all.length === 1 ? "1 thing" : `${issues.all.length} things`} to fix before this can go live.</p>}
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={ui.confirmed} onChange={(e) => ui.setConfirmed(e.target.checked)} className="mt-1.5 size-4 accent-jade" />
        <span>This is my work, and the numbers are true</span>
      </label>
      <Button variant="primary" loading={busy} disabled={busy || !env.canGoLive} onClick={publish} label={published ? "Publish changes" : "Publish"}>
        {published ? "Publish changes" : "Publish"}
      </Button>
      <div role="status">
        {result?.ok && (
          <div>
            <p className="font-semibold">{published ? "Your changes are live." : "It's live."}</p>
            {liveUrl && (
              <a href={liveUrl} className="link font-semibold">
                {liveUrl.replace(/^https:\/\//, "")}
              </a>
            )}
          </div>
        )}
        {result && !result.ok && (
          <ul className="space-y-1 text-error">
            {result.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
