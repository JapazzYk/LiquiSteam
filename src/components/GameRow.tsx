import { useRef, useState } from 'react';
import { ChevronRight, Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';

interface GameRowProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
}

// Linha do layout de lista: imagem horizontal da loja, nome e tamanho.
// A moldura de cada tema está em src/index.css (.game-row).
export default function GameRow({ game, onOpen }: GameRowProps) {
  const artwork = uniqueUrls([
    game.header_image,
    ...gameArtworkUrls(game.appid).filter((url) => url.endsWith('/header.jpg')),
  ]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  const src = artwork[artworkIndex];

  return (
    <button type="button" onClick={() => onOpen(game, readOrigin(artRef.current))} className="game-row group">
      <div
        ref={artRef}
        className="game-row-art aspect-[460/215] w-[112px] sm:w-[148px]"
      >
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Gamepad2 className="h-6 w-6 text-white/30" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight text-white">{game.name}</p>
        {game.size_on_disk && game.size_on_disk > 0 ? (
          <p className="mt-0.5 text-xs text-white/50">{formatSize(game.size_on_disk)} instalado</p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-[color:var(--accent-color)]" />
    </button>
  );
}
