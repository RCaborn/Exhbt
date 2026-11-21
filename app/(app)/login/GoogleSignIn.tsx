"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";

/** Starts Google sign-in. Supabase must have the Google provider switched on (LAUNCH.md). */
export function GoogleSignIn({ next }: { next: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function start() {
    setError("");
    setPending(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setPending(false);
      setError("Google sign-in isn't available just now. Use your email instead.");
      return;
    }
    const sb = createBrowserClient(url, key);
    const { error: oauthError } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) {
      setPending(false);
      setError("Google sign-in isn't available just now. Use your email instead.");
    }
  }

  return (
    <div>
      <Button type="button" variant="secondary" label="Continue with Google" loading={pending} onClick={() => void start()} className="w-full">
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
