"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { createFromScratch } from "@/app/(app)/exhbts/[id]/actions";
import type { OwnerOnlyExhbt } from "@/app/(app)/portfolio/load";
import type { HomeOwnerPlace } from "@/components/portfolio/home-ctx";
import { bandButtonClass, ROWS, WRAP } from "@/components/portfolio/PortfolioHome";
import { usePortfolioApi, usePortfolioData, usePortfolioState, usePortfolioUi } from "../runtime";
import { showTile } from "../sections/arrange";
import { AddSection } from "../sections/AddSection";
import { W } from "../sections/words";
import { lookOf } from "../home-props";
import { useArranged, useWorkTreatment } from "./arranged";
import { WorkRowLike } from "./WorkRowLike";

/*
 * What only the owner sees on the page (brief F, steps 6 to 9), all in the person's own look, since it
 * sits in the page's flow (decision 0031, "What the editing page adds that takes room", 3 and 4):
 *  - "band": the look's own button, "Add an exhbt", in the vision's button row (the page draws the band
 *    and "Your best project goes here" itself);
 *  - "work-end": the owner-only tiles (a draft, an exhbt over the plan's limit), the Add tile and the
 *    hidden row, as <li>s, the last children of the work's list;
 *  - "page-end": the same after the last section, when More of my work is off the page, with "Add a
 *    section" too when no section is left.
 * Everything here carries `data-owner`, which the box-for-box tests take out (HOME_EDIT_ONLY_IN_FLOW).
 */
export function OwnerParts({ where }: { where: HomeOwnerPlace }): ReactNode {
  if (where === "band") return <VisionButton />;
  return where === "work-end" ? <WorkEnd /> : <PageEnd />;
}

/** The look's own button in the vision: does what the Add tile does (its first way, uploading). */
function VisionButton(): ReactNode {
  const themeId = usePortfolioState((s) => s.arrangement.themeId);
  const previewing = usePortfolioUi((u) => u.previewing);
  const room = usePortfolioData().addRoom;
  const cta = lookOf(themeId, previewing).treatment.cta;
  if (!room.ok) return <span data-owner="vision" className="text-[0.95rem] text-[color:var(--band-soft)]">{room.reason}</span>;
  return (
    <Link href="/exhbts/new" data-owner="vision" className={bandButtonClass(cta)}>
      {W.visionAdd}
    </Link>
  );
}

function WorkEnd(): ReactNode {
  const treatment = useWorkTreatment();
  const shape = treatment === "cards" ? "card" : "row";
  return <Parts shape={shape} list={false} />;
}

/** After the last section: in a list of the look's own, inside the page's own wrap. */
function PageEnd(): ReactNode {
  const treatment = useWorkTreatment();
  const none = usePortfolioState((s) => s.arrangement.sections.length === 0);
  const shape = treatment === "cards" ? "card" : "row";
  return (
    <div data-owner="page-end" className={`${WRAP} py-12 @3xl:py-16`}>
      {none && (
        <div className="pe-add-section-flow-wrap">
          <AddSection inFlow />
        </div>
      )}
      <Parts shape={shape} list />
    </div>
  );
}

function Parts({ shape, list }: { shape: "card" | "row"; list: boolean }): ReactNode {
  const { ownerOnly } = usePortfolioData();
  const items = (
    <>
      {ownerOnly.map((e) => (
        <OwnerTile key={e.id} exhbt={e} shape={shape} />
      ))}
      <AddTile shape={shape} />
      <HiddenRow shape={shape} />
    </>
  );
  if (!list) return items;
  return shape === "card" ? <ul className="grid gap-5 @2xl:grid-cols-2">{items}</ul> : <ul className={`max-w-[48rem] ${ROWS}`}>{items}</ul>;
}

/* ---------- Owner-only tiles ---------- */

const DASHED = "border-[length:max(1px,var(--pf-edge-width))] border-dashed border-[color:var(--pf-line)]";
const ACCENT_LINK = "font-semibold text-[color:var(--pf-accent)] underline underline-offset-4";

function Chip({ children }: { children: ReactNode }): ReactNode {
  return <span className="pe-page-chip inline-flex items-center rounded-[var(--pf-radius-pill)] border border-[color:var(--pf-line)] bg-[var(--pf-well)] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-[color:var(--pf-soft)]">{children}</span>;
}

/** A draft or an exhbt over the plan's limit: never dragged or starred, since the server does not arrange it. */
function OwnerTile({ exhbt: e, shape }: { exhbt: OwnerOnlyExhbt; shape: "card" | "row" }): ReactNode {
  const draft = e.why === "draft";
  const chip = <Chip>{draft ? W.draft : W.overLimit}</Chip>;
  const action = (
    <Link href={`/exhbts/${e.id}/edit`} className={ACCENT_LINK}>
      {draft ? W.finish : W.openIt}
    </Link>
  );
  const why = draft ? W.draftWhy : W.overLimitWhy;
  if (shape === "row") {
    return (
      <li data-owner="owner-only" data-tile={e.id} data-why={e.why}>
        <WorkRowLike title={e.title} summary={why} chip={chip} action={action} />
      </li>
    );
  }
  return (
    <li data-owner="owner-only" data-tile={e.id} data-why={e.why}>
      <div className={`${DASHED} flex h-full flex-col gap-3 rounded-[var(--pf-radius)] bg-[var(--pf-card)] p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          {chip}
          <span className="text-[0.8125rem] text-[color:var(--pf-faint)]">{W.ownerOnly}</span>
        </div>
        <h3 className="pf-display text-[1.125rem] leading-snug [letter-spacing:calc(var(--pf-tracking)*0.3)]">{e.title}</h3>
        <p className="text-[0.9375rem] leading-relaxed text-[color:var(--pf-soft)]">{why}</p>
        <p className="mt-auto pt-1">{action}</p>
      </div>
    </li>
  );
}

/* ---------- The Add tile ---------- */

const PAGE_BUTTON = "inline-flex items-center gap-2 rounded-[var(--pf-radius-button)] bg-[var(--pf-button-bg)] px-5 py-2.5 text-[0.95rem] font-semibold text-[color:var(--pf-button-text)] hover:opacity-90";

/** "Add an exhbt": the two ways to make one, and how many the plan holds. When it is full: the reason and the upgrade, in the alert tone after `?full=1`. */
function AddTile({ shape }: { shape: "card" | "row" }): ReactNode {
  const { addRoom: room, builder } = usePortfolioData();
  const full = usePortfolioUi((u) => u.full);
  const count = <p className="text-[0.875rem] text-[color:var(--pf-faint)] tabular-nums" data-pe-room>{W.room(room.used, room.limit, room.planName)}</p>;
  const body = room.ok ? (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link href="/exhbts/new" className={PAGE_BUTTON}>
          <Plus aria-hidden size={16} strokeWidth={2.5} />
          {W.upload}
        </Link>
        <form action={createFromScratch}>
          <button type="submit" className={ACCENT_LINK}>
            {W.blank}
          </button>
        </form>
      </div>
      {!builder.plan.isPublic && <p className="text-[0.875rem] text-[color:var(--pf-soft)]">{W.freeNote}</p>}
      {count}
    </>
  ) : (
    <div role={full ? "alert" : "status"} data-tone={full ? "alert" : "plain"} className="space-y-2">
      <p className={full ? "font-semibold text-[color:var(--pf-error)]" : "text-[color:var(--pf-soft)]"}>{room.reason}</p>
      {count}
      {room.upgradeTo && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/account/billing" className={ACCENT_LINK}>
            {W.seePlansUpgrade}
          </Link>
        </p>
      )}
    </div>
  );
  const heading = <h3 className="pf-display text-[1.25rem] leading-snug [letter-spacing:calc(var(--pf-tracking)*0.3)]">{W.addExhbt}</h3>;
  const what = <p className="max-w-[34rem] text-[0.9375rem] leading-relaxed text-[color:var(--pf-soft)]">{W.addWhat}</p>;
  if (shape === "row") {
    return (
      <li data-owner="add" data-pe-add="exhbt" data-full={room.ok ? undefined : "true"}>
        <div className="flex flex-col gap-3 py-5">
          {heading}
          {what}
          {body}
        </div>
      </li>
    );
  }
  return (
    <li data-owner="add" data-pe-add="exhbt" data-full={room.ok ? undefined : "true"}>
      <div className={`${DASHED} flex h-full min-h-48 flex-col justify-center gap-3 rounded-[var(--pf-radius)] p-6`}>
        {heading}
        {what}
        {body}
      </div>
    </li>
  );
}

/* ---------- The hidden row ---------- */

function HiddenRow({ shape }: { shape: "card" | "row" }): ReactNode {
  const api = usePortfolioApi();
  const arranged = useArranged();
  if (arranged.hidden.length === 0) return null;
  const show = (id: string) => {
    const title = arranged.title(id);
    api.change((s) => showTile(s, id), W.showed(title));
    api.say(W.saidShowed(title));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tile-frame="${CSS.escape(id)}"] [data-pe-tools] button, [data-hidden-row] button`)?.focus());
  };
  return (
    <li data-owner="hidden" data-hidden-row className={shape === "card" ? "@2xl:col-span-2" : ""}>
      <section aria-labelledby="pe-hidden-h" className={`${DASHED} rounded-[var(--pf-radius)] p-5 ${shape === "row" ? "my-4" : ""}`}>
        <h3 id="pe-hidden-h" className="text-[1rem] font-semibold">
          {W.hiddenHeading}
        </h3>
        <p className="mt-1 text-[0.875rem] text-[color:var(--pf-soft)]">{W.hiddenWhy}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {arranged.hidden.map((id) => (
            <li key={id} data-hidden-key={id} className="inline-flex items-center gap-2 rounded-[var(--pf-radius-button)] border border-[color:var(--pf-line)] py-1 pr-1 pl-3">
              <span className="text-[0.9375rem] text-[color:var(--pf-soft)]">{arranged.title(id)}</span>
              <button
                type="button"
                data-show={id}
                aria-label={W.show(arranged.title(id))}
                onClick={() => show(id)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--pf-radius-button)] px-3 text-[0.875rem] font-semibold text-[color:var(--pf-accent)] hover:bg-[var(--pf-well)] pointer-coarse:min-h-11"
              >
                <Eye aria-hidden size={15} strokeWidth={2} /> {W.showShort}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </li>
  );
}
