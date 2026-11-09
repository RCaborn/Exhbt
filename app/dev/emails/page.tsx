import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { outbox } from "@/lib/email/send";

export const metadata: Metadata = { title: "Dev outbox", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Development only: every email the app "sent" without an email provider configured.
 * Use it to check and restyle templates. Returns 404 in production.
 */
export default async function DevEmails({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await searchParams;
  const mail = outbox();
  const current = mail.find((m) => m.id === id) ?? mail[0];

  return (
    <main id="main" className="min-h-svh bg-mist px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[76rem]">
        <h1 className="">Dev outbox</h1>
        <p className="mt-2 text-graphite">
          Emails sent while <code className="font-mono text-sm">RESEND_API_KEY</code> is unset. Cleared when the dev
          server restarts. Templates live in <code className="font-mono text-sm">lib/email/templates/</code>.
        </p>

        {mail.length === 0 ? (
          <p className="mt-8 rounded-[var(--radius)] bg-surface px-5 py-4">
            Nothing yet. <Link href="/roadmap/new" className="link">Build a roadmap</Link> and its email will appear here.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[20rem_1fr]">
            <ul className="space-y-2" aria-label="Sent emails">
              {mail.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/dev/emails?id=${m.id}`}
                    aria-current={m.id === current?.id ? "true" : undefined}
                    className={`block rounded-[var(--radius)] border px-4 py-3 ${
                      m.id === current?.id ? "border-jade bg-surface" : "border-line bg-surface/60 hover:bg-surface"
                    }`}
                  >
                    <span className="block font-semibold">{m.subject}</span>
                    <span className="block text-sm text-graphite">to {m.to}</span>
                    <span className="block font-mono text-xs text-graphite">{new Date(m.sentAt).toLocaleTimeString("en-GB")}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {current && (
              <section aria-label="Email preview" className="rounded-[16px] border border-line bg-surface">
                <div className="border-b border-line px-5 py-3 text-sm">
                  <p><span className="text-graphite">To:</span> {current.to}</p>
                  <p><span className="text-graphite">Subject:</span> {current.subject}</p>
                </div>
                <iframe title={`Preview: ${current.subject}`} srcDoc={current.html} className="h-[900px] w-full rounded-b-[16px]" />
                <details className="border-t border-line px-5 py-3 text-sm">
                  <summary className="cursor-pointer font-semibold">Plain-text version</summary>
                  <pre className="mt-3 whitespace-pre-wrap font-mono text-xs">{current.text}</pre>
                </details>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
