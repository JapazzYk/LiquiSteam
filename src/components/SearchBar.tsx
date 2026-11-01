import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

// Barra de busca: ao focar, sobe e ganha um halo e uma linha que se abre do centro; a lupa balança enquanto
// você digita; o botão de limpar entra e sai com um pulo. Tudo volta ao normal com uma mola, sem corte seco.
export default function SearchBar({ value, onChange }: SearchBarProps) {
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    },
    []
  );

  const handleChange = (next: string) => {
    onChange(next);
    setTyping(true);
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 420);
  };

  return (
    <div
      className="search-shell search-bar relative flex h-11 w-full items-center rounded-full border border-white/15 bg-white/[0.07] pl-4 pr-2 backdrop-blur-2xl focus-within:border-[rgba(var(--accent-rgb),0.55)] focus-within:bg-white/[0.10] md:h-12 md:pl-5"
      data-typing={typing ? '' : undefined}
      data-filled={value ? '' : undefined}
    >
      <Search className="search-icon mr-3 h-4 w-4 shrink-0 text-white/50" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Buscar um jogo pelo nome"
        aria-label="Buscar jogos"
        className="h-full w-full bg-transparent text-[15px] tracking-tight text-white placeholder:text-white/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        onClick={() => onChange('')}
        data-show={value ? '' : undefined}
        tabIndex={value ? 0 : -1}
        aria-hidden={!value}
        className="search-clear ml-2 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
        aria-label="Limpar busca"
      >
        <X className="h-4 w-4" />
      </button>
      <span aria-hidden className="search-line" />
    </div>
  );
}
