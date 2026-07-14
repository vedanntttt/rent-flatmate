import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Role } from "@/lib/types";

export interface SessionContext {
  user: User | null;
  profile: Profile | null;
}

/**
 * Resolve the signed-in user and their profile (role) for the current request.
 * Reads the user via the session-bound client, then fetches the profile with the
 * admin client so a missing/edge-case RLS policy can't hide a user's own role.
 */
export async function getSessionContext(): Promise<SessionContext> {
  // Before Supabase is configured, treat everyone as logged-out so public
  // pages (landing/login/signup) still render instead of 500-ing.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { user: null, profile: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as Profile) ?? null };
}

/** Throwable guard for Route Handlers. Returns the context or an HTTP error. */
export async function requireRole(
  roles?: Role | Role[]
): Promise<
  | { ok: true; user: User; profile: Profile }
  | { ok: false; status: number; error: string }
> {
  const { user, profile } = await getSessionContext();
  if (!user || !profile) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(profile.role)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }
  return { ok: true, user, profile };
}

/**
 * Server Component guard: redirect unauthenticated users to /login and users
 * with the wrong role to the home page. Returns the authenticated context.
 */
export async function requirePage(
  roles?: Role | Role[]
): Promise<{ user: User; profile: Profile }> {
  const { user, profile } = await getSessionContext();
  if (!user || !profile) redirect("/login");
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(profile.role)) redirect("/");
  }
  return { user, profile };
}
