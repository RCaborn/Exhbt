import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default async function CheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string; kind?: string }>;
}) {
  const { email, dev, kind } = await searchParams;
  const isLink = kind === "link";
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Check your email</h1>
      <p className="mt-4 text-lg text-graphite">
        {isLink ? (
          <>
            We sent a sign-in link to <span className="text-ink">{email ?? "your inbox"}</span>. Open it to log in. It
            works on any device, once, for one hour.
          </>
        ) : (
          <>
            We sent a link to <span className="text-ink">{email ?? "your inbox"}</span>. Open it to confirm your
            address. It works on any device, for one hour. After that, log in with your password.
          </>
        )}
      </p>
      <p className="hint mt-6">Nothing there after a few minutes? Check spam, or go back and check the address.</p>
      {dev && dev.startsWith("/auth/dev") && (
        <p className="mt-10 rounded border border-dashed border-line p-4 text-sm">
          Development mode: email is not configured.{" "}
          <a className="link font-medium" href={dev}>
            {isLink ? "Open the sign-in link" : "Open the confirmation link"}
          </a>
        </p>
      )}
    </div>
  );
}
