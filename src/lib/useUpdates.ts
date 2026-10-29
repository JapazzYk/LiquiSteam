import { useCallback, useEffect, useRef, useState } from 'react';
import { helperUpdates } from '@/lib/steamHelper';
import { pendingUpdates, type PendingUpdate } from '@/lib/updates';

// Com a aba aberta confere com mais frequência; no resto basta de tempos em tempos (é só para o contador).
const POLL_VIEW_MS = 5000;
const POLL_IDLE_MS = 45000;

interface UseUpdatesOptions {
  helperOnline: boolean;
  active: boolean; // a aba Atualizações está aberta
}

// Lista os jogos com atualização pendente, lendo o que a Steam anotou no computador (via helper).
export function useUpdates({ helperOnline, active }: UseUpdatesOptions) {
  const [pending, setPending] = useState<PendingUpdate[]>([]);
  // null = ainda não sei; false = helper antigo, sem a função de atualizações.
  const [supported, setSupported] = useState<boolean | null>(null);

  const activeRef = useRef(active);
  activeRef.current = active;
  const tickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!helperOnline) {
      setSupported(null);
      setPending([]);
      return;
    }

    let stopped = false;
    let timer = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped || document.hidden) return;
      timer = window.setTimeout(tick, activeRef.current ? POLL_VIEW_MS : POLL_IDLE_MS);
    };

    const tick = async () => {
      const list = await helperUpdates();
      if (stopped) return;
      if (list === null) {
        setSupported(false);
      } else {
        setSupported(true);
        setPending(pendingUpdates(list));
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

  return { pending, pendingCount: pending.length, supported, refresh };
}

export type UpdatesState = ReturnType<typeof useUpdates>;
