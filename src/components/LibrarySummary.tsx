import { Clock, EyeOff, Flame, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LibraryStats } from '@/lib/facts';
import { formatHours } from '@/lib/facts';

// Resumo do tempo de jogo da biblioteca, com uma curiosidade em cada cartão.
export default function LibrarySummary({ stats }: { stats: LibraryStats }) {
  if (stats.total === 0 || stats.totalMinutes === 0) return null;
  const days = stats.totalMinutes / 60 / 24;
  const items: { icon: ReactNode; label: string; value: string; note: string }[] = [
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Tempo total',
      value: formatHours(stats.totalMinutes),
      note: days >= 1 ? `${days.toFixed(1).replace('.', ',')} dias seguidos de jogo` : 'em toda a biblioteca',
    },
  ];
  if (stats.top) {
    const share = Math.round((stats.top.minutes / stats.totalMinutes) * 100);
    items.push({
      icon: <Trophy className="h-4 w-4" />,
      label: 'Mais jogado',
      value: stats.top.game.name,
      note: `${formatHours(stats.top.minutes)} · ${share}% do seu tempo`,
    });
  }
  items.push({
    icon: <Flame className="h-4 w-4" />,
    label: 'Últimas 2 semanas',
    value: stats.twoWeeksMinutes > 0 ? formatHours(stats.twoWeeksMinutes) : 'Nenhum',
    note: stats.twoWeeksMinutes > 0 ? 'jogados recentemente' : 'nada jogado ultimamente',
  });
  items.push({
    icon: <EyeOff className="h-4 w-4" />,
    label: 'Nunca jogados',
    value: `${stats.neverPlayed} de ${stats.total}`,
    note: stats.neverPlayed === 0 ? 'você abriu todos' : `${Math.round((stats.neverPlayed / stats.total) * 100)}% da biblioteca`,
  });

  return (
    <div className="fx-stack mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="reveal theme-glass relative min-w-0 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-4 backdrop-blur-xl"
        >
          <div className="mb-1.5 flex items-center gap-2 text-white/50">
            {item.icon}
            <span className="text-[11px] font-medium">{item.label}</span>
          </div>
          <p className="truncate text-lg font-semibold tracking-tight text-white">{item.value}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/45">{item.note}</p>
        </div>
      ))}
    </div>
  );
}
