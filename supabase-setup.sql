create table if not exists public.ritual_clicker_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ritual_clicker_saves enable row level security;

drop policy if exists "Players can read own ritual save" on public.ritual_clicker_saves;
create policy "Players can read own ritual save"
on public.ritual_clicker_saves
for select
to authenticated
using (auth.uid() = user_id);

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
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
