import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string }>;
}) {
  const { email, dev } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Check your email</h1>
      <p className="mt-4 text-lg text-graphite">
        We sent a sign-in link to <span className="text-ink">{email ?? "your inbox"}</span>. Open it on this device
        to log in. The link works for one hour.
      </p>
      <p className="hint mt-6">Nothing there after a few minutes? Check spam, or go back and check the address.</p>
      {dev && dev.startsWith("/auth/dev") && (
        <p className="mt-10 rounded border border-dashed border-line p-4 text-sm">
          Development mode: email is not configured.{" "}
          <a className="link font-medium" href={dev}>
            Open the sign-in link
          </a>
        </p>
      )}
    </div>
  );
}
