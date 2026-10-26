import { Gamepad2 as SteamIcon, Loader2, CheckCircle2, Power } from 'lucide-react';
import type { SteamStatus } from '@/lib/useSteamStatus';
import { openSteamClient, stopSteamClient } from '@/lib/steamLaunch';

interface OpenSteamButtonProps {
  status: SteamStatus;
  onOpen: () => void;
  onToggle: () => void;
}

// Shown prominently when the app opens. Clicking attempts to launch the Steam
// client via the steam:// protocol. Once Steam is "running", the button
// becomes a status pill the user can toggle off.
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
      onClick={handleClick}
      className={`group relative flex h-10 items-center gap-2.5 overflow-hidden rounded-full border px-5 text-sm font-medium backdrop-blur-xl transition-all ${
        running
          ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20'
          : 'border-[#2a475e]/60 bg-[#1b2838]/70 text-white hover:border-[#66c0f4]/60 hover:bg-[#22344a]/80'
      }`}
      title={running ? 'Encerrar a Steam' : 'Abrir a Steam'}
    >
      {starting ? (
        <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
      ) : running ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
      ) : (
        <SteamIcon className="h-4 w-4 text-sky-300" />
      )}
      <span className="tracking-tight">
        {starting ? 'Iniciando Steam…' : running ? 'Encerrar Steam' : 'Abrir Steam'}
      </span>
      {running && <Power className="ml-1 h-3.5 w-3.5 opacity-60" />}
    </button>
  );
}
