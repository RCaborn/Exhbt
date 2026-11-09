import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The big "start" control: one role field and the primary button. A plain GET form,
 * so it works without JavaScript and pre-fills the roadmap builder via ?role=.
 * On a mint or wash band (`tone="band"`) the button switches to ink so it doesn't disappear.
 */
export function StartForm({
  id,
  tone = "white",
  hidden = {},
}: {
  id: string;
  tone?: "white" | "band";
  /** Extra values to carry into the builder, e.g. utm_* from an ad. */
  hidden?: Record<string, string>;
}) {
  return (
    <form action="/roadmap/new" method="get" className="w-full max-w-[40rem]">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={id} className="sr-only">
        Describe the job you want
      </label>
      <div className="flex flex-col gap-2 rounded-[28px] border-[1.5px] border-ink bg-surface p-2 shadow-[0_18px_44px_rgb(14_15_18_/_0.10)] has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-solid has-[input:focus-visible]:outline-ink sm:flex-row sm:items-stretch sm:rounded-full">
        <input
          id={id}
          name="role"
          type="text"
          maxLength={120}
          autoComplete="organization-title"
          placeholder="Describe the job you want"
          className="min-h-14 flex-1 rounded-full bg-transparent px-5 text-[1.15rem] font-medium text-ink placeholder:font-normal placeholder:text-slate focus-visible:shadow-none focus-visible:outline-none sm:min-h-16 sm:text-[1.25rem]"
        />
        <Button type="submit" size="xl" variant={tone === "band" ? "ink" : "primary"} label="Build my roadmap">
          Build my roadmap
          <ArrowRight aria-hidden size={20} strokeWidth={2.5} />
        </Button>
      </div>
    </form>
  );
}
