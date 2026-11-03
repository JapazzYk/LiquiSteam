import { useCallback, useEffect, useRef, useState } from 'react';
import { helperUpdates } from '@/lib/steamHelper';
import { downloadItems, pendingUpdates, type DownloadItem, type PendingUpdate } from '@/lib/updates';

// Com a aba aberta confere com mais frequência; no resto basta de tempos em tempos (é só para o contador).
const POLL_VIEW_MS = 5000;
const POLL_IDLE_MS = 45000;
// Com um download andando: rápido na aba (barra e velocidade ao vivo) e moderado fora dela (anel no ícone).
const POLL_LIVE_VIEW_MS = 1500;
const POLL_LIVE_IDLE_MS = 4000;

export interface FinishedDownload {
  appid: number;
  name: string;
  firstInstall: boolean;
  at: number;
}

const RECENT_KEY = 'liquid_recent_downloads';
const RECENT_MAX_AGE = 7 * 24 * 3600 * 1000;

function readRecent(): FinishedDownload[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as FinishedDownload[];
    const now = Date.now();
    return Array.isArray(list)
      ? list.filter((f) => f && typeof f.appid === 'number' && typeof f.at === 'number' && now - f.at < RECENT_MAX_AGE).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

interface SpeedSample {
  bytes: number;
  at: number;
  speed: number; // bytes por segundo, suavizado
  changedAt: number;
}

interface UseUpdatesOptions {
  helperOnline: boolean;
  active: boolean; // a aba Atualizações está aberta
}

// Lista os jogos com atualização pendente, lendo o que a Steam anotou no computador (via helper).
export function useUpdates({ helperOnline, active }: UseUpdatesOptions) {
  const [pending, setPending] = useState<PendingUpdate[]>([]);
  // null = ainda não sei; false = helper antigo, sem a função de atualizações.
  const [supported, setSupported] = useState<boolean | null>(null);
  // Helper 12+: progresso ao vivo. false = Helper antigo (só a lista de pendentes).
  const [live, setLive] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [speeds, setSpeeds] = useState<Record<number, number>>({});
  // Downloads recentes: ficam guardados neste navegador por alguns dias.
  const [finished, setFinished] = useState<FinishedDownload[]>(readRecent);
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(finished));
    } catch {
      // armazenamento indisponível
    }
  }, [finished]);
  const samples = useRef(new Map<number, SpeedSample>());
  const previous = useRef(new Map<number, DownloadItem>());
  const liveRef = useRef(false);

  const activeRef = useRef(active);
  activeRef.current = active;
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!helperOnline) {
      setSupported(null);
      setPending([]);
      setDownloads([]);
      setSpeeds({});
      samples.current.clear();
      previous.current.clear();
      liveRef.current = false;
      return;
    }

    let stopped = false;
    let timer = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped || document.hidden) return;
      const delay = liveRef.current
        ? activeRef.current
          ? POLL_LIVE_VIEW_MS
          : POLL_LIVE_IDLE_MS
        : activeRef.current
          ? POLL_VIEW_MS
          : POLL_IDLE_MS;
      timer = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      const list = await helperUpdates();
      if (stopped) return;
      if (list === null) {
        setSupported(false);
      } else {
        setSupported(true);
        setPending(pendingUpdates(list));
        const hasProgress = list.some((u) => u.progress);
        setLive(hasProgress);
        const items = hasProgress ? downloadItems(list) : [];
        const now = Date.now();

        // Velocidade: quanto o número de bytes baixados andou desde a última leitura, suavizado.
        // A Steam grava o manifesto de tempos em tempos, então a conta usa o tempo entre mudanças.
        const nextSpeeds: Record<number, number> = {};
        const seen = new Set<number>();
        for (const item of items) {
          seen.add(item.appid);
          const done = item.downloaded + item.staged;
          const old = samples.current.get(item.appid);
          if (!item.active) {
            samples.current.delete(item.appid);
            continue;
          }
          if (!old) {
            samples.current.set(item.appid, { bytes: done, at: now, speed: 0, changedAt: now });
            continue;
          }
          let speed = old.speed;
          if (done > old.bytes) {
            const instant = ((done - old.bytes) * 1000) / Math.max(250, now - old.changedAt);
            speed = old.speed > 0 ? old.speed * 0.6 + instant * 0.4 : instant;
            samples.current.set(item.appid, { bytes: done, at: now, speed, changedAt: now });
          } else if (now - old.changedAt > 12000) {
            // Parado há um tempo (gravando no disco, rede caiu): a velocidade vai a zero aos poucos.
            speed = old.speed * 0.5;
            samples.current.set(item.appid, { ...old, at: now, speed });
          }
          if (speed > 1024) nextSpeeds[item.appid] = speed;
        }
        for (const appid of Array.from(samples.current.keys())) if (!seen.has(appid)) samples.current.delete(appid);

        // Concluídos: estava andando (ou na fila) na leitura anterior e agora sumiu da lista.
        const justFinished: FinishedDownload[] = [];
        previous.current.forEach((item, appid) => {
          if (seen.has(appid) || item.phase === 'pending' || item.phase === 'uninstalling') return;
          justFinished.push({ appid, name: item.name, firstInstall: item.firstInstall, at: now });
        });
        if (justFinished.length) setFinished((list) => [...justFinished, ...list.filter((f) => !justFinished.some((j) => j.appid === f.appid))].slice(0, 8));
        previous.current = new Map(items.map((item) => [item.appid, item]));

        liveRef.current = items.some((item) => item.active);
        setDownloads(items);
        setSpeeds(nextSpeeds);
      }
      schedule();
    };

    tickRef.current = () => {
      window.clearTimeout(timer);
      void tick();
    };

    const onVisible = () => {
      if (!document.hidden) tickRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    void tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [helperOnline]);

  // Ao abrir a aba, confere na hora.
  useEffect(() => {
    if (helperOnline && active) tickRef.current();
  }, [active, helperOnline]);

  const refresh = useCallback(() => tickRef.current(), []);
  const clearFinished = useCallback(() => setFinished([]), []);

  // O que está andando agora (o primeiro da lista).
  const current = downloads.find((item) => item.active) ?? null;

  return {
    pending,
    pendingCount: pending.length,
    supported,
    refresh,
    live,
    downloads,
    speeds,
    current,
    finished,
    clearFinished,
  };
}

export type UpdatesState = ReturnType<typeof useUpdates>;
