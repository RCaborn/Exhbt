"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
    let retry: ReturnType<typeof setTimeout> | undefined;
    fetch(`/api/roadmap/${id}/generate`, { method: "POST" })
      .then((res) => {
        if (res.ok) {
          router.refresh();
          return;
        }
        // Another tab/request is generating — wait and try again.
        if (res.status === 409) {
          retry = setTimeout(() => setAttempt((a) => a + 1), 1500);
          return;
        }
        setStatus("failed");
      })
      .catch(() => setStatus("failed"))
      .finally(() => clearTimeout(slow));
    return () => {
      clearTimeout(slow);
      if (retry) clearTimeout(retry);
    };
  }, [id, attempt, router]);

  return (
    <div className="min-h-[calc(100svh-4.75rem)] bg-mist px-4 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-[40rem] rounded-[24px] border border-line bg-surface p-8 shadow-pack sm:p-12" aria-live="polite">
        {status === "failed" ? (
          <>
            <h1 className="">That didn&rsquo;t work</h1>
            <p className="mt-4 text-graphite">
              We couldn&rsquo;t build your roadmap just now. Your answers are saved, so trying again only takes a
              moment.
            </p>
            <div className="mt-8">
              <Button variant="primary" size="lg" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-graphite">Building your roadmap</p>
            <h1 className="mt-3">
              Mapping the road to <span className="highlight">{role.length > 70 ? `${role.slice(0, 67).trimEnd()}…` : role}</span>
            </h1>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-wash" role="progressbar" aria-label="Building your roadmap" aria-busy="true">
              <span className="block h-full w-1/3 rounded-full bg-jade motion-safe:animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            </div>
            <p className="mt-6 text-graphite">
              {status === "slow"
                ? "Still working. Longer answers take a little more time."
                : "Reading your answers, comparing them with the job, and picking projects. Usually under a minute."}
            </p>
            <p className="hint mt-2">We&rsquo;ll also email you a copy.</p>
          </>
        )}
      </div>
    </div>
  );
}
