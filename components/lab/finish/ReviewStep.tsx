"use client";

import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DialogHeader } from "@astryxdesign/core/Dialog";
import { Text } from "@astryxdesign/core/Text";
import { Tick } from "@/components/ui/Tick";
import type { FinishWords } from "./words";

/** A check that hasn't happened yet: a hollow ring where its tick will be. */
export function Hollow() {
  return <span aria-hidden className="fin-hollow" />;
}

/**
 * "Review and publish", the step before the finish: where the exhbt goes, its three checks as
 * they stand, the person's own tick ("This is my work, and the numbers are true") and Publish.
 * The real step holds more (the numbers to check, the plan); this is the part the finish follows.
 * Publish is never greyed out: pressed without the tick, it says what is missing.
 */
export function ReviewStep({
  words,
  changes,
  confirmed,
  onConfirm,
  tried,
  onPublish,
  onClose,
  publishRef,
}: {
  words: FinishWords;
  /** The exhbt is live already: the button says "Publish changes". */
  changes: boolean;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  /** Publish was pressed without the tick. */
  tried: boolean;
  onPublish: () => void;
  onClose: () => void;
  /** The Publish button's wrapper, for maximal's shared-element transition. */
  publishRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="fin-review">
      <DialogHeader title="Review and publish" onOpenChange={() => onClose()} hasDivider={false} />
      <div className="fin-review-body">
        <Text as="p" display="block" color="secondary">
          Publishing puts this exhbt on your portfolio at <b className="fin-review-host">{words.host}</b>, with its own link to send with
          applications.
        </Text>
        <ul className="fin-review-checks" aria-label="Can you trust it?">
          <li>
            {confirmed || changes ? <Tick size="lg" /> : <Hollow />}
            <span>{confirmed || changes ? `Confirmed by ${words.first}` : "Not confirmed yet"}</span>
          </li>
          {words.evidence && (
            <li>
              <Tick size="lg" />
              <span>Source attached: {words.evidence}</span>
            </li>
          )}
          <li>
            {changes ? <Tick size="lg" /> : <Hollow />}
            <span>{changes ? `Checked by exhbt, ${words.checkedOn}` : "Checked by exhbt when you publish"}</span>
          </li>
        </ul>
        <CheckboxInput
          label="This is my work, and the numbers are true"
          value={confirmed}
          onChange={(v) => onConfirm(v)}
          status={tried && !confirmed ? { type: "error", message: "Tick this to publish." } : undefined}
        />
      </div>
      <div className="fin-review-foot">
        <span ref={publishRef} className="fin-publish">
          <Button label={changes ? "Publish changes" : "Publish"} variant="primary" size="lg" onClick={onPublish} />
        </span>
      </div>
    </div>
  );
}
