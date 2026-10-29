import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { placeholderHue } from '@/lib/customGames';
import { artBackdrop, useArtFit } from '@/lib/artFit';

interface GameCardProps {
  game: InstalledGame;
  // Posição na lista; o Arcade e o Grafite mostram como número e a entrada em cascata usa.
  index: number;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
}

// Qual imagem de cada jogo funcionou: quando o cartão é recriado (busca, troca de layout), não repete as tentativas.
const artworkIndexCache = new Map<number, number>();

// A aparência do cartão (moldura, capa, legenda, movimento) vem do tema ativo,
// em src/index.css. Aqui fica só a estrutura.
export default function GameCard({ game, index, onOpen }: GameCardProps) {
  // Jogo de fora da Steam: só a capa escolhida; nada é pedido à Steam.
  const artwork = game.custom
    ? uniqueUrls([game.library_image])
    : uniqueUrls([game.library_image, ...gameArtworkUrls(game.appid), game.header_image]);
  const [artworkIndex, setArtworkIndex] = useState(() => artworkIndexCache.get(game.appid) ?? 0);
  const artRef = useRef<HTMLDivElement>(null);
  const cover = artwork[artworkIndex];
  // Capa vertical 2:3 preenche a moldura; qualquer outra proporção aparece inteira, sem corte.
  const { fit, onLoad } = useArtFit(2 / 3, 0.08, `card-${game.appid}-${artworkIndex}`);

  return (
    <div className="game-card-wrap" style={{ '--i': index } as CSSProperties}>
      <button type="button" className="game-card" onClick={() => onOpen(game, readOrigin(artRef.current))}>
        <span className="game-card-frame" aria-hidden />

        <div
          ref={artRef}
          className="game-card-art"
          data-fit={fit}
          style={artBackdrop(cover) as CSSProperties}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              onLoad={onLoad}
              onError={() => {
                artworkIndexCache.set(game.appid, artworkIndex + 1);
                setArtworkIndex((current) => current + 1);
              }}
            />
          ) : (
            <div
              className="game-card-empty"
              style={
                game.custom
                  ? {
                      background: `linear-gradient(145deg, hsl(${placeholderHue(game.name)} 55% 34%), hsl(${(placeholderHue(game.name) + 40) % 360} 60% 16%))`,
                    }
                  : undefined
              }
            >
              {game.custom ? (
                <span className="custom-initial" aria-hidden>
                  {game.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
              ) : (
                <Gamepad2 className="h-12 w-12" />
              )}
            </div>
          )}
          <div className="game-card-shade" />
          <span className="game-card-rank" aria-hidden>
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="game-card-badge" aria-hidden>
            <span className="badge-default">Ver detalhes</span>
            <span className="badge-alt">Press start</span>
          </span>
        </div>

        <div className="game-card-meta">
          <h3 className="game-card-title">{game.name}</h3>
          {game.size_on_disk && game.size_on_disk > 0 ? (
            <p className="game-card-size">{formatSize(game.size_on_disk)} instalado</p>
          ) : null}
        </div>

        <span className="game-card-sheen" aria-hidden />
      </button>
    </div>
  );
}
