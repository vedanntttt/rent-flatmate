import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}

export async function AppHeader() {
  const { profile } = await getSessionContext();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-[15px] font-semibold tracking-tight">
          Rent<span className="text-neutral-400">Buddy</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {profile?.role === "tenant" && (
            <>
              <NavLink href="/browse">Browse</NavLink>
              <NavLink href="/interests">My Interests</NavLink>
              <NavLink href="/tenant/profile">Profile</NavLink>
            </>
          )}
          {profile?.role === "owner" && (
            <>
              <NavLink href="/owner/listings">My Listings</NavLink>
              <NavLink href="/owner/interests">Requests</NavLink>
            </>
          )}
          {profile?.role === "admin" && <NavLink href="/admin">Admin</NavLink>}

          {profile ? (
            <div className="ml-2 flex items-center gap-3 border-l border-neutral-200 pl-3">
              <span className="hidden text-xs text-neutral-500 sm:inline">
                {profile.full_name} · {profile.role}
              </span>
              <SignOutButton />
            </div>
          ) : (
            <>
              <NavLink href="/login">Log in</NavLink>
              <Link
                href="/signup"
                className="ml-1 rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
