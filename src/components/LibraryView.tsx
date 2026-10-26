import type { InstalledGame } from '@/types';
import type { LayoutId } from '@/lib/theme';
import GameCard from '@/components/GameCard';
import GameRow from '@/components/GameRow';
import FeaturedGame from '@/components/FeaturedGame';

interface LibraryViewProps {
  games: InstalledGame[];
  layout: LayoutId;
  loading: boolean;
  onOpen: (game: InstalledGame) => void;
}

const gridClass = 'grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export default function LibraryView({ games, layout, loading, onOpen }: LibraryViewProps) {
  if (loading && games.length === 0) return <LibrarySkeleton layout={layout} />;

  if (layout === 'list') {
    return (
      <ul className="grid gap-2">
        {games.map((game) => (
          <li key={game.appid}>
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
          <div className={gridClass}>
            {rest.map((game) => (
              <GameCard key={game.appid} game={game} onOpen={onOpen} />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className={gridClass}>
      {games.map((game) => (
        <GameCard key={game.appid} game={game} onOpen={onOpen} />
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
          <div key={i} className="h-[70px] rounded-2xl bg-white/[0.05] motion-safe:animate-pulse sm:h-[86px]" />
        ))}
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Carregando jogos">
      {layout === 'featured' && (
        <div className="mb-8 h-[280px] rounded-[28px] bg-white/[0.05] motion-safe:animate-pulse sm:h-[330px] md:h-[390px]" />
      )}
      <div className={gridClass}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[18px] bg-white/[0.05] motion-safe:animate-pulse"
            style={{ aspectRatio: '4 / 5' }}
          />
        ))}
      </div>
    </div>
  );
}
