import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:px-8 lg:pt-16">
      <h1 className="">Account</h1>
      <p className="mt-3 text-graphite">Signed in as {user.email}. Plan: Free.</p>

      <section aria-labelledby="data" className="mt-12 border-t border-line pt-8">
        <h2 id="data" className="text-[1.375rem]">Your data</h2>
        <p className="mt-3">Download everything we hold about you as a JSON file.</p>
        <div className="mt-4">
          <Button href="/api/account/export">Download my data</Button>
        </div>
      </section>

      <section aria-labelledby="delete" className="mt-12 border-t border-line pt-8">
        <h2 id="delete" className="text-[1.375rem]">Delete account</h2>
        <p className="mt-3">
          This removes your account, your CV text and your roadmap straight away. It cannot be undone.
        </p>
        <form action="/api/account/delete" method="post" className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="confirm" value="yes" required className="mt-1.5 size-4 accent-error" />
            <span>I understand this deletes everything.</span>
          </label>
          <Button type="submit" variant="danger">Delete my account</Button>
        </form>
      </section>
    </div>
  );
}
