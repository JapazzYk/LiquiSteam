// Conversa com o LiquiSteam Helper, um programinha local (pasta "helper" do projeto)
// que enxerga os processos do Windows. O navegador sozinho não consegue saber se a
// Steam está aberta; o helper consegue e responde em http://127.0.0.1.
import type { InstalledGame } from '@/types';
import { headerImageUrl, libraryImageUrl } from '@/lib/steamLibrary';

const BASE = 'http://127.0.0.1:47231';

export type HelperSteamState = 'running' | 'starting' | 'not-running';

async function call(path: string, method: 'GET' | 'POST', timeoutMs: number): Promise<Response | null> {
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
    return response.ok ? response : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

// null = helper não está rodando (ou o navegador bloqueou o acesso).
export async function helperSteamState(): Promise<HelperSteamState | null> {
  const response = await call('/status', 'GET', 1500);
  if (!response) return null;
  try {
    const data = (await response.json()) as { app?: string; steam?: string };
    if (data.app !== 'liquisteam-helper') return null;
    if (data.steam === 'running' || data.steam === 'starting' || data.steam === 'not-running') return data.steam;
  } catch {
    // resposta inválida
  }
  return null;
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
