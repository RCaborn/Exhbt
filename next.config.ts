import type { NextConfig } from "next";

const isPublicLaunch = process.env.EXHBT_PUBLIC === "1";

const nextConfig: NextConfig = {
  // The e2e test server builds into its own folder, so tests can run while `npm run dev` is up.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Fixed at build time so static pages and server code agree (see lib/site.ts).
  env: { EXHBT_PUBLIC: isPublicLaunch ? "1" : "" },
  async headers() {
    // Private preview: tell search engines not to index anything, including files and APIs.
    return isPublicLaunch
      ? []
      : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
