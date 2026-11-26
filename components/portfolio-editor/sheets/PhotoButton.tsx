"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { Text } from "@astryxdesign/core/Text";
import { PhotoField } from "@/app/(app)/portfolio/PhotoField";
import { Button } from "@/components/ui/Button";
import { useBarSize } from "../bar/hooks";
import { usePortfolioApi, usePortfolioData, usePortfolioState } from "../runtime";
import { Sheet } from "../ui/Sheet";

/*
 * The photo (decision 0031, "What is edited where": Photo). A button over the photo or the initials,
 * "Add a photo" or "Change your photo", that opens the photo sheet. The face is drawn as the page gave
 * it, untouched: in Classic, Mono and Ledger it is a grid item with `order-*` classes, and a box round it
 * would move it at phone width (docs/briefs/portfolio-first/d-findings.md). So the face and the button
 * sit in a `display: contents` span, and the button is placed over the face's middle-bottom by measuring
 * it: absolutely positioned, it takes no room and no grid cell.
 */

/** Where the face's bottom middle is, from the button's own containing block. */
type Spot = { left: number; top: number };

export function PhotoButton({ children }: { children: ReactNode }): ReactNode {
  const api = usePortfolioApi();
  const hasPhoto = Boolean(usePortfolioData().builder.photoUrl);
  const size = useBarSize();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLSpanElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  useLayoutEffect(() => {
    const face = wrap.current?.firstElementChild as HTMLElement | null;
    const own = button.current;
    if (!face || !own || face === own) return;
    const place = () => {
      const base = own.offsetParent ?? document.body;
      const f = face.getBoundingClientRect();
      const b = base.getBoundingClientRect();
      // Kept inside what it is placed in, which may clip (Studio's band block): a gap of 8px from its edges.
      const o = own.getBoundingClientRect();
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const next = {
        left: clamp(f.left - b.left + f.width / 2 + base.scrollLeft, o.width / 2 + 8, Math.max(o.width / 2 + 8, base.clientWidth - o.width / 2 - 8)),
        top: clamp(f.bottom - b.top + base.scrollTop - 4, o.height / 2 + 8, Math.max(o.height / 2 + 8, base.clientHeight - o.height / 2 - 8)),
      };
      setSpot((s) => (s && Math.abs(s.left - next.left) < 0.5 && Math.abs(s.top - next.top) < 0.5 ? s : next));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(face);
    if (face.parentElement) ro.observe(face.parentElement);
    if (own.offsetParent) ro.observe(own.offsetParent);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  const label = hasPhoto ? "Change your photo" : "Add a photo";
  return (
    <span ref={wrap} className="pe-photo" data-photo-slot>
      {children}
      <span ref={button} className="pe-photo-button" data-photo-button style={spot ? { left: spot.left, top: spot.top } : { visibility: "hidden" }}>
        <Button size={size} onClick={() => api.open("photo")} label={label}>
          <Camera aria-hidden size={16} strokeWidth={2.25} />
          {label}
        </Button>
      </span>
    </span>
  );
}

/** The photo sheet: the step builder's PhotoField as it is. It saves at once, outside autosave, and refreshes the page's data. */
export function PhotoSheet(): ReactNode {
  const name = usePortfolioState((s) => s.profile.name);
  const { photoUrl, plan } = usePortfolioData().builder;
  return (
    <Sheet name="photo" title={photoUrl ? "Your photo" : "Add a photo"} width={440}>
      <div className="pe-sheet-body" data-photo-sheet>
        <Text type="body" className="pe-sheet-lead">
          A clear photo of your face helps an employer put a name to your work. It is optional: without one, your initials show in your look.
        </Text>
        <PhotoField name={name || "You"} photoUrl={photoUrl} maxMb={plan.uploadMb} />
      </div>
    </Sheet>
  );
}
