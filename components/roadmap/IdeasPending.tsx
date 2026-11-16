"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { IdeasStatus } from "@/lib/roadmap/ideas";

type Phase = "working" | "failed" | "timeout" | "limit";

/** How long to wait for the ideas before saying so and offering another go. */
const GIVE_UP_MS = 90_000;
const POLL_MS = 2_000;

const STEPS = ["Reading your roadmap", "Matching projects to your gaps", "Writing your three ideas"];

/**
 * The Projects page while the ideas aren't there yet (docs/decisions/0019): a progress state with
 * the shape of the cards to come, never an empty page. It makes sure the ideas have been started
 * (idempotent), asks every couple of seconds, and refreshes into the ideas the moment they exist.
 * A failure or a long wait gets a plain message and "Try again".
 */
export function IdeasPending({ id, initial }: { id: string; initial: Exclude<IdeasStatus, "ready"> }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(initial === "failed" ? "failed" : initial === "limit" ? "limit" : "working");
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "working") return;
    const key = `${attempt}`;
    if (ran.current === key) return; // React strict-mode double run
    ran.current = key;

    let stopped = false;
    const url = `/api/roadmap/${id}/ideas`;
    const settle = (status: string | undefined): boolean => {
      if (stopped) return true;
      if (status === "ready") {
        stopped = true;
        router.refresh();
        return true;
      }
      if (status === "failed") setPhase("failed");
      else if (status === "limit") setPhase("limit");
      else return false;
      stopped = true;
      return true;
    };

    const begun = Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok && settle((await res.json()).status)) return;
      } catch {
        // A dropped request: the next poll tries again.
      }
      if (!stopped && Date.now() - begun > GIVE_UP_MS) {
        stopped = true;
        setPhase("timeout");
      }
    };

    // Start them if nobody has (the call is idempotent), then watch.
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retry: attempt > 0 }),
    })
      .then(async (res) => (res.ok ? settle((await res.json()).status) : false))
      .catch(() => false)
      .then((done) => {
        if (!done && !stopped) timer = setInterval(poll, POLL_MS);
      });
    const steps = [setTimeout(() => setStep(1), 600), setTimeout(() => setStep(2), 7_000)];
    setStep(0);

    return () => {
      stopped = true;
      clearInterval(timer);
      steps.forEach(clearTimeout);
      // Strict mode runs the cleanup and the effect again; let the second run start properly.
      ran.current = null;
    };
  }, [id, phase, attempt, router]);

  const retry = () => {
    setAttempt((a) => a + 1);
    setPhase("working");
  };

  if (phase !== "working") {
    return (
      <div className="mt-8 rounded-[16px] border border-line bg-surface p-6 sm:p-8" role="alert">
        <h2 className="text-[1.375rem]">
          {phase === "timeout" ? "This is taking longer than it should" : "We couldn’t write your project ideas"}
        </h2>
        <p className="mt-3 max-w-[38rem] text-graphite">
          {phase === "limit"
            ? "We’ve tried a few times and it still hasn’t worked. Your roadmap and answers are saved, so please come back a little later and open this page again."
            : phase === "timeout"
              ? "The ideas haven’t come back yet. Your roadmap and answers are saved. You can ask again, and it should only take a moment."
              : "That’s on our side, not yours. Your roadmap and answers are saved, so trying again only takes a moment."}
        </p>
        {phase !== "limit" && (
          <div className="mt-6">
            <Button variant="primary" size="lg" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8" aria-busy="true">
      <div className="rounded-[16px] border border-line bg-surface p-5 sm:p-6" role="status" aria-live="polite">
        <p className="font-semibold">Writing your project ideas</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-wash" aria-hidden="true">
          <span className="block h-full w-1/3 rounded-full bg-jade motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
        </div>
        <ol className="mt-4 space-y-1.5 text-graphite">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? "font-semibold text-ink" : undefined} aria-current={i === step ? "step" : undefined}>
              <span aria-hidden="true" className="mr-2 inline-block w-4 text-center">
                {i < step ? "✓" : i === step ? "•" : ""}
              </span>
              {label}
              {i < step && <span className="sr-only"> (done)</span>}
            </li>
          ))}
        </ol>
        <p className="hint mt-4">This usually takes under a minute. You can stay on this page; it updates by itself.</p>
      </div>
      <ul aria-hidden="true" className="mt-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-[16px] border border-line p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="h-6 w-2/3 rounded bg-wash motion-safe:animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-wash motion-safe:animate-pulse" />
            </div>
            <div className="mt-4 h-4 w-full rounded bg-wash motion-safe:animate-pulse" />
            <div className="mt-2 h-4 w-4/5 rounded bg-wash motion-safe:animate-pulse" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="h-10 rounded bg-wash motion-safe:animate-pulse" />
              <div className="h-10 rounded bg-wash motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
