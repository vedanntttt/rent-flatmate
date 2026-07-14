# RentBuddy — Rent & Flatmate Finder

**Live demo:** [rent-flatmate-gray.vercel.app](https://rent-flatmate-gray.vercel.app/)

An AI-powered platform where **owners list rooms** and **tenants create "looking for a room" profiles**. A compatibility engine (LLM with a rule-based fallback) scores and ranks matches, tenants express interest, owners accept/decline, and accepted pairs **chat in real time**. Key events trigger **email notifications**.

Built with **Next.js 16 (App Router) + Supabase + Groq**.

---

## Features (mapped to the brief)

| Requirement | Where |
| --- | --- |
| Role-based auth (tenant / owner / admin) | Supabase Auth + `profiles.role`, guarded in `lib/auth.ts` |
| Owner posts rooms (location, rent, available-from, room type, furnishing, photos) | `/owner/listings`, `POST /api/listings` |
| Tenant profile (preferred location, budget range, move-in date) | `/tenant/profile`, `POST /api/tenant-profile` |
| Browse + filter by location & budget, ranked by compatibility | `/browse`, `GET /api/listings` |
| AI compatibility score (0–100 + explanation), **stored, not recomputed** | `lib/compatibility.ts`, `compatibility_scores` table |
| LLM failure → **rule-based fallback** | `lib/compatibility.ts` (`ruleBasedScore`) |
| Express interest; owner accepts/declines | `POST /api/interests`, `PATCH /api/interests/[id]` |
| Real-time chat once accepted, messages persisted | `components/Chat.tsx` + Supabase Realtime, `messages` table |
| Email when a high-score (>80) tenant expresses interest | `POST /api/interests` → `lib/email.ts` |
| Email when owner accepts/declines | `PATCH /api/interests/[id]` → `lib/email.ts` |
| Mark listing filled → hidden from search | `PATCH /api/listings/[id]`, browse filters `status='active'` |
| Admin manages users/listings + activity | `/admin`, `GET/PATCH /api/admin` |

---

## Tech stack

- **Next.js 16** (App Router, Route Handlers = REST API, React 19)
- **Supabase** — Postgres, Auth, Row Level Security, Realtime (WebSocket), Storage-ready
- **Groq** (`openai/gpt-oss-120b`) via the OpenAI-compatible API for scoring
- **Tailwind CSS v4** — black & white minimalist UI, no external component library
- **Zod** for validation, **Resend/Nodemailer** for email

---

## Architecture

```
Browser (React) ──HTTP──> Next.js Route Handlers (/app/api/*) ──> Supabase Postgres
       │                        │  authorize (lib/auth) + service-role writes
       │                        └─> Groq LLM (compatibility) / Email (Resend|SMTP)
       └──WebSocket──> Supabase Realtime (new `messages` rows, RLS-filtered)
```

- Session cookies are refreshed by `proxy.ts` (Next 16's renamed middleware, Node.js runtime).
- Route Handlers authenticate the user (session-bound client) and **authorize in code**, then use the **service-role** client for writes. RLS is defense-in-depth and is what makes the browser's Realtime subscription safe (only the two chat participants receive a conversation's messages).

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

At [supabase.com](https://supabase.com) → New project. Then open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates all tables, indexes, RLS policies, the signup trigger, and enables Realtime on `messages`.

> Auth note: the app creates users with the admin API and `email_confirm: true`, so **no email confirmation is needed**. (If you sign up through Supabase directly, disable "Confirm email" under Authentication → Providers → Email.)

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in (from **Project Settings → API**):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server-only**, never exposed to the browser |
| `GROQ_API_KEY` | optional | Without it, scoring uses the rule-based fallback |
| `GROQ_MODEL` | optional | Defaults to `openai/gpt-oss-120b` |
| `RESEND_API_KEY` | optional | Email via Resend |
| `SMTP_HOST` … | optional | Local SMTP (e.g. Mailpit) if no Resend key |

If no email provider is configured, notifications are **logged to the server console** (`📧 [email:log-only] …`) so the flow is still observable.

### 4. Run

```bash
npm run dev      # http://localhost:3000
```

### 5. Create an admin (optional)

Sign up as any user, then in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Log out/in and visit `/admin`.

---

## API reference

All endpoints are JSON. Auth is via the Supabase session cookie; each handler enforces role/ownership.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | public | Create confirmed user + profile with a role |
| `GET/POST` | `/api/tenant-profile` | tenant | Read / upsert preferences (upsert clears cached scores) |
| `GET` | `/api/listings` | any | Browse active listings (`?location=&minBudget=&maxBudget=`); tenants get scores + ranking. `?mine=1` → owner's own listings |
| `POST` | `/api/listings` | owner | Create a listing |
| `PATCH` | `/api/listings/[id]` | owner | Edit / mark `filled` or `active` |
| `GET` | `/api/interests` | tenant/owner | Role-scoped interests (with listing, counterpart, score) |
| `POST` | `/api/interests` | tenant | Express interest (ensures score; emails owner if score > 80) |
| `PATCH` | `/api/interests/[id]` | owner | Accept / decline (emails tenant) |
| `GET/POST` | `/api/messages` | participants | Chat history (`?interestId=`) / send (only if accepted) |
| `GET/PATCH` | `/api/admin` | admin | Stats + users + listings / delete user or listing |

---

## Database schema

Six tables (full DDL in [`supabase/schema.sql`](supabase/schema.sql)):

- **profiles** `(id→auth.users, role, full_name, email)`
- **tenant_profiles** `(user_id→profiles unique, preferred_location, budget_min, budget_max, move_in_date)`
- **listings** `(owner_id, title, location, rent, available_from, room_type, furnishing_status, photos[], status)`
- **compatibility_scores** `(tenant_id, listing_id, score, explanation, method) UNIQUE(tenant_id, listing_id)` — the cache
- **interests** `(tenant_id, listing_id, status) UNIQUE(tenant_id, listing_id)`
- **messages** `(interest_id→interests, sender_id, content, created_at)` — Realtime-enabled

---

## LLM compatibility scoring

The prompt (in `lib/compatibility.ts`):

**System:** _"You are a rental compatibility scoring engine… compute a score from 0 to 100 based primarily on how well BUDGET and LOCATION match… Respond with STRICT JSON only: {"score", "explanation"}."_

**User:** `Given this room listing: {…} and this tenant profile: {…} compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { "score": number, "explanation": string }`

### Example I/O

**Input**
```json
{
  "room_listing":  { "location": "Koramangala, Bangalore", "rent": 12000, "room_type": "private", "furnishing_status": "furnished" },
  "tenant_profile":{ "preferred_location": "Koramangala", "budget_min": 10000, "budget_max": 15000, "move_in_date": "2026-08-01" }
}
```

**Output**
```json
{
  "score": 92,
  "explanation": "The room is in Koramangala — exactly the tenant's preferred area — and the ₹12,000 rent sits comfortably within their ₹10,000–15,000 budget."
}
```

### Fallback (LLM unavailable / no key / bad JSON / timeout)

`ruleBasedScore()` returns a deterministic score: **50 pts location** (exact / overlap / token match) + **50 pts budget** (within range / under / scaled penalty when over), with a generated explanation. The result is stored with `method: 'rule'` so you can see which path produced each score. **Scores are cached per (tenant, listing)** and never recomputed unless the tenant changes their preferences.

---

## Real-time chat

Chat unlocks once an interest is `accepted`. `components/Chat.tsx` loads history via `GET /api/messages`, then subscribes to Supabase Realtime `postgres_changes` (INSERT on `messages`, filtered by `interest_id`). RLS ensures only the interest's tenant and the listing owner receive the rows. Messages are persisted in Postgres; a page refresh re-loads full history.

---

## Notifications

`lib/email.ts` picks a provider in order: **Resend → SMTP → log-only**, and never throws into the request flow. Two events fire emails:
1. A tenant with **score > 80** expresses interest → email to the **owner**.
2. Owner **accepts/declines** → email to the **tenant**.

---

## Project structure

```
app/
  api/            REST route handlers
  browse/ interests/ tenant/ owner/ admin/ login/ signup/   pages
components/       UI kit + feature components (Chat, *Listings, *Interests, Admin)
lib/
  supabase/       server / client / admin clients
  compatibility.ts  LLM + rule-based scoring (+ cache)
  email.ts  auth.ts  validation.ts  types.ts  utils.ts
proxy.ts          Supabase session refresh (Next 16 middleware)
supabase/schema.sql
docs/SYSTEM_DESIGN.md
```

## Notes

- **Photo upload is stubbed**: listings accept image **URLs** (comma-separated) rather than file uploads to Supabase Storage. The `photos text[]` column and UI are ready to swap in a real uploader.
- Deployment is out of scope for this build; the app is Vercel-ready (set the same env vars).
