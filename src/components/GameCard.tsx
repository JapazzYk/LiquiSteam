import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { InstalledGame } from '@/types';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import { uniqueUrls } from '@/lib/format';
import { fetchGameDetails, previewVideoUrl, type PlaytimeEntry } from '@/lib/steamMeta';
import { readOrigin, type OpenOrigin } from '@/lib/openOrigin';
import { placeholderHue } from '@/lib/customGames';
import { artBackdrop, useArtFit } from '@/lib/artFit';
import { DRAG_TYPE, useCollectionsUi } from '@/lib/collections';
import CollectionButtons from '@/components/CollectionButtons';
import GameChips from '@/components/GameChips';

interface GameCardProps {
  game: InstalledGame;
  // Posição na lista; o Arcade e o Grafite mostram como número e a entrada em cascata usa.
  index: number;
  onOpen: (game: InstalledGame, origin?: OpenOrigin) => void;
  // Tempo de jogo da Steam para este jogo (undefined = sem informação).
  entry?: PlaytimeEntry;
  // Maior tempo de jogo da biblioteca: a barra do cartão mostra quanto este jogo representa dele.
  maxMinutes?: number;
  // O jogo está aberto agora.
  running?: boolean;
  // Passar o mouse toca uma prévia do trailer.
  trailerPreview?: boolean;
}

// Qual imagem de cada jogo funcionou: quando o cartão é recriado (busca, troca de layout), não repete as tentativas.
const artworkIndexCache = new Map<number, number>();

// A aparência do cartão (moldura, capa, legenda, movimento) vem do tema ativo,
// em src/index.css. Aqui fica só a estrutura.
export default function GameCard({ game, index, onOpen, entry, maxMinutes = 0, running = false, trailerPreview = false }: GameCardProps) {
  // Jogo de fora da Steam: só a capa escolhida; nada é pedido à Steam.
  const artwork = game.custom
    ? uniqueUrls([game.library_image])
    : uniqueUrls([game.library_image, ...gameArtworkUrls(game.appid), game.header_image]);
  const [artworkIndex, setArtworkIndex] = useState(() => artworkIndexCache.get(game.appid) ?? 0);
  const artRef = useRef<HTMLDivElement>(null);
  const cover = artwork[artworkIndex];
  const [video, setVideo] = useState<{ url: string; ready: boolean } | null>(null);
  // Sem trailer, a prévia vira um carrossel com as imagens da loja.
  const [slides, setSlides] = useState<{ urls: string[]; index: number } | null>(null);
  const slideTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  // Gêneros do jogo: aparecem no lugar dos chips quando o mouse fica sobre o cartão.
  const [genres, setGenres] = useState<string[]>([]);
  const collectionsUi = useCollectionsUi();

  // Prévia do trailer: só com mouse, depois de uma pausa, e uma vez por jogo (os detalhes ficam em cache).
  const startPreview = (event: PointerEvent<HTMLButtonElement>) => {
    if (game.custom || event.pointerType !== 'mouse') return;
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      void fetchGameDetails(game.appid).then((details) => {
        if (hoverTimer.current === null) return;
        if (details?.genres.length) setGenres(details.genres.slice(0, 3));
        if (!trailerPreview) return;
        const url = previewVideoUrl(details?.movies[0]);
        if (url) {
          setVideo({ url, ready: false });
          return;
        }
        const urls = (details?.screenshots ?? []).slice(0, 6).map((shot) => shot.thumb || shot.full).filter(Boolean);
        if (urls.length < 2) return;
        urls.forEach((src) => {
          const image = new Image();
          image.src = src; // carrega antes, para a troca não piscar
        });
        setSlides({ urls, index: 0 });
        if (slideTimer.current !== null) window.clearInterval(slideTimer.current);
        slideTimer.current = window.setInterval(() => {
          setSlides((current) => (current ? { ...current, index: (current.index + 1) % current.urls.length } : current));
        }, 1400);
      });
    }, 500);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      if (slideTimer.current !== null) window.clearInterval(slideTimer.current);
    },
    []
  );
  const stopPreview = () => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (slideTimer.current !== null) window.clearInterval(slideTimer.current);
    slideTimer.current = null;
    setVideo(null);
    setSlides(null);
  };
  // Capa vertical 2:3 preenche a moldura; qualquer outra proporção aparece inteira, sem corte.
  const { fit, onLoad } = useArtFit(2 / 3, 0.08, `card-${game.appid}-${artworkIndex}`);

  return (
    <div
      className="game-card-wrap"
      style={{ '--i': index } as CSSProperties}
      draggable={!!collectionsUi?.enabled}
      onDragStart={(event) => {
        // Arrastar o cartão até um grupo (ou Favoritos) na faixa acima da biblioteca.
        event.dataTransfer.setData(DRAG_TYPE, String(game.appid));
        event.dataTransfer.setData('text/plain', game.name);
        event.dataTransfer.effectAllowed = 'copy';
        stopPreview();
      }}
    >
      <button
        type="button"
        className="game-card"
        data-not-installed={game.notInstalled ? '' : undefined}
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
          {slides && (
            <div className="game-card-slides" aria-hidden>
              {slides.urls.map((src, i) => (
                <img key={src} src={src} alt="" data-active={i === slides.index ? '' : undefined} />
              ))}
            </div>
          )}
          <div className="game-card-shade" />
          {(entry?.forever ?? 0) > 0 && maxMinutes > 0 && (
            <span
              className="game-card-bar"
              aria-hidden
              style={{ '--p': Math.min(1, Math.sqrt((entry?.forever ?? 0) / maxMinutes)) } as CSSProperties}
            />
          )}
          <CollectionButtons appid={game.appid} className="game-card-coll" />
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
          <div className="game-card-chipbox" data-genres={genres.length > 0 ? '' : undefined}>
            <div className="game-card-chips">
              <GameChips game={game} entry={entry} running={running} />
            </div>
            {genres.length > 0 && (
              <div className="game-card-genres" aria-hidden>
                {genres.map((genre) => (
                  <span key={genre} className="gchip gchip-genre">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="game-card-sheen" aria-hidden />
      </button>
    </div>
  );
}
