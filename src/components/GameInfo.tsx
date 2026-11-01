import { Clock, HardDrive, History } from 'lucide-react';
import type { ReactNode } from 'react';
import type { InstalledGame } from '@/types';
import type { PlaytimeEntry } from '@/lib/steamMeta';
import { formatHours } from '@/lib/facts';
import { formatAgo, formatAgoShort, formatSize } from '@/lib/format';
import { customLastLaunch } from '@/lib/customGames';

type Dot = 'live' | 'recent' | 'off';

interface Item {
  key: string;
  text: string;
  title: string;
  icon?: ReactNode;
  dot?: Dot;
}

const RECENT_SECONDS = 14 * 24 * 60 * 60;

// Linha de informações de um jogo: estado, tempo de jogo, última sessão e tamanho.
// Texto simples numa linha só (sem caixinhas): no cartão cabem até 3 itens; na lista, todos.
export function gameInfoItems(game: InstalledGame, entry: PlaytimeEntry | undefined, running: boolean): Item[] {
  const items: Item[] = [];
  if (running) items.push({ key: 'live', text: 'Em execução', title: 'O jogo está aberto agora', dot: 'live' });
  else if (game.notInstalled) items.push({ key: 'off', text: 'Não instalado', title: 'Está na sua conta, mas não neste computador', dot: 'off' });

  const minutes = entry?.forever ?? 0;
  if (minutes > 0) {
    items.push({ key: 'time', text: formatHours(minutes), title: `Tempo de jogo: ${formatHours(minutes)}`, icon: <Clock aria-hidden /> });
  }

  const lastMs = game.custom
    ? game.customId
      ? customLastLaunch(game.customId)
      : null
    : entry && entry.lastPlayed > 0
      ? entry.lastPlayed * 1000
      : null;
  if (lastMs !== null) {
    const recent = !running && Date.now() / 1000 - lastMs / 1000 < RECENT_SECONDS;
    items.push({
      key: 'last',
      text: formatAgoShort(lastMs),
      title: `${game.custom ? 'Última vez aberto pelo LiquiSteam' : 'Última sessão'}: ${formatAgo(lastMs)}`,
      icon: recent ? undefined : <History aria-hidden />,
      dot: recent ? 'recent' : undefined,
    });
  } else if (entry && minutes === 0 && !running) {
    items.push({ key: 'never', text: 'Nunca jogado', title: 'Você ainda não abriu este jogo' });
  }

  if (game.size_on_disk && game.size_on_disk > 0) {
    items.push({ key: 'size', text: formatSize(game.size_on_disk), title: `Espaço no disco: ${formatSize(game.size_on_disk)}`, icon: <HardDrive aria-hidden /> });
  }
  if (game.custom && items.length === 0) items.push({ key: 'custom', text: 'Fora da Steam', title: 'Jogo adicionado por você' });
  return items;
}

interface GameInfoProps {
  game: InstalledGame;
  entry?: PlaytimeEntry;
  running?: boolean;
  max?: number;
  className?: string;
}

export default function GameInfo({ game, entry, running = false, max, className = '' }: GameInfoProps) {
  const all = gameInfoItems(game, entry, running);
  // Um estado escrito por extenso ("Em execução", "Não instalado") ocupa espaço: aí cabem só 2 itens.
  const limit = max && (all[0]?.key === 'live' || all[0]?.key === 'off') ? Math.min(max, 2) : max;
  const items = limit ? all.slice(0, limit) : all;
  if (items.length === 0) return null;
  return (
    <p className={`ginfo ${className}`} title={all.map((item) => item.title).join(' · ')}>
      {items.map((item) => (
        <span key={item.key} className="ginfo-item" data-k={item.key}>
          {item.dot && <i className="ginfo-dot" data-dot={item.dot} aria-hidden />}
          {item.icon}
          {item.text}
        </span>
      ))}
    </p>
  );
}
