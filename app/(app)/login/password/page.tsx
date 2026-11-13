import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { peekDevReset } from "@/lib/passwords";
import { isSupabaseConfigured } from "@/lib/store";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Choose a password", robots: { index: false } };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const user = await getCurrentUser();
  const devEmail = process.env.NODE_ENV !== "production" && !isSupabaseConfigured() && token ? peekDevReset(token) : null;
  const ready = Boolean(user) || Boolean(devEmail);
  const email = user?.email ?? devEmail;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Choose a password</h1>
      {ready ? (
        <>
          <p className="mt-3 text-graphite">
            {email ? <>This is for <span className="text-ink">{email}</span>. </> : null}
            After this, log in with your email or username and this password.
          </p>
          <div className="mt-8">
            <PasswordForm token={devEmail && token ? token : undefined} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-graphite">
            {token
              ? "That link has expired, or it has already been used."
              : "Open the link from your email, then choose a password. If you're already signed in, this page is where you change it."}
          </p>
          <p className="hint mt-8">
            <Link href="/login/reset" className="link">Send a new link</Link>
          </p>
        </>
      )}
    </div>
  );
}
