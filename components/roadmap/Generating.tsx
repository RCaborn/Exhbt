"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "working" | "slow" | "failed";

/**
 * Shown while a roadmap is being written. Asks the server to generate (idempotent),
 * then refreshes into the result. Failure offers a retry; the answers are kept.
 */
export function Generating({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("working");
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return; // React strict-mode double run
    started.current = attempt;
    setStatus("working");
    const slow = setTimeout(() => setStatus((s) => (s === "working" ? "slow" : s)), 20_000);
    fetch(`/api/roadmap/${id}/generate`, { method: "POST" })
      .then((res) => (res.ok ? router.refresh() : setStatus("failed")))
      .catch(() => setStatus("failed"))
      .finally(() => clearTimeout(slow));
    return () => clearTimeout(slow);
  }, [id, attempt, router]);

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-sky px-4 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[40rem] rounded-[24px] border border-rule bg-surface p-8 shadow-pack sm:p-12" aria-live="polite">
        {status === "failed" ? (
          <>
            <h1 className="text-[2rem] sm:text-[2.6rem]">That didn&rsquo;t work</h1>
            <p className="mt-4 text-ink-2">
              We couldn&rsquo;t build your roadmap just now. Your answers are saved, so trying again only takes a
              moment.
            </p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="btn btn-primary mt-8 min-h-12 px-6 text-base">
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink-2">Building your roadmap</p>
            <h1 className="mt-3 text-[2rem] sm:text-[2.6rem]">
              Mapping the road to <span className="highlight">{role}</span>
            </h1>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-sky-2" role="progressbar" aria-label="Building your roadmap" aria-busy="true">
              <span className="block h-full w-1/3 rounded-full bg-blue-edge motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            </div>
            <p className="mt-6 text-ink-2">
              {status === "slow"
                ? "Still working. Longer CVs take a little more time."
                : "Reading your CV, comparing it with the role, and picking projects. Usually under a minute."}
            </p>
            <p className="hint mt-2">We&rsquo;ll also email you a copy.</p>
          </>
        )}
      </div>
    </div>
  );
}
