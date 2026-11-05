import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canView } from "@/lib/access";
import { getStore } from "@/lib/store";
import { Generating } from "@/components/roadmap/Generating";
import { RoadmapViews, parseView } from "@/components/roadmap/RoadmapViews";

export const metadata: Metadata = { title: "Your roadmap", robots: { index: false } };

export default async function RoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const record = await getStore().getRoadmap(id);
  if (!record) notFound();

  if (!(await canView(record, user))) {
    // Not signed in on this device (e.g. opened from the email later): log in, then come back.
    if (!user) redirect(`/login?next=/roadmap/${id}`);
    // Signed in as someone else: same response as "missing", so ids can't be probed.
    notFound();
  }

  if (!record.output) return <Generating id={id} role={record.input.targetRole} />;

  return (
    <RoadmapViews
      id={id}
      roadmap={record.output}
      view={parseView(view)}
      emailedTo={record.emailSentAt ? record.pendingEmail : null}
      signedIn={Boolean(user)}
    />
  );
}
