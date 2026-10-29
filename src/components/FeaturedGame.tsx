import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Shuffle } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { formatSize, uniqueUrls } from '@/lib/format';
import { formatHours } from '@/lib/facts';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { artBackdrop, useArtFit } from '@/lib/artFit';
import { fetchGameDetails, type GameDetails } from '@/lib/steamMeta';

interface FeaturedGameProps {
  game: InstalledGame;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
  onShuffle: () => void; // sorteia outro jogo
  playtimeMinutes?: number;
}

// Banner do layout "Destaque". O jogo é sorteado a cada visita (e a qualquer hora pelo botão), com a arte
// larga da biblioteca da Steam (library_hero) e, quando há, descrição e gêneros da loja.
// A moldura de cada tema está em src/index.css (.featured-banner).
export default function FeaturedGame({ game, onOpen, onShuffle, playtimeMinutes }: FeaturedGameProps) {
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

  const [details, setDetails] = useState<GameDetails | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    if (!game.custom) {
      void fetchGameDetails(game.appid).then((d) => {
        if (!cancelled) setDetails(d);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [game.appid, game.custom]);

  const facts: string[] = [];
  if (game.size_on_disk && game.size_on_disk > 0) facts.push(`${formatSize(game.size_on_disk)} instalado`);
  if (playtimeMinutes && playtimeMinutes > 0) facts.push(`${formatHours(playtimeMinutes)} jogadas`);
  else if (playtimeMinutes === 0) facts.push('nunca jogado');
  if (details?.genres.length) facts.push(details.genres.slice(0, 3).join(' · '));

  return (
    <section ref={sectionRef} aria-label="Jogo em destaque" className="featured-banner">
      <div
        className="featured-stage relative h-[300px] sm:h-[340px] md:h-[400px]"
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
            Em destaque agora
          </p>
          <h2
            className="hero-title detail-rise text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl"
            style={{ '--d': '220ms' } as CSSProperties}
          >
            {game.name}
          </h2>
          {details?.shortDescription && (
            <p
              className="detail-rise mt-3 max-w-md text-sm leading-relaxed text-white/70"
              style={
                {
                  '--d': '280ms',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                } as CSSProperties
              }
            >
              {details.shortDescription}
            </p>
          )}
          {facts.length > 0 && (
            <p className="detail-rise mt-3 text-sm text-white/55" style={{ '--d': '320ms' } as CSSProperties}>
              {facts.join('  ·  ')}
            </p>
          )}
          <div className="detail-rise mt-6 flex flex-wrap items-center gap-3" style={{ '--d': '380ms' } as CSSProperties}>
            <button
              type="button"
              onClick={() => onOpen(game, readOrigin(sectionRef.current))}
              className="inline-flex h-11 items-center rounded-full bg-[var(--accent-color)] px-6 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
            >
              Ver jogo
            </button>
            <button
              type="button"
              onClick={onShuffle}
              title="Sortear outro jogo"
              aria-label="Sortear outro jogo em destaque"
              className="reveal relative inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-5 text-sm text-white/85 backdrop-blur-xl transition hover:border-white/40 hover:text-white"
            >
              <Shuffle className="h-4 w-4" />
              Sortear outro
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
