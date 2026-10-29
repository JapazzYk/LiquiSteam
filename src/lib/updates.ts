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
