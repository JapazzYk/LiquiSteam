import type { CSSProperties } from 'react';
import type { InstalledGame } from '@/types';
import type { LayoutId } from '@/lib/theme';
import type { OpenOrigin } from '@/lib/openOrigin';
import GameCard from '@/components/GameCard';
import GameRow from '@/components/GameRow';
import FeaturedGame from '@/components/FeaturedGame';
import type { PlaytimeEntry } from '@/lib/steamMeta';

interface LibraryViewProps {
  games: InstalledGame[];
  layout: LayoutId;
  loading: boolean;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
  // Tempo de jogo da Steam (null = indisponível) e prévia de trailer ao passar o mouse.
  playtimes: Map<number, PlaytimeEntry> | null;
  trailerPreview: boolean;
  // Jogo em destaque: sorteado no App, para continuar o mesmo enquanto você busca e ordena.
  featuredId: number | null;
  onShuffleFeatured: () => void;
}

export default function LibraryView({
  games,
  layout,
  loading,
  onOpen,
  playtimes,
  trailerPreview,
  featuredId,
  onShuffleFeatured,
}: LibraryViewProps) {
  const minutesOf = (game: InstalledGame) => (playtimes && !game.custom ? playtimes.get(game.appid)?.forever ?? 0 : undefined);

  if (loading && games.length === 0) return <LibrarySkeleton layout={layout} />;

  if (layout === 'list') {
    return (
      <ul className="grid gap-2">
        {games.map((game, index) => (
          <li key={game.appid} className="game-row-wrap" style={{ '--i': index } as CSSProperties}>
            <GameRow game={game} onOpen={onOpen} playtimeMinutes={minutesOf(game)} />
          </li>
        ))}
      </ul>
    );
  }

  if (layout === 'featured' && games.length > 0) {
    const featured = games.find((game) => game.appid === featuredId) ?? games[0];
    const rest = games.filter((game) => game.appid !== featured.appid);
    return (
      <>
        <FeaturedGame
          key={featured.appid}
          game={featured}
          onOpen={onOpen}
          onShuffle={onShuffleFeatured}
          playtimeMinutes={minutesOf(featured)}
        />
        {rest.length > 0 && (
          <div className="library-grid">
            {rest.map((game, index) => (
              <GameCard
                key={game.appid}
                game={game}
                index={index}
                onOpen={onOpen}
                playtimeMinutes={minutesOf(game)}
                trailerPreview={trailerPreview}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="library-grid">
      {games.map((game, index) => (
        <GameCard
                key={game.appid}
                game={game}
                index={index}
                onOpen={onOpen}
                playtimeMinutes={minutesOf(game)}
                trailerPreview={trailerPreview}
              />
      ))}
    </div>
  );
}

function LibrarySkeleton({ layout }: { layout: LayoutId }) {
  if (layout === 'list') {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Carregando jogos">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="game-card-skeleton h-[70px] motion-safe:animate-pulse sm:h-[86px]" style={{ aspectRatio: 'auto' }} />
        ))}
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Carregando jogos">
      {layout === 'featured' && (
        <div className="game-card-skeleton mb-8 h-[280px] motion-safe:animate-pulse sm:h-[330px] md:h-[390px]" style={{ aspectRatio: 'auto' }} />
      )}
      <div className="library-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="game-card-skeleton-wrap">
            <div className="game-card-skeleton motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
