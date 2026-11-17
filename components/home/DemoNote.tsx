import { Button } from "@/components/ui/Button";

/** The wash bar that says a demo page is fictional, with the way to a real one. */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <div data-demo-note className="border-b border-line bg-wash">
      <div className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <p className="max-w-[44rem] text-[0.95rem]">{children}</p>
        <Button href="/pricing" size="sm" variant="ink">
          Get your own
        </Button>
      </div>
    </div>
  );
}
