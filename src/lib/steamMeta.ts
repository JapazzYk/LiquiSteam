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
