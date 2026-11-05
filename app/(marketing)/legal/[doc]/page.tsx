import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Doc = { title: string; updated: string; body: React.ReactNode };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy policy",
    updated: "5 November 2026",
    body: (
      <>
        <p>
          Exhbt (&ldquo;we&rdquo;) is the controller of the personal data described here. Contact:{" "}
          <a className="link" href="mailto:privacy@exhbt.example">privacy@exhbt.example</a>.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Your email address, to create your account and send sign-in links.</li>
          <li>The text of your CV and anything you type into the roadmap form.</li>
          <li>On paid plans, the files and text you add to evidence packs.</li>
          <li>
            Product events such as &ldquo;roadmap completed&rdquo;, linked to your account. We do not use
            advertising or tracking cookies.
          </li>
        </ul>
        <h2>Why, and on what lawful basis</h2>
        <p>
          We process this data to provide the service you asked for (contract). We use aggregated, non-identifying
          counts to improve Exhbt (legitimate interests). If your university licenses Exhbt, it sees counts of
          activity, never the content of your CV or packs.
        </p>
        <h2>Who processes it for us</h2>
        <ul>
          <li>Supabase: database, file storage and sign-in. Data stored in London, UK.</li>
          <li>Cloudflare: hosting and delivery of the website.</li>
          <li>
            Anthropic: an AI model reads your CV and inputs to write your roadmap. Processing may take place
            outside the UK under appropriate safeguards; inputs are not used to train models.
          </li>
          <li>Resend: sending sign-in emails.</li>
          <li>Stripe (paid plans): payments. Card details go directly to Stripe.</li>
        </ul>
        <h2>How long we keep it</h2>
        <p>
          Until you delete your account. Deleting your account from the Account page removes your data from our
          live systems immediately and from backups within 30 days.
        </p>
        <h2>Your rights</h2>
        <p>
          You can download all your data or delete your account yourself from the Account page. You can also ask
          us to correct or restrict processing, and you can complain to the Information Commissioner&rsquo;s
          Office (ico.org.uk).
        </p>
      </>
    ),
  },
  terms: {
    title: "Terms of use",
    updated: "5 November 2026",
    body: (
      <>
        <h2>Your content</h2>
        <p>
          You keep ownership of everything you upload. You give us permission to store it, process it to provide
          the service, and show published packs to anyone with the link.
        </p>
        <h2>Accuracy</h2>
        <p>
          Before publishing a pack you confirm it is accurate and your own work. AI drafts are suggestions built
          only from what you supplied; you are responsible for checking them. We may withdraw packs that fail an
          originality check or that we believe are misleading.
        </p>
        <h2>Paid plans</h2>
        <p>
          Paid plans are annual and renew automatically; we remind you before renewal. You can cancel at any time
          and keep access until the end of the period you paid for. If a plan lapses, published packs and links
          stay readable but cannot be edited.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Do not upload anything you do not have the right to share, other people&rsquo;s personal data beyond what
          your project needs, or malicious files.
        </p>
      </>
    ),
  },
  cookies: {
    title: "Cookie policy",
    updated: "5 November 2026",
    body: (
      <>
        <p>
          We only use cookies that are strictly necessary: one to keep you signed in, set when you click a sign-in
          link. These do not need consent, so you will not see a cookie banner.
        </p>
        <p>
          Our page-view statistics come from Cloudflare Web Analytics, which does not set cookies or fingerprint
          your device. If we ever add optional cookies, they will be off until you turn them on.
        </p>
      </>
    ),
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc]?.title ?? "Not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-[68ch] px-4 pt-14 sm:px-8 lg:pt-20">
      <h1 className="text-[2.6rem]">{d.title}</h1>
      <p className="hint mt-3">Last updated {d.updated}. Draft pending legal review.</p>
      <div className="prose-read mt-8">{d.body}</div>
    </div>
  );
}
