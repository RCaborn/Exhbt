import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Set a password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ sent?: string; dev?: string }> }) {
  const { sent, dev } = await searchParams;
  const devHref = dev?.startsWith("/login/password?token=") ? dev : null;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Set a password</h1>
      {sent ? (
        <>
          <p className="mt-3 text-graphite">
            If an account uses that address, we&rsquo;ve sent a link to set a password. It works for one hour. After that, log in with the password.
          </p>
          {devHref && (
            <p className="mt-10 rounded border border-dashed border-line p-4 text-sm">
              Development mode: email is not configured.{" "}
              <a className="link font-medium" href={devHref}>
                Open the link
              </a>
            </p>
          )}
          <p className="hint mt-8">
            <Link href="/login/reset" className="link">Use a different address</Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-graphite">
            If you already have an account, we&rsquo;ll email you a link to choose a password. You only need this once.
          </p>
          <div className="mt-8">
            <ResetForm />
          </div>
          <p className="hint mt-8">
            <Link href="/login" className="link">Back to log in</Link>
          </p>
        </>
      )}
    </div>
  );
}
