import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JobLinkView } from "@/components/portfolio/JobLinkView";
import { getCurrentUser } from "@/lib/auth";
import { loadJobLinkPreview } from "@/lib/job-links";
import { isPhase2Enabled } from "@/lib/site";

export const metadata: Metadata = { title: "Preview job link", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The owner's view of the page an employer gets, on or off. Counts no view. */
export default async function JobLinkPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isPhase2Enabled()) notFound();
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/job-links/${id}/preview`);
  const data = await loadJobLinkPreview(id, user.id);

  return (
    <div className="bg-mist">
      <div className="mx-auto max-w-[64rem] px-4 pt-8 pb-16 sm:px-8 sm:pt-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-sm">
          <span className="font-semibold">Preview: this is what the employer sees.</span>
          <Link href={`/job-links/${id}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-graphite">
            <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Back to editing
          </Link>
        </div>
        {data ? (
          <JobLinkView data={data} />
        ) : (
          <p role="status">Nothing to show yet: none of this link&apos;s exhbts is live.</p>
        )}
      </div>
    </div>
  );
}
