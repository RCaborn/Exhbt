"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { appHref, type AppScreen } from "./screens";

/**
 * A save that failed, said where it happened: an inline Astryx Banner in the error status, with
 * the way out ("Try again"). A Banner is not a live region, so the same words are announced too,
 * at once (assertive), when it appears; a sighted person sees it and a screen reader hears it.
 *
 * In the lab it is shown by the address (?show=failed), so it is brought into view when it
 * appears, as it would be in front of someone who has just pressed Save. "Try again" saves and
 * clears it, as the real one would once the save goes through.
 */
export function FailedSave({ screen, title, description, onRetry }: { screen: AppScreen; title: string; description: string; onRetry: () => void }) {
  const announce = useAnnounce();
  const router = useRouter();
  const here = useRef<HTMLDivElement>(null);
  useEffect(() => {
    announce(`${title} ${description}`, "assertive");
  }, [announce, title, description]);
  useEffect(() => {
    const el = here.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);
  return (
    <div className="app-failed" ref={here}>
      <Banner
        status="error"
        title={title}
        description={description}
        endContent={
          <Button
            label="Try again"
            size="sm"
            onClick={() => {
              router.replace(appHref(screen), { scroll: false });
              onRetry();
            }}
          />
        }
      />
    </div>
  );
}
