import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MonitorDown, X } from 'lucide-react';

// Ajuda para instalar o LiquiSteam Helper (Windows). Aparece ao lado do botão da Steam
// enquanto o helper não está rodando. O comando baixa o instalador do próprio site.
function installCommand(): string {
  const base = `${window.location.origin}/helper`;
  return (
    `$r = Invoke-WebRequest -UseBasicParsing '${base}/instalar.ps1'; ` +
    `$t = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { $r.Content }; ` +
    `& ([scriptblock]::Create($t)) -Base '${base}'`
  );
}

export default function HelperInstall() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installCommand());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão para a área de transferência: o comando continua visível para copiar à mão.
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Helper opcional: sincronizar o status com a Steam"
        title="Helper opcional: deixa o status da Steam sempre exato"
        className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 text-sm text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
      >
        <MonitorDown className="h-4 w-4" />
        <span className="hidden whitespace-nowrap xl:inline">
          Helper <span className="text-white/45">· opcional</span>
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Instalar o LiquiSteam Helper"
          className="install-pop absolute right-0 top-full z-40 mt-3 w-[min(380px,calc(100vw-32px))] rounded-2xl border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-white">
              Sincronizar com a Steam
              <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-white/55">
                Opcional
              </span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">
            Este botão é opcional e não faz parte do app. Ele aparece porque o LiquiSteam Helper não está
            rodando neste computador. Instale-o, uma vez só, para o status da Steam bater sempre e para o botão
            abrir e encerrar o cliente. Só para Windows, sem precisar de administrador.
          </p>
          <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[13px] leading-relaxed text-white/65">
            <li>Abra o PowerShell (tecla Windows, digite PowerShell).</li>
            <li>Clique em Copiar comando, cole lá e aperte Enter.</li>
            <li>Volte aqui: o ponto no botão da Steam fica verde.</li>
          </ol>
          <button
            type="button"
            onClick={copy}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Comando copiado' : 'Copiar comando'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            O helper só responde ao LiquiSteam e inicia junto com o Windows. Sem ele, o site ainda
            funciona, só que o status da Steam fica estimado.
          </p>
        </div>
      )}
    </div>
  );
}
