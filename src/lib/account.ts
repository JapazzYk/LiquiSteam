import type { SteamUser } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { callSteamGame } from '@/lib/steamMeta';
import { normalizeTheme, type ThemePreferences } from '@/lib/theme';

export interface AccountState {
  user: SteamUser;
  hasKey: boolean;
  theme: ThemePreferences | null;
}

// Carrega a conta do usuário logado. Retorna null se não houver sessão válida.
export async function loadAccount(): Promise<AccountState | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const uid = session.user.id;

  const [profile, settings, status] = await Promise.all([
    supabase
      .from('steam_profiles')
      .select('steam_id, persona_name, avatar_url')
      .eq('user_id', uid)
      .maybeSingle(),
    supabase.from('user_settings').select('theme').eq('user_id', uid).maybeSingle(),
    callSteamGame<{ hasKey: boolean }>('status').catch(() => ({ hasKey: false })),
  ]);

  if (!profile.data) return null;

  const savedTheme = settings.data?.theme as Record<string, unknown> | undefined;
  const hasSavedTheme = !!savedTheme && Object.keys(savedTheme).length > 0;

  return {
    user: {
      steamId: profile.data.steam_id as string,
      personaName: profile.data.persona_name as string,
      avatarUrl: (profile.data.avatar_url as string | null) ?? undefined,
    },
    hasKey: status.hasKey,
    theme: hasSavedTheme ? normalizeTheme(savedTheme) : null,
  };
}

// Grava o tema do usuário logado. Sem sessão, não faz nada.
export async function saveRemoteTheme(theme: ThemePreferences): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  await supabase.from('user_settings').upsert({
    user_id: uid,
    theme,
    updated_at: new Date().toISOString(),
  });
}

export async function signOutAccount(): Promise<void> {
  await supabase.auth.signOut();
}
