import type { HelperGameUpdate } from '@/lib/steamHelper';

// Estado de cada jogo como a Steam grava no manifesto (appmanifest_*.acf). O bit 2 de StateFlags é
// "atualização necessária"; também vale quando a versão alvo é diferente da instalada.
export const FLAG_UPDATE_REQUIRED = 2;

export interface PendingUpdate {
  appid: number;
  name: string;
  bytesToDownload: number;
  buildId: number;
  targetBuildId: number;
}

export function isPending(update: HelperGameUpdate): boolean {
  if (update.stateFlags & FLAG_UPDATE_REQUIRED) return true;
  return update.targetBuildId > 0 && update.buildId > 0 && update.targetBuildId !== update.buildId;
}

// Só os jogos com atualização pendente.
export function pendingUpdates(list: HelperGameUpdate[]): PendingUpdate[] {
  return list
    .filter(isPending)
    .map((update) => ({
      appid: update.appid,
      name: update.name,
      bytesToDownload: update.bytesToDownload,
      buildId: update.buildId,
      targetBuildId: update.targetBuildId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Downloads com progresso (Helper 12+) ----
// Bits de StateFlags que interessam aqui (os mesmos nomes do cliente da Steam).
const FLAG_FULLY_INSTALLED = 4;
const FLAG_UPDATE_RUNNING = 256;
const FLAG_UPDATE_PAUSED = 512;
const FLAG_UPDATE_STARTED = 1024;
const FLAG_UNINSTALLING = 2048;
const FLAG_VALIDATING = 131072;
const FLAG_PREALLOCATING = 524288;
const FLAG_DOWNLOADING = 1048576;
const FLAG_STAGING = 2097152;
const FLAG_COMMITTING = 4194304;

export type DownloadPhase =
  | 'downloading' // baixando
  | 'installing' // descompactando e gravando no disco
  | 'validating' // verificando arquivos
  | 'preparing' // reservando espaço
  | 'uninstalling'
  | 'paused' // começou e parou no meio
  | 'queued' // na fila, ainda sem nada baixado
  | 'pending'; // atualização disponível, ainda não começou

export interface DownloadItem {
  appid: number;
  name: string;
  phase: DownloadPhase;
  active: boolean; // a Steam está mexendo neste jogo agora
  firstInstall: boolean; // instalação nova (não é atualização)
  toDownload: number;
  downloaded: number;
  toStage: number;
  staged: number;
  progress: number; // 0 a 1, da etapa atual (baixando ou gravando)
  size: number;
}

function phaseOf(u: HelperGameUpdate, active: boolean): DownloadPhase {
  const f = u.stateFlags;
  if (f & FLAG_UNINSTALLING) return 'uninstalling';
  if (f & FLAG_VALIDATING) return 'validating';
  if (f & FLAG_PREALLOCATING) return 'preparing';
  if (f & (FLAG_STAGING | FLAG_COMMITTING)) return 'installing';
  if (f & FLAG_DOWNLOADING) return 'downloading';
  if (active) {
    // O manifesto quase sempre só diz "começou"; o que falta baixar ou gravar diz a etapa.
    if (u.bytesToDownload > 0 && u.bytesDownloaded < u.bytesToDownload) return 'downloading';
    if (u.bytesToStage > 0 && u.bytesStaged < u.bytesToStage) return 'installing';
    return 'downloading';
  }
  if (f & FLAG_UPDATE_PAUSED) return 'paused';
  if (f & FLAG_UPDATE_STARTED) return u.bytesDownloaded > 0 || u.bytesStaged > 0 ? 'paused' : 'queued';
  return 'pending';
}

// Progresso da etapa atual, como na Steam: baixando conta os bytes baixados; instalando, os gravados.
function progressOf(u: HelperGameUpdate, phase: DownloadPhase): number {
  const ratio = (done: number, total: number) => (total > 0 ? Math.min(1, Math.max(0, done / total)) : 0);
  if (phase === 'installing') return ratio(u.bytesStaged, u.bytesToStage);
  if (u.bytesToDownload > 0) return ratio(u.bytesDownloaded, u.bytesToDownload);
  return ratio(u.bytesStaged, u.bytesToStage);
}

// Tudo o que a Steam tem para baixar ou instalar, do que está andando agora para o que só está disponível.
export function downloadItems(list: HelperGameUpdate[]): DownloadItem[] {
  const order: Record<DownloadPhase, number> = {
    downloading: 0,
    installing: 0,
    validating: 0,
    preparing: 0,
    uninstalling: 0,
    paused: 1,
    queued: 2,
    pending: 3,
  };
  return list
    .filter((u) => u.updating || isPending(u) || (u.stateFlags & (FLAG_UPDATE_RUNNING | FLAG_UPDATE_STARTED | FLAG_UNINSTALLING | FLAG_VALIDATING)) !== 0)
    .map((u) => {
      const active = u.updating || (u.stateFlags & FLAG_UPDATE_RUNNING) !== 0;
      const phase = phaseOf(u, active);
      return {
        appid: u.appid,
        name: u.name,
        phase,
        active,
        // Jogo novo ainda não tem versão instalada (buildid 0 no manifesto).
        firstInstall: u.buildId === 0 && (u.stateFlags & FLAG_FULLY_INSTALLED) === 0,
        toDownload: u.bytesToDownload,
        downloaded: u.bytesDownloaded,
        toStage: u.bytesToStage,
        staged: u.bytesStaged,
        progress: progressOf(u, phase),
        size: u.size,
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || order[a.phase] - order[b.phase] || a.name.localeCompare(b.name));
}

export const PHASE_LABEL: Record<DownloadPhase, string> = {
  downloading: 'Baixando',
  installing: 'Instalando',
  validating: 'Verificando arquivos',
  preparing: 'Reservando espaço',
  uninstalling: 'Desinstalando',
  paused: 'Pausado',
  queued: 'Na fila',
  pending: 'Atualização disponível',
};
