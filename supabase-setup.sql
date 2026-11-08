-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- One row per signed-in player holding their H2H Chess profiles (rating, W/L/D, streaks, duels).
create table if not exists public.h2h_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.h2h_profiles enable row level security;

-- Each player can only read and write their own row.
drop policy if exists "own row read" on public.h2h_profiles;
drop policy if exists "own row insert" on public.h2h_profiles;
drop policy if exists "own row update" on public.h2h_profiles;
create policy "own row read"   on public.h2h_profiles for select using (auth.uid() = user_id);
create policy "own row insert" on public.h2h_profiles for insert with check (auth.uid() = user_id);
create policy "own row update" on public.h2h_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
