import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ChevronRight, Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';
import { formatHours } from '@/lib/facts';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { artBackdrop, useArtFit } from '@/lib/artFit';
import { placeholderHue } from '@/lib/customGames';

interface GameRowProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
  playtimeMinutes?: number;
}

// Linha do layout de lista: imagem horizontal da loja, nome e tamanho.
// A moldura de cada tema está em src/index.css (.game-row).
export default function GameRow({ game, onOpen, playtimeMinutes }: GameRowProps) {
  const artwork = game.custom
    ? uniqueUrls([game.header_image])
    : uniqueUrls([
        game.header_image,
        ...gameArtworkUrls(game.appid).filter((url) => url.endsWith('/header.jpg')),
      ]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  const src = artwork[artworkIndex];
  // A imagem da loja tem a proporção da moldura; a capa de um jogo próprio pode ter qualquer uma e aparece inteira.
  const { fit, onLoad } = useArtFit(460 / 215, 0.1, `row-${game.appid}-${artworkIndex}`);

  return (
    <button type="button" onClick={() => onOpen(game, readOrigin(artRef.current))} className="game-row group">
      <div
        ref={artRef}
        className="game-row-art aspect-[460/215] w-[112px] sm:w-[148px]"
        data-fit={fit}
        style={artBackdrop(src) as CSSProperties}
      >
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onLoad={onLoad}
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            style={
              game.custom
                ? {
                    background: `linear-gradient(145deg, hsl(${placeholderHue(game.name)} 55% 34%), hsl(${(placeholderHue(game.name) + 40) % 360} 60% 16%))`,
                  }
                : undefined
            }
          >
            {game.custom ? (
              <span className="text-lg font-bold text-white/85">{game.name.trim().charAt(0).toUpperCase() || '?'}</span>
            ) : (
              <Gamepad2 className="h-6 w-6 text-white/30" />
            )}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight text-white">{game.name}</p>
        {(game.size_on_disk && game.size_on_disk > 0) || (playtimeMinutes ?? 0) > 0 ? (
          <p className="mt-0.5 text-xs text-white/50">
            {game.size_on_disk && game.size_on_disk > 0 ? `${formatSize(game.size_on_disk)} instalado` : null}
            {game.size_on_disk && game.size_on_disk > 0 && playtimeMinutes && playtimeMinutes > 0 ? ' · ' : ''}
            {playtimeMinutes && playtimeMinutes > 0 ? `${formatHours(playtimeMinutes)} jogadas` : null}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-[color:var(--accent-color)]" />
    </button>
  );
}
