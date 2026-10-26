import type { AchievementSummary, NewsItem } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function functionUrl(action: string, params: Record<string, string>): string {
  const u = new URL(`${SUPABASE_URL}/functions/v1/steam-game`);
  u.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  return u.toString();
}

async function callFunction<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Steam data request failed (${res.status})`);
  }
  const data = await res.json();
  if (data && typeof data === 'object' && 'error' in data && !('achievements' in data)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export async function fetchNews(appid: number): Promise<NewsItem[]> {
  try {
    const data = await callFunction<{ news: NewsItem[] }>(
      functionUrl('news', { appid: String(appid) })
    );
    return data.news ?? [];
  } catch {
    return [];
  }
}

export async function fetchAchievements(
  appid: number,
  steamId?: string,
  apiKey?: string
): Promise<AchievementSummary | null> {
  try {
    const data = await callFunction<AchievementSummary>(
      functionUrl('achievements', {
        appid: String(appid),
        steamid: steamId ?? '',
        key: apiKey ?? '',
      })
    );
    return data;
  } catch {
    return null;
  }
}

export interface Playtime {
  appid: number;
  playtime_forever: number; // minutes
  name?: string | null;
}

export async function fetchPlaytime(
  steamId: string,
  apiKey: string,
  appid?: number
): Promise<Playtime | null> {
  try {
    const data = await callFunction<Playtime>(
      functionUrl('playtime', {
        key: apiKey,
        steamid: steamId,
        appid: appid != null ? String(appid) : '',
      })
    );
    return data;
  } catch {
    return null;
  }
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export async function validateApiKey(
  apiKey: string,
  steamId: string
): Promise<ValidationResult> {
  try {
    const data = await callFunction<ValidationResult>(
      functionUrl('validate', { key: apiKey, steamid: steamId })
    );
    return data;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Validation failed',
    };
  }
}
