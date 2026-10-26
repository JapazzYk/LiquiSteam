import { useState } from 'react';
import { Gamepad2, Play } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';

interface GameCardProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame) => void;
}

export default function GameCard({ game, onOpen }: GameCardProps) {
  const artwork = [game.library_image, ...gameArtworkUrls(game.appid), game.header_image].filter(
    (url, index, urls) => url && urls.indexOf(url) === index
  );
  const [artworkIndex, setArtworkIndex] = useState(0);
  const cover = artwork[artworkIndex];

  return (
    <button
      onClick={() => onOpen(game)}
      className="group relative flex flex-col overflow-hidden rounded-[18px] text-left focus:outline-none"
      style={{ aspectRatio: '4 / 5' }}
    >
      <div className="theme-glass absolute inset-0 rounded-[18px] border border-white/15 backdrop-blur-2xl transition-all duration-300 group-hover:border-[rgba(var(--accent-rgb),0.55)] group-hover:bg-white/[0.09]" />

      <div className="relative m-2 flex-1 overflow-hidden rounded-[13px]">
        {cover ? (
          <img
            src={cover}
            alt={game.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#1b2838] to-[#0b1220]">
            <Gamepad2 className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-1 items-center justify-between opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/85 backdrop-blur-md">Abrir</span>
          <Play className="h-4 w-4 fill-current text-white drop-shadow-lg" />
        </div>
      </div>

      <div className="relative px-4 pb-4 pt-1">
        <div className="mb-2 h-px w-8 bg-[var(--accent-color)] opacity-70 transition-all duration-300 group-hover:w-14" />
        <h3 className="line-clamp-2 text-[14px] font-medium leading-tight tracking-tight text-white">
          {game.name}
        </h3>
        {game.size_on_disk && game.size_on_disk > 0 && (
          <p className="mt-1 text-[11px] font-light text-white/55">
            {formatSize(game.size_on_disk)} instalado
          </p>
        )}
      </div>

      {/* top sheen */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 h-1/3 rounded-[20px] bg-gradient-to-b from-white/15 to-transparent opacity-60" />
    </button>
  );
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}
