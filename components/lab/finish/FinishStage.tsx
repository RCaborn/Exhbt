"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { Token } from "@astryxdesign/core/Token";
import { PersonPage, useLab } from "../LabFrame";
import { FreeMoment } from "./FreeMoment";
import { LiveMoment } from "./LiveMoment";
import { ReviewStep } from "./ReviewStep";
import type { FinishState } from "./states";
import type { FinishWords } from "./words";

type Step = "closed" | "review" | "finish";

/** Below this width the moment is a bottom sheet (Astryx's phone form of a dialog), above it a dialog. */
const NARROW = "(max-width: 639px)";

/** The theme's motion tokens as the lab's root has them at this level (a view transition's pseudo-elements hang off :root, which the level doesn't reach). */
function motionOf(): { slow: string; medium: string; entrance: string; move: string } {
  const root = document.querySelector<HTMLElement>("[data-lab-root]") ?? document.documentElement;
  const css = getComputedStyle(root);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    slow: read("--duration-slow", "720ms"),
    medium: read("--duration-medium", "320ms"),
    entrance: read("--ease-entrance", "ease-out"),
    move: read("--ease-move", "ease-in-out"),
  };
}

/**
 * The finish's setting and its flow: a stand-in for the exhbt editor (its bar, and the person's own
 * page under it), whose "Review and publish" opens one Astryx Dialog on a wide window, or a
 * BottomSheet that hugs its content on a phone. The dialog holds the review step, then the finish
 * itself: LiveMoment on a paid plan, FreeMoment on Free. Publishing changes to an exhbt that is
 * already live ends quietly, on a Toast and the page.
 *
 * One status line inside the dialog says what happened for screen readers ("<title> is live at
 * <address>"): it is in the dialog because everything outside a modal is hidden from them.
 *
 * Maximal adds a shared-element view transition: Publish's button opens out into the live page's
 * frame while the ink holds the whole screen for a beat, then settles. It runs only when the lab's
 * `moves` is true (motion on, and the device hasn't asked for less) and the browser has view
 * transitions; anywhere else the finish simply arrives.
 */
export function FinishStage({
  state,
  words,
  editorPage,
  livePage,
  freePage,
}: {
  state: FinishState;
  words: FinishWords;
  editorPage: React.ReactNode;
  livePage: React.ReactNode;
  freePage: React.ReactNode;
}) {
  const lab = useLab();
  const narrow = useMediaQuery(NARROW);
  const showToast = useToast();
  const [step, setStep] = useState<Step>("closed");
  const [live, setLive] = useState(state === "changes");
  // Something on the page that isn't out yet: a draft, or edits to a live exhbt. While there is, Publish is the next step.
  const [unsent, setUnsent] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [tried, setTried] = useState(false);
  const [beat, setBeat] = useState(false);
  const [arrival, setArrival] = useState<"css" | "vt">("css");
  const [said, setSaid] = useState("");
  const publishRef = useRef<HTMLSpanElement>(null);
  const changes = state === "changes";

  function open() {
    setSaid("");
    setTried(false);
    setConfirmed(false);
    setArrival("css");
    setStep(state === "free" ? "finish" : "review");
  }
  const close = () => {
    setStep("closed");
    setBeat(false);
  };

  function publish() {
    if (!confirmed) {
      setTried(true);
      return;
    }
    if (changes) {
      // The second time: no ceremony. The dialog goes, a toast says so, and the page is there.
      setStep("closed");
      setUnsent(false);
      showToast({
        body: words.changedLine,
        uniqueID: "fin-changes",
        endContent: <Button label="View it" variant="secondary" size="sm" href={words.viewHref} />,
      });
      return;
    }
    const arrive = () => {
      setStep("finish");
      setLive(true);
      setUnsent(false);
      setSaid(`${words.title} is live at ${words.link}`);
    };
    const transition = lab.level === "maximal" && lab.moves && typeof document.startViewTransition === "function";
    if (!transition) {
      arrive();
      return;
    }
    // Maximal: the frame opens out of the Publish button (one name on both: the button's wrapper before,
    // the frame after, finish.css), and the ink holds the screen for a beat before it settles ([data-beat]).
    const m = motionOf();
    const html = document.documentElement;
    html.style.setProperty("--fin-vt-duration", m.slow);
    html.style.setProperty("--fin-vt-ease", m.move);
    html.dataset.finVt = "";
    publishRef.current?.style.setProperty("view-transition-name", "fin-frame");
    const vt = document.startViewTransition(() => {
      flushSync(() => {
        arrive();
        setArrival("vt");
        setBeat(true);
      });
    });
    vt.finished.finally(() => {
      delete html.dataset.finVt;
      // The beat: the ink holds a moment longer than the frame's flight, then lets go.
      window.setTimeout(() => setBeat(false), 420);
    });
  }

  const title = step === "review" ? "Review and publish" : state === "free" ? "Saved to your portfolio" : words.liveLine;
  const body = (
    <div className="fin-overlay" data-step={step} data-form={narrow ? "sheet" : "dialog"}>
      <p role="status" className="sr-only">
        {said}
      </p>
      {step === "review" && (
        <ReviewStep
          words={words}
          changes={changes}
          confirmed={confirmed}
          onConfirm={(v) => {
            setConfirmed(v);
            setTried(false);
          }}
          tried={tried}
          onPublish={publish}
          onClose={close}
          publishRef={publishRef}
        />
      )}
      {step === "finish" && state === "free" && <FreeMoment words={words} freePage={freePage} onClose={close} />}
      {step === "finish" && state !== "free" && <LiveMoment words={words} livePage={livePage} beat={beat} arrival={arrival} onClose={close} />}
    </div>
  );
  const isOpen = step !== "closed";
  const wide = step === "finish";

  return (
    <section className="fin-stage lab-content" aria-labelledby="fin-stage-title">
      <h2 id="fin-stage-title" className="sr-only">
        The exhbt editor, a stand-in
      </h2>
      <div className="fin-window">
        <div className="fin-bar">
          <span className="fin-bar-narrow">
            <IconButton label="Your portfolio" icon={<Icon icon="chevronLeft" />} variant="ghost" href={words.portfolioHref} />
          </span>
          <span className="fin-bar-wide">
            <Button label="Your portfolio" variant="ghost" icon={<Icon icon="chevronLeft" />} href={words.portfolioHref} />
          </span>
          {live ? (
            <Token label="Live" color="green" icon={<StatusDot variant="success" label="Live" />} />
          ) : (
            <Token label="Draft" icon={<StatusDot variant="neutral" label="Draft" />} />
          )}
          <span className="fin-bar-gap" />
          <span className="fin-bar-wide">
            <Text type="supporting">Saved</Text>
          </span>
          {/* One mint button: Publish is the next step while there is something to publish. */}
          <Button label="Review and publish" variant={unsent ? "primary" : "secondary"} onClick={open} />
        </div>
        <figure className="fin-window-page">
          <figcaption className="sr-only">
            {`${words.title}, by ${words.first}, as it stands in the editor: ${live ? "live" : "a draft, not yet confirmed or checked"}.`}
          </figcaption>
          {/* Her page, under today's theme and tokens: the proposed theme never restyles it. */}
          <div inert aria-hidden className="fin-window-crop">
            <PersonPage>{editorPage}</PersonPage>
          </div>
        </figure>
      </div>

      {narrow ? (
        <BottomSheet isOpen={isOpen} onOpenChange={(o) => !o && close()} label={title} height="hug" padding={0}>
          {body}
        </BottomSheet>
      ) : (
        <Dialog
          isOpen={isOpen}
          onOpenChange={(o) => !o && close()}
          // Named outright: the title's own wiring (aria-labelledby) didn't follow the step's content swap.
          aria-label={title}
          width={wide ? (state === "free" ? "min(60rem, calc(100vw - 2rem))" : "min(72rem, calc(100vw - 2rem))") : 520}
          maxHeight="calc(100dvh - 2rem)"
          padding={0}
        >
          {body}
        </Dialog>
      )}
    </section>
  );
}
