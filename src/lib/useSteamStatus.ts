import { useCallback, useEffect, useRef, useState } from 'react';
import {
  helperAccessState,
  helperAction,
  helperSteamState,
  isFirefox,
  readHelperHint,
  watchHelperAccess,
  writeHelperHint,
  type HelperAccess,
  type HelperAccessResult,
} from '@/lib/steamHelper';
import { fetchPresence } from '@/lib/steamMeta';
import { openSteamClient, stopSteamClient } from '@/lib/steamLaunch';

// Estado do cliente da Steam, da fonte mais confiável para a menos:
//  1. helper: o LiquiSteam Helper (instalado no Windows) lê o processo da Steam. Sempre confere.
//  2. account: sem helper, mas com login e chave de API, pergunta à Steam se a conta está online.
//     Não distingue "iniciando" e a Steam pode demorar alguns segundos para atualizar.
//  3. estimate: sem nada disso o navegador não enxerga processos; o estado é uma estimativa.
export type SteamStatus = 'unknown' | 'starting' | 'running' | 'not-running';
export type HelperLink = 'checking' | 'online' | 'offline';
export type StatusSource = 'helper' | 'account' | 'estimate';

const STORAGE_KEY = 'liquid_steam_status';
// Tempo para o usuário responder ao pop-up de permissão do navegador.
const ACCESS_PROMPT_MS = 60000;

// Intervalos de checagem: rápido logo após abrir/encerrar, lento no resto.
// Com a aba escondida não há checagem nenhuma.
const POLL_FAST_MS = 1000;
const POLL_NORMAL_MS = 4000;
const POLL_ACCOUNT_FAST_MS = 5000;
const POLL_ACCOUNT_MS = 45000;
const POLL_ESTIMATE_MS = 20000;
const FAST_WINDOW_MS = 30000;
// Depois de abrir/encerrar, ignora respostas atrasadas que contradizem o comando.
const GRACE_HELPER_MS = 10000;
const GRACE_ACCOUNT_MS = 45000;

function readStored(): SteamStatus {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'running' || v === 'not-running') return v;
  } catch {
    // ignore
  }
  return 'unknown';
}

// accountAvailable: há login e chave de API salva, então dá para perguntar à Steam.
export function useSteamStatus(accountAvailable: boolean) {
  const [status, setStatus] = useState<SteamStatus>(() => readStored());
  const [helper, setHelper] = useState<HelperLink>('checking');
  const [source, setSource] = useState<StatusSource>('estimate');
  const [access, setAccess] = useState<HelperAccess>('unsupported');
  const [hint, setHint] = useState<boolean>(() => readHelperHint());

  const helperOnline = useRef(false);
  const accountRef = useRef(accountAvailable);
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

  // Quando login/chave mudam, confere de novo na hora.
  useEffect(() => {
    accountRef.current = accountAvailable;
    tickRef.current();
  }, [accountAvailable]);

  // Laço de leitura. Um único timer, parado quando a aba fica escondida.
  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (!stopped && !document.hidden) timer = window.setTimeout(tick, ms);
    };

    // Aplica um estado lido, respeitando a tolerância logo após abrir/encerrar.
    const apply = (state: SteamStatus) => {
      const inGrace = Date.now() < graceUntil.current;
      const contradicts =
        (graceExpect.current === 'open' && state === 'not-running') ||
        (graceExpect.current === 'exit' && state !== 'not-running');
      if (inGrace && contradicts) return;
      setStatus(state);
      if (graceExpect.current === 'open' && state === 'running') graceExpect.current = null;
      if (graceExpect.current === 'exit' && state === 'not-running') graceExpect.current = null;
    };

    const tick = async () => {
      // Só consulta o helper sem abrir o pop-up de permissão: com a permissão já dada, ou em
      // navegadores que não pedem nenhuma. Com 'prompt' ou 'denied' o pedido só acontece
      // quando o usuário clica (requestAccess).
      const nextAccess = await helperAccessState();
      if (stopped) return;
      setAccess(nextAccess);
      const canProbe =
        nextAccess === 'granted' || (nextAccess === 'unsupported' && (!isFirefox() || readHelperHint()));
      const fromHelper = canProbe ? await helperSteamState() : null;
      if (stopped) return;

      if (fromHelper !== null) {
        if (!helperOnline.current) {
          writeHelperHint(true);
          setHint(true);
        }
        helperOnline.current = true;
        setHelper('online');
        setSource('helper');
        apply(fromHelper);
        schedule(Date.now() < fastUntil.current ? POLL_FAST_MS : POLL_NORMAL_MS);
        return;
      }

      helperOnline.current = false;
      setHelper('offline');

      if (accountRef.current) {
        const fromAccount = await fetchPresence();
        if (stopped) return;
        if (fromAccount !== null) {
          setSource('account');
          apply(fromAccount);
          schedule(Date.now() < fastUntil.current ? POLL_ACCOUNT_FAST_MS : POLL_ACCOUNT_MS);
          return;
        }
      }

      setSource('estimate');
      schedule(POLL_ESTIMATE_MS);
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

    // Se o usuário mudar a permissão (pop-up ou configurações do site), confere na hora.
    let unwatch: () => void = () => undefined;
    void watchHelperAccess(() => tickRef.current()).then((stop) => {
      if (stopped) stop();
      else unwatch = stop;
    });

    return () => {
      stopped = true;
      unwatch();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Depois de um comando: tolerância contra respostas atrasadas e checagens mais frequentes.
  const watchAfter = useCallback((expect: 'open' | 'exit') => {
    graceExpect.current = expect;
    graceUntil.current = Date.now() + (helperOnline.current ? GRACE_HELPER_MS : GRACE_ACCOUNT_MS);
    fastUntil.current = Date.now() + FAST_WINDOW_MS;
  }, []);

  const open = useCallback(async () => {
    setStatus('starting');
    if (helperOnline.current && (await helperAction('open'))) {
      watchAfter('open');
      tickRef.current();
      return;
    }
    // Sem helper: abre pelo protocolo steam://.
    openSteamClient();
    if (accountRef.current) {
      // A Steam informa o estado real em instantes.
      watchAfter('open');
      window.setTimeout(() => tickRef.current(), POLL_ACCOUNT_FAST_MS);
      return;
    }
    // Sem nada para conferir: estima.
    window.setTimeout(() => {
      setStatus((s) => (s === 'starting' ? 'running' : s));
    }, 4000);
  }, [watchAfter]);

  const stop = useCallback(async () => {
    if (helperOnline.current && (await helperAction('exit'))) {
      setStatus('not-running');
      watchAfter('exit');
      tickRef.current();
      return;
    }
    stopSteamClient();
    setStatus('not-running');
    if (accountRef.current) {
      watchAfter('exit');
      window.setTimeout(() => tickRef.current(), POLL_ACCOUNT_FAST_MS);
    }
  }, [watchAfter]);

  // Confere de novo agora (por exemplo, depois de instalar ou desinstalar o helper).
  const refresh = useCallback(() => tickRef.current(), []);

  // Pedido explícito, vindo de um clique: é aqui que o navegador mostra o pop-up de permissão.
  const requestAccess = useCallback(async (): Promise<HelperAccessResult> => {
    writeHelperHint(true);
    setHint(true);
    const result = await helperSteamState(ACCESS_PROMPT_MS);
    const nextAccess = await helperAccessState();
    setAccess(nextAccess);
    tickRef.current();
    if (result !== null) return 'online';
    if (nextAccess === 'denied') return 'blocked';
    if (nextAccess === 'prompt') return 'dismissed';
    return 'no-helper';
  }, []);

  // O usuário diz que não tem o helper: para de oferecer o botão de permissão.
  const forgetHint = useCallback(() => {
    writeHelperHint(false);
    setHint(false);
  }, []);

  return { status, helper, source, access, hint, open, stop, refresh, requestAccess, forgetHint };
}
