import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-8 lg:pt-24">
      <h1 className="">Log in</h1>
      <p className="mt-3 text-graphite">We email you a link. No password to remember.</p>
      <div className="mt-8">
        <LoginForm next={next ?? "/roadmap"} />
      </div>
      <p className="hint mt-8">
        New here? <Link href="/roadmap/new" className="link">Start with a free roadmap</Link>.
      </p>
    </div>
  );
}
