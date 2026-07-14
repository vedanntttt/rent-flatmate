import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function Home() {
  const { profile } = await getSessionContext();
  if (profile?.role === "tenant") redirect("/browse");
  if (profile?.role === "owner") redirect("/owner/listings");
  if (profile?.role === "admin") redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl py-16 text-center">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">
        AI-powered room matching
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Find a room and a flatmate who actually fit.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-neutral-600">
        Owners list rooms, tenants share what they&apos;re looking for, and an AI
        compatibility engine ranks the best matches. Express interest, get accepted,
        and chat in real time.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-50"
        >
          Log in
        </Link>
      </div>

      <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
        {[
          ["1. Set preferences", "Tenants add preferred location, budget and move-in date."],
          ["2. See ranked matches", "Every listing gets a 0–100 AI compatibility score with a reason."],
          ["3. Chat in real time", "Express interest, get accepted, and message instantly."],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-neutral-200 bg-white p-5">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-neutral-600">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
