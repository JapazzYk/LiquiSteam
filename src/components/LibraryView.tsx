import type { CSSProperties } from 'react';
import type { InstalledGame } from '@/types';
import type { LayoutId } from '@/lib/theme';
import type { OpenOrigin } from '@/lib/openOrigin';
import GameCard from '@/components/GameCard';
import GameRow from '@/components/GameRow';
import FeaturedGame from '@/components/FeaturedGame';

interface LibraryViewProps {
  games: InstalledGame[];
  layout: LayoutId;
  loading: boolean;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
}

export default function LibraryView({ games, layout, loading, onOpen }: LibraryViewProps) {
  if (loading && games.length === 0) return <LibrarySkeleton layout={layout} />;

  if (layout === 'list') {
    return (
      <ul className="grid gap-2">
        {games.map((game, index) => (
          <li key={game.appid} className="game-row-wrap" style={{ '--i': index } as CSSProperties}>
            <GameRow game={game} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
  }

  if (layout === 'featured' && games.length > 0) {
    const featured = dailyPick(games);
    const rest = games.filter((game) => game.appid !== featured.appid);
    return (
      <>
        <FeaturedGame key={featured.appid} game={featured} onOpen={onOpen} />
        {rest.length > 0 && (
          <div className="library-grid">
            {rest.map((game, index) => (
              <GameCard key={game.appid} game={game} index={index} onOpen={onOpen} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="library-grid">
      {games.map((game, index) => (
        <GameCard key={game.appid} game={game} index={index} onOpen={onOpen} />
      ))}
    </div>
  );
}

// Escolhe um jogo diferente a cada dia, sempre o mesmo durante o dia.
function dailyPick(games: InstalledGame[]): InstalledGame {
  const day = Math.floor(Date.now() / 86_400_000);
  return games[day % games.length];
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
          <div key={i} className="game-card-skeleton motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
