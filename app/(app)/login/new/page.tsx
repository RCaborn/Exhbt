import type { Metadata } from "next";
import { safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { GoogleOrEmail } from "../GoogleOrEmail";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext, "/account");
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Create an account</h1>
      <p className="mt-3 text-graphite">
        {isSupabaseConfigured()
          ? "Choose a password. We'll email you once to confirm the address, and after that you log in with the password."
          : "Choose a password. On this development server you're signed in straight away."}
      </p>
      <GoogleOrEmail next={next} />
      <div className="mt-8">
        <SignupForm next={next} />
      </div>
      <div className="mt-6">
        <Button href={loginHref} variant="secondary" className="w-full">
          Log in
        </Button>
      </div>
    </div>
  );
}
