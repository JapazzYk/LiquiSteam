import type { InstalledGame } from '@/types';

// As pastas "steamapps" escolhidas ficam guardadas neste navegador (IndexedDB). O usuário
// pode ter várias: uma por biblioteca da Steam (cada HD ou pasta de jogos).
const IDB_DB = 'liquid_steam';
const IDB_STORE = 'handles';
const IDB_KEY_LIST = 'steamapps_handles';
const IDB_KEY_LEGACY = 'steamapps_handle'; // versão antiga: uma pasta só

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const get = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    get.onsuccess = () => resolve((get.result as T) ?? null);
    get.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function readHandles(): Promise<FileSystemDirectoryHandle[]> {
  const list = await idbGet<FileSystemDirectoryHandle[]>(IDB_KEY_LIST);
  if (Array.isArray(list)) return list;
  // Migra a pasta única da versão anterior.
  const legacy = await idbGet<FileSystemDirectoryHandle>(IDB_KEY_LEGACY);
  if (legacy) {
    await idbPut(IDB_KEY_LIST, [legacy]);
    await idbDelete(IDB_KEY_LEGACY);
    return [legacy];
  }
  return [];
}

export async function clearStoredSteamappsDirs(): Promise<void> {
  await idbDelete(IDB_KEY_LIST);
  await idbDelete(IDB_KEY_LEGACY);
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read',
  request = false
): Promise<boolean> {
  const descriptor = { mode };
  try {
    // @ts-expect-error - queryPermission/requestPermission are not in stable TS lib types
    if ((await handle.queryPermission?.(descriptor)) === 'granted') return true;
    if (!request) return false;
    // @ts-expect-error - requestPermission must run from a user gesture
    return (await handle.requestPermission?.(descriptor)) === 'granted';
  } catch {
    return false;
  }
}

export interface StoredDir {
  index: number;
  handle: FileSystemDirectoryHandle;
  name: string;
  granted: boolean; // o navegador ainda permite ler (depois de reiniciar, pode pedir de novo)
}

export async function listStoredSteamappsDirs(): Promise<StoredDir[]> {
  const handles = await readHandles();
  return Promise.all(
    handles.map(async (handle, index) => ({
      index,
      handle,
      name: handle.name,
      granted: await verifyPermission(handle, 'read'),
    }))
  );
}

// Pede de novo a permissão de uma pasta já guardada (precisa de um clique do usuário).
export async function regrantSteamappsDir(index: number): Promise<boolean> {
  const handles = await readHandles();
  const handle = handles[index];
  if (!handle) return false;
  return verifyPermission(handle, 'read', true);
}

export async function removeSteamappsDir(index: number): Promise<void> {
  const handles = await readHandles();
  handles.splice(index, 1);
  if (handles.length === 0) await idbDelete(IDB_KEY_LIST);
  else await idbPut(IDB_KEY_LIST, handles);
}

// Aceita a pasta "steamapps" ou a pasta da biblioteca que a contém (por exemplo D:\SteamLibrary).
async function resolveSteamapps(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (dir.name.toLowerCase() === 'steamapps') return dir;
  try {
    return await dir.getDirectoryHandle('steamapps');
  } catch {
    return dir;
  }
}

export type AddDirResult =
  | { status: 'added'; name: string }
  | { status: 'duplicate'; name: string }
  | { status: 'cancelled' }
  | { status: 'denied' };

// Abre o seletor de pasta e acrescenta a escolhida às que já existem.
export async function addSteamappsDir(): Promise<AddDirResult> {
  if (!('showDirectoryPicker' in window)) return { status: 'cancelled' };
  let picked: FileSystemDirectoryHandle;
  try {
    // @ts-expect-error - showDirectoryPicker types vary across TS lib versions
    picked = await window.showDirectoryPicker({ id: 'steamapps', mode: 'read', startIn: 'documents' });
  } catch {
    return { status: 'cancelled' };
  }
  if (!(await verifyPermission(picked, 'read', true))) return { status: 'denied' };

  const dir = await resolveSteamapps(picked);
  const handles = await readHandles();
  for (const existing of handles) {
    try {
      if (await (existing as unknown as { isSameEntry(other: FileSystemHandle): Promise<boolean> }).isSameEntry(dir)) return { status: 'duplicate', name: dir.name };
    } catch {
      // segue em frente
    }
  }
  await idbPut(IDB_KEY_LIST, [...handles, dir]);
  return { status: 'added', name: dir.name };
}

export interface ScannedLibrary {
  dir: FileSystemDirectoryHandle;
  games: InstalledGame[];
}

// Lê todas as pastas e junta os jogos (o mesmo jogo em duas pastas aparece uma vez).
export async function scanLibraries(
  dirs: FileSystemDirectoryHandle[]
): Promise<{ games: InstalledGame[]; libraries: ScannedLibrary[] }> {
  const libraries: ScannedLibrary[] = [];
  for (const dir of dirs) {
    try {
      libraries.push({ dir, games: await scanInstalledGames(dir) });
    } catch {
      // pasta que sumiu ou perdeu a permissão
    }
  }
  return { games: mergeGames(libraries.flatMap((l) => l.games)), libraries };
}

// Junta listas de jogos por appid; a primeira ocorrência vence, mas completa o tamanho que faltar.
export function mergeGames(...lists: InstalledGame[][]): InstalledGame[] {
  const byId = new Map<number, InstalledGame>();
  for (const game of lists.flat()) {
    const current = byId.get(game.appid);
    if (!current) byId.set(game.appid, game);
    else if (!current.size_on_disk && game.size_on_disk) byId.set(game.appid, { ...current, size_on_disk: game.size_on_disk });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface AcfManifest {
  appid: string;
  name: string;
  installdir: string;
  size_on_disk?: string;
  StateFlags?: string;
  UserConfig?: Record<string, string>;
}

function parseAcf(text: string): AcfManifest | null {
  const tokens = tokenizeVdf(text);
  let i = 0;

  function parseObj(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    while (i < tokens.length) {
      const key = tokens[i++];
      if (key === '}') return obj;
      if (i >= tokens.length) return obj;
      const val = tokens[i];
      if (val === '{') {
        i++;
        obj[key] = parseObj();
      } else {
        obj[key] = val;
        i++;
      }
    }
    return obj;
  }

  try {
    const root = parseObj();
    const state = (root.AppState ?? root) as Record<string, unknown>;
    const uc = (state.UserConfig ?? {}) as Record<string, string>;
    return {
      appid: String(state.appid ?? ''),
      name: String(state.name ?? uc.name ?? ''),
      installdir: String(state.installdir ?? ''),
      // O manifesto da Steam grava o tamanho como "SizeOnDisk" (com letras maiúsculas).
      size_on_disk: pickSize(state),
      StateFlags: state.StateFlags ? String(state.StateFlags) : undefined,
      UserConfig: uc,
    };
  } catch {
    return null;
  }
}

function pickSize(state: Record<string, unknown>): string | undefined {
  const value = state.SizeOnDisk ?? state.sizeondisk ?? state.size_on_disk;
  return value ? String(value) : undefined;
}

function tokenizeVdf(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' || ch === '}') {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch === '"') {
      i++;
      let buf = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          buf += text[i + 1];
          i += 2;
        } else {
          buf += text[i];
          i++;
        }
      }
      i++;
      tokens.push(buf);
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    let buf = '';
    while (i < text.length && !/[\s{}"]/.test(text[i])) {
      buf += text[i];
      i++;
    }
    if (buf) tokens.push(buf);
  }
  return tokens;
}

async function readTextFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function scanInstalledGames(
  steamappsDir: FileSystemDirectoryHandle
): Promise<InstalledGame[]> {
  const games: InstalledGame[] = [];
  const entries = (steamappsDir as unknown as {
    values(): AsyncIterable<
      | { kind: 'file'; name: string; getFile(): Promise<File> }
      | { kind: 'directory'; name: string }
    >;
  }).values();
  for await (const entry of entries) {
    if (entry.kind !== 'file' || !/^appmanifest_\d+\.acf$/i.test(entry.name)) continue;
    try {
      const manifest = parseAcf(await readTextFile(entry as FileSystemFileHandle));
      if (!manifest?.appid) continue;
      const appid = parseInt(manifest.appid, 10);
      if (Number.isNaN(appid)) continue;
      games.push({
        appid,
        name: manifest.name || `App ${appid}`,
        installdir: manifest.installdir,
        size_on_disk: parseSize(manifest.size_on_disk),
        library_image: libraryImageUrl(appid),
        header_image: headerImageUrl(appid),
      });
    } catch {
      // Skip unreadable manifests.
    }
  }
  games.sort((a, b) => a.name.localeCompare(b.name));
  return games;
}

export async function hydrateInstalledSizes(
  steamappsDir: FileSystemDirectoryHandle,
  games: InstalledGame[],
  onSize: (appid: number, size: number) => void
): Promise<void> {
  let common: FileSystemDirectoryHandle;
  try {
    common = await steamappsDir.getDirectoryHandle('common');
  } catch {
    return;
  }

  for (const game of games) {
    if (game.size_on_disk || !game.installdir) continue;
    try {
      const gameDir = await common.getDirectoryHandle(game.installdir);
      const size = await calculateDirectorySize(gameDir);
      if (size > 0) onSize(game.appid, size);
    } catch {
      // Some manifests point to removed or protected folders.
    }
    await yieldToBrowser();
  }
}

async function calculateDirectorySize(directory: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  const entries = (directory as unknown as {
    values(): AsyncIterable<FileSystemHandle>;
  }).values();
  for await (const entry of entries) {
    if (entry.kind === 'file') {
      total += (await (entry as FileSystemFileHandle).getFile()).size;
    } else if (entry.kind === 'directory') {
      total += await calculateDirectorySize(entry as FileSystemDirectoryHandle);
    }
  }
  return total;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function parseSize(value?: string): number | undefined {
  if (!value) return undefined;
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? size : undefined;
}

export function libraryImageUrl(appid: number): string {
  return gameArtworkUrls(appid)[0];
}

export function headerImageUrl(appid: number): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

export function gameArtworkUrls(appid: number): string[] {
  const cdns = [
    'https://cdn.cloudflare.steamstatic.com',
    'https://cdn.akamai.steamstatic.com',
    'https://shared.cloudflare.steamstatic.com/store_item_assets',
  ];
  return [
    ...cdns.map((cdn) => `${cdn}/steam/apps/${appid}/library_600x900_2x.jpg`),
    ...cdns.map((cdn) => `${cdn}/steam/apps/${appid}/library_600x900.jpg`),
    ...cdns.map((cdn) => `${cdn}/steam/apps/${appid}/header.jpg`),
  ];
}

export function launchUrl(appid: number): string {
  return `steam://run/${appid}`;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
