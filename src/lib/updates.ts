import type { HelperGameUpdate } from '@/lib/steamHelper';

// Estado de cada jogo como a Steam grava no manifesto (appmanifest_*.acf). Os bits de StateFlags que
// importam aqui; a leitura é conservadora e o valor bruto continua disponível para conferência.
export const FLAG_UPDATE_REQUIRED = 2;
export const FLAG_FULLY_INSTALLED = 4;
export const FLAG_UPDATE_RUNNING = 256;
export const FLAG_UPDATE_STARTED = 1024;

export type UpdatePhase = 'queued' | 'downloading' | 'staging' | 'idle';

export interface UpdateItem extends HelperGameUpdate {
  pending: boolean; // há atualização (ou instalação) a fazer
  inProgress: boolean; // a Steam já começou
  isInstall: boolean; // instalação nova, não atualização
  phase: UpdatePhase;
  progress: number; // 0 a 1 da etapa atual
  speed: number; // bytes por segundo (média recente)
  eta: number | null; // segundos restantes
}

export function isPending(update: HelperGameUpdate): boolean {
  if (update.stateFlags & FLAG_UPDATE_REQUIRED) return true;
  return update.targetBuildId > 0 && update.buildId > 0 && update.targetBuildId !== update.buildId;
}

export function isInProgress(update: HelperGameUpdate): boolean {
  return (update.stateFlags & (FLAG_UPDATE_RUNNING | FLAG_UPDATE_STARTED)) !== 0;
}

// Só os jogos com algo a fazer, já com o andamento calculado.
export function toItem(update: HelperGameUpdate, speed: number): UpdateItem {
  const inProgress = isInProgress(update);
  const pending = isPending(update) || inProgress;
  const isInstall = update.buildId === 0 && !(update.stateFlags & FLAG_FULLY_INSTALLED);

  let phase: UpdatePhase = 'queued';
  let progress = 0;
  let remaining = 0;
  if (inProgress) {
    const downloading = update.bytesToDownload > 0 && update.bytesDownloaded < update.bytesToDownload;
    const staging = update.bytesToStage > 0 && update.bytesStaged < update.bytesToStage;
    if (downloading) {
      phase = speed > 1024 ? 'downloading' : 'idle';
      progress = update.bytesDownloaded / update.bytesToDownload;
      remaining = update.bytesToDownload - update.bytesDownloaded;
    } else if (staging) {
      phase = 'staging';
      progress = update.bytesStaged / update.bytesToStage;
      remaining = update.bytesToStage - update.bytesStaged;
    } else {
      phase = 'idle';
      progress = update.bytesToDownload > 0 ? 1 : 0;
    }
  }
  const eta = phase === 'downloading' && speed > 1024 ? remaining / speed : null;
  return { ...update, pending, inProgress, isInstall, phase, progress: Math.min(Math.max(progress, 0), 1), speed, eta };
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return 'menos de 1 min';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Atualizações concluídas, lembradas neste navegador.
export interface FinishedUpdate {
  appid: number;
  name: string;
  at: number; // ms
  install: boolean;
}

const HISTORY_KEY = 'liquid_update_history';
const HISTORY_MAX = 12;

export function loadHistory(): FinishedUpdate[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FinishedUpdate[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.appid === 'number' && typeof item.at === 'number').slice(0, HISTORY_MAX)
      : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: FinishedUpdate[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch {
    // ignora
  }
}
