import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { GoogleOrEmail } from "./GoogleOrEmail";
import { safeNext } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const create = `/login/new?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Log in</h1>
      <p className="mt-3 text-graphite">Use the email and password on your account. New here? Create one first.</p>
      {error === "link" && (
        <p className="mt-4 text-error">That sign-in didn&rsquo;t finish. Try again, or log in with your password.</p>
      )}
      <div className="mt-6">
        <Button href={create} variant="secondary" className="w-full">
          Create an account
        </Button>
      </div>
      <GoogleOrEmail next={next} />
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="hint mt-6">
        <Link href="/login/reset" className="link">Forgot your password?</Link>
        {" · "}
        <Link href={`/login/link?next=${encodeURIComponent(next)}`} className="link">Email me a link</Link>
      </p>
    </div>
  );
}
