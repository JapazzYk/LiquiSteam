import { useCallback, useEffect, useRef, useState } from 'react';
import { helperAction, helperSteamState } from '@/lib/steamHelper';
import { openSteamClient, stopSteamClient } from '@/lib/steamLaunch';

// Estado do cliente da Steam.
// - Com o LiquiSteam Helper rodando no computador, o estado é lido do Windows e sempre confere.
// - Sem o helper, o navegador não enxerga processos: o estado é uma estimativa
//   (abrir marca "iniciando" e, depois de alguns segundos, "aberta").
export type SteamStatus = 'unknown' | 'starting' | 'running' | 'not-running';
export type HelperLink = 'checking' | 'online' | 'offline';

const STORAGE_KEY = 'liquid_steam_status';

// Intervalos de checagem: rápido logo após abrir/encerrar, lento no resto.
// Com a aba escondida não há checagem nenhuma.
const POLL_FAST_MS = 1000;
const POLL_NORMAL_MS = 4000;
const POLL_OFFLINE_MS = 20000;
const FAST_WINDOW_MS = 30000;
// Depois de abrir/encerrar, ignora respostas atrasadas que contradizem o comando.
const GRACE_MS = 10000;

function readStored(): SteamStatus {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'running' || v === 'not-running') return v;
  } catch {
    // ignore
  }
  return 'unknown';
}

export function useSteamStatus() {
  const [status, setStatus] = useState<SteamStatus>(() => readStored());
  const [helper, setHelper] = useState<HelperLink>('checking');

  const helperOnline = useRef(false);
  const fastUntil = useRef(0);
  const graceUntil = useRef(0);
  const graceExpect = useRef<'open' | 'exit' | null>(null);
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, status);
    } catch {
      // ignore
    }
  }, [status]);

  // Laço de leitura do helper. Um único timer, parado quando a aba fica escondida.
  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (!stopped && !document.hidden) timer = window.setTimeout(tick, ms);
    };

    const tick = async () => {
      const state = await helperSteamState();
      if (stopped) return;

      if (state === null) {
        helperOnline.current = false;
        setHelper('offline');
        schedule(POLL_OFFLINE_MS);
        return;
      }

      helperOnline.current = true;
      setHelper('online');

      const now = Date.now();
      const inGrace = now < graceUntil.current;
      const contradicts =
        (graceExpect.current === 'open' && state === 'not-running') ||
        (graceExpect.current === 'exit' && state !== 'not-running');
      if (!(inGrace && contradicts)) {
        setStatus(state);
        // Chegou ao estado esperado: encerra a janela de tolerância.
        if (graceExpect.current === 'open' && state === 'running') graceExpect.current = null;
        if (graceExpect.current === 'exit' && state === 'not-running') graceExpect.current = null;
      }
      schedule(now < fastUntil.current ? POLL_FAST_MS : POLL_NORMAL_MS);
    };
    tickRef.current = () => {
      window.clearTimeout(timer);
      void tick();
    };

    const onVisible = () => {
      if (!document.hidden) tickRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const open = useCallback(async () => {
    setStatus('starting');
    if (helperOnline.current && (await helperAction('open'))) {
      graceExpect.current = 'open';
      graceUntil.current = Date.now() + GRACE_MS;
      fastUntil.current = Date.now() + FAST_WINDOW_MS;
      tickRef.current();
      return;
    }
    // Sem helper: abre pelo protocolo steam:// e estima o resultado.
    openSteamClient();
    window.setTimeout(() => {
      setStatus((s) => (s === 'starting' ? 'running' : s));
    }, 4000);
  }, []);

  const stop = useCallback(async () => {
    if (helperOnline.current && (await helperAction('exit'))) {
      setStatus('not-running');
      graceExpect.current = 'exit';
      graceUntil.current = Date.now() + GRACE_MS;
      fastUntil.current = Date.now() + FAST_WINDOW_MS;
      tickRef.current();
      return;
    }
    stopSteamClient();
    setStatus('not-running');
  }, []);

  return { status, helper, open, stop };
}
