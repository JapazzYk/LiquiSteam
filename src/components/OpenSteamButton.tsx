import { Gamepad2 as SteamIcon, Loader2, CheckCircle2, Power } from 'lucide-react';
import type { StatusSource, SteamStatus } from '@/lib/useSteamStatus';

interface OpenSteamButtonProps {
  status: SteamStatus;
  source: StatusSource;
  onOpen: () => void;
  onStop: () => void;
}

// Abre o cliente da Steam. Quando a Steam está aberta, o botão vira um indicador de
// status que também permite encerrá-la. Com o LiquiSteam Helper rodando, o status
// é lido do Windows (ponto verde); sem ele, é uma estimativa.
export default function OpenSteamButton({ status, source, onOpen, onStop }: OpenSteamButtonProps) {
  const running = status === 'running';
  const starting = status === 'starting';

  const handleClick = () => (running ? onStop() : onOpen());

  const title = running ? 'Encerrar a Steam' : 'Abrir a Steam';
  const hint =
    source === 'helper'
      ? 'Status lido direto do computador'
      : source === 'account'
        ? 'Status da sua conta na Steam (pode demorar alguns segundos; instale o LiquiSteam Helper para ficar exato)'
        : 'Status estimado (instale o LiquiSteam Helper para sincronizar)';
  const dot = source === 'helper' ? 'bg-ok' : source === 'account' ? 'bg-[rgb(var(--accent-rgb))]' : 'bg-white/25';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-full border px-5 text-sm font-medium backdrop-blur-xl transition-all ${
        running
          ? 'border-ok/40 bg-ok/15 text-white hover:bg-ok/20'
          : 'border-white/15 bg-white/[0.07] text-white hover:border-[rgba(var(--accent-rgb),0.55)]'
      }`}
      title={`${title}. ${hint}.`}
    >
      {starting ? (
        <Loader2 className="theme-accent h-4 w-4 animate-spin" />
      ) : running ? (
        <CheckCircle2 className="h-4 w-4 text-ok" />
      ) : (
        <SteamIcon className="theme-accent h-4 w-4" />
      )}
      <span className="tracking-tight">
        {starting ? 'Iniciando Steam…' : running ? 'Encerrar Steam' : 'Abrir Steam'}
      </span>
      {running && <Power className="ml-1 h-3.5 w-3.5 opacity-60" />}
      <span
        aria-hidden
        className={`absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full ${dot}`}
      />
    </button>
  );
}
