import { useState } from 'react';
import type { InstalledGame } from '@/types';
import { formatSize, uniqueUrls } from '@/lib/format';

interface FeaturedGameProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame) => void;
}

// Banner do layout "Destaque". Usa a arte larga da biblioteca da Steam
// (library_hero) e cai para a imagem da loja quando o jogo não tem essa arte.
export default function FeaturedGame({ game, onOpen }: FeaturedGameProps) {
  const artwork = uniqueUrls([
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`,
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_hero.jpg`,
    game.header_image,
  ]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const src = artwork[artworkIndex];

  return (
    <section
      aria-label="Sugestão de hoje"
      className="theme-glass relative mb-8 overflow-hidden rounded-[28px] border border-white/12"
    >
      <div className="relative h-[280px] sm:h-[330px] md:h-[390px]">
        {src && (
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-canvas/0" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent" />

        <div className="relative flex h-full max-w-xl flex-col justify-end p-6 md:p-10">
          <p className="mb-2 text-sm text-white/60">Sugestão de hoje</p>
          <h2 className="hero-title text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl">
            {game.name}
          </h2>
          {game.size_on_disk && game.size_on_disk > 0 ? (
            <p className="mt-3 text-sm text-white/55">{formatSize(game.size_on_disk)} instalado</p>
          ) : null}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => onOpen(game)}
              className="inline-flex h-11 items-center rounded-full bg-[var(--accent-color)] px-6 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
            >
              Ver jogo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
