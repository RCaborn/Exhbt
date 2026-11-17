import { ArrowUpRight } from "lucide-react";
import { MethodFlow } from "@/components/exhbt/MethodFlow";
import { RichText } from "@/components/exhbt/RichText";
import { Figure, Findings, SectionBlock, type ImageUrls, type Sub } from "@/components/portfolio/exhbt-parts";
import { safeHref, type ExhbtDoc, type Section, type SectionOf } from "@/lib/exhbt/blocks";
import { shownSections } from "@/lib/exhbt/formats";

/**
 * The research page's main column below the title and the background (decision 0024): a poster,
 * read figure first. The page sets where each kind goes: the aim and the method on the left with
 * the key figure large on the right, any further figures two to a row, the results beside the
 * conclusion and the limitations, then feedback and the references. The person's list order only
 * decides which figure is the key figure (the first graph or image). Draws only the kinds the
 * layout shows; an image with no signed URL is left out. Every colour and rule is an --xp-* variable.
 */
export function ResearchMain({ doc, imageUrls, Sub }: { doc: ExhbtDoc; imageUrls: ImageUrls; Sub: Sub }) {
  const shown = shownSections(doc).map((x) => x.s);
  const figures = shown.filter((s): s is SectionOf<"graph"> | SectionOf<"image"> => s.kind === "graph" || (s.kind === "image" && Boolean(imageUrls[s.fileId])));
  const key = figures[0];
  const more = figures.slice(1);
  const aim = shown.find((s): s is SectionOf<"aim"> => s.kind === "aim" && s.text.some((r) => r.t.trim()) );
  const findings = shown.find((s): s is SectionOf<"findings"> => s.kind === "findings");
  const conclusion = shown.find((s): s is SectionOf<"conclusion"> => s.kind === "conclusion" && s.text.some((r) => r.t.trim()));
  const reflection = shown.find((s): s is SectionOf<"reflection"> => s.kind === "reflection");
  const quote = shown.find((s) => s.kind === "quote");
  const refs = shown.filter((s): s is SectionOf<"link"> => s.kind === "link");

  const method = (
    <section aria-labelledby="method-h" data-part="process" className={`break-inside-avoid ${aim ? "mt-6 print:mt-3" : ""}`}>
      <Sub id="method-h" className="xp-label">
        Method
      </Sub>
      <div className="mt-2">
        <MethodFlow steps={doc.flow} variant="page" stack />
      </div>
    </section>
  );
  const aimBlock = aim && (
    <section aria-labelledby={`${aim.id}-h`} data-part="aim" className="xp-quote break-inside-avoid border-l-[3px] pl-4">
      <Sub id={`${aim.id}-h`} className="xp-label">
        {aim.heading === "hypothesis" ? "Hypothesis" : "Aim"}
      </Sub>
      <p className="mt-1.5 text-[1.0625rem] leading-relaxed">
        <RichText value={aim.text} />
      </p>
    </section>
  );

  const hasRight = Boolean(findings || conclusion || reflection);
  const conclusionAndNext = (conclusion || reflection) && (
    <div className="min-w-0">
      {conclusion && <Block s={conclusion} Sub={Sub} label="Conclusion" part="conclusion" />}
      {reflection && <Block s={reflection} Sub={Sub} label="Limitations and next steps" part="reflection" ruled={Boolean(conclusion)} />}
    </div>
  );

  return (
    <>
      {key ? (
        <div className="xp-section mt-8 grid items-start gap-9 @2xl/main:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] print:mt-3 print:grid-cols-[52mm_minmax(0,1fr)] print:gap-5">
          <div className="@container min-w-0">
            {aimBlock}
            {method}
          </div>
          <div data-part="key-figure" className="min-w-0">
            <Figure s={key} imageUrls={imageUrls} zoom big />
          </div>
        </div>
      ) : (
        <div className="xp-section mt-8 min-w-0 print:mt-3">
          {aimBlock}
          {method}
        </div>
      )}

      {more.length > 0 && (
        <div role="group" aria-label="More figures" data-part="figures" className={`xp-section grid gap-6 ${more.length > 1 ? "@2xl/main:grid-cols-2 print:grid-cols-2" : ""}`}>
          {more.map((f) => (
            <Figure key={f.id} s={f} imageUrls={imageUrls} zoom />
          ))}
        </div>
      )}

      {(findings || hasRight) && (
        <div className={`xp-section grid items-start gap-8 ${findings && hasRight && (conclusion || reflection) ? "@2xl/main:grid-cols-2 print:grid-cols-2 print:gap-5" : ""}`}>
          {findings && <Findings s={findings} Sub={Sub} heading="Results" part="results" kicker />}
          {conclusionAndNext}
        </div>
      )}

      {quote && <SectionBlock s={quote} Sub={Sub} imageUrls={imageUrls} format="research" />}

      {refs.length > 0 && (
        <section aria-labelledby="refs-h" data-part="references" className="xp-section break-inside-avoid">
          <Sub id="refs-h" className="xp-label">
            References
          </Sub>
          <ul className="mt-1">
            {refs.map((r) => {
              const href = safeHref(r.href);
              const label = r.label.trim() || "Reference";
              return (
                <li key={r.id} className="xp-finding border-b py-3 text-[0.9375rem] leading-snug last:border-b-0 print:py-1.5">
                  {href ? (
                    <a href={href} rel="nofollow ugc noopener" target="_blank" className="xp-link inline-flex items-start gap-1.5 font-semibold">
                      <span>{label}</span>
                      <ArrowUpRight aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="font-semibold">{label}</span>
                  )}
                  {r.description.trim() && <span className="xp-muted mt-0.5 block text-sm">{r.description.trim()}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

/** The conclusion, or the limitations and next steps: a small heading over text, with a hairline above when it follows another. */
function Block({ s, Sub, label, part, ruled = false }: { s: Extract<Section, { kind: "conclusion" | "reflection" }>; Sub: Sub; label: string; part: string; ruled?: boolean }) {
  return (
    <section aria-labelledby={`${s.id}-h`} data-part={part} className={`break-inside-avoid ${ruled ? "xp-next mt-5 border-t pt-5 print:mt-2 print:pt-2" : ""}`}>
      <Sub id={`${s.id}-h`} className="xp-label">
        {label}
      </Sub>
      <p className="mt-1.5 text-[1.0625rem] leading-relaxed">
        <RichText value={s.text} />
      </p>
    </section>
  );
}
