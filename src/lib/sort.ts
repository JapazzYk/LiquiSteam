import type { InstalledGame } from '@/types';
import type { PlaytimeEntry } from '@/lib/steamMeta';

export type SortKey = 'name' | 'size' | 'playtime' | 'recent';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
  onlyUnplayed: boolean;
}

export const defaultSort: SortState = { key: 'name', dir: 'asc', onlyUnplayed: false };

// Sentido natural de cada critério ao escolhê-lo: nome do A ao Z; o resto, do maior para o menor.
export function defaultDir(key: SortKey): SortDir {
  return key === 'name' ? 'asc' : 'desc';
}

const SORT_KEY = 'liquid_sort';

export function loadSort(): SortState {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return defaultSort;
    const v = JSON.parse(raw) as Partial<SortState>;
    const key: SortKey = v.key === 'size' || v.key === 'playtime' || v.key === 'recent' ? v.key : 'name';
    return { key, dir: v.dir === 'asc' || v.dir === 'desc' ? v.dir : defaultDir(key), onlyUnplayed: v.onlyUnplayed === true };
  } catch {
    return defaultSort;
  }
}

export function saveSort(sort: SortState): void {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(sort));
  } catch {
    // ignora
  }
}

export function sortGames(
  games: InstalledGame[],
  sort: SortState,
  playtimes: Map<number, PlaytimeEntry> | null
): InstalledGame[] {
  const value = (game: InstalledGame): number => {
    if (sort.key === 'size') return game.size_on_disk ?? 0;
    if (sort.key === 'playtime') return playtimes?.get(game.appid)?.forever ?? 0;
    if (sort.key === 'recent') return playtimes?.get(game.appid)?.lastPlayed ?? 0;
    return 0;
  };
  const factor = sort.dir === 'asc' ? 1 : -1;
  const list = [...games];
  list.sort((a, b) => {
    if (sort.key === 'name') return factor * a.name.localeCompare(b.name);
    const diff = value(a) - value(b);
    return diff !== 0 ? factor * diff : a.name.localeCompare(b.name);
  });
  return list;
}
