import { Gamepad2 as SteamIcon, Loader2, CheckCircle2, Power } from 'lucide-react';
import type { SteamStatus } from '@/lib/useSteamStatus';
import { openSteamClient, stopSteamClient } from '@/lib/steamLaunch';

interface OpenSteamButtonProps {
  status: SteamStatus;
  onOpen: () => void;
  onToggle: () => void;
}

// Abre o cliente da Steam pelo protocolo steam://. Quando a Steam está aberta,
// o botão vira um indicador de status que também permite encerrá-la.
export default function OpenSteamButton({
  status,
  onOpen,
  onToggle,
}: OpenSteamButtonProps) {
  const handleClick = () => {
    if (status === 'running') {
      stopSteamClient();
      onToggle();
    } else {
      openSteamClient();
      onOpen();
    }
  };

  const running = status === 'running';
  const starting = status === 'starting';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-full border px-5 text-sm font-medium backdrop-blur-xl transition-all ${
        running
          ? 'border-ok/40 bg-ok/15 text-white hover:bg-ok/20'
          : 'border-white/15 bg-white/[0.07] text-white hover:border-[rgba(var(--accent-rgb),0.55)]'
      }`}
      title={running ? 'Encerrar a Steam' : 'Abrir a Steam'}
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
    </button>
  );
}
