import { GoogleSignIn } from "./GoogleSignIn";

/** Google, then a divider, when the public Supabase keys are set. Hidden in local development. */
export function GoogleOrEmail({ next }: { next: string }) {
  const on = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!on) return null;
  return (
    <div className="mt-8 space-y-6">
      <GoogleSignIn next={next} />
      <p className="flex items-center gap-3 text-sm text-graphite">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or
        <span className="h-px flex-1 bg-line" aria-hidden />
      </p>
    </div>
  );
}
