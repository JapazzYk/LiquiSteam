import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex h-12 w-full items-center rounded-full border border-white/15 bg-white/[0.07] pl-5 pr-3 backdrop-blur-2xl transition-all duration-300 focus-within:border-white/30 focus-within:bg-white/[0.10] focus-within:shadow-[inset_0_0_30px_4px_rgba(56,189,248,0.30)]">
      <Search className="mr-3 h-4 w-4 shrink-0 text-white/50" strokeWidth={2} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your library…"
        className="h-full w-full bg-transparent text-[15px] font-light tracking-tight text-white placeholder:text-white/40 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
