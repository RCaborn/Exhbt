"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { APP_HOST } from "@/lib/hosts";
import { Frame } from "../Frame";
import { FailedSave } from "./Feedback";
import { useMorph } from "./motion";
import type { TileStatus, TileWords, AppWords } from "./words";

/**
 * Her four exhbts as the site draws them (on the server): each one's card (PortfolioHome's
 * ProjectCard, in her look) and its page (ProjectView), by slug, and her page's band with her best
 * piece of work in it (PortfolioHome, that section only). `radius` is her look's card corner, so
 * the raised edge follows the card's own shape.
 */
export type WorkArt = {
  cards: Record<string, React.ReactNode>;
  pages: Record<string, React.ReactNode>;
  band: { slug: string; node: React.ReactNode };
  radius: string;
};

export const Live = () => <Token label="Live" color="green" icon={<StatusDot variant="success" label="Live" />} />;
export const Draft = () => <Token label="Draft" icon={<StatusDot variant="neutral" label="Draft" />} />;
const StatusToken = ({ status }: { status: TileStatus }) => (status === "live" ? <Live /> : <Draft />);

/** A title short enough for a toast or a menu's name. */
const short = (t: string) => (t.length > 44 ? `${t.slice(0, 42).trimEnd()}…` : t);

/**
 * With work (decision 0031's portfolio, as its owner arranges it): the same person with four
 * exhbts. One display line opens the page, her address. Each exhbt is a picture: its real card,
 * raised, with its status in words (an Astryx Token), one action (Edit) and everything else in its
 * More menu, where Delete asks first. The last tile adds an exhbt, says the plan's limit plainly,
 * and carries the screen's one mint button.
 *
 * Opening a tile (the picture, or Edit) shows the exhbt itself: a stand-in for its editor. At
 * maximal the tile's picture travels into the page (motion.ts).
 */
export function WithWork({
  words,
  art,
  address,
  failed,
  loading,
  onCopied,
  toast,
}: {
  words: AppWords;
  art: WorkArt;
  address: React.ReactNode;
  failed: boolean;
  loading: boolean;
  onCopied: () => void;
  toast: (body: string, id?: string) => void;
}) {
  const morph = useMorph();
  const [tiles, setTiles] = useState<TileWords[]>(words.work.tiles);
  const [open, setOpen] = useState<string | null>(null);
  // The tile that travels: named for the length of a view transition (app.css, [data-morph]).
  const [traveller, setTraveller] = useState<string | null>(null);
  const [asking, setAsking] = useState<TileWords | null>(null);

  const live = tiles.filter((t) => t.status === "live").length;
  const drafts = tiles.length - live;
  const limitLine = `${tiles.length} of ${words.work.limit} on ${words.work.plan}`;

  const copy = (link: string) => {
    navigator.clipboard
      ?.writeText(`https://${link}`)
      .then(onCopied)
      .catch(() => toast(`The link is ${link}`, "app-copied"));
    if (!navigator.clipboard) toast(`The link is ${link}`, "app-copied");
  };

  // The page's scroll belongs to the state it moves to, so it is set before the browser's picture of that state.
  const openTile = (slug: string) => {
    flushSync(() => setTraveller(slug));
    morph(
      () => setOpen(slug),
      () => window.scrollTo({ top: 0, behavior: "instant" }),
    );
  };
  const close = () => {
    morph(
      () => setOpen(null),
      () => document.querySelector("[data-app-lab] .app-tile-art[data-morph]")?.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  };

  // Moves stay inside a group: live exhbts first, in her order, then drafts (decision 0031).
  const canMove = (i: number, by: -1 | 1) => tiles[i + by] !== undefined && tiles[i + by]!.status === tiles[i]!.status;
  const move = (i: number, by: -1 | 1) => {
    const t = tiles[i]!;
    morph(() =>
      setTiles((list) => {
        const next = [...list];
        [next[i], next[i + by]] = [next[i + by]!, next[i]!];
        return next;
      }),
    );
    toast(`Moved “${short(t.title)}” ${by < 0 ? "up" : "down"}`, "app-moved");
  };

  if (open) {
    const t = tiles.find((x) => x.slug === open)!;
    return (
      <div className="lab-content app-open">
        <div className="app-open-bar">
          <Button label="Back to your portfolio" variant="ghost" icon={<Icon icon="chevronLeft" />} onClick={close}>
            Your portfolio
          </Button>
          <StatusToken status={t.status} />
          <span className="app-open-gap" />
          {t.link && <Button label="Copy link" variant="secondary" icon={<Icon icon="copy" />} onClick={() => copy(t.link!)} />}
        </div>
        <div className="app-open-frame" data-morph>
          <Frame url={t.link ?? `${APP_HOST}/exhbts/${t.slug}/edit`} label={`“${t.title}”, the exhbt itself`} page="[zoom:0.7] sm:[zoom:0.8] lg:[zoom:0.9]">
            {art.pages[t.slug]}
          </Frame>
        </div>
        <p className="app-lab-aside">
          <b>Lab</b>
          <span>In the product the exhbt&rsquo;s editor opens here. It isn&rsquo;t part of this mock-up, so the page itself is shown.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="lab-content app-work">
      <header className="app-head app-work-head">
        <div className="app-eyebrow">
          <Text type="label">Your portfolio</Text>
          <Live />
        </div>
        <Heading level={1} type="display-1">
          {address}
        </Heading>
        <div className="app-work-sub">
          <Text as="p" display="block" type="large" color="secondary">
            {live} live{drafts > 0 ? ` and ${drafts} ${drafts === 1 ? "draft" : "drafts"}` : ""}, in the order visitors see them.
          </Text>
          <div className="app-row">
            <Button label="Copy link" variant="secondary" icon={<Icon icon="copy" />} onClick={() => copy(words.person.host)} />
            <Button label="See as a visitor" variant="ghost" icon={<Icon icon="externalLink" />} href="/demo" target="_blank" />
          </div>
        </div>
      </header>

      {failed && (
        <FailedSave
          screen="work"
          title="We couldn’t save the new order."
          description="Your exhbts are still where you left them. Check your connection, then try again."
          onRetry={() => toast("Saved", "app-saved")}
        />
      )}

      <ul className="app-tiles" aria-label="Your exhbts">
        {tiles.map((t, i) => {
          // Her best work leads as her page's band while it is first in her order.
          const band = i === 0 && art.band.slug === t.slug;
          return (
          <li
            key={t.slug}
            className="app-tile"
            data-status={t.status}
            data-band={band || undefined}
            style={{ "--app-vt-name": `app-tile-${t.slug}` } as React.CSSProperties}
          >
            <h2 className="sr-only">{t.title}</h2>
            {loading ? (
              // Laid out as the card that is coming: its figure, then its title and a line.
              <div className="app-tile-art app-tile-skel" data-loading role="img" aria-label="Loading">
                <div className="app-tile-skel-figure">
                  <Skeleton height="100%" radius={2} index={i} />
                </div>
                <div className="app-tile-skel-words">
                  <Skeleton width="85%" height={20} index={i + 1} />
                  <Skeleton width="60%" height={20} index={i + 2} />
                  <Skeleton width="92%" height={12} index={i + 3} />
                </div>
              </div>
            ) : (
              <div
                className="app-tile-art"
                style={{ "--app-tile-radius": art.radius } as React.CSSProperties}
                data-morph={traveller === t.slug || undefined}
                onClick={() => openTile(t.slug)}
                aria-hidden
              >
                {/* As her page's band where the tile is wide enough to hold it, as her card where it isn't. */}
                {band && <div className="app-tile-band">{art.band.node}</div>}
                <div className="app-tile-card">{art.cards[t.slug]}</div>
              </div>
            )}
            <div className="app-tile-meta">
              {loading ? (
                <Skeleton width={72} height={28} radius="rounded" index={i + 4} />
              ) : (
                <>
                  <StatusToken status={t.status} />
                  <span className="app-tile-actions">
                    <Button label={`Edit “${short(t.title)}”`} variant="secondary" onClick={() => openTile(t.slug)}>
                      Edit
                    </Button>
                    <MoreMenu
                      label={`More for “${short(t.title)}”`}
                      alignment="end"
                      items={[
                        t.status === "live"
                          ? { label: "View it", href: t.viewHref, target: "_blank", icon: <Icon icon="externalLink" /> }
                          : { label: "Preview", onClick: () => openTile(t.slug), icon: <Icon icon="externalLink" /> },
                        { label: "Team", icon: <Icon icon={UsersRound} />, onClick: () => toast("Team opens in the exhbt’s editor.", "app-team") },
                        { type: "divider" },
                        { label: "Move up", icon: <Icon icon="arrowUp" />, isDisabled: !canMove(i, -1), onClick: () => move(i, -1) },
                        { label: "Move down", icon: <Icon icon="arrowDown" />, isDisabled: !canMove(i, 1), onClick: () => move(i, 1) },
                        { type: "divider" },
                        { label: "Delete", variant: "destructive", icon: <Icon icon={Trash2} />, onClick: () => setAsking(t) },
                      ]}
                    />
                  </span>
                </>
              )}
            </div>
          </li>
          );
        })}
        <li className="app-tile app-add">
          <div className="app-add-slot">
            <span className="app-add-mark" aria-hidden>
              <Plus size={22} strokeWidth={2.25} />
            </span>
            <Text as="p" display="block" type="large">
              Your next project goes here. Upload it and we draft it, or start from a blank page.
            </Text>
            <Button label="Add an exhbt" variant="primary" icon={<Icon icon={Plus} />} onClick={() => toast("“Add an exhbt to your portfolio” opens next. It isn’t in the lab.", "app-add")} />
            <Text as="p" display="block" type="supporting">
              {limitLine}
            </Text>
          </div>
        </li>
      </ul>

      <AlertDialog
        isOpen={asking !== null}
        onOpenChange={(o) => !o && setAsking(null)}
        title="Delete this exhbt?"
        description={
          asking
            ? `“${short(asking.title)}” ${asking.status === "live" ? "comes off your portfolio and its link stops working" : "and its files are deleted"}. It can’t be brought back.`
            : ""
        }
        actionLabel="Delete it"
        cancelLabel="Keep it"
        onAction={() => {
          const gone = asking!;
          setAsking(null);
          morph(() => setTiles((list) => list.filter((x) => x.slug !== gone.slug)));
          toast(`Deleted “${short(gone.title)}”`, "app-deleted");
        }}
      />
    </div>
  );
}
