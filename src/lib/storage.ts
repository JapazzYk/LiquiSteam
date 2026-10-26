import type { SteamUser } from '@/types';

// Cache local apenas para exibir o perfil enquanto a sessão é verificada.
// A chave da Steam não é mais guardada no navegador.
const USER_KEY = 'liquid_steam_user';

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
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // armazenamento indisponível: segue sem cache
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignora
  }
}
