import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false } };

export default async function Unsubscribed({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 pb-24 sm:px-8 lg:pt-24">
      <h1 className="text-[2.6rem] sm:text-[3.4rem]">{error ? "That link didn't work" : "You're unsubscribed"}</h1>
      <p className="mt-4 text-lg text-ink-2">
        {error
          ? "The unsubscribe link may be incomplete. Copy the full link from the email, or reply to it and we'll take you off the list."
          : "We won't send you news about Exhbt features. You'll still get emails you ask for, such as sign-in links."}
      </p>
      <Link href="/" className="link mt-6 inline-block">Back to Exhbt</Link>
    </div>
  );
}
