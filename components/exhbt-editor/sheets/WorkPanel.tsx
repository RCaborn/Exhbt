"use client";

import { useRef, type ReactNode } from "react";
import { FieldIssues } from "@/components/editor/FieldIssues";
import { Button } from "@/components/ui/Button";
import { WORK_ACCEPT } from "@/components/editor/media";
import { useEnv, useIssues } from "../context";
import { useFiles } from "../files";
import { useDoc, useStore } from "../store";
import { Sheet } from "../ui/Sheet";
import "../css/sheets.css";

/*
 * "The work" (decision 0026): the file or link behind "See the work", and the name on the button. A
 * port of the classic editor's card. Typing is not an undo entry; removing the file is (files.ts).
 */
export function WorkPanel(): ReactNode {
  return (
    <Sheet name="work" title="The work">
      <WorkBody />
    </Sheet>
  );
}

const link = (href: string, label: string) => (href.trim() || label.trim() ? { kind: "link" as const, href: href.trim(), label } : undefined);

function WorkBody() {
  const store = useStore();
  const files = useFiles();
  const env = useEnv();
  const issues = useIssues();
  const evidence = useDoc((d) => d.evidence);
  const input = useRef<HTMLInputElement>(null);

  function setWork(next: ReturnType<typeof link> | { kind: "file"; fileId: string; label: string }) {
    store.patchDoc((d) => {
      const out = { ...d };
      if (next) out.evidence = next;
      else delete out.evidence;
      return out;
    });
  }

  const evidenceIssues = issues.at("evidence");
  const busy = files.busy.work;
  return (
    <div className="xe-sheet-stack">
      <p className="hint">One click to the original: a report, a repository, a dashboard. A link, or a file.</p>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-label="Choose a file"
        accept={WORK_ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void files.attachWork(f);
          e.target.value = "";
        }}
      />
      {evidence?.kind === "file" ? (
        <>
          <p>
            File attached: <strong className="break-all">{evidence.label}</strong>
          </p>
          <LabelField value={evidence.label} onChange={(label) => setWork({ kind: "file", fileId: evidence.fileId, label })} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} loading={busy} onClick={() => input.current?.click()} label="Replace the file">
              {busy ? "Uploading…" : "Replace the file"}
            </Button>
            <Button size="sm" variant="danger" onClick={() => files.removeWork()} label="Remove the file">
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="evidence-href" className="label">
              Link to the work
            </label>
            <input
              id="evidence-href"
              data-path="evidence"
              type="url"
              className="field"
              placeholder="https://"
              value={evidence?.kind === "link" ? evidence.href : ""}
              aria-invalid={evidenceIssues.length > 0 || undefined}
              aria-describedby="evidence-href-issues"
              onChange={(e) => setWork(link(e.target.value, evidence?.label ?? ""))}
            />
            <FieldIssues id="evidence-href-issues" issues={evidenceIssues} />
          </div>
          <LabelField value={evidence?.label ?? ""} onChange={(label) => setWork(link(evidence?.kind === "link" ? evidence.href : "", label))} />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={busy} loading={busy} onClick={() => input.current?.click()} label="Attach a file instead">
              {busy ? "Uploading…" : "Attach a file instead"}
            </Button>
            <span className="hint">PDF, Word, PowerPoint, Excel, zip or text, up to {env.maxFileMb} MB.</span>
          </div>
        </>
      )}
      {files.error.work && (
        <p role="alert" className="text-sm text-error">
          {files.error.work}
        </p>
      )}
    </div>
  );
}

function LabelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="evidence-label" className="label">
        Name on the button
      </label>
      <input id="evidence-label" className="field" placeholder="e.g. Final report (PDF)" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
