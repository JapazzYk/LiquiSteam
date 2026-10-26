import type { SteamUser } from '@/types';

const USER_KEY = 'liquid_steam_user';
const API_KEY = 'liquid_steam_api_key';

export function loadUser(): SteamUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SteamUser;
    if (!parsed.steamId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveUser(user: SteamUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function loadApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY);
  } catch {
    return null;
  }
}

export function saveApiKey(key: string): void {
  localStorage.setItem(API_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY);
}
