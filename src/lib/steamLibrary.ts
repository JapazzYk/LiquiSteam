import type { InstalledGame } from '@/types';

const IDB_DB = 'liquid_steam';
const IDB_STORE = 'handles';
const IDB_KEY = 'steamapps_handle';

async function idbGetHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readonly');
      const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
      get.onsuccess = () => resolve((get.result as FileSystemDirectoryHandle) ?? null);
      get.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

async function idbSaveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function idbClearHandle(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read',
  request = false
): Promise<boolean> {
  const descriptor = { mode };
  // @ts-expect-error - queryPermission/requestPermission are not in stable TS lib types
  if ((await handle.queryPermission?.(descriptor)) === 'granted') return true;
  if (!request) return false;
  // @ts-expect-error - requestPermission must run from a user gesture
  return (await handle.requestPermission?.(descriptor)) === 'granted';
}

export async function getStoredSteamappsDir(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await idbGetHandle();
  if (!handle) return null;
  const ok = await verifyPermission(handle, 'read');
  return ok ? handle : null;
}

export async function pickSteamappsDir(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    // @ts-expect-error - showDirectoryPicker types vary across TS lib versions
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: 'steamapps',
      mode: 'read',
      startIn: 'documents',
    });
    const granted = await verifyPermission(handle, 'read', true);
    if (!granted) return null;
    await idbSaveHandle(handle);
    return handle;
  } catch {
    return null;
  }
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
      size_on_disk: state.size_on_disk ? String(state.size_on_disk) : undefined,
      StateFlags: state.StateFlags ? String(state.StateFlags) : undefined,
      UserConfig: uc,
    };
  } catch {
    return null;
  }
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
