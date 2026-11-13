import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const create = `/login/new?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Log in</h1>
      <p className="mt-3 text-graphite">Email or username, and your password.</p>
      {error === "link" && (
        <p className="mt-4 text-error">That link has expired or already been used. Log in with your password, or set a new one.</p>
      )}
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="hint mt-8">
        <Link href={create} className="link">Create an account</Link>
        {" · "}
        <Link href="/login/reset" className="link">Forgot your password?</Link>
      </p>
      <p className="hint mt-3">
        Used an emailed link before? <Link href="/login/reset" className="link">Set a password</Link> once, then this page is enough.{" "}
        <Link href="/roadmap/new" className="link">Start with a free roadmap</Link> if you don&rsquo;t have an account yet.
      </p>
    </div>
  );
}
