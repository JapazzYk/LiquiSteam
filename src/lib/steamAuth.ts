import type { SteamUser } from '@/types';
import { SUPABASE_URL, ANON_KEY, supabase } from '@/lib/supabaseClient';

// Login pela Steam (OpenID 2.0). O navegador só redireciona; quem confirma a
// resposta é a função steam-auth, no servidor.
const STEAM_OPENID_REALM = window.location.origin;
const STEAM_OPENID_URL =
  'https://steamcommunity.com/openid/login' +
  `?openid.ns=${encodeURIComponent('http://specs.openid.net/auth/2.0')}` +
  '&openid.mode=checkid_setup' +
  `&openid.return_to=${encodeURIComponent(STEAM_OPENID_REALM + '/?steam_auth=done')}` +
  `&openid.realm=${encodeURIComponent(STEAM_OPENID_REALM)}` +
  '&openid.ns.sreg=' + encodeURIComponent('http://openid.net/extensions/sreg/1.1') +
  '&openid.claimed_id=' + encodeURIComponent('http://specs.openid.net/auth/2.0/identifier_select') +
  '&openid.identity=' + encodeURIComponent('http://specs.openid.net/auth/2.0/identifier_select');

export function steamLoginUrl(): string {
  return STEAM_OPENID_URL;
}

// Lê os parâmetros openid.* do retorno da Steam. Retorna null se não houver retorno.
export function readOpenIdParams(url: string = window.location.href): Record<string, string> | null {
  try {
    const u = new URL(url);
    if (u.searchParams.get('steam_auth') !== 'done') return null;
    const params: Record<string, string> = {};
    u.searchParams.forEach((value, key) => {
      if (key.startsWith('openid.')) params[key] = value;
    });
    return params['openid.claimed_id'] ? params : null;
  } catch {
    return null;
  }
}

// Remove da barra de endereço os parâmetros já consumidos.
export function cleanAuthFromUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (key === 'steam_auth' || key.startsWith('openid.')) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, document.title, url.pathname + url.hash);
  }
}

// Envia a resposta da Steam ao servidor, que confirma e devolve um token de sessão.
export async function completeSteamLogin(params: Record<string, string>): Promise<SteamUser> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/steam-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ params }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token_hash) {
    throw new Error(data?.error ?? 'Não foi possível concluir o login com a Steam.');
  }

  const { error } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.token_hash,
  });
  if (error) throw new Error('Não foi possível iniciar a sessão.');

  return {
    steamId: data.steam_id,
    personaName: data.persona_name,
    avatarUrl: data.avatar_url ?? undefined,
  };
}
