-- ============================================================================
-- Rent & Flatmate Finder — database schema
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- (Project: Settings > API for keys; SQL Editor > New query > paste > Run.)
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles: one row per auth user, carries the role (tenant | owner | admin)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'tenant' check (role in ('tenant', 'owner', 'admin')),
  full_name  text,
  age        integer check (age between 16 and 120),
  email      text,
  created_at timestamptz not null default now()
);

-- Migration for databases created before the age field existed.
alter table public.profiles
  add column if not exists age integer check (age between 16 and 120);

-- ----------------------------------------------------------------------------
-- tenant_profiles: a tenant's "looking for a room" preferences
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.profiles (id) on delete cascade,
  preferred_location text not null,
  budget_min         integer not null check (budget_min >= 0),
  budget_max         integer not null check (budget_max >= budget_min),
  move_in_date       date,
  created_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- listings: a room posted by an owner
-- ----------------------------------------------------------------------------
create table if not exists public.listings (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  title             text not null,
  description       text,
  location          text not null,
  rent              integer not null check (rent >= 0),
  available_from    date,
  room_type         text not null default 'private',   -- private | shared | studio ...
  furnishing_status text not null default 'unfurnished',-- furnished | semi | unfurnished
  photos            text[] not null default '{}',       -- image URLs (upload stubbed)
  status            text not null default 'active' check (status in ('active', 'filled')),
  created_at        timestamptz not null default now()
);

create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_location_idx on public.listings (lower(location));
create index if not exists listings_owner_idx    on public.listings (owner_id);

-- ----------------------------------------------------------------------------
-- compatibility_scores: cached AI/rule score per (tenant, listing) pair.
-- UNIQUE ensures we compute once and never recompute on every request.
-- ----------------------------------------------------------------------------
create table if not exists public.compatibility_scores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  score       integer not null check (score between 0 and 100),
  explanation text not null,
  method      text not null check (method in ('llm', 'rule')),
  created_at  timestamptz not null default now(),
  unique (tenant_id, listing_id)
);

-- ----------------------------------------------------------------------------
-- interests: a tenant expressing interest; owner accepts/declines
-- ----------------------------------------------------------------------------
create table if not exists public.interests (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (tenant_id, listing_id)
);

create index if not exists interests_listing_idx on public.interests (listing_id);
create index if not exists interests_tenant_idx  on public.interests (tenant_id);

-- ----------------------------------------------------------------------------
-- messages: chat, unlocked once an interest is accepted (interest = conversation)
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  interest_id uuid not null references public.interests (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  content     text not null check (char_length(content) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists messages_interest_idx on public.messages (interest_id, created_at);

-- ============================================================================
-- Auto-create a profile whenever a new auth user is created.
-- Role + name come from user_metadata set at signup. Idempotent.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'tenant'),
    new.raw_user_meta_data ->> 'full_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper: is the current user a participant in a chat (interest)?
-- security definer so the RLS policy can traverse interests + listings.
-- ============================================================================
create or replace function public.is_interest_participant(_interest_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.interests i
    join public.listings l on l.id = i.listing_id
    where i.id = _interest_id
      and (i.tenant_id = auth.uid() or l.owner_id = auth.uid())
  );
$$;

-- ============================================================================
-- Row Level Security
-- Most writes flow through the API using the service-role key (authorized in
-- code). RLS is defense-in-depth, and is REQUIRED for the browser Realtime
-- subscription on messages to only stream a chat's two participants.
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.tenant_profiles     enable row level security;
alter table public.listings            enable row level security;
alter table public.compatibility_scores enable row level security;
alter table public.interests           enable row level security;
alter table public.messages            enable row level security;

-- profiles: any authenticated user can read profiles (names shown in chat/admin)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- tenant_profiles: readable by authenticated; writable only by the owner
drop policy if exists tenant_profiles_select on public.tenant_profiles;
create policy tenant_profiles_select on public.tenant_profiles
  for select to authenticated using (true);

drop policy if exists tenant_profiles_write on public.tenant_profiles;
create policy tenant_profiles_write on public.tenant_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- listings: active listings public to authenticated; owners see their own
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings
  for select to authenticated
  using (status = 'active' or owner_id = auth.uid());

drop policy if exists listings_write on public.listings;
create policy listings_write on public.listings
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- compatibility_scores: visible to the tenant and to the listing's owner
drop policy if exists scores_select on public.compatibility_scores;
create policy scores_select on public.compatibility_scores
  for select to authenticated
  using (
    tenant_id = auth.uid()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = auth.uid()
    )
  );

-- interests: visible to the tenant and to the listing's owner
drop policy if exists interests_select on public.interests;
create policy interests_select on public.interests
  for select to authenticated
  using (
    tenant_id = auth.uid()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = auth.uid()
    )
  );

-- messages: only the two chat participants may read/insert
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_interest_participant(interest_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid() and public.is_interest_participant(interest_id)
  );

-- ============================================================================
-- Realtime: stream new chat messages to subscribed clients (RLS still applies)
-- ============================================================================
alter table public.messages replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;  -- already added
end $$;
