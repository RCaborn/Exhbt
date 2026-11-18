import { marketingUrls } from "@/lib/marketing-urls";

/** Plain list of the same URLs as /sitemap.xml. One address per line. */
export function GET() {
  return new Response(`${marketingUrls().join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
