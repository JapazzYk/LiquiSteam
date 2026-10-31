import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, EyeOff } from 'lucide-react';
import { defaultDir, type SortKey, type SortState } from '@/lib/sort';

interface LibraryToolbarProps {
  sort: SortState;
  onChange: (sort: SortState) => void;
  count: number;
  hasSizes: boolean; // algum jogo tem o tamanho conhecido
  hasPlaytime: boolean; // tempo de jogo da Steam disponível
}

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'A–Z' },
  { key: 'size', label: 'Tamanho' },
  { key: 'playtime', label: 'Mais jogados' },
  { key: 'recent', label: 'Recentes' },
];

// Ordenação e filtro da biblioteca. Tempo de jogo e "recentes" vêm da Steam (precisam de login e chave).
export default function LibraryToolbar({ sort, onChange, count, hasSizes, hasPlaytime }: LibraryToolbarProps) {
  const enabled = (key: SortKey) => (key === 'size' ? hasSizes : key === 'playtime' || key === 'recent' ? hasPlaytime : true);
  const DirIcon =
    sort.key === 'name' ? (sort.dir === 'asc' ? ArrowDownAZ : ArrowUpAZ) : sort.dir === 'desc' ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  const dirLabel =
    sort.key === 'name'
      ? sort.dir === 'asc'
        ? 'A a Z'
        : 'Z a A'
      : sort.dir === 'desc'
        ? 'Maior primeiro'
        : 'Menor primeiro';

  return (
    <div className="fx-soft mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-xs text-white/45">Ordenar por</span>
      <div role="group" aria-label="Ordenar biblioteca" className="layout-switch reveal relative flex h-10 flex-wrap items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] p-1">
        {OPTIONS.map((option) => {
          const active = sort.key === option.key;
          const ok = enabled(option.key);
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              disabled={!ok}
              title={
                ok
                  ? option.label
                  : option.key === 'size'
                    ? 'Ainda não sabemos o tamanho dos jogos. Escolha as pastas da Steam na tela de conta ou instale o Helper'
                    : 'Para ordenar por tempo de jogo, entre com a Steam e salve a sua chave na tela de conta'
              }
              onClick={() => onChange({ ...sort, key: option.key, dir: active ? sort.dir : defaultDir(option.key) })}
              className={`h-8 rounded-full px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active ? 'theme-accent-surface text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
        title={`Clique para inverter a ordem (agora: ${dirLabel})`}
        aria-label={`Inverter a ordem (agora: ${dirLabel})`}
        className="reveal relative flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 text-xs text-white/75 transition-all hover:border-white/30 hover:text-white"
      >
        <DirIcon className="h-4 w-4" />
        {dirLabel}
      </button>
      {hasPlaytime && (
        <button
          type="button"
          aria-pressed={sort.onlyUnplayed}
          onClick={() => onChange({ ...sort, onlyUnplayed: !sort.onlyUnplayed })}
          title="Mostrar só os jogos que você nunca abriu"
          className={`reveal relative flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs transition-all ${
            sort.onlyUnplayed
              ? 'theme-accent-border theme-accent-surface text-white'
              : 'border-white/15 bg-white/[0.06] text-white/75 hover:border-white/30 hover:text-white'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          Nunca jogados
        </button>
      )}
      <span className="ml-auto text-xs tabular-nums text-white/40">
        {count} {count === 1 ? 'jogo' : 'jogos'}
      </span>
    </div>
  );
}
