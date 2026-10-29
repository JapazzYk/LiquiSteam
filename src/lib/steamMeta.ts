import type { AchievementSummary, NewsItem } from '@/types';
import { SUPABASE_URL, ANON_KEY, accessToken } from '@/lib/supabaseClient';

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  params?: Record<string, string>;
}

// Todas as chamadas passam pela função steam-game. A chave da Steam nunca sai do servidor.
export async function callSteamGame<T>(
  action: string,
  { method = 'GET', body, params = {} }: CallOptions = {}
): Promise<T> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/steam-game`);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Steam data request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchNews(appid: number): Promise<NewsItem[]> {
  try {
    const data = await callSteamGame<{ news: NewsItem[] }>('news', {
      params: { appid: String(appid) },
    });
    return data.news ?? [];
  } catch {
    return [];
  }
}

export async function fetchAchievements(appid: number): Promise<AchievementSummary | null> {
  try {
    return await callSteamGame<AchievementSummary>('achievements', {
      params: { appid: String(appid) },
    });
  } catch {
    return null;
  }
}

export interface Playtime {
  appid: number;
  playtime_forever: number; // minutos
  name?: string | null;
}

export async function fetchPlaytime(appid?: number): Promise<Playtime | null> {
  try {
    return await callSteamGame<Playtime>('playtime', {
      params: { appid: appid != null ? String(appid) : '' },
    });
  } catch {
    return null;
  }
}

// Estado da conta na Steam (online/offline). null se não der para saber
// (sem login, sem chave de API ou erro de rede).
export async function fetchPresence(): Promise<'running' | 'not-running' | null> {
  try {
    const data = await callSteamGame<{ online: boolean }>('presence');
    return data.online ? 'running' : 'not-running';
  } catch {
    return null;
  }
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// Valida no servidor e, se estiver certa, guarda a chave associada à conta.
export async function saveSteamKey(apiKey: string): Promise<ValidationResult> {
  try {
    return await callSteamGame<ValidationResult>('save-key', {
      method: 'POST',
      body: { key: apiKey },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao salvar a chave.' };
  }
}

export async function removeSteamKey(): Promise<void> {
  await callSteamGame('delete-key', { method: 'POST' }).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------
// Tempo de jogo de toda a biblioteca (um pedido só)
// ---------------------------------------------------------------------------------------------
export interface PlaytimeEntry {
  forever: number; // minutos
  twoWeeks: number; // minutos nas últimas duas semanas
  lastPlayed: number; // segundos desde 1970; 0 = nunca
}

// null = sem login, sem chave de API ou perfil privado.
export async function fetchAllPlaytime(): Promise<Map<number, PlaytimeEntry> | null> {
  try {
    const data = await callSteamGame<{
      games?: { appid: number; playtime_forever?: number; playtime_2weeks?: number; rtime_last_played?: number }[];
    }>('playtime');
    if (!Array.isArray(data.games)) return null;
    const map = new Map<number, PlaytimeEntry>();
    for (const g of data.games) {
      map.set(g.appid, {
        forever: g.playtime_forever ?? 0,
        twoWeeks: g.playtime_2weeks ?? 0,
        lastPlayed: g.rtime_last_played ?? 0,
      });
    }
    return map;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Detalhes da loja: descrição, gêneros, nota, preço e trailers
// ---------------------------------------------------------------------------------------------
export interface GameMovie {
  id: number;
  name: string;
  thumbnail: string;
  mp4_480: string;
  mp4_max: string;
  webm_480: string;
  webm_max: string;
}

export interface GameDetails {
  found: boolean;
  name: string;
  shortDescription: string;
  releaseDate: string;
  comingSoon: boolean;
  developers: string[];
  publishers: string[];
  genres: string[];
  categories: string[];
  metacritic: number | null;
  recommendations: number | null;
  achievements: number | null;
  dlcCount: number;
  languages: string;
  controllerSupport: string | null;
  price: { free: boolean; final: string; discount: number } | null;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  movies: GameMovie[];
}

const DETAILS_PREFIX = 'liquid_gd_';
const DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const detailsMemory = new Map<number, Promise<GameDetails | null>>();

function readCachedDetails(appid: number): GameDetails | null {
  try {
    const raw = localStorage.getItem(DETAILS_PREFIX + appid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: GameDetails };
    if (!parsed || Date.now() - parsed.at > DETAILS_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedDetails(appid: number, data: GameDetails): void {
  try {
    localStorage.setItem(DETAILS_PREFIX + appid, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // armazenamento cheio: segue sem guardar
  }
}

// Cada jogo é pedido uma vez por sessão e lembrado por 24 horas no navegador.
export function fetchGameDetails(appid: number): Promise<GameDetails | null> {
  if (appid <= 0) return Promise.resolve(null);
  const existing = detailsMemory.get(appid);
  if (existing) return existing;
  const cached = readCachedDetails(appid);
  if (cached) {
    const resolved = Promise.resolve(cached);
    detailsMemory.set(appid, resolved);
    return resolved;
  }
  const request = callSteamGame<GameDetails>('details', { params: { appid: String(appid) } })
    .then((data) => {
      if (data && data.found) {
        writeCachedDetails(appid, data);
        return data;
      }
      return null;
    })
    .catch(() => {
      detailsMemory.delete(appid); // tenta de novo na próxima vez
      return null;
    });
  detailsMemory.set(appid, request);
  return request;
}

// Melhor vídeo para uma prévia pequena: mp4 de 480 p (mais leve); se faltar, o maior disponível.
export function previewVideoUrl(movie: GameMovie | undefined): string {
  if (!movie) return '';
  return movie.mp4_480 || movie.webm_480 || movie.mp4_max || movie.webm_max || '';
}

export function fullVideoUrl(movie: GameMovie | undefined): string {
  if (!movie) return '';
  return movie.mp4_max || movie.mp4_480 || movie.webm_max || movie.webm_480 || '';
}
