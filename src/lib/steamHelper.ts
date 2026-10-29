// Conversa com o LiquiSteam Helper, um programinha local (pasta "helper" do projeto)
// que enxerga os processos do Windows. O navegador sozinho não consegue saber se a
// Steam está aberta; o helper consegue e responde em http://127.0.0.1.
import type { InstalledGame } from '@/types';
import { headerImageUrl, libraryImageUrl } from '@/lib/steamLibrary';

const BASE = 'http://127.0.0.1:47231';

export type HelperSteamState = 'running' | 'starting' | 'not-running';

// Permissão do navegador para o site falar com apps neste computador (Chrome: "Acessar outros
// apps e serviços neste dispositivo"). 'unsupported' = o navegador não expõe essa permissão.
export type HelperAccess = 'granted' | 'prompt' | 'denied' | 'unsupported';
// Resultado de um pedido explícito de permissão (clique do usuário).
export type HelperAccessResult = 'online' | 'no-helper' | 'dismissed' | 'blocked';

// Lembra que este navegador já teve (ou vai ter) o helper, para só consultar por conta própria
// quando faz sentido e nunca abrir o pop-up de permissão para quem não usa o helper.
const HINT_KEY = 'liquid_helper_hint';

export function readHelperHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHelperHint(value: boolean): void {
  try {
    if (value) localStorage.setItem(HINT_KEY, '1');
    else localStorage.removeItem(HINT_KEY);
  } catch {
    // ignore
  }
}

// "loopback-network" é a permissão atual do Chrome; "local-network-access" é o nome antigo.
const PERMISSION_NAMES = ['loopback-network', 'local-network-access'];

async function queryAccess(): Promise<PermissionStatus | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  for (const name of PERMISSION_NAMES) {
    try {
      return await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
    } catch {
      // nome desconhecido neste navegador: tenta o próximo
    }
  }
  return null;
}

// Só lê o estado da permissão. Nunca abre o pop-up.
export async function helperAccessState(): Promise<HelperAccess> {
  const status = await queryAccess();
  return status ? status.state : 'unsupported';
}

// Avisa quando o usuário muda a permissão (pelo pop-up ou pelas configurações do site).
export async function watchHelperAccess(onChange: () => void): Promise<() => void> {
  const status = await queryAccess();
  if (!status) return () => undefined;
  status.addEventListener('change', onChange);
  return () => status.removeEventListener('change', onChange);
}

// O Firefox também pergunta, mas pode não expor a permissão; nele só consultamos de forma
// automática quem já tem o helper.
export function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
}

async function call(
  path: string,
  method: 'GET' | 'POST',
  timeoutMs: number,
  requireOk = true
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    // targetAddressSpace pede ao Chrome o acesso ao computador local; navegadores que não
    // conhecem a opção simplesmente a ignoram.
    const init = {
      method,
      cache: 'no-store',
      signal: controller.signal,
      targetAddressSpace: 'loopback',
    } as RequestInit;
    const response = await fetch(`${BASE}${path}`, init);
    return response.ok || !requireOk ? response : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

// Estado lido do helper. game = AppID do jogo em execução (0 = nenhum); null quando o helper é de uma
// versão antiga, que ainda não informa o jogo.
export interface HelperStatus {
  steam: HelperSteamState;
  game: number | null;
}

// null = helper não está rodando (ou o navegador bloqueou o acesso).
// timeoutMs maior só em pedidos explícitos: com o pop-up de permissão aberto a resposta espera o usuário.
export async function helperStatus(timeoutMs = 1500): Promise<HelperStatus | null> {
  const response = await call('/status', 'GET', timeoutMs);
  if (!response) return null;
  try {
    const data = (await response.json()) as { app?: string; steam?: string; game?: unknown };
    if (data.app !== 'liquisteam-helper') return null;
    if (data.steam === 'running' || data.steam === 'starting' || data.steam === 'not-running') {
      return { steam: data.steam, game: typeof data.game === 'number' ? data.game : null };
    }
  } catch {
    // resposta inválida
  }
  return null;
}

export async function helperSteamState(timeoutMs = 1500): Promise<HelperSteamState | null> {
  const status = await helperStatus(timeoutMs);
  return status ? status.steam : null;
}

export async function helperAction(action: 'open' | 'exit'): Promise<boolean> {
  return (await call(`/${action}`, 'POST', 4000)) !== null;
}

// Desinstala o helper pelo próprio site. false = não deu (versão antiga do helper, sem essa função).
export async function helperUninstall(): Promise<boolean> {
  return (await call('/uninstall', 'POST', 4000)) !== null;
}

// Jogos instalados em todas as bibliotecas da Steam do computador, lidos pelo helper.
// Funciona mesmo com a Steam em "Arquivos de Programas", que o navegador não deixa escolher.
// null = helper desligado ou de uma versão antiga, sem essa função.
export async function helperLibrary(): Promise<InstalledGame[] | null> {
  const response = await call('/library', 'GET', 15000);
  if (!response) return null;
  try {
    const data = (await response.json()) as {
      games?: { appid?: number; name?: string; installdir?: string; size?: number }[];
    };
    if (!Array.isArray(data.games)) return null;
    return data.games
      .filter((g) => typeof g.appid === 'number' && g.appid > 0)
      .map((g) => ({
        appid: g.appid as number,
        name: g.name || `App ${g.appid}`,
        installdir: g.installdir ?? '',
        size_on_disk: g.size && g.size > 0 ? g.size : undefined,
        library_image: libraryImageUrl(g.appid as number),
        header_image: headerImageUrl(g.appid as number),
      }));
  } catch {
    return null;
  }
}

// Estado de atualização de um jogo, como a Steam grava no manifesto (appmanifest_*.acf).
export interface HelperGameUpdate {
  appid: number;
  name: string;
  stateFlags: number;
  buildId: number;
  targetBuildId: number;
  bytesToDownload: number;
}

// null = helper desligado ou de uma versão antiga, sem essa função.
export async function helperUpdates(): Promise<HelperGameUpdate[] | null> {
  const response = await call('/updates', 'GET', 8000);
  if (!response) return null;
  try {
    const data = (await response.json()) as { games?: Partial<HelperGameUpdate>[] };
    if (!Array.isArray(data.games)) return null;
    const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    return data.games
      .filter((g) => typeof g.appid === 'number' && g.appid > 0)
      .map((g) => ({
        appid: g.appid as number,
        name: g.name || `App ${g.appid}`,
        stateFlags: num(g.stateFlags),
        buildId: num(g.buildId),
        targetBuildId: num(g.targetBuildId),
        bytesToDownload: num(g.bytesToDownload),
      }));
  } catch {
    return null;
  }
}

// ok = pedido enviado; no-process = não achei o jogo rodando; unsupported = helper antigo ou falha.
export async function helperStopGame(appid: number): Promise<'ok' | 'no-process' | 'unsupported'> {
  const response = await call(`/stop-game?appid=${appid}`, 'POST', 10000, false);
  if (!response) return 'unsupported';
  if (response.ok) return 'ok';
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error === 'no-process' || data.error === 'unknown-game') return 'no-process';
  } catch {
    // resposta inválida
  }
  return 'unsupported';
}
