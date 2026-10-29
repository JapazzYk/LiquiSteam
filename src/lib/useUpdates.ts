import { useCallback, useEffect, useRef, useState } from 'react';
import { helperUpdateGame, helperUpdates } from '@/lib/steamHelper';
import {
  loadHistory,
  saveHistory,
  toItem,
  type FinishedUpdate,
  type UpdateItem,
} from '@/lib/updates';

// Intervalos de leitura dos manifestos: rápido com a tela aberta, calmo no resto.
const POLL_VIEW_MS = 2000;
const POLL_ACTIVE_MS = 4000;
const POLL_IDLE_MS = 30000;
const BOOST_MS = 20000;

interface UseUpdatesOptions {
  helperOnline: boolean;
  active: boolean; // a aba Atualizações está aberta
}

interface Sample {
  bytes: number;
  at: number;
  speed: number;
}

// Lê o estado de atualização dos jogos pelo helper e calcula velocidade e tempo restante
// (a Steam grava os bytes baixados, mas não a velocidade).
export function useUpdates({ helperOnline, active }: UseUpdatesOptions) {
  const [items, setItems] = useState<UpdateItem[]>([]);
  // null = ainda não sei; false = helper antigo, sem a função de atualizações.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [history, setHistory] = useState<FinishedUpdate[]>(() => loadHistory());
  // Jogos para os quais o usuário pediu a atualização (appid -> quando).
  const [requested, setRequested] = useState<Record<number, number>>({});

  const samples = useRef<Map<number, Sample>>(new Map());
  const wasPending = useRef<Map<number, { name: string; install: boolean }>>(new Map());
  const first = useRef(true);
  const itemsRef = useRef<UpdateItem[]>([]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const boostUntil = useRef(0);
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!helperOnline) {
      setSupported(null);
      setItems([]);
      itemsRef.current = [];
      samples.current.clear();
      wasPending.current.clear();
      first.current = true;
      return;
    }

    let stopped = false;
    let timer = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped || document.hidden) return;
      const anyActive = itemsRef.current.some((item: UpdateItem) => item.inProgress);
      const boosted = Date.now() < boostUntil.current;
      const ms = activeRef.current ? POLL_VIEW_MS : anyActive || boosted ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      timer = window.setTimeout(tick, ms);
    };

    const tick = async () => {
      const list = await helperUpdates();
      if (stopped) return;
      if (list === null) {
        setSupported(false);
        schedule();
        return;
      }
      setSupported(true);
      const now = Date.now();

      const next: UpdateItem[] = [];
      const finished: FinishedUpdate[] = [];
      const seen = new Set<number>();
      for (const update of list) {
        seen.add(update.appid);
        const prev = samples.current.get(update.appid);
        let speed = 0;
        if (prev) {
          const dt = (now - prev.at) / 1000;
          const delta = update.bytesDownloaded + update.bytesStaged - prev.bytes;
          if (dt >= 0.5) {
            const instant = delta > 0 ? delta / dt : 0;
            speed = delta > 0 ? (prev.speed > 0 ? prev.speed * 0.5 + instant * 0.5 : instant) : prev.speed * 0.4;
            if (speed < 512) speed = 0;
            samples.current.set(update.appid, { bytes: update.bytesDownloaded + update.bytesStaged, at: now, speed });
          } else {
            speed = prev.speed;
          }
        } else {
          samples.current.set(update.appid, { bytes: update.bytesDownloaded + update.bytesStaged, at: now, speed: 0 });
        }

        const item = toItem(update, speed);
        if (item.pending) {
          next.push(item);
          wasPending.current.set(update.appid, { name: update.name, install: item.isInstall });
        } else if (wasPending.current.has(update.appid)) {
          // Estava atualizando e agora não tem mais nada a fazer: terminou.
          const info = wasPending.current.get(update.appid)!;
          wasPending.current.delete(update.appid);
          if (!first.current) finished.push({ appid: update.appid, name: info.name, at: now, install: info.install });
        }
      }
      // Jogos que sumiram da lista (desinstalados) deixam de ser acompanhados.
      for (const appid of Array.from(wasPending.current.keys() as Iterable<number>)) {
        if (!seen.has(appid)) wasPending.current.delete(appid);
      }
      for (const appid of Array.from(samples.current.keys() as Iterable<number>)) {
        if (!seen.has(appid)) samples.current.delete(appid);
      }
      first.current = false;

      itemsRef.current = next;
      setItems(next);
      setRequested((current: Record<number, number>) => {
        // Tira dos "pedidos" o que a Steam já começou ou terminou.
        const keep: Record<number, number> = {};
        for (const [key, at] of Object.entries(current)) {
          const item = next.find((entry: UpdateItem) => entry.appid === Number(key));
          if (item && !item.inProgress) keep[Number(key)] = at;
        }
        return Object.keys(keep).length === Object.keys(current).length ? current : keep;
      });
      if (finished.length > 0) {
        setHistory((current: FinishedUpdate[]) => {
          const merged = [...finished, ...current].slice(0, 12);
          saveHistory(merged);
          return merged;
        });
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

  // Ao abrir ou fechar a aba, ajusta o ritmo na hora.
  useEffect(() => {
    if (helperOnline) tickRef.current();
  }, [active, helperOnline]);

  const refresh = useCallback(() => tickRef.current(), []);

  // Pede à Steam para atualizar. Sem o helper (ou se ele falhar), cai no atalho steam:// do navegador.
  // Atualização de jogo instalado usa "validate" (a Steam compara com a versão nova e baixa o que mudou);
  // "install" só serve para instalação nova, e num jogo já instalado a Steam costuma não fazer nada.
  const update = useCallback(async (appid: number, forcedMode?: 'install' | 'validate') => {
    const target = itemsRef.current.find((item: UpdateItem) => item.appid === appid);
    const mode = forcedMode ?? (target?.isInstall ? 'install' : 'validate');
    setRequested((current: Record<number, number>) => ({ ...current, [appid]: Date.now() }));
    boostUntil.current = Date.now() + BOOST_MS;
    const ok = await helperUpdateGame(appid, mode);
    if (!ok) window.location.href = `steam://${mode}/${appid}`;
    window.setTimeout(() => tickRef.current(), 1500);
  }, []);

  const updateAll = useCallback(async () => {
    const targets = itemsRef.current.filter((item: UpdateItem) => !item.inProgress);
    for (const item of targets) {
      await update(item.appid);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
  }, [update]);

  const clearHistory = useCallback(() => {
    saveHistory([]);
    setHistory([]);
  }, []);

  const downloading = items.filter((item: UpdateItem) => item.inProgress);
  const available = items.filter((item: UpdateItem) => !item.inProgress);

  return {
    items,
    downloading,
    available,
    pendingCount: items.length,
    supported,
    history,
    requested,
    refresh,
    update,
    updateAll,
    clearHistory,
  };
}

export type UpdatesState = ReturnType<typeof useUpdates>;
