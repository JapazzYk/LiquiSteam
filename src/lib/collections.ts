import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Favoritos e grupos (pastas) de jogos. Ficam neste navegador e, com login, também na conta
// (coluna user_settings.collections; se ela não existir, tudo continua funcionando só localmente).
export interface Group {
  id: string;
  name: string;
  games: number[]; // appids (jogos de fora da Steam têm appid negativo)
}

export interface Collections {
  favorites: number[];
  groups: Group[];
}

export const emptyCollections: Collections = { favorites: [], groups: [] };

const STORAGE_KEY = 'liquid_collections_v1';
export const MAX_GROUPS = 30;
export const MAX_GROUP_NAME = 32;

function uniqueNumbers(list: unknown): number[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<number>();
  for (const value of list) if (typeof value === 'number' && Number.isFinite(value)) seen.add(value);
  return [...seen];
}

export function normalizeCollections(raw: unknown): Collections {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const groups: Group[] = [];
  const ids = new Set<string>();
  if (Array.isArray(value.groups)) {
    for (const item of value.groups) {
      const group = item as Record<string, unknown>;
      const id = typeof group?.id === 'string' ? group.id : '';
      const name = typeof group?.name === 'string' ? group.name.trim().slice(0, MAX_GROUP_NAME) : '';
      if (!id || !name || ids.has(id)) continue;
      ids.add(id);
      groups.push({ id, name, games: uniqueNumbers(group.games) });
    }
  }
  return { favorites: uniqueNumbers(value.favorites), groups: groups.slice(0, MAX_GROUPS) };
}

// Junta duas versões (ex.: a do navegador com a da conta ao entrar): nada se perde.
export function mergeCollections(a: Collections, b: Collections): Collections {
  const groups = new Map<string, Group>();
  for (const group of [...a.groups, ...b.groups]) {
    const existing = groups.get(group.id);
    groups.set(
      group.id,
      existing ? { ...existing, games: [...new Set([...existing.games, ...group.games])] } : { ...group }
    );
  }
  return {
    favorites: [...new Set([...a.favorites, ...b.favorites])],
    groups: [...groups.values()].slice(0, MAX_GROUPS),
  };
}

function loadLocal(): Collections {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeCollections(JSON.parse(raw)) : emptyCollections;
  } catch {
    return emptyCollections;
  }
}

function saveLocal(value: Collections): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // armazenamento indisponível: segue só na memória
  }
}

function newGroupId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface CollectionsApi {
  collections: Collections;
  isFavorite: (appid: number) => boolean;
  groupsOf: (appid: number) => Group[];
  toggleFavorite: (appid: number) => void;
  createGroup: (name: string, firstGame?: number) => string | null;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  toggleInGroup: (id: string, appid: number) => void;
  addToGroup: (id: string, appid: number) => void;
  addToFavorites: (appid: number) => void;
}

// signedInAs: SteamID quando há login (liga a sincronização com a conta); null = só neste navegador.
export function useCollections(signedInAs: string | null): CollectionsApi {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!signedInAs) {
      setUserId(null);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [signedInAs]);

  const [collections, setCollections] = useState<Collections>(() => loadLocal());
  const syncedFor = useRef<string | null>(null);
  const remoteTimer = useRef<number | null>(null);
  const remoteOk = useRef(true);

  const update = useCallback((change: (current: Collections) => Collections) => {
    setCollections((current) => {
      const next = change(current);
      if (next === current) return current;
      saveLocal(next);
      return next;
    });
  }, []);

  // Ao entrar: junta o que há na conta com o que há no navegador (uma vez por login).
  useEffect(() => {
    if (!userId) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('user_settings').select('collections').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      if (error) {
        remoteOk.current = false; // coluna ainda não criada: fica só no navegador
        return;
      }
      remoteOk.current = true;
      const remote = normalizeCollections(data?.collections);
      update((current) => mergeCollections(current, remote));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, update]);

  // Grava na conta com um pequeno atraso.
  useEffect(() => {
    if (!userId || syncedFor.current !== userId || !remoteOk.current) return;
    if (remoteTimer.current !== null) window.clearTimeout(remoteTimer.current);
    remoteTimer.current = window.setTimeout(() => {
      void supabase
        .from('user_settings')
        .upsert({ user_id: userId, collections, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) remoteOk.current = false;
        });
    }, 800);
    return () => {
      if (remoteTimer.current !== null) window.clearTimeout(remoteTimer.current);
    };
  }, [collections, userId]);

  const favoriteSet = useMemo(() => new Set(collections.favorites), [collections.favorites]);

  return useMemo<CollectionsApi>(
    () => ({
      collections,
      isFavorite: (appid) => favoriteSet.has(appid),
      groupsOf: (appid) => collections.groups.filter((group) => group.games.includes(appid)),
      toggleFavorite: (appid) =>
        update((c) => ({
          ...c,
          favorites: c.favorites.includes(appid) ? c.favorites.filter((id) => id !== appid) : [...c.favorites, appid],
        })),
      addToFavorites: (appid) =>
        update((c) => (c.favorites.includes(appid) ? c : { ...c, favorites: [...c.favorites, appid] })),
      createGroup: (name, firstGame) => {
        const clean = name.trim().slice(0, MAX_GROUP_NAME);
        if (!clean || collections.groups.length >= MAX_GROUPS) return null;
        const id = newGroupId();
        update((c) => ({ ...c, groups: [...c.groups, { id, name: clean, games: firstGame === undefined ? [] : [firstGame] }] }));
        return id;
      },
      renameGroup: (id, name) => {
        const clean = name.trim().slice(0, MAX_GROUP_NAME);
        if (!clean) return;
        update((c) => ({ ...c, groups: c.groups.map((g) => (g.id === id ? { ...g, name: clean } : g)) }));
      },
      deleteGroup: (id) => update((c) => ({ ...c, groups: c.groups.filter((g) => g.id !== id) })),
      toggleInGroup: (id, appid) =>
        update((c) => ({
          ...c,
          groups: c.groups.map((g) =>
            g.id !== id ? g : { ...g, games: g.games.includes(appid) ? g.games.filter((x) => x !== appid) : [...g.games, appid] }
          ),
        })),
      addToGroup: (id, appid) =>
        update((c) => ({
          ...c,
          groups: c.groups.map((g) => (g.id !== id || g.games.includes(appid) ? g : { ...g, games: [...g.games, appid] })),
        })),
    }),
    [collections, favoriteSet, update]
  );
}

// Os cartões, linhas e o detalhe leem favoritos e grupos por aqui, sem passar props por todas as telas.
export interface CollectionsUi {
  api: CollectionsApi;
  // Abre o menu "guardar em…" ao lado do botão que o chamou.
  openGroupMenu: (appid: number, anchor: HTMLElement) => void;
}

export const CollectionsContext = createContext<CollectionsUi | null>(null);

export function useCollectionsUi(): CollectionsUi | null {
  return useContext(CollectionsContext);
}

// Formato do que é arrastado de um cartão para um grupo.
export const DRAG_TYPE = 'application/x-liquisteam-game';
