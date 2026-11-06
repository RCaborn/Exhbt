import type { MetadataRoute } from "next";
import { isPrivatePreview } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (isPrivatePreview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/roadmap/", "/account", "/api/", "/auth/", "/dev/"] },
  };
}
