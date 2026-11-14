import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/store";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext, "/account");
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Create an account</h1>
      <p className="mt-3 text-graphite">
        {isSupabaseConfigured()
          ? "Choose a password. We'll email you once to confirm the address, and after that you log in with the password."
          : "Choose a password. On this development server you're signed in straight away."}
      </p>
      <div className="mt-8">
        <SignupForm next={next} />
      </div>
      <p className="hint mt-8">
        Already have an account? <Link href={loginHref} className="link">Log in</Link>.
      </p>
    </div>
  );
}
