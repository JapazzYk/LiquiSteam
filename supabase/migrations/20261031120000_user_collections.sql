-- Favoritos e grupos de jogos de cada usuário (um JSON por conta).
-- A coluna é opcional para o site: sem ela, favoritos e grupos ficam só neste navegador.
alter table public.user_settings
  add column if not exists collections jsonb not null default '{}'::jsonb;
