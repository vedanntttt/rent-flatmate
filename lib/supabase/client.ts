import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (browser). Shares the auth session with
 * the server via cookies, and carries the user's JWT into Realtime subscriptions
 * so RLS applies to postgres_changes.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
