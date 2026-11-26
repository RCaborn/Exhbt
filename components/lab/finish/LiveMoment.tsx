"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Share2 } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { useToast } from "@astryxdesign/core/Toast";
import { Seal } from "@/components/brand/Seal";
import { Tick } from "@/components/ui/Tick";
import { useLab } from "../LabFrame";
import { Address } from "../samples";
import { LinkPreview } from "./LinkPreview";
import type { FinishWords } from "./words";

/** The phone's own share sheet, where there is one. Asked after the page has loaded, never on the server. */
function useCanShare() {
  const [can, setCan] = useState(false);
  useEffect(() => setCan(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  return can;
}

/**
 * The finish after a first publish on a plan with an address (decision 0033, "It's live").
 *
 * Two parts, like a piece in a gallery and its label. The label, on ink: the checks, whose ticks fill
 * one after another; the person's address in display type, mint and white, with the highlighter
 * stroke drawn under it; and the one mint action, Copy link, with Share (the phone's own sheet) and
 * View it. The work, on white: the live page raised in its frame with the seal pressed on its corner,
 * the link as LinkedIn or WhatsApp will show it, and the next step, "Add your next exhbt".
 *
 * At restrained the label is mist, with no stroke and no stamp. Every movement is CSS inside the
 * lab's two motion guards (finish.css), resting on the finished picture, so with less motion asked
 * for everything is simply there.
 */
export function LiveMoment({
  words,
  livePage,
  beat = false,
  onClose,
}: {
  words: FinishWords;
  livePage: React.ReactNode;
  /** Maximal only: the beat after Publish, when the ink holds the whole screen. */
  beat?: boolean;
  onClose: () => void;
}) {
  const { level } = useLab();
  const showToast = useToast();
  const canShare = useCanShare();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const url = `https://${words.link}`;
  useEffect(() => () => clearTimeout(timer.current), []);

  // The step before was the review, whose Publish button has gone: focus moves to this moment's title.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("h2[tabindex]")?.focus({ preventScroll: true });
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2400);
      showToast({ body: "Link copied", uniqueID: "fin-copied" });
    } catch {
      showToast({ type: "error", body: `We couldn't copy it. The link is ${words.link}`, uniqueID: "fin-copied" });
    }
  }

  const ink = level !== "restrained";
  const label = (
    <>
      <DialogHeader title={words.liveLine} hasDivider={false} />
      <ul className="fin-checks" aria-label="Can you trust it?">
        {[`Confirmed by ${words.first}`, ...(words.evidence ? ["Source attached"] : []), "Checked by exhbt"].map((c, i) => (
          <li key={c} style={{ "--i": i } as React.CSSProperties}>
            <span className="fin-check">
              <Tick size="lg" />
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <p className="fin-address">
        <span className="fin-host">
          <Address name={words.name} nameClass={`fin-name ${ink ? "text-mint" : "text-jade"}`} />
        </span>
        <span className="fin-path">{words.path}</span>
      </p>
      <div className="fin-actions">
        <Button label={copied ? "Link copied" : "Copy link"} variant="primary" size="lg" icon={<Icon icon={copied ? "check" : "copy"} />} onClick={copy} />
        {canShare && (
          <Button
            label="Share"
            variant="secondary"
            size="lg"
            icon={<Icon icon={Share2} />}
            onClick={() => navigator.share?.({ title: words.title, url }).catch(() => {})}
          />
        )}
        <Button label="View it" variant="ghost" size="lg" icon={<Icon icon="externalLink" />} href={words.viewHref} />
      </div>
      <span className="fin-close fin-close-narrow">
        <IconButton label="Close" icon={<Icon icon="close" />} variant="ghost" onClick={onClose} />
      </span>
    </>
  );

  return (
    <div ref={root} className="fin-live" data-beat={beat || undefined}>
      <div className="fin-label" data-ink={ink || undefined}>
        {ink ? <MediaTheme mode="dark">{label}</MediaTheme> : label}
      </div>
      <div className="fin-work">
        <div className="fin-frame">
          {livePage}
          <span className="fin-seal">
            <Seal date={words.checkedOn} asLink={false} />
          </span>
        </div>
        <section className="fin-share" aria-labelledby="fin-share-title">
          <Heading level={3} id="fin-share-title">
            How it looks when you paste it
          </Heading>
          <LinkPreview src={words.preview.src} alt={words.preview.alt} title={words.preview.title} description={words.preview.description} host={words.host} />
          <Text as="p" display="block" type="supporting">
            Put it in an application, on your CV, under Featured on your LinkedIn profile or in your email signature.
          </Text>
        </section>
        <div className="fin-next">
          <Button label="Add your next exhbt" variant="secondary" icon={<Icon icon={Plus} />} href={words.nextHref} />
        </div>
      </div>
      <span className="fin-close fin-close-wide">
        <IconButton label="Close" icon={<Icon icon="close" />} variant="ghost" onClick={onClose} />
      </span>
    </div>
  );
}
