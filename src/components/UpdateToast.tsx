import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

// When the service worker detects a new deploy, it activates and posts
// { type: 'SW_UPDATED' } to all clients. We surface a small toast that lets
// the user reload into the new version. This is what makes installed-PWA
// updates automatic without uninstalling/reinstalling.
export default function UpdateToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Na primeira visita (ou num endereço novo, como cada prévia da Vercel) o service worker
    // também "ativa" e avisa, mas não há versão antiga para trocar. Só vale como atualização
    // quando a página já abriu controlada por um service worker anterior.
    const hadController = !!navigator.serviceWorker.controller;
    const onMessage = (event: MessageEvent) => {
      if (hadController && event.data && event.data.type === 'SW_UPDATED') {
        setVisible(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // Also handle the case where a new SW is waiting to activate (older
    // browsers): prompt it and reload.
    const checkWaiting = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (hadController && reg?.waiting) {
        reg.waiting.postMessage('SKIP_WAITING');
        setVisible(true);
      }
    };
    checkWaiting();

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (!visible) return null;

  const reload = () => window.location.reload();

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[rgba(var(--accent-rgb),0.35)] bg-surface/95 px-5 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full theme-accent-surface">
          <RefreshCw className="h-4 w-4 theme-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-tight text-white">Nova versão disponível</p>
          <p className="text-xs font-light text-white/55">Recarregue para atualizar o app.</p>
        </div>
        <button
          onClick={reload}
          className="ml-1 flex h-8 items-center rounded-full bg-[var(--accent-color)] px-4 text-sm font-medium text-[color:var(--on-accent)] transition-colors hover:brightness-110"
        >
          Atualizar
        </button>
        <button
          onClick={() => setVisible(false)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
