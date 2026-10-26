-- Contas por usuário: login Steam verificado no servidor, notas, tema e chave
-- da Steam Web API visíveis apenas para o próprio dono.

-- 1. Ligação SteamID <-> usuário do Supabase Auth.
--    Escrita apenas pela função steam-auth (service role).
create table if not exists public.steam_profiles (
  steam_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  persona_name text not null default 'Steam Player',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.steam_profiles enable row level security;
revoke all on public.steam_profiles from anon, authenticated;
grant select on public.steam_profiles to authenticated;

drop policy if exists "own profile select" on public.steam_profiles;
create policy "own profile select"
on public.steam_profiles for select
to authenticated
using (user_id = auth.uid());

-- 2. Notas passam a pertencer a um usuário. Notas antigas (user_id nulo) são
--    vinculadas automaticamente quando o dono fizer login pela Steam.
alter table public.game_notes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists game_notes_user_idx on public.game_notes (user_id);

drop policy if exists "anon_select_game_notes" on public.game_notes;
drop policy if exists "anon_insert_game_notes" on public.game_notes;
drop policy if exists "anon_update_game_notes" on public.game_notes;
drop policy if exists "anon_delete_game_notes" on public.game_notes;

revoke all on public.game_notes from anon, authenticated;
grant select, insert, update, delete on public.game_notes to authenticated;

drop policy if exists "owner select game_notes" on public.game_notes;
create policy "owner select game_notes"
on public.game_notes for select to authenticated
using (user_id = auth.uid());

drop policy if exists "owner insert game_notes" on public.game_notes;
create policy "owner insert game_notes"
on public.game_notes for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "owner update game_notes" on public.game_notes;
create policy "owner update game_notes"
on public.game_notes for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "owner delete game_notes" on public.game_notes;
create policy "owner delete game_notes"
on public.game_notes for delete to authenticated
using (user_id = auth.uid());

-- 3. Tema salvo por usuário.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "own settings select" on public.user_settings;
create policy "own settings select"
on public.user_settings for select to authenticated
using (user_id = auth.uid());

drop policy if exists "own settings insert" on public.user_settings;
create policy "own settings insert"
on public.user_settings for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "own settings update" on public.user_settings;
create policy "own settings update"
on public.user_settings for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 4. Chave da Steam Web API. Nenhuma política e nenhum grant para o navegador:
--    só a função steam-game (service role) consegue ler ou gravar.
create table if not exists public.steam_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.steam_credentials enable row level security;
revoke all on public.steam_credentials from anon, authenticated;
