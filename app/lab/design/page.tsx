import Link from "next/link";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { LAB_SCREENS, LEVEL_NOTE, LEVELS } from "@/components/lab/lab";
import { readLab } from "@/components/lab/server";

/**
 * The lab's index: what the lab is, in three sentences, and its four screens. The level list is
 * drawn on the server from the level cookie (readLab), so it marks the one the bar is set to.
 */
export default async function LabIndex() {
  const { level } = await readLab();
  return (
    <main id="main" className="mx-auto max-w-[72rem] px-4 pt-12 pb-24 sm:px-8 sm:pt-20">
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <Heading level={1} type="display-1">
            Choose how Exhbt should look.
          </Heading>
          <div className="mt-6 max-w-[38rem]">
            <Text as="p" type="large" color="secondary">
              This is the design lab: mock-ups of the next look, built with the real components on made-up data. Each screen
              can be seen at three levels, restrained, confident and maximal, with the switch in the bar above. Nothing here is
              live, and nothing you do here is saved.
            </Text>
          </div>
        </div>
        <dl className="self-end border-t-2 border-ink">
          {LEVELS.map((l) => (
            <div key={l} className="flex gap-4 border-b border-line py-3" data-on={l === level || undefined}>
              <dt className="w-28 flex-none font-semibold capitalize">
                {l}
                {l === level && <span className="sr-only"> (showing now)</span>}
              </dt>
              <dd className="text-graphite">
                {LEVEL_NOTE[l]}
                {l === level && <span className="ml-2 font-semibold whitespace-nowrap text-jade">Showing now</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-label="Screens" className="mt-16 border-t-2 border-ink sm:mt-24">
        <ul>
          {LAB_SCREENS.map((s) => (
            <li key={s.href} className="border-b border-line">
              <Link
                href={s.href}
                className="group grid min-h-24 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-5 text-ink no-underline sm:grid-cols-[14rem_minmax(0,1fr)_auto]"
              >
                <span className="font-[family-name:var(--font-family-heading)] text-[length:var(--text-display-3-size)] leading-none font-semibold tracking-[-0.03em]">
                  {s.label}
                </span>
                <span className="col-start-1 row-start-2 text-graphite sm:col-start-2 sm:row-start-1 sm:text-lg">{s.note}</span>
                <span
                  aria-hidden
                  className="row-span-2 flex size-11 items-center justify-center rounded-full border-[1.5px] border-ink transition-colors duration-[var(--duration-fast)] group-hover:bg-ink group-hover:text-white sm:row-span-1"
                >
                  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
