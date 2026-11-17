import { ArrowDown, ArrowRight, FileText, GripVertical } from "lucide-react";
import { PLAN_NAMES } from "@/lib/entitlements";
import { portfolioHost } from "@/lib/hosts";

/**
 * How an exhbt gets made, drawn the way an exhbt draws its own method (MethodFlow): boxes joined by
 * arrows, the last one ink. Each box has a small sketch of that step, made from the product's own
 * parts (a file, the question with its highlight, sections with grips, the live address), not a
 * screenshot. A row from lg, a column with down arrows below it.
 */
type Step = { title: string; body: string; sketch: React.ReactNode; last?: boolean };

export function HowItWorks({ username, fileName, question, slug }: { username: string; fileName: string; question: string; slug: string }) {
  const steps: Step[] = [
    {
      title: "Upload your project",
      body: "The report, notes, slides or spreadsheet you already have. Most files are read in your browser.",
      sketch: <UploadSketch fileName={fileName} />,
    },
    {
      title: "We draft the exhbt",
      body: "The AI writes a first version from your files and nothing else, and flags any number it can’t find in them.",
      sketch: <DraftSketch question={question} />,
    },
    {
      title: "You arrange it",
      body: "Edit any part, add a graph, drag the sections into your order, then confirm it’s accurate and your own.",
      sketch: <ArrangeSketch />,
    },
    {
      title: "It goes live on your site",
      body: `At ${portfolioHost("name")}, on ${PLAN_NAMES.premium} and ${PLAN_NAMES.max}. Until you publish, only you can see it.`,
      sketch: <LiveSketch name={username} host={portfolioHost(username)} path={slug} />,
      last: true,
    },
  ];
  return (
    <ol aria-label="How an exhbt gets made" className="mt-12 grid gap-10 lg:grid-cols-4 lg:gap-8">
      {steps.map((s, i) => (
        <li
          key={s.title}
          data-step={i + 1}
          className={`relative flex flex-col rounded-[20px] border ${s.last ? "border-ink bg-ink text-white" : "border-line bg-surface"}`}
        >
          {/* The arrow from the step before, centred in the gap: down in the column, right in the row. */}
          {i > 0 && (
            <span aria-hidden className="absolute -top-[1.875rem] left-1/2 -translate-x-1/2 text-slate lg:top-[5rem] lg:-left-[1.625rem] lg:translate-x-0 lg:-translate-y-1/2">
              <ArrowDown size={20} strokeWidth={2} className="lg:hidden" />
              <ArrowRight size={20} strokeWidth={2} className="hidden lg:block" />
            </span>
          )}
          <div aria-hidden className={`flex h-40 items-center justify-center rounded-t-[19px] px-3 xl:px-5 ${s.last ? "" : "border-b border-line bg-mist"}`}>
            {s.sketch}
          </div>
          <div className="p-5 pt-4">
            <p className={`text-[1.125rem] leading-snug font-semibold tracking-[-0.01em] ${s.last ? "text-white" : ""}`}>{s.title}</p>
            <p className={`mt-1.5 text-[0.95rem] leading-relaxed ${s.last ? "text-on-ink" : "text-graphite"}`}>{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function UploadSketch({ fileName }: { fileName: string }) {
  return (
    <div className="w-full max-w-[15rem] rounded-[14px] border border-line bg-surface p-3 shadow-pack">
      <div className="flex items-center gap-2.5 xl:gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-wash text-jade xl:size-10">
          <FileText size={20} strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-semibold">{fileName}</span>
          <span className="block text-[0.75rem] text-slate">Read in your browser</span>
        </span>
      </div>
      <span className="mt-3 block h-1.5 rounded-full bg-jade" />
    </div>
  );
}

function DraftSketch({ question }: { question: string }) {
  return (
    <div className="w-full max-w-[15rem]">
      <p className="font-[family-name:var(--font-display)] text-[1rem] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">{question}</p>
      <span className="mt-2.5 block h-2 w-full rounded-[3px] bg-line" />
      <span className="mt-1.5 block h-2 w-2/3 rounded-[3px] bg-[color-mix(in_srgb,var(--color-mint)_42%,white)]" />
      <span className="mt-3 flex items-center gap-1">
        <span className="h-4 flex-1 rounded-[4px] border border-line bg-surface" />
        <span className="h-4 flex-1 rounded-[4px] border border-line bg-surface" />
        <span className="h-4 flex-1 rounded-[4px] bg-ink" />
      </span>
    </div>
  );
}

function ArrangeSketch() {
  const rows = ["What I found", "Graph", "What I’d do next"];
  return (
    <ul className="w-full max-w-[15rem] space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={r}
          className={`flex items-center gap-2 rounded-[10px] border bg-surface px-2.5 py-1.5 text-[0.8125rem] font-medium ${
            i === 1 ? "translate-x-2 border-jade shadow-pack outline-2 outline-jade outline-solid" : "border-line"
          }`}
        >
          <GripVertical size={14} strokeWidth={2} className="text-slate" />
          {r}
        </li>
      ))}
    </ul>
  );
}

function LiveSketch({ name, host, path }: { name: string; host: string; path: string }) {
  return (
    <div className="w-full max-w-[15rem] rounded-[14px] border border-graphite px-4 py-3.5">
      <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-mint">
        <span className="size-2 shrink-0 rounded-full bg-mint" />
        Live
      </p>
      {/* A narrow card breaks the host after the name, never mid-word. */}
      <p className="mt-2 font-[family-name:var(--font-display)] text-[1.2rem] leading-tight font-semibold tracking-[-0.02em] text-white">
        {name}.<wbr />
        {host.slice(name.length + 1)}
      </p>
      <p className="mt-0.5 font-mono text-[0.875rem] [overflow-wrap:anywhere] text-on-ink">/{path}</p>
    </div>
  );
}
