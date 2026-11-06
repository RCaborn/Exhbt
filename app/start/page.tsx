import { redirect } from "next/navigation";

/**
 * Direct entry for directed traffic (ads, social links, QR codes): skips the landing
 * page and opens the roadmap builder at "Describe the job you want". Organic visitors
 * land on the home page instead. Keeps ?role= and utm_* parameters.
 */
export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && (k === "role" || k.startsWith("utm_"))) q.set(k, v.slice(0, 300));
  if (!q.has("role")) q.set("step", "1");
  redirect(`/roadmap/new?${q}`);
}
