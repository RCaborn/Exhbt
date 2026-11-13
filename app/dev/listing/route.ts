import { NextResponse, type NextRequest } from "next/server";

/**
 * Development and tests only: a job advert page for "Use a link" to read
 * (EXHBT_LISTING_TEST_ORIGIN lets lib/jobs/fetch-listing.ts read this origin outside production).
 * /dev/listing is a JavaScript-only shell with almost no text, like many job boards;
 * /dev/listing?full=1 is a readable advert with a JobPosting block. Off in production.
 */
const FULL_DESCRIPTION =
  "<p>We are looking for a graduate data analyst to join our customer insight team in Leeds.</p>" +
  "<p>You will clean and join data from our branch and online systems, build dashboards in Excel and Power BI, and write SQL " +
  "to answer questions from product managers. You will present what you find to people who are not analysts, in plain language.</p>" +
  "<ul><li>A degree with a quantitative element</li><li>Experience with SQL and Python, from study or work</li>" +
  "<li>Some time series or forecasting work is useful</li><li>Clear writing and a habit of checking your numbers</li></ul>" +
  "<p>The scheme lasts two years, with rotations across three teams and study time for a professional qualification.</p>";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const full = new URL(req.url).searchParams.get("full") === "1";
  const html = full
    ? `<!doctype html><html><head><title>Graduate Data Analyst</title>
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Graduate Data Analyst", description: FULL_DESCRIPTION })}</script>
</head><body><nav>Home · Careers · Sign in</nav><main><h1>Graduate Data Analyst</h1>${FULL_DESCRIPTION}</main><footer>Cookies · Privacy</footer></body></html>`
    : `<!doctype html><html><head><title>Jobs</title><script>window.__APP__={}</script></head>
<body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
