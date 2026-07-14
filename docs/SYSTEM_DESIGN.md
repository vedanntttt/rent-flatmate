# System Design — RentBuddy

## Overview

The system is a single Next.js 16 application. Route Handlers under `app/api/*` form a REST API; React Server/Client Components render the UI. Supabase provides Postgres, Auth, Row-Level Security (RLS) and Realtime. Every request-mutating handler authenticates the caller via the session-bound Supabase client and authorizes by role/ownership in code, then performs writes with a service-role client. This "code-authoritative, RLS as defense-in-depth" split keeps behaviour predictable while still letting the browser subscribe safely to Realtime.

## Compatibility scoring design

Scoring answers one question per tenant–listing pair: *how well do budget and location align?* The output is a 0–100 integer plus a short natural-language explanation. Because computing this on every browse would be slow and costly, scores are **cached** in a `compatibility_scores` table with a `UNIQUE(tenant_id, listing_id)` constraint. The entry point, `getOrComputeScore()`, first looks for a cached row and returns it immediately; only on a miss does it compute and persist. Cached rows are invalidated (deleted for that tenant) when the tenant edits their preferences, so stale scores never linger, and the “not recomputed on every request” requirement is met by construction. Each row also records `method` (`llm` or `rule`), making it transparent which path produced a score.

On the browse page, active listings are fetched with optional `location`/budget filters, each listing is scored (cache-first), and results are sorted by score descending — so the strongest matches surface first.

## LLM integration and fallback

The LLM path uses **Groq** (`openai/gpt-oss-120b`) through the OpenAI-compatible SDK (`baseURL` override). A system prompt frames the model as a rental-compatibility engine and demands strict JSON; the user message embeds the listing and tenant profile as JSON and mirrors the brief's prompt. We request `response_format: { type: "json_object" }`, a low temperature for stability, a 12-second timeout, and a single retry.

Robustness is the priority. `llmScore()` is wrapped so that **any** failure — missing API key, network/timeout, non-JSON output, or a payload that fails Zod validation — returns `null` rather than throwing. The score is then clamped to 0–100 and rounded. When `llmScore()` yields `null`, `getOrComputeScore()` falls back to `ruleBasedScore()`.

The **rule-based fallback** is fully deterministic and offline: 50 points for location (exact match, substring overlap, or token overlap) plus 50 points for budget (full marks inside the range, near-full when under budget, a linearly scaled penalty when over), producing both a number and a human-readable explanation. Because the fallback is a pure function of the same inputs, the app remains fully functional — ranked matches and explanations included — even with no LLM key configured. This is easy to demonstrate: unset `GROQ_API_KEY` and every new score is stored with `method: 'rule'`.

## Chat implementation

Chat is scoped to an accepted interest; the `interests.id` doubles as the conversation id, and `messages` reference it. Rather than run a bespoke WebSocket server (awkward on serverless), the app uses **Supabase Realtime**, which is WebSocket-based and satisfies the "real-time via WebSocket + persistence" requirement with minimal infrastructure.

The `Chat` client component loads history through `GET /api/messages?interestId=` and then opens a Realtime channel subscribed to `postgres_changes` INSERTs on `messages`, filtered by `interest_id`. New rows stream in and are appended, de-duplicated by id (the sender also receives its own echo, and optimistically renders the POST response). Sending goes through `POST /api/messages`, which verifies the sender is a participant **and** that the interest is `accepted` before inserting.

Security relies on RLS. A `SECURITY DEFINER` helper, `is_interest_participant()`, checks whether `auth.uid()` is the interest's tenant or the listing's owner; the `messages` SELECT policy calls it, so Realtime only delivers a conversation's rows to its two participants. `messages` is set to `REPLICA IDENTITY FULL` and added to the `supabase_realtime` publication. Messages persist in Postgres, so a refresh reloads the full thread.

## Notification flow

Email is centralized in `lib/email.ts`, which selects a provider by availability — **Resend**, else **SMTP** (e.g. a local Mailpit), else a **log-only** no-op that prints the message to the server console. Crucially, `sendEmail()` catches all errors and never throws into the request path: notifications are best-effort and must not block the underlying action.

Two events trigger mail. First, when a tenant expresses interest, the handler ensures the compatibility score exists and, if it exceeds 80, emails the **owner** that a strong match is interested. Interest creation is idempotent (unique tenant–listing pair), so re-clicks neither duplicate the row nor re-notify. Second, when an owner accepts or declines, the handler emails the **tenant** of the decision. Both use small templated HTML builders.

## Data model & auth

Six tables model the domain: `profiles` (role), `tenant_profiles`, `listings`, `compatibility_scores`, `interests`, and `messages`, with foreign keys, check constraints, indexes on hot filter columns, and unique constraints that encode the cache and one-interest-per-pair rules. Roles live on `profiles.role`; a signup trigger (plus an idempotent API upsert) provisions the profile from user metadata. Filled listings are simply `status='filled'` and excluded from browse queries, hiding them from search while preserving history.
