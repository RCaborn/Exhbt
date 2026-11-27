import type { ReactNode } from "react";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import type { AddRoom, OwnerOnlyExhbt, PortfolioData } from "@/app/(app)/portfolio/load";
import type { BuilderState } from "@/app/(app)/portfolio/steps";
import type { HomeOwnerPlace } from "@/components/portfolio/home-ctx";
import { bandButtonClass, ROWS, WorkRow, WRAP } from "@/components/portfolio/PortfolioHome";
import type { PortfolioTheme } from "@/lib/portfolio-themes";
import { lookOf } from "../home-props";
import { W } from "../sections/words";
import { arrangedOf } from "./order";

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
 *
 * No hooks and no "use client": the editor draws it through OwnerParts.tsx, which reads the state, and
 * the loading stand-in draws the same parts still (`OwnerPartsStill`), so they take the same room
 * before the editor arrives and nothing moves when it does.
 */

export type OwnerViewProps = {
  where: HomeOwnerPlace;
  cta: PortfolioTheme["treatment"]["cta"];
  treatment: PortfolioTheme["treatment"]["work"];
  room: AddRoom;
  isPublic: boolean;
  /** The address said `?full=1`. */
  full: boolean;
  ownerOnly: OwnerOnlyExhbt[];
  /** How many exhbts the work lists: the index look's owner rows go on numbering after them. */
  workCount: number;
  hidden: { id: string; title: string }[];
  /** No section is left on the page. */
  noSections: boolean;
  /** Show, in the hidden row. Without it the row's buttons do nothing (the stand-in, which is inert). */
  onShow?: (id: string) => void;
  /** "Add a section", drawn at the page's end when no section is left. */
  addSection?: ReactNode;
};

export function OwnerView(p: OwnerViewProps): ReactNode {
  if (p.where === "band") return <VisionButton room={p.room} cta={p.cta} />;
  const shape = p.treatment === "cards" ? "card" : "row";
  if (p.where === "work-end") return <Parts {...p} shape={shape} list={false} />;
  return (
    <div data-owner="page-end" className={`${WRAP} py-12 @3xl:py-16`}>
      {p.noSections && <div className="pe-add-section-flow-wrap">{p.addSection ?? <AddSectionStill />}</div>}
      <Parts {...p} shape={shape} list />
    </div>
  );
}

/**
 * The owner's parts as the loading stand-in draws them: the same as the editor's, from the loader's data
 * and the state the stand-in draws, with nothing to press (the stand-in is inert).
 */
export function OwnerPartsStill({ where, data, state }: { where: HomeOwnerPlace; data: PortfolioData; state?: BuilderState }): ReactNode {
  const s = state ?? data.builder.initial;
  const { projects, plan } = data.builder;
  const arranged = arrangedOf(s.arrangement, projects, plan.isPublic);
  const look = lookOf(s.arrangement.themeId, null);
  return (
    <OwnerView
      where={where}
      cta={look.treatment.cta}
      treatment={look.treatment.work}
      room={data.addRoom}
      isPublic={plan.isPublic}
      full={false}
      ownerOnly={data.ownerOnly}
      workCount={arranged.work.length}
      hidden={arranged.hidden.map((id) => ({ id, title: arranged.title(id) }))}
      noSections={s.arrangement.sections.length === 0}
    />
  );
}

/** The look's own button in the vision: does what the Add tile does (to /exhbts/new, the chooser). */
function VisionButton({ room, cta }: { room: AddRoom; cta: PortfolioTheme["treatment"]["cta"] }): ReactNode {
  if (!room.ok) return <span data-owner="vision" className="text-[0.95rem] text-[color:var(--band-soft)]">{room.reason}</span>;
  return (
    <Link href="/exhbts/new" data-owner="vision" className={bandButtonClass(cta)}>
      {W.visionAdd}
    </Link>
  );
}

/** "Add a section" as the stand-in draws it: the trigger's own size, nothing to open. */
function AddSectionStill(): ReactNode {
  return (
    <div className="pe-add-section pe-add-section-flow">
      <span className="inline-flex h-8 items-center gap-1.5 px-3 text-[0.875rem] font-semibold">
        <Plus aria-hidden size={16} strokeWidth={2.5} /> {W.addSection}
      </span>
    </div>
  );
}

type Shaped = OwnerViewProps & { shape: "card" | "row"; list: boolean };

function Parts(p: Shaped): ReactNode {
  const items = (
    <>
      {p.ownerOnly.map((e, i) => (
        <OwnerTile key={e.id} exhbt={e} shape={p.shape} index={p.treatment === "index"} n={p.workCount + i} />
      ))}
      <AddTile shape={p.shape} room={p.room} isPublic={p.isPublic} full={p.full} />
      <HiddenRow shape={p.shape} hidden={p.hidden} onShow={p.onShow} />
    </>
  );
  if (!p.list) return items;
  return p.shape === "card" ? <ul className="grid gap-5 @2xl:grid-cols-2">{items}</ul> : <ul className={`max-w-[48rem] ${ROWS}`}>{items}</ul>;
}

/* ---------- Owner-only tiles ---------- */

const DASHED = "border-[length:max(1px,var(--pf-edge-width))] border-dashed border-[color:var(--pf-line)]";
const ACCENT_LINK = "font-semibold text-[color:var(--pf-accent)] underline underline-offset-4";

function Chip({ children }: { children: ReactNode }): ReactNode {
  return <span className="pe-page-chip inline-flex items-center rounded-[var(--pf-radius-pill)] border border-[color:var(--pf-line)] bg-[var(--pf-well)] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-[color:var(--pf-soft)]">{children}</span>;
}

/** A draft or an exhbt over the plan's limit: never dragged or starred, since the server does not arrange it. */
function OwnerTile({ exhbt: e, shape, index, n }: { exhbt: OwnerOnlyExhbt; shape: "card" | "row"; index: boolean; n: number }): ReactNode {
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
        {/* The look's own row (PortfolioHome's WorkRow), then what only the owner sees, under its words. */}
        <WorkRow project={{ title: e.title, summary: why, href: null }} n={n} look={index ? "index" : "list"} inert />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-4 pl-[1.875rem]">
          {chip}
          {action}
        </div>
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

/**
 * The Add tile (decision 0033, F2): what the space is for, "Your next project goes here", answering the
 * band's "Your best project goes here", and one link, "Add an exhbt", to /exhbts/new, the chooser that
 * explains both ways to start. Then how many the plan holds. When it is full: the reason and the
 * upgrade, in the alert tone after `?full=1`.
 */
function AddTile({ shape, room, isPublic, full }: { shape: "card" | "row"; room: AddRoom; isPublic: boolean; full: boolean }): ReactNode {
  const count = <p className="text-[0.875rem] text-[color:var(--pf-faint)] tabular-nums" data-pe-room>{W.room(room.used, room.limit, room.planName)}</p>;
  const body = room.ok ? (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link href="/exhbts/new" className={PAGE_BUTTON}>
          <Plus aria-hidden size={16} strokeWidth={2.5} />
          {W.addExhbt}
        </Link>
      </div>
      {!isPublic && <p className="text-[0.875rem] text-[color:var(--pf-soft)]">{W.freeNote}</p>}
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
  const heading = <h3 className="pf-display text-[1.25rem] leading-snug [letter-spacing:calc(var(--pf-tracking)*0.3)]">{W.addHeading}</h3>;
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

function HiddenRow({ shape, hidden, onShow }: { shape: "card" | "row"; hidden: { id: string; title: string }[]; onShow?: (id: string) => void }): ReactNode {
  if (hidden.length === 0) return null;
  return (
    <li data-owner="hidden" data-hidden-row className={shape === "card" ? "@2xl:col-span-2" : ""}>
      <section aria-labelledby="pe-hidden-h" className={`${DASHED} rounded-[var(--pf-radius)] p-5 ${shape === "row" ? "my-4" : ""}`}>
        <h3 id="pe-hidden-h" className="text-[1rem] font-semibold">
          {W.hiddenHeading}
        </h3>
        <p className="mt-1 text-[0.875rem] text-[color:var(--pf-soft)]">{W.hiddenWhy}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {hidden.map(({ id, title }) => (
            <li key={id} data-hidden-key={id} className="inline-flex items-center gap-2 rounded-[var(--pf-radius-button)] border border-[color:var(--pf-line)] py-1 pr-1 pl-3">
              <span className="text-[0.9375rem] text-[color:var(--pf-soft)]">{title}</span>
              <button
                type="button"
                data-show={id}
                aria-label={W.show(title)}
                onClick={onShow ? () => onShow(id) : undefined}
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
