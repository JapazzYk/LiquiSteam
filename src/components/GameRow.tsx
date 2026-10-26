import { useState } from 'react';
import { ChevronRight, Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';

interface GameRowProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame) => void;
}

// Linha do layout de lista: imagem horizontal da loja, nome e tamanho.
export default function GameRow({ game, onOpen }: GameRowProps) {
  const artwork = uniqueUrls([
    game.header_image,
    ...gameArtworkUrls(game.appid).filter((url) => url.endsWith('/header.jpg')),
  ]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const src = artwork[artworkIndex];

  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      className="theme-glass group flex w-full items-center gap-4 rounded-2xl border border-white/10 p-2 pr-4 text-left backdrop-blur-xl transition-colors hover:border-[rgba(var(--accent-rgb),0.5)]"
    >
      <div className="relative aspect-[460/215] w-[112px] shrink-0 overflow-hidden rounded-xl bg-surface sm:w-[148px]">
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
