"use client";

import { useEffect, useRef, useState } from "react";
import { askToJoinAction, notTogetherAction } from "@/app/(app)/team/actions";
import { Button } from "@/components/ui/Button";
import { ROLE_MAX_CHARS } from "@/lib/team-rules";
import { MATCH_EVENT, type MatchDetail } from "./finish-upload";

type Step = "ask" | "form" | "asked" | "mine";
/** `modal`: a sheet (a modal dialog) was open when the file matched, so the page behind it is inert and a panel there could not be answered. */
type Queued = MatchDetail & { modal: boolean };

/**
 * The calm question after an upload whose file is already on someone else's exhbt (decision
 * 0013): "Were you on that project together?" It never says whose exhbt it is. "Ask to join"
 * sends the owner the uploader's name and email; "No, it's mine" is logged for review and
 * nothing else happens. Mounted once on pages that upload (the draft page, the editor), and
 * shown when finishUpload raises MATCH_EVENT. A panel at the foot of the screen, not a modal:
 * it doesn't take the cursor out of the field someone is typing in; screen readers hear it.
 * When a modal sheet is open (the editor's "The work"), everything outside the sheet is inert, so the
 * same prompt is drawn as a modal dialog of its own, above the sheet: the focus moves into it, and
 * back to where it was when it closes. Same words, same buttons.
 */
export function MatchPrompt() {
  const [queue, setQueue] = useState<Queued[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("ask");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<MatchDetail>).detail;
      setQueue((q) => (q.some((x) => x.matchId === d.matchId) ? q : [...q, { ...d, modal: document.querySelector("dialog:modal") !== null }]));
    };
    window.addEventListener(MATCH_EVENT, on);
    return () => window.removeEventListener(MATCH_EVENT, on);
  }, []);

  const current = queue[0];
  const modal = current?.modal ?? false;
  const matchId = current?.matchId;
  // Drawn as its own modal dialog: opened on top of the sheet, so the focus goes in.
  useEffect(() => {
    const d = dialog.current;
    if (modal && d && !d.open) d.showModal();
  }, [modal, matchId]);
  // Each step swaps its buttons: keep the focus inside the dialog.
  useEffect(() => {
    const d = dialog.current;
    if (modal && d?.open && !d.contains(document.activeElement)) d.querySelector<HTMLElement>("input, button")?.focus();
  }, [modal, matchId, step]);
  const next = () => {
    setQueue((q) => q.slice(1));
    setStep("ask");
    setRole("");
    setError(null);
  };

  async function run(fn: () => Promise<{ ok?: boolean; error?: string } | undefined>, done: Step) {
    setPending(true);
    setError(null);
    try {
      const res = await fn();
      if (res?.error) setError(res.error);
      else setStep(done);
    } catch {
      setError("We couldn't reach the server. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  // Closing the modal dialog restores the focus to where it was (the sheet); its close event moves on to the next prompt.
  const leave = () => (dialog.current?.open ? dialog.current.close() : next());
  const Box = (modal ? "dialog" : "section") as "section";
  const box = (modal ? { ref: dialog, onClose: next } : {}) as Record<string, never>;

  return (
    <div aria-live="polite">
      {current && (
        <Box
          key={`${current.matchId}-${modal}`}
          {...box}
          aria-labelledby="match-title"
          data-testid="match-prompt"
          className={`fixed inset-x-4 bottom-4 z-40 rounded-[16px] border border-line bg-surface p-5 shadow-pack sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]${modal ? " m-0 top-auto text-ink" : ""}`}
        >
          {step === "ask" && (
            <>
              <h2 id="match-title" className="text-[1.125rem] leading-snug">
                This file is already on someone else&apos;s exhbt
              </h2>
              <p className="mt-1 truncate text-sm text-graphite">{current.fileName}</p>
              <p className="mt-2">Were you on that project together?</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => setStep("form")}>
                  Ask to join
                </Button>
                <Button size="sm" loading={pending} disabled={pending} onClick={() => void run(() => notTogetherAction(current.matchId), "mine")}>
                  No, it&apos;s mine
                </Button>
                <button type="button" onClick={leave} className="link px-1 text-sm font-semibold text-ink">
                  Decide later
                </button>
              </div>
            </>
          )}

          {step === "form" && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => askToJoinAction(current.matchId, name, role), "asked");
              }}
            >
              <h2 id="match-title" className="text-[1.125rem] leading-snug">
                Ask to join the project
              </h2>
              <p className="mt-1 text-sm text-graphite">
                We&apos;ll send the owner your name and email address, and your part if you add it. You won&apos;t see who they are unless they add you.
              </p>
              {!current.name && (
                <div className="mt-3">
                  <label htmlFor="match-name" className="label">
                    Your name
                  </label>
                  <input id="match-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required className="field" />
                </div>
              )}
              <div className="mt-3">
                <label htmlFor="match-role" className="label">
                  Your part in it <span className="font-normal text-graphite">(optional)</span>
                </label>
                <input
                  id="match-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  maxLength={ROLE_MAX_CHARS}
                  placeholder="Built the model"
                  aria-describedby="match-role-count"
                  className="field"
                />
                <p id="match-role-count" className="hint mt-1">
                  {role.length} of {ROLE_MAX_CHARS} characters
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" variant="primary" size="sm" loading={pending} disabled={pending}>
                  Send request
                </Button>
                <Button size="sm" onClick={() => setStep("ask")}>
                  Back
                </Button>
              </div>
            </form>
          )}

          {(step === "asked" || step === "mine") && (
            <>
              <h2 id="match-title" className="text-[1.125rem] leading-snug">
                {step === "asked" ? "Request sent" : "Thanks"}
              </h2>
              <p className="mt-2">
                {step === "asked"
                  ? "If they add you, we'll email you and the project will show under Team projects on Your exhbts."
                  : "Nothing about this shows on any exhbt. We keep a private note of file matches in case one needs looking into."}
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={leave}>
                  Close
                </Button>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-error">
              {error}
            </p>
          )}
        </Box>
      )}
    </div>
  );
}
