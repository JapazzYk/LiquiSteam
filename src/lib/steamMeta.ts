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
  // Streaming (HLS) do trailer completo e mp4 curto e mudo para prévias. Ausentes na função antiga.
  hls?: string;
  dash?: string;
  micro?: string;
  mp4_480: string;
  mp4_max: string;
  webm_480: string;
  webm_max: string;
}

export interface GameScreenshot {
  id: number;
  thumb: string;
  full: string;
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
  // Imagens da loja. Ausente se a função steam-game no Supabase ainda for a versão antiga.
  screenshots?: GameScreenshot[];
}

// O navegador bloqueia vídeo e imagem http:// numa página https://, então tudo vai por https.
function toHttps(url: string): string {
  return typeof url === 'string' ? url.replace(/^http:\/\//i, 'https://') : '';
}

function normalizeDetails(data: GameDetails): GameDetails {
  return {
    ...data,
    movies: (data.movies ?? []).map((m) => ({
      ...m,
      thumbnail: toHttps(m.thumbnail),
      hls: toHttps(m.hls ?? ''),
      dash: toHttps(m.dash ?? ''),
      micro: toHttps(m.micro ?? ''),
      mp4_480: toHttps(m.mp4_480),
      mp4_max: toHttps(m.mp4_max),
      webm_480: toHttps(m.webm_480),
      webm_max: toHttps(m.webm_max),
    })),
    screenshots: (data.screenshots ?? []).map((sc) => ({ ...sc, thumb: toHttps(sc.thumb), full: toHttps(sc.full) })),
  };
}

// Versão dos dados guardados: ao mudar o formato (trailers por streaming, imagens...), o que foi guardado
// antes é descartado em vez de aparecer incompleto por 24 horas.
const DETAILS_VERSION = 3;
const DETAILS_PREFIX = 'liquid_gd3_';
const DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const detailsMemory = new Map<number, Promise<GameDetails | null>>();
const detailsErrors = new Map<number, string>();

// Por que a última tentativa de ler os detalhes de um jogo falhou (null = não falhou).
export function detailsError(appid: number): string | null {
  return detailsErrors.get(appid) ?? null;
}

function readCachedDetails(appid: number): GameDetails | null {
  try {
    const raw = localStorage.getItem(DETAILS_PREFIX + appid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; at: number; data: GameDetails };
    if (!parsed || parsed.v !== DETAILS_VERSION || Date.now() - parsed.at > DETAILS_TTL_MS) return null;
    return normalizeDetails(parsed.data);
  } catch {
    return null;
  }
}

function writeCachedDetails(appid: number, data: GameDetails): void {
  try {
    localStorage.setItem(DETAILS_PREFIX + appid, JSON.stringify({ v: DETAILS_VERSION, at: Date.now(), data }));
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
  const request = callSteamGame<GameDetails & { reason?: string }>('details', { params: { appid: String(appid) } })
    .then((data) => {
      if (data && data.found) {
        detailsErrors.delete(appid);
        const normalized = normalizeDetails(data);
        writeCachedDetails(appid, normalized);
        return normalized;
      }
      const reason = data?.reason ?? 'not-in-store';
      detailsErrors.set(appid, reason);
      if (reason.startsWith('store-')) detailsMemory.delete(appid); // falha passageira: tenta de novo depois
      return null;
    })
    .catch((error: unknown) => {
      detailsErrors.set(appid, error instanceof Error ? error.message : 'erro');
      detailsMemory.delete(appid); // tenta de novo na próxima vez
      return null;
    });
  detailsMemory.set(appid, request);
  return request;
}

// Melhor vídeo para uma prévia pequena: o microtrailer (mp4 curto e mudo); nos jogos antigos, o mp4 de 480 p.
export function previewVideoUrl(movie: GameMovie | undefined): string {
  if (!movie) return '';
  return movie.micro || movie.mp4_480 || movie.webm_480 || movie.mp4_max || movie.webm_max || '';
}

// Endereço de streaming (HLS) do trailer completo.
export function hlsVideoUrl(movie: GameMovie | undefined): string {
  return movie?.hls ?? '';
}

// Arquivo mp4/webm direto (só existe nos jogos antigos).
export function fullVideoUrl(movie: GameMovie | undefined): string {
  if (!movie) return '';
  return movie.mp4_max || movie.mp4_480 || movie.webm_max || movie.webm_480 || '';
}
