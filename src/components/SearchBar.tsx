import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex h-11 w-full items-center rounded-full border border-white/15 bg-white/[0.07] pl-4 pr-2 backdrop-blur-2xl transition-all duration-300 focus-within:border-[rgba(var(--accent-rgb),0.55)] focus-within:bg-white/[0.10] md:h-12 md:pl-5">
      <Search className="mr-3 h-4 w-4 shrink-0 text-white/50" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar na biblioteca"
        aria-label="Buscar jogos"
        className="h-full w-full bg-transparent text-[15px] tracking-tight text-white placeholder:text-white/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
