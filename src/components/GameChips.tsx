import { Clock, HardDrive, History } from 'lucide-react';
import type { InstalledGame } from '@/types';
import type { PlaytimeEntry } from '@/lib/steamMeta';
import { formatHours } from '@/lib/facts';
import { formatAgoShort, formatSize } from '@/lib/format';
import { customLastLaunch } from '@/lib/customGames';

interface GameChipsProps {
  game: InstalledGame;
  entry?: PlaytimeEntry;
  running?: boolean;
}

// Estado do jogo (em execução, recente, nunca jogado, não instalado, avulso).
export function statusOf(game: InstalledGame, entry: PlaytimeEntry | undefined, running: boolean) {
  if (running) return { kind: 'live', label: 'Em execução' } as const;
  if (game.notInstalled) return { kind: 'off', label: 'Não instalado' } as const;
  if (game.custom) return { kind: 'neutral', label: 'Fora da Steam' } as const;
  if (entry && entry.twoWeeks > 0) return { kind: 'recent', label: 'Recente' } as const;
  if (entry && entry.forever === 0) return { kind: 'neutral', label: 'Nunca jogado' } as const;
  return null;
}

// Chips de informação de um jogo: estado, tempo de jogo, última sessão e tamanho. Usados no cartão e na linha da lista.
export default function GameChips({ game, entry, running = false }: GameChipsProps) {
  const status = statusOf(game, entry, running);
  const lastMs = game.custom
    ? game.customId
      ? customLastLaunch(game.customId)
      : null
    : entry && entry.lastPlayed > 0
      ? entry.lastPlayed * 1000
      : null;
  const minutes = entry?.forever ?? 0;
  const size = game.size_on_disk && game.size_on_disk > 0 ? game.size_on_disk : 0;

  return (
    <>
      {status && status.kind !== 'recent' && (
        <span className={`gchip gchip-${status.kind}`}>
          {status.kind === 'live' && <i className="gchip-dot" aria-hidden />}
          {status.label}
        </span>
      )}
      {minutes > 0 && (
        <span className="gchip" title="Tempo de jogo">
          <Clock aria-hidden />
          {formatHours(minutes)}
        </span>
      )}
      {lastMs !== null && (
        <span
          className={`gchip ${status?.kind === 'recent' ? 'gchip-recent' : ''}`}
          title={
            game.custom
              ? 'Última vez aberto pelo LiquiSteam'
              : status?.kind === 'recent'
                ? 'Última sessão (jogado nas últimas 2 semanas)'
                : 'Última sessão'
          }
        >
          {status?.kind === 'recent' ? <i className="gchip-dot" aria-hidden /> : <History aria-hidden />}
          {formatAgoShort(lastMs)}
        </span>
      )}
      {size > 0 && (
        <span className="gchip" title="Espaço no disco">
          <HardDrive aria-hidden />
          {formatSize(size)}
        </span>
      )}
    </>
  );
}
