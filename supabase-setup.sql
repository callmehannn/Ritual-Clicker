create table if not exists public.ritual_clicker_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null unique,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.ritual_clicker_saves to authenticated;
grant select on public.ritual_clicker_saves to anon;

alter table public.ritual_clicker_saves
drop constraint if exists ritual_clicker_saves_pkey;

alter table public.ritual_clicker_saves
add constraint ritual_clicker_saves_pkey primary key (wallet_address);

create index if not exists ritual_clicker_saves_user_id_idx
on public.ritual_clicker_saves (user_id);

alter table public.ritual_clicker_saves enable row level security;

drop policy if exists "Players can read own ritual save" on public.ritual_clicker_saves;
drop policy if exists "Anyone can read ritual leaderboard" on public.ritual_clicker_saves;
create policy "Anyone can read ritual leaderboard"
on public.ritual_clicker_saves
for select
to anon, authenticated
using (true);

drop policy if exists "Players can create own ritual save" on public.ritual_clicker_saves;
create policy "Players can create own ritual save"
on public.ritual_clicker_saves
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Players can update own ritual save" on public.ritual_clicker_saves;
create policy "Players can update own ritual save"
on public.ritual_clicker_saves
for update
to authenticated
using (true)
with check (auth.uid() = user_id);

create table if not exists public.ritual_daily_quests (
  quest_date text primary key,
  quest jsonb not null default '{}'::jsonb,
  generated_by text,
  tx_hash text,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.ritual_daily_quests to authenticated;
grant select on public.ritual_daily_quests to anon;

alter table public.ritual_daily_quests enable row level security;

drop policy if exists "Anyone can read ritual daily quests" on public.ritual_daily_quests;
create policy "Anyone can read ritual daily quests"
on public.ritual_daily_quests
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can create ritual daily quests" on public.ritual_daily_quests;
create policy "Authenticated users can create ritual daily quests"
on public.ritual_daily_quests
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update ritual daily quests" on public.ritual_daily_quests;
create policy "Authenticated users can update ritual daily quests"
on public.ritual_daily_quests
for update
to authenticated
using (true)
with check (true);
