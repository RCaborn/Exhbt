"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { publishExhbt, unpublishExhbt } from "@/app/(app)/exhbts/[id]/actions";
import { confirmNumber, unverifiedOf } from "@/components/editor/model";
import { ConfirmAction } from "@/components/editor/ConfirmAction";
import { SeeYourPortfolio, WhereItGoes } from "@/components/editor/PublishWhere";
import { liveLine } from "@/lib/exhbt/publish-words";
import { UpgradePrompt } from "@/components/site/UpgradePrompt";
import { Button } from "@/components/ui/Button";
import { CopyLink } from "@/components/ui/CopyLink";
import { pathOfNumber } from "@/lib/exhbt/verify";
import type { FieldPath } from "@/components/portfolio/page-ctx";
import { useEnv, useIssues, useSave, useUi } from "../context";
import { useFiles } from "../files";
import { noteSaved } from "../pending";
import { useDoc, useStore } from "../store";
import { Sheet } from "../ui/Sheet";
import { setLive, useLive } from "./live";
import { useShowMe } from "./paths";
import "../css/sheets.css";

/*
 * "Review and publish" (decision 0026, "What the page does not draw"): the plan, the username, what
 * stops publishing, the numbers to check, the tick, and Publish. A port of the classic editor's
 * publish section. Before publishing it says where the exhbt goes, on the person's portfolio, and
 * after it, that it is live there (components/editor/PublishWhere.tsx, the same in both editors).
 */
export function PublishSheet(): ReactNode {
  return (
    <Sheet name="publish" title="Review and publish">
      <PublishBody />
    </Sheet>
  );
}

type Result = { ok: true; slug: string; changed: boolean } | { ok: false; lines: string[] };

/** The server words one reason with "at the top", which this editor does not have. */
const FLAGGED = /flagged number/;

function PublishBody() {
  const env = useEnv();
  const ui = useUi();
  const save = useSave();
  const issues = useIssues();
  const files = useFiles();
  const store = useStore();
  const doc = useDoc((d) => d);
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const published = live.status === "published";
  const flags = unverifiedOf(doc);
  const first = issues.all[0];

  const showMe = useShowMe();
  const router = useRouter();
  // Portfolio first (decision 0031): the way back is to this exhbt's tile on the portfolio.
  const portfolioAt = `/portfolio?at=${encodeURIComponent(env.id)}`;

  async function publish() {
    issues.setTried(true);
    setBusy(true);
    // Set when a first publish leaves for the portfolio: Publish stays busy until the page goes.
    let leaving = false;
    setResult(null);
    try {
      await save.settled();
      const sent = store.get();
      const r = await publishExhbt(env.id, sent, ui.confirmed);
      if (r.ok) {
        save.markSaved(sent);
        noteSaved(sent);
        files.markPublished(sent);
        setLive(env.id, "published", r.slug, r.publishedAt);
        // Portfolio first: a first publish returns to the portfolio, where the tile has turned Live and the
        // note gives its link. Publishing changes to a live exhbt stays here, with the live panel.
        if (env.portfolioFirst && !published) {
          leaving = true;
          router.push(portfolioAt);
          return;
        }
        setResult({ ok: true, slug: r.slug, changed: published });
      } else setResult({ ok: false, lines: r.reasons });
    } catch {
      setResult({ ok: false, lines: ["Couldn't reach the server. Try again in a moment."] });
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  const base = env.liveBase;
  const hidden = env.hiddenOnPortfolio === true;
  const justUrl = result?.ok && base ? `${base}/${result.slug}` : null;
  const liveUrl = base && live.slug ? `${base}/${live.slug}` : null;
  const shortOf = (u: string) => u.replace(/^https:\/\//, "");
  const reasons = result && !result.ok ? [...new Set(result.lines.map((l) => (FLAGGED.test(l) ? "Check the flagged numbers below." : l)))] : [];

  if (!env.canGoLive) {
    return (
      <div className="xe-sheet-stack">
        <p className="text-graphite">
          {env.portfolioFirst ? "This exhbt is on your portfolio as a draft only you can see." : "This exhbt is a preview only: nobody else can see it."}
        </p>
        {env.planBlock && <UpgradePrompt reason={env.planBlock.reason} upgradeTo={env.planBlock.upgradeTo} />}
        {env.portfolioFirst && (
          <div>
            <Button href={portfolioAt} size="sm">
              Back to your portfolio
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="xe-sheet-stack">
      {result?.ok && justUrl ? (
        <div role="status" className="xe-live">
          <p className="text-[1.25rem] font-semibold">{liveLine(result.changed, hidden)}</p>
          <p className="mt-2 text-graphite">Paste this into an application:</p>
          <p className="mt-1 font-mono text-sm break-words">
            <a href={justUrl} className="link font-semibold">
              {shortOf(justUrl)}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button href={justUrl} variant="primary" label="View it">
              View it
            </Button>
            <CopyLink href={justUrl} />
            {base && <SeeYourPortfolio liveBase={base} />}
            {env.portfolioFirst ? <Button href={portfolioAt}>Back to your portfolio</Button> : <Button href="/exhbts">Back to your exhbts</Button>}
          </div>
        </div>
      ) : (
        liveUrl &&
        published && (
          <p className="break-words">
            Live at{" "}
            <a href={liveUrl} className="link font-semibold">
              {shortOf(liveUrl)}
            </a>
          </p>
        )
      )}
      {env.planBlock && <UpgradePrompt reason={env.planBlock.reason} upgradeTo={env.planBlock.upgradeTo} primary={false} />}
      {(!base || (!published && !result?.ok)) && <WhereItGoes liveBase={base} hidden={hidden} className="text-graphite" />}
      {first && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-graphite">{issues.all.length === 1 ? "1 thing" : `${issues.all.length} things`} to fix before this can go live.</p>
          <Button size="sm" onClick={() => showMe(first.path as FieldPath)}>
            Show me
          </Button>
        </div>
      )}
      {flags.length > 0 && (
        <ul aria-label="Numbers to check" className="xe-sheet-list">
          {flags.map((n) => {
            const at = pathOfNumber(doc, n);
            return (
              <li key={n} className="xe-flag">
                <span>
                  Check this number: <strong className="font-mono">{n}</strong>
                  <span className="block text-sm text-graphite">We couldn&apos;t find it in your files. Fix it in the text, or confirm it.</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button size="sm" label={`That's right: ${n}`} onClick={() => store.patchDoc((d) => confirmNumber(d, n), `confirm ${n}`)}>
                    That&apos;s right
                  </Button>
                  {at && (
                    <Button size="sm" label={`Show me: ${n}`} onClick={() => showMe(at as FieldPath)}>
                      Show me
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={ui.confirmed} onChange={(e) => ui.setConfirmed(e.target.checked)} className="mt-1.5 size-4 accent-jade" />
        <span>This is my work, and the numbers are true</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" loading={busy} disabled={busy} onClick={publish} label={published ? "Publish changes" : "Publish"}>
          {published ? "Publish changes" : "Publish"}
        </Button>
        {published && (
          <ConfirmAction
            label="Unpublish"
            question="Take it off your portfolio?"
            confirmLabel="Yes, unpublish"
            action={async () => {
              setLive(env.id, "draft", live.slug);
              await unpublishExhbt(env.id);
            }}
          />
        )}
      </div>
      <div role="status">
        {reasons.length > 0 && (
          <ul className="space-y-1 text-error">
            {reasons.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
