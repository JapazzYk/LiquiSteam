import type { SteamUser } from '@/types';

// Steam OpenID (openid spec 2.0) does NOT issue OAuth tokens. It returns a
// signed assertion we exchange for the user's SteamID. We keep this around to
// identify the logged-in user, but we never need (and cannot use) a Steam Web
// API key from here.
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

// Parse the SteamID from the query string after Steam redirects back.
// Steam returns openid.claimed_id = https://steamcommunity.com/openid/id/<steamid>
export function parseSteamIdFromCallback(url: string = window.location.href): string | null {
  try {
    const u = new URL(url);
    const claimed = u.searchParams.get('openid.claimed_id');
    if (!claimed) return null;
    const match = claimed.match(/openid\/id\/(\d+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// The redirect leaves ?steam_auth=done&openid.* params in the URL. Strip them
// after we've consumed them so reloads don't re-trigger the auth handler.
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

// Best-effort: fetch the public persona name + avatar for a SteamID.
// This uses the public profile XML endpoint (no key needed).
export async function fetchSteamUser(steamId: string): Promise<SteamUser> {
  const profileUrl = `https://steamcommunity.com/profiles/${steamId}/?xml=1`;
  try {
    const proxied = `https://corsproxy.io/?url=${encodeURIComponent(profileUrl)}`;
    const res = await fetch(proxied);
    if (!res.ok) throw new Error('profile fetch failed');
    const xml = await res.text();
    const steamIDMatch = xml.match(/<steamID64>(\d+)<\/steamID64>/);
    const nameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
    const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
    return {
      steamId: steamIDMatch ? steamIDMatch[1] : steamId,
      personaName: nameMatch ? nameMatch[1] : 'Steam Player',
      avatarUrl: avatarMatch ? avatarMatch[1] : undefined,
    };
  } catch {
    return {
      steamId,
      personaName: 'Steam Player',
      avatarUrl: undefined,
    };
  }
}
