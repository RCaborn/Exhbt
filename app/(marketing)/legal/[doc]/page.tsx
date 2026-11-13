import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BILLING_PERIOD, PLAN_NAMES } from "@/lib/entitlements";

const PAID = `${PLAN_NAMES.premium} and ${PLAN_NAMES.max}`;

type Doc = { title: string; updated: string; body: React.ReactNode };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy policy",
    updated: "13 November 2026",
    body: (
      <>
        <p>
          Exhbt (&ldquo;we&rdquo;) is the controller of the personal data described here. Contact:{" "}
          <a className="link" href="mailto:privacy@exhbt.co.uk">privacy@exhbt.co.uk</a>.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Your email address, to create your account and send sign-in links.</li>
          <li>Your name, and your LinkedIn profile address if you give it, for your account and, later, your portfolio.</li>
          <li>
            The text of your CV and anything you type into the roadmap form. Your browser reads the CV file
            itself. If it can&rsquo;t (a scan or a photo) and you choose to send it, Anthropic reads the file to
            turn it into text; we keep the text, not the file.
          </li>
          <li>
            What you put on your portfolio if you set one up: a username, a headline, a short bio and, if you add
            one, a profile photo.
          </li>
          <li>The files you upload for an exhbt, the text read from them, and everything you write in the editor.</li>
          <li>
            If you make a link for a job: the company, the role, the job description you paste, which exhbts the
            link shows, and how many times the page is opened. The count has no cookie and no record of who opened it.
          </li>
          <li>
            If you pay for a plan: which plan, its status and renewal date, and Stripe&rsquo;s reference for you and
            your subscription. Not your card details.
          </li>
          <li>
            Product events such as &ldquo;roadmap completed&rdquo;, linked to your account. We do not use
            advertising or tracking cookies.
          </li>
        </ul>
        <h2>Public portfolios</h2>
        <p>
          On {PAID} you can publish exhbts to your own portfolio address. Anyone with the link can see your name,
          headline, bio and profile photo, your LinkedIn link if you added it, and the exhbts you have published,
          including their images and any evidence file you attached. Drafts, and edits you haven&rsquo;t published,
          are never shown. Free accounts don&rsquo;t have a public page.
        </p>
        <p>
          Search engines can list your portfolio unless you tick &ldquo;Hide my portfolio from search
          engines&rdquo; in Portfolio settings; we then ask them not to index it. That can&rsquo;t pull back copies
          other people or search engines have already made.
        </p>
        <p>
          To take an exhbt down, open it and choose Unpublish. It leaves your portfolio straight away. A file link
          someone opened just before can keep working for up to an hour.
        </p>
        <h2>Project files</h2>
        <p>
          Uploaded files sit in private storage with Supabase in London. They have no public address: when your
          portfolio shows an image or an evidence file, we make a link to it that expires after an hour. We keep the
          project material you upload with the exhbt it belongs to, and delete it when you delete that exhbt or your
          account. We plan to delete project material automatically 30 days after upload, but that isn&rsquo;t
          switched on yet.
        </p>
        <h2>AI drafting</h2>
        <p>
          When you ask for a draft, the text read from your files goes to Anthropic, with your notes and any link
          address you gave, and its model writes the draft. Your browser reads most files itself; a scan or a photo
          goes to Anthropic only if you choose to send it. The model is told to use only the facts in your material.
          We then check every number in the draft against your material and flag any we can&rsquo;t find, so you
          check or remove it before you publish.
        </p>
        <h2>Job matching</h2>
        <p>
          On {PLAN_NAMES.max}, you can make a link for one job. You paste the job description. That text and your
          published exhbts go to Anthropic, which suggests which exhbts to show and a short introduction. You can
          change both before anyone sees the page. We don&rsquo;t fetch the advert from a web address. The page is
          not listed by search engines. We count how many times it is opened, without a cookie and without
          recording who opened it.
        </p>
        <h2>Why, and on what lawful basis</h2>
        <p>
          We process this data to provide the service you asked for (contract). We use aggregated, non-identifying
          counts to improve Exhbt (legitimate interests). If your university licenses Exhbt, it sees counts of
          activity, never the content of your CV or exhbts.
        </p>
        <h2>Who processes it for us</h2>
        <ul>
          <li>Supabase: database, file storage and sign-in. Data stored in London, UK.</li>
          <li>Cloudflare: hosting and delivery of the website.</li>
          <li>
            Anthropic: an AI model reads your CV and inputs to write your roadmap, your project material to
            draft an exhbt, and, when you make a link for a job, the job description you pasted and your
            published exhbts. Processing may take place outside the UK under appropriate safeguards; inputs are not
            used to train models.
          </li>
          <li>Resend: sending sign-in emails.</li>
          <li>
            Stripe (paid plans): payments. You pay on Stripe&rsquo;s own page, so your card details go straight to
            Stripe and never reach us.
          </li>
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
    updated: "12 November 2026",
    body: (
      <>
        <h2>Your content</h2>
        <p>
          You keep ownership of everything you upload. You give us permission to store it, process it to provide
          the service, and show published exhbts to anyone with the link.
        </p>
        <h2>Accuracy</h2>
        <p>
          Before publishing an exhbt you confirm it is accurate and your own work. AI drafts are suggestions built
          only from what you supplied; you are responsible for checking them. We may remove exhbts that we believe
          are copied or misleading.
        </p>
        <h2>Confidential information</h2>
        <p>
          Don&rsquo;t publish anything an employer, client or university gave you in confidence: internal figures,
          client names, unreleased work. If a project used confidential data, describe the method and leave the
          numbers out, or get permission first. We may remove an exhbt that appears to break this.
        </p>
        <h2>Paid plans</h2>
        <p>
          {PAID} are billed each {BILLING_PERIOD} through Stripe and renew automatically. You can cancel at any time
          from the Billing page and keep the plan until the end of the period you paid for. If you move to a smaller
          plan, nothing is deleted: your portfolio shows as many published exhbts as the new plan allows, in your
          order, and on Free your portfolio is no longer public.
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
      <h1>{d.title}</h1>
      <p className="hint mt-3">Last updated {d.updated}. Draft pending legal review.</p>
      <div className="prose-read mt-8">{d.body}</div>
    </div>
  );
}
