import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { InstalledGame } from '@/types';
import { formatSize, uniqueUrls } from '@/lib/format';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { artBackdrop, useArtFit } from '@/lib/artFit';

interface FeaturedGameProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
}

// Banner do layout "Destaque". Usa a arte larga da biblioteca da Steam
// (library_hero) e cai para a imagem da loja quando o jogo não tem essa arte.
// A moldura de cada tema está em src/index.css (.featured-banner).
export default function FeaturedGame({ game, onOpen }: FeaturedGameProps) {
  const artwork = game.custom
    ? uniqueUrls([game.library_image])
    : uniqueUrls([
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`,
        `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_hero.jpg`,
        game.header_image,
      ]);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const src = artwork[artworkIndex];
  // A arte larga (library_hero) preenche o banner; a imagem da loja, mais quadrada, aparece inteira.
  const { fit, onLoad } = useArtFit(1920 / 620, 0.25);

  return (
    <section ref={sectionRef} aria-label="Sugestão de hoje" className="featured-banner">
      <div
        className="featured-stage relative h-[280px] sm:h-[330px] md:h-[390px]"
        data-fit={fit}
        style={artBackdrop(src) as CSSProperties}
      >
        {src && (
          <img
            src={src}
            alt=""
            className="featured-art absolute inset-0 h-full w-full object-cover"
            onLoad={onLoad}
            onError={() => setArtworkIndex((index) => index + 1)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/70 to-canvas/0" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas/80 via-transparent to-transparent" />

        <div className="relative flex h-full max-w-xl flex-col justify-end p-6 md:p-10">
          <p className="detail-rise mb-2 text-sm text-white/60" style={{ '--d': '140ms' } as CSSProperties}>
            Sugestão de hoje
          </p>
          <h2
            className="hero-title detail-rise text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl"
            style={{ '--d': '220ms' } as CSSProperties}
          >
            {game.name}
          </h2>
          {game.size_on_disk && game.size_on_disk > 0 ? (
            <p className="detail-rise mt-3 text-sm text-white/55" style={{ '--d': '300ms' } as CSSProperties}>
              {formatSize(game.size_on_disk)} instalado
            </p>
          ) : null}
          <div className="detail-rise mt-6" style={{ '--d': '380ms' } as CSSProperties}>
            <button
              type="button"
              onClick={() => onOpen(game, readOrigin(sectionRef.current))}
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
