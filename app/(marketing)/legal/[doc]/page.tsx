import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { legalUpdatedLabel } from "@/lib/legal";
import { marketingMetadata } from "@/lib/seo";
import { BILLING_PERIOD, PLAN_NAMES, REFERRAL_CREDIT } from "@/lib/entitlements";

const PAID = `${PLAN_NAMES.premium} and ${PLAN_NAMES.max}`;

type Doc = { title: string; updated: string; body: React.ReactNode };

const DOCS: Record<string, Doc> = {
  privacy: {
    title: "Privacy policy",
    updated: legalUpdatedLabel("privacy"),
    body: (
      <>
        <p>
          Exhbt (&ldquo;we&rdquo;) is the controller of the personal data described here. Contact:{" "}
          <a className="link" href="mailto:hello@exhbt.co.uk">hello@exhbt.co.uk</a>.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>Your email address, and a password you choose, to create your account and sign you in. Supabase Auth stores the password in a form that cannot be read back. We also email you sign-in and password-reset links when you ask for them.</li>
          <li>Your name, and your LinkedIn profile address if you give it.</li>
          <li>
            The text of your CV and what you type into the roadmap form: the job you want, your education and your
            skills. Your browser reads a CV file itself. If it can&rsquo;t (a scan or a photo) and you choose to send
            it, Anthropic reads the file to turn it into text. We keep the text, not the file.
          </li>
          <li>Your roadmaps, and the project ideas you save from them. A saved idea is a copy that stays on your list.</li>
          <li>
            Your portfolio, if you set one up: a username, headline, short bio, profile photo, the look and layout you
            choose, and the exhbts you write.
          </li>
          <li>The files you upload for an exhbt, the text read from them, and everything you write in the editor.</li>
          <li>
            If you invite teammates: their email addresses and the roles you give them. If you are invited: your email
            address on the invite, and your name, photo and role once you accept.
          </li>
          <li>
            If you make a link for a job ({PLAN_NAMES.max}): the company, the role, the job description or link you
            gave, the exhbts we picked and your note to the employer.
          </li>
          <li>
            If you pay for a plan: which plan, its status and renewal date, and Stripe&rsquo;s reference for you and
            your subscription. Not your card details.
          </li>
          <li>
            Referrals are not open yet. When they are, each account gets a short referral code. If you follow
            someone&rsquo;s referral link and sign up, we keep a record that links your new account to theirs, with its
            status, until your account is deleted. We tell the person who referred you only that a referral was
            credited, never who you are. If they get {REFERRAL_CREDIT} credit when you first pay, that credit is
            applied to their own Stripe balance.
          </li>
          <li>
            A record of what the service does, linked to your account: events such as &ldquo;roadmap
            completed&rdquo;, and for each AI request the step, model, tokens used and cost, but not the text. For some
            requests we also keep a one-way hash of your IP address, to limit abuse. We do not use advertising or
            tracking cookies.
          </li>
          <li>
            Anonymous page-view counts: when a page loads we count one view, with the page address (no search
            terms or personal links) and the site that sent you. We use no cookie, store no IP address or browser
            details, and do not tie a view to your account. We skip it if your browser sends Do Not Track.
          </li>
          <li>If you join the waitlist or write to us as a university: your email and what you tell us.</li>
        </ul>

        <h2>Public portfolios</h2>
        <p>
          On {PAID} you can publish exhbts to your own portfolio at{" "}
          <span className="font-mono text-[0.9em]">username.exhbt.co.uk</span>. Anyone with the link can see your
          name, headline, bio and profile photo, your LinkedIn link if you added it, and the exhbts you have
          published, including their images and any evidence file you attached. Drafts and unpublished edits are never
          shown. Free accounts don&rsquo;t have a public page.
        </p>
        <p>
          Your look and layout (colours, fonts, the order of tiles, any extra tiles you add) are saved with your
          profile and shown to visitors as you set them. If you change your username, the old address redirects to the
          new one for 30 days, then stops working.
        </p>
        <p>
          Search engines can list your portfolio unless you tick &ldquo;Hide my portfolio from search engines&rdquo; in
          Portfolio settings; we then ask them not to index it. That can&rsquo;t pull back copies others have already
          made.
        </p>
        <p>
          To take an exhbt down, open it and choose Unpublish. It leaves your portfolio straight away. A file link
          someone opened just before can keep working for up to an hour.
        </p>
        <p>
          If you move to a smaller plan we delete nothing. Your portfolio shows as many published exhbts as the new
          plan allows, and the saved look falls back to the default until you upgrade again.
        </p>
        <h2>Protect the real numbers</h2>
        <p>
          A graph can hide its real figures. Turn on &ldquo;Protect the real numbers&rdquo; and the page shows a change
          or an index instead. When you publish, we store only that index for the live page. The figures you typed stay
          in your own working copy and are never published.
        </p>

        <h2>Project files</h2>
        <p>
          Uploaded files sit in private storage with Supabase. They have no public address: when your portfolio shows
          an image or an evidence file, we make a link that expires after an hour. We keep your project material, the
          text we draft from and the AI version of your exhbt with the exhbt they belong to. When you delete an exhbt
          we delete those and any image or work file it uses, unless another of your exhbts or your profile photo uses
          the same file. When you delete your account we delete every file you have stored.
        </p>

        <h2>Teammates and shared files</h2>
        <p>
          When you invite a teammate, we email the address you give. The email names you, the project title and the
          role you chose, and has a link that works for 14 days. If they accept, their name, photo and role show on the
          exhbt once it&rsquo;s published, and they can leave at any time. We also email you when someone asks to join
          your exhbt, and email someone when you add them. A teammate who makes their own exhbt from the project gets
          their own copy of the files you uploaded for it. Nothing you wrote is copied.
        </p>
        <p>
          When you upload a file, we work out its fingerprint (a SHA-256 hash) and compare it with the fingerprints of
          files on other people&rsquo;s exhbts, to spot shared project files and help teammates find each other. Only
          identical files match. If one does, we ask whether you worked on that project together, without telling you
          whose exhbt it is. If you ask to join, we show its owner your name, email address and the role you give so
          they can say yes or no. A match is never shown publicly. We keep a record of each match and how it was
          answered, and Exhbt staff may review those records.
        </p>

        <h2>AI</h2>
        <p>We use Anthropic&rsquo;s Claude Haiku model for:</p>
        <ul>
          <li>writing your roadmap from the job, your CV text and what you told us, and suggesting project ideas;</li>
          <li>reading a CV scan or photo, only if you choose to send it;</li>
          <li>transcribing a scan or photo of project material, only if you choose to send it;</li>
          <li>drafting an exhbt from your project material, and rewriting a block when you ask;</li>
          <li>
            choosing a figure for an exhbt: when you draft one from a PDF, images of the pages with charts, diagrams or
            pictures on them (from the first 30) are sent to pick the one that best shows your result. If your browser
            can&rsquo;t read any text in a PDF, as with most scans, its page images are sent only if you choose to send it
            to be read. A scan that already has text in it is treated like any other PDF: each of its pages is a picture,
            so its page images are sent when you draft. We keep the figure cut out of the page, not the page images.
          </li>
        </ul>
        <p>
          The model is told to use only facts you supplied. We then check every number in a draft against your material
          and flag any we can&rsquo;t find, so you can check or remove it before you publish. A draft is a suggestion;
          you decide what is published. Anthropic receives only what a request needs, and its API terms say it
          doesn&rsquo;t use API inputs to train its models.
        </p>

        <h2>Job links ({PLAN_NAMES.max})</h2>
        <p>
          When you make one, you paste a
          job description or a link to it. If you give a link, our server reads that web page. We send the job
          description and, for each of your published exhbts, its title, context line, skills and findings to
          Anthropic, which picks the best fits and writes a short reason for each and a draft note to the employer. We
          keep the description and link with the job link so you can see what it was made from. A visit to the link
          adds one to a view count, with no cookie and nothing recorded about the visitor. Search engines are told not
          to list job links.
        </p>

        <h2>Why, and on what lawful basis</h2>
        <p>
          We process this data to provide the service you asked for (contract). We use usage records to run, secure and
          improve Exhbt (legitimate interests). Exhbt staff can view account-level usage data, such as accounts,
          roadmaps and AI usage, to run the service. If your university licenses Exhbt, it sees counts of activity,
          never the content of your CV or exhbts.
        </p>

        <h2>Who processes it for us</h2>
        <ul>
          <li>Supabase: database, sign-in and file storage. Your data is stored in the European Union (Paris, France).</li>
          <li>Cloudflare: hosting and delivery of the website, and Web Analytics, which sets no cookies.</li>
          <li>Anthropic: the AI steps above.</li>
          <li>Resend: sending sign-in, confirmation and password-reset emails, roadmap emails and teammate invites.</li>
          <li>
            Stripe, when you buy a paid plan: payments. You pay on Stripe&rsquo;s own page, so your card details go
            straight to Stripe and never reach us.
          </li>
        </ul>
        <p>
          Data moves between the UK and the EU under the UK&rsquo;s adequacy regulations for the EU. Anthropic,
          Cloudflare, Resend and Stripe may also process data outside the UK and EU, under safeguards such as standard
          contractual clauses.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Until you delete it or your account. We plan to delete project source material automatically 30 days after
          upload, but that isn&rsquo;t built yet: for now it stays with its exhbt until you delete the exhbt or your
          account. Deleting your account from the Account page removes your profile, roadmaps, exhbts, teammate
          records, saved ideas, job links, subscription records and every stored file from our live systems straight
          away. Copies in Supabase backups age out afterwards. Usage events and AI usage logs stay, with the link to
          your account removed. Stripe keeps its own payment records as the law requires.
        </p>

        <h2>Your rights</h2>
        <p>
          You can download all your data or delete your account yourself from the Account page. The download includes
          your portfolio, every exhbt, file details (not the files), plans, saved ideas, team records and your side of
          any file match. You can also ask us to correct or restrict processing, and you can complain to the
          Information Commissioner&rsquo;s Office (ico.org.uk).
        </p>
      </>
    ),
  },
  terms: {
    title: "Terms of use",
    updated: legalUpdatedLabel("terms"),
    body: (
      <>
        <h2>Your content</h2>
        <p>
          You keep ownership of everything you upload and write. You give us a licence to store it, process it to
          provide the service (including sending it to our AI provider when you ask for a draft or a job match), and
          show published exhbts to anyone with the link. The licence ends when you delete the content or your account,
          apart from copies in backups that age out.
        </p>

        <h2>Accuracy and AI drafts</h2>
        <p>
          Before publishing an exhbt you confirm it is accurate and your own work. AI drafts are suggestions built only
          from what you supplied. You are responsible for checking them, and for every number and claim you publish. We
          may remove exhbts that we believe are copied or misleading.
        </p>

        <h2>Confidential information</h2>
        <p>
          Don&rsquo;t publish anything an employer, client or university gave you in confidence: internal figures,
          client names, unreleased work. If a project used confidential data, describe the method and leave the numbers
          out, or get permission first. &ldquo;Protect the real numbers&rdquo; on a graph helps, but you are still
          responsible for what you publish. We may remove an exhbt that appears to break this.
        </p>

        <h2>Teammates and shared files</h2>
        <p>
          If you invite someone, or add files that others worked on, you must have the right to share them with the
          people you add. You are responsible for who you invite and for the files you add to an exhbt. A teammate who
          makes their own exhbt from yours gets copies of the files you uploaded for it, so only upload what they may
          see. A teammate can leave an exhbt at any time.
        </p>

        <h2>Paid plans</h2>
        <p>
          {PAID} are billed once a {BILLING_PERIOD}, in one payment, through Stripe. They renew automatically each {BILLING_PERIOD} until
          you cancel. You can cancel at any time from the Billing page and keep the plan until the end of the period you
          paid for.
        </p>
        <p>
          If you move to a smaller plan, or your plan ends, nothing is deleted. Your portfolio shows as many published
          exhbts as the new plan allows, in your order, the saved look falls back to the default, and on Free your
          portfolio is no longer public. Upgrade again and the rest come back.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Don&rsquo;t upload anything you don&rsquo;t have the right to share, other people&rsquo;s personal data
          beyond what your project needs, or malicious files. Don&rsquo;t pass off other people&rsquo;s work as yours,
          or try to get round plan limits or reach other people&rsquo;s accounts.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <a className="link" href="mailto:hello@exhbt.co.uk">hello@exhbt.co.uk</a>.
        </p>
      </>
    ),
  },
  cookies: {
    title: "Cookie policy",
    updated: legalUpdatedLabel("cookies"),
    body: (
      <>
        <p>
          We only use cookies that are strictly necessary to run the service. These don&rsquo;t need consent, so you
          won&rsquo;t see a cookie banner.
        </p>
        <h2>Cookies we set</h2>
        <ul>
          <li>
            <strong>Sign-in session.</strong> Set when you log in or open a sign-in link, and kept fresh while you use the app, to
            keep you signed in. It is not set on portfolio pages.
          </li>
          <li>
            <strong>Roadmap access (exhbt_rm).</strong> Remembers which roadmaps this browser created, so you can come
            back to one before you sign in. It holds a signed list of roadmap ids, not your name or email, and lasts up
            to 90 days.
          </li>
        </ul>
        <h2>Referral cookie (not in use yet)</h2>
        <p>
          Referrals are not open, so we set no referral cookie today. When they open, following a referral link will
          set one cookie, <strong>exhbt_ref</strong>, for 30 days. It holds the referral code from the link and the
          time you followed it, signed so it can&rsquo;t be altered, and nothing about you. We use it once, when you
          sign up, to link your new account to the person who sent you, and then remove it. This page will be updated
          to say how it is used before that happens.
        </p>
        <h2>What your browser stores</h2>
        <p>
          The exhbt editor keeps a copy of your unsaved changes in your browser&rsquo;s local storage until the server
          has them, and remembers if you hid the editor guide. Neither is used to track you.
        </p>
        <h2>Statistics</h2>
        <p>
          Cloudflare Web Analytics gives us basic visit counts without cookies or fingerprinting your device. Visits to
          a job link are counted as a number, with no cookie. We also count page views ourselves, anonymously: the page
          and the site that sent you, with no cookie and no IP address stored. If we ever add optional cookies, they
          will be off until you turn them on.
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
  if (!Object.hasOwn(DOCS, doc)) return { title: "Not found" };
  return marketingMetadata(`legal-${doc}` as "legal-privacy" | "legal-terms" | "legal-cookies");
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-[68ch] px-4 pt-14 sm:px-8 lg:pt-20">
      <h1>{d.title}</h1>
      <p className="hint mt-3">Last updated {d.updated}.</p>
      <div className="prose-read mt-8">{d.body}</div>
    </div>
  );
}
