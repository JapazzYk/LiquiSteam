/*
# Create game_notes table (single-tenant, no Supabase auth)

This launcher identifies users by their SteamID (obtained via Steam OpenID),
not by Supabase auth. There is no sign-in screen for Supabase, so the anon-key
client must be able to read and write its own data. This is a single-tenant
design: notes are keyed by (steam_id, app_id) and intentionally shared/public
within the app.

1. New Tables
- `game_notes`
  - `id` (uuid, primary key)
  - `steam_id` (text, not null) — the SteamID64 of the logged-in Steam user
  - `app_id` (bigint, not null) — the Steam app id the note is attached to
  - `game_name` (text, not null) — denormalized for display in lists
  - `content` (text, not null default '') — the note/reminder text
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (steam_id, app_id) — one note per game per user

2. Security
- Enable RLS on `game_notes`.
- Grant CRUD to `anon` + `authenticated` so the anon-key frontend can reach it.
- Allow anon + authenticated full CRUD because the data is intentionally
  shared/public within this single-tenant launcher app.

3. Important notes
- No `user_id` / `auth.users` FK: identity comes from Steam OpenID, not Supabase auth.
- `USING (true)` is acceptable here because there is no Supabase auth and the
  app is single-tenant: the anon-key client is the only writer.
*/

CREATE TABLE IF NOT EXISTS game_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  steam_id text NOT NULL,
  app_id bigint NOT NULL,
  game_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_notes_steam_app_unique UNIQUE (steam_id, app_id)
);

ALTER TABLE game_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON game_notes TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_game_notes" ON game_notes;
CREATE POLICY "anon_select_game_notes"
ON game_notes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_game_notes" ON game_notes;
CREATE POLICY "anon_insert_game_notes"
ON game_notes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_game_notes" ON game_notes;
CREATE POLICY "anon_update_game_notes"
ON game_notes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_game_notes" ON game_notes;
CREATE POLICY "anon_delete_game_notes"
ON game_notes FOR DELETE
TO anon, authenticated USING (true);

-- index for looking up a note by user + game
CREATE INDEX IF NOT EXISTS game_notes_steam_app_idx
ON game_notes (steam_id, app_id);
