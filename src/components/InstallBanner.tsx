import { useEffect, useState } from 'react';
import { Download, X, FolderOpen, Monitor } from 'lucide-react';
import {
  onInstallPromptChange,
  triggerInstall,
  isStandalone,
  fileSystemAccessBlockedByIframe,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa';

// Two related but distinct problems this banner solves:
//  1) The app needs to be installable (PWA) to feel like a desktop launcher.
//  2) The File System Access API can't run inside an embedded preview iframe, so
//     "Select steamapps folder" silently fails there. Installing the app opens
//     it in its own window where the API works.
export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const off = onInstallPromptChange((e) => setPrompt(e));
    return off;
  }, []);

  const blockedByIframe = fileSystemAccessBlockedByIframe();
  const standalone = isStandalone();

  // Nothing to show: app is already installed and not in an iframe.
  if (standalone && !blockedByIframe) return null;
  if (dismissed) return null;

  // Only show when useful: we have a deferred install prompt OR we're in an
  // iframe (so the user needs to escape it regardless).
  if (!prompt && !blockedByIframe) return null;

  const handleInstall = async () => {
    setBusy(true);
    const result = await triggerInstall();
    setBusy(false);
    if (result === 'unavailable') {
      // Some browsers don't fire beforeinstallprompt (e.g. iOS Safari). Guide
      // the user to use the browser's built-in "Install / Add to Home Screen".
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto relative flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-sky-300/25 bg-[#0a0f1a]/85 px-5 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.08]">
          {blockedByIframe ? <FolderOpen className="h-5 w-5 text-sky-300" /> : <Download className="h-5 w-5 text-sky-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-white">
            {blockedByIframe
              ? 'Instale o app para acessar sua pasta da Steam'
              : 'Instale o Liquid Steam como app'}
          </p>
          <p className="mt-1 text-[13px] font-light leading-relaxed text-white/60">
            {blockedByIframe
              ? 'O preview embutido roda numa moldura (iframe) que bloqueia a seleção de pasta. Instale o app para abri-lo numa janela própria, onde a leitura dos seus jogos da Steam funciona.'
              : 'Abra o Liquid Steam na própria janela, fora do navegador, como um launcher de verdade.'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleInstall}
              disabled={busy}
              className="flex h-9 items-center gap-2 rounded-full bg-sky-400 px-5 text-sm font-medium text-[#04101f] transition-all hover:bg-sky-300 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy ? 'Instalando…' : 'Instalar app'}
            </button>
            {!prompt && blockedByIframe && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-light text-white/45">
                <Monitor className="h-3.5 w-3.5" />
                Ou abra em nova aba
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
