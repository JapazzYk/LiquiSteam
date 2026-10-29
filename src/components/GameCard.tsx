import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { formatSize, uniqueUrls } from '@/lib/format';
import { formatHours } from '@/lib/facts';
import { fetchGameDetails, previewVideoUrl } from '@/lib/steamMeta';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { placeholderHue } from '@/lib/customGames';
import { artBackdrop, useArtFit } from '@/lib/artFit';

interface GameCardProps {
  game: InstalledGame;
  // Posição na lista; o Arcade e o Grafite mostram como número e a entrada em cascata usa.
  index: number;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
  // Minutos jogados (Steam); undefined = não sei.
  playtimeMinutes?: number;
  // Passar o mouse toca uma prévia do trailer.
  trailerPreview?: boolean;
}

// Qual imagem de cada jogo funcionou: quando o cartão é recriado (busca, troca de layout), não repete as tentativas.
const artworkIndexCache = new Map<number, number>();

// A aparência do cartão (moldura, capa, legenda, movimento) vem do tema ativo,
// em src/index.css. Aqui fica só a estrutura.
export default function GameCard({ game, index, onOpen, playtimeMinutes, trailerPreview = false }: GameCardProps) {
  // Jogo de fora da Steam: só a capa escolhida; nada é pedido à Steam.
  const artwork = game.custom
    ? uniqueUrls([game.library_image])
    : uniqueUrls([game.library_image, ...gameArtworkUrls(game.appid), game.header_image]);
  const [artworkIndex, setArtworkIndex] = useState(() => artworkIndexCache.get(game.appid) ?? 0);
  const artRef = useRef<HTMLDivElement>(null);
  const cover = artwork[artworkIndex];
  const [video, setVideo] = useState<{ url: string; ready: boolean } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  // Prévia do trailer: só com mouse, depois de uma pausa, e uma vez por jogo (os detalhes ficam em cache).
  const startPreview = (event: PointerEvent<HTMLButtonElement>) => {
    if (!trailerPreview || game.custom || event.pointerType !== 'mouse') return;
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      void fetchGameDetails(game.appid).then((details) => {
        const url = previewVideoUrl(details?.movies[0]);
        if (url && hoverTimer.current !== null) setVideo({ url, ready: false });
      });
    }, 650);
  };
  const stopPreview = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setVideo(null);
  };
  // Capa vertical 2:3 preenche a moldura; qualquer outra proporção aparece inteira, sem corte.
  const { fit, onLoad } = useArtFit(2 / 3, 0.08, `card-${game.appid}-${artworkIndex}`);

  return (
    <div className="game-card-wrap" style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className="game-card"
        onClick={() => onOpen(game, readOrigin(artRef.current))}
        onPointerEnter={startPreview}
        onPointerLeave={stopPreview}
      >
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
          {video && (
            <video
              className="game-card-video"
              data-ready={video.ready ? '' : undefined}
              src={video.url}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden
              onCanPlay={() => setVideo((current) => (current ? { ...current, ready: true } : current))}
              onError={() => setVideo(null)}
            />
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
          {(game.size_on_disk && game.size_on_disk > 0) || (playtimeMinutes ?? 0) > 0 ? (
            <p className="game-card-size">
              {game.size_on_disk && game.size_on_disk > 0
                ? playtimeMinutes && playtimeMinutes > 0
                  ? formatSize(game.size_on_disk)
                  : `${formatSize(game.size_on_disk)} instalado`
                : null}
              {game.size_on_disk && game.size_on_disk > 0 && playtimeMinutes && playtimeMinutes > 0 ? ' · ' : ''}
              {playtimeMinutes && playtimeMinutes > 0 ? `${formatHours(playtimeMinutes)} jogadas` : null}
            </p>
          ) : null}
        </div>

        <span className="game-card-sheen" aria-hidden />
      </button>
    </div>
  );
}
