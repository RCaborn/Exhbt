/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly; next/image would cache the wrong one. */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ProjectCard } from "@/components/portfolio/PortfolioHome";
import { themeStyle } from "@/components/portfolio/themeFonts";
import type { LoadedJobLink } from "@/lib/job-links";
import { initialsOf } from "@/lib/portfolio-profile";

/**
 * A per-job page (docs/phase-2.md section 8): the person, "For Lloyds Banking Group · Graduate Data
 * Analyst", their intro, and the exhbts they picked for the job in the order they chose, each under
 * the one-line reason the AI gave. It follows the portfolio's look (docs/design/portfolio-and-exhbt-layouts.pdf,
 * page 1; decision 0016): the cards are the portfolio home's own (`ProjectCard`) and every colour,
 * corner and face is a `--pf-*` or `--band-*` variable set by the person's look, so a look restyles
 * this page too. Each card opens the project with ?for=<slug>, so the project page can offer the way back.
 * Plain markup with no hooks: the public page and the owner's preview both render it on the server.
 */
export function JobLinkView({
  data,
  startHref = "/start",
  embedded = false,
}: {
  data: LoadedJobLink;
  /** The sign-off's link to our site (absolute on a person's own host). */
  startHref?: string;
  /** Inside the app's own page frame (the owner's preview), which already has the main landmark. */
  embedded?: boolean;
}) {
  const Main = embedded ? "div" : "main";
  const { link, displayName, photoUrl, items, base, theme } = data;
  const heading = [link.company, link.roleTitle].map((s) => s.trim()).filter(Boolean).join(" · "); // non-breaking space keeps the "·" on the company's line
  const intro = link.intro.split(/\n{2,}/).filter((p) => p.trim());
  const corners = theme.photo === "round" ? "rounded-full" : "rounded-[var(--pf-radius-lg)]";
  const face = "size-20 @3xl:size-28";

  return (
    <div data-job-page data-theme={theme.id} style={themeStyle(theme)} className="@container min-h-svh bg-[var(--pf-ground)] text-[color:var(--pf-ink)]">
      <Main id={embedded ? undefined : "main"} className="mx-auto w-full max-w-[68rem] px-5 pt-8 pb-6 @3xl:px-10 @3xl:pt-12">
        <header className="grid items-center gap-x-8 gap-y-5 @3xl:grid-cols-[auto_minmax(0,1fr)]">
          {photoUrl ? (
            <img src={photoUrl} alt="" width={112} height={112} data-avatar="photo" className={`${face} ${corners} object-cover`} />
          ) : (
            <span
              aria-hidden
              data-avatar="initials"
              className={`${face} ${corners} inline-flex items-center justify-center bg-[var(--band-initials-bg)] font-[family-name:var(--font-display)] text-[1.75rem] font-semibold text-[color:var(--band-initials-text)] @3xl:text-[2.25rem]`}
            >
              {initialsOf(displayName) || "?"}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[1.0625rem] font-semibold text-[color:var(--pf-soft)]">{displayName}</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-[clamp(2rem,6.5cqw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] break-words text-[color:var(--pf-ink)]">
              For {heading}
            </h1>
            {intro.length > 0 && (
              <div data-intro className="mt-5 max-w-[40rem] space-y-3 text-[1.125rem] leading-relaxed text-[color:var(--pf-soft)] @3xl:text-[1.25rem]">
                {intro.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>
        </header>

        <section aria-labelledby="job-picks-h" className="mt-12 @3xl:mt-16">
          <h2 id="job-picks-h" className="sr-only">
            Work picked for this role
          </h2>
          <ol className="grid gap-x-5 gap-y-8 @2xl:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} data-card={it.id} className="flex flex-col gap-3">
                <ProjectCard project={it.project} />
                {it.reason.trim() && (
                  <p data-reason className="px-1 text-[0.9375rem] leading-relaxed text-[color:var(--pf-soft)]">
                    <span className="font-semibold text-[color:var(--pf-ink)]">Why it fits: </span>
                    {it.reason.trim()}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12">
          <Link
            href={base || "/"}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--pf-button-bg)] px-5 py-3 text-[0.95rem] font-semibold text-[color:var(--pf-button-text)] hover:opacity-90"
          >
            See all of {displayName}&apos;s work <ArrowRight aria-hidden size={16} strokeWidth={2.25} />
          </Link>
        </p>
      </Main>

      <footer className="mx-auto w-full max-w-[68rem] px-5 pt-6 pb-12 @3xl:px-10">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-[color:var(--pf-faint)]">
          <span className="inline-flex items-center gap-1.5">
            Made with <Logo size="sm" className="text-[color:var(--pf-ink)]" />
          </span>
          <Link href={startHref} className="underline decoration-[color:var(--pf-line)] underline-offset-4 hover:text-[color:var(--pf-ink)]">
            Build your own roadmap
          </Link>
        </p>
      </footer>
    </div>
  );
}
