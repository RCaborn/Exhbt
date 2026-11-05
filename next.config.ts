import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e test server builds into its own folder, so tests can run while `npm run dev` is up.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
