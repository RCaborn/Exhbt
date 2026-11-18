import type { MetadataRoute } from "next";
import { marketingUrls } from "@/lib/marketing-urls";

export default function sitemap(): MetadataRoute.Sitemap {
  return marketingUrls().map((url) => ({ url }));
}
