import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';

interface GameCardProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame) => void;
}

export default function GameCard({ game, onOpen }: GameCardProps) {
  const artwork = uniqueUrls([game.library_image, ...gameArtworkUrls(game.appid), game.header_image]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const cover = artwork[artworkIndex];

  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      className="group relative flex flex-col overflow-hidden rounded-[18px] text-left"
      style={{ aspectRatio: '4 / 5' }}
    >
      <div className="theme-glass absolute inset-0 rounded-[18px] border border-white/15 backdrop-blur-2xl transition-colors duration-300 group-hover:border-[rgba(var(--accent-rgb),0.55)]" />

      <div className="relative m-2 flex-1 overflow-hidden rounded-[13px] bg-surface">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface to-canvas">
            <Gamepad2 className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

        <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-snow opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          Ver detalhes
        </span>
      </div>

      <div className="relative px-4 pb-4 pt-1">
        <h3 className="line-clamp-2 text-[14px] font-medium leading-tight tracking-tight text-white">
          {game.name}
        </h3>
        {game.size_on_disk && game.size_on_disk > 0 ? (
          <p className="mt-1 text-[11px] text-white/55">{formatSize(game.size_on_disk)} instalado</p>
        ) : null}
      </div>

      <div className="card-sheen pointer-events-none absolute left-3 right-3 top-3 h-1/3 rounded-[20px] bg-gradient-to-b from-snow/15 to-transparent opacity-60" />
    </button>
  );
}
