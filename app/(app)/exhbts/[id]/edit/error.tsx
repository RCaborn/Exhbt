"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEditorServed } from "./served";

/**
 * The edit page's own error page (decision 0026, "The crash fallback"): for what the new editor's
 * boundary cannot see, the page failing on the server. In the new editor it says what the boundary says
 * and links to the classic editor for this visit. In the classic editor, whether the address asked for it
 * or the switch serves it (as it does everyone until the new editor is switched on), it names the classic
 * editor and offers Reload: the route's layout says which (served.tsx), since the address alone told the
 * live site's classic editor that the new one had failed. The link is a full page load: a client
 * navigation that only changes the query would keep this page.
 */
export default function EditError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const served = useEditorServed();
  const classicAsked = useSearchParams().get("editor") === "classic" || served === "classic";
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-mist" data-edit-error>
      <div className="mx-auto max-w-[78rem] px-4 pt-8 pb-16 sm:px-8 xl:max-w-[90rem]">
        <Link href="/exhbts" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-graphite">
          <ArrowLeft aria-hidden size={15} strokeWidth={2.25} /> Your exhbts
        </Link>
        <h1 className="mt-3 text-[2rem] sm:text-[2.5rem]">Edit exhbt</h1>
        <p role="alert" className="mt-4 font-semibold">
          Something went wrong with the {classicAsked ? "classic" : "new"} editor. Your work is saved.
        </p>
        <div className="mt-4">
          {classicAsked ? (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : (
            <a href={`${pathname}?editor=classic`} className="link font-semibold">
              Use the classic editor
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
