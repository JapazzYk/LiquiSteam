import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePresence } from '@/lib/motion';
import {
  onInstallPromptChange,
  triggerInstall,
  isStandalone,
  isInIframe,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa';

// Botão fixo no topo para instalar o LiquiSteam como app, em janela própria.
// Se o navegador oferece a instalação direta, o clique abre o diálogo dele.
// Caso contrário (Brave, Safari, Firefox...), mostra o caminho manual.
export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const helpPop = usePresence(help);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => onInstallPromptChange(setPrompt), []);

  useEffect(() => {
    const onInstalled = () => {
      setInstalled(true);
      setHelp(false);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  // Fecha a explicação ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!help) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setHelp(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelp(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [help]);

  if (installed) return null;

  const handleClick = async () => {
    // Dentro de uma moldura (preview embutido) o app não instala: abre a página inteira.
    if (isInIframe()) {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!prompt) {
      setHelp((open) => !open);
      return;
    }
    setBusy(true);
    const result = await triggerInstall();
    setBusy(false);
    if (result === 'accepted') setInstalled(true);
    if (result === 'unavailable') setHelp(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-expanded={help}
        title="Instalar o LiquiSteam como app"
        className="install-btn reveal relative flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium text-white backdrop-blur-xl transition-all disabled:opacity-60 md:px-4"
      >
        <Download className="theme-accent h-4 w-4" />
        <span className="hidden md:inline">{busy ? 'Instalando…' : 'Instalar app'}</span>
      </button>

      {helpPop.mounted && (
        <div
          role="dialog"
          aria-label="Como instalar o LiquiSteam"
          className={`${helpPop.closing ? 'fx-out' : 'fx-in'} install-pop absolute right-0 top-full z-40 mt-3 w-[min(320px,calc(100vw-32px))] rounded-2xl border p-4`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-white">Instalar o LiquiSteam</p>
            <button
              type="button"
              onClick={() => setHelp(false)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 grid gap-2.5 text-[13px] leading-relaxed text-white/65">
            <li>
              <span className="font-medium text-white">Computador (Chrome, Edge, Brave):</span> clique no
              ícone de instalar na barra de endereço, ou abra o menu do navegador e escolha{' '}
              <span className="font-medium text-white">Instalar LiquiSteam</span>.
            </li>
            <li>
              <span className="font-medium text-white">iPhone e iPad (Safari):</span> toque em Compartilhar
              e depois em <span className="font-medium text-white">Adicionar à Tela de Início</span>.
            </li>
          </ul>
          <p className="mt-3 text-xs text-white/45">
            O app abre em janela própria, sem a barra do navegador, e atualiza sozinho.
          </p>
        </div>
      )}
    </div>
  );
}
