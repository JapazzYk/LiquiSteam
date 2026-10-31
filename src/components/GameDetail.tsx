import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  X,
  Play,
  Lock,
  Trophy,
  Newspaper,
  HardDrive,
  Clock,
  StickyNote,
  Loader2,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Circle,
  Save,
  Gamepad2 as SteamIcon,
  Power,
  Sparkles,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { InstalledGame, SteamUser, GameNote, AchievementSummary, NewsItem } from '@/types';
import type { SteamStatus } from '@/lib/useSteamStatus';
import { launchGame } from '@/lib/steamLaunch';
import {
  fetchAchievements,
  fetchGameDetails,
  fetchNews,
  fetchPlaytime,
  detailsError,
  fullVideoUrl,
  hlsVideoUrl,
  type GameDetails,
  type PlaytimeEntry,
} from '@/lib/steamMeta';
import { gameFacts, playtimeFacts } from '@/lib/facts';
import { loadNote, saveNote } from '@/lib/notes';
import { gameArtworkUrls } from '@/lib/steamLibrary';
import type { OpenOrigin } from '@/lib/openOrigin';
import { artBackdrop, useArtFit } from '@/lib/artFit';

interface GameDetailProps {
  game: InstalledGame;
  // Capa de onde o detalhe nasce; sem ela, abre a partir do centro da tela.
  origin?: OpenOrigin | null;
  user: SteamUser | null;
  hasKey: boolean;
  steamStatus: SteamStatus;
  // Jogo em execução (0 = nenhum); null quando não dá para saber (sem helper, ou helper antigo).
  runningAppId: number | null;
  // Jogos de fora da Steam em execução (ids); null quando não dá para saber.
  // Tempo de jogo de toda a biblioteca (Steam) e a lista de jogos, para as curiosidades.
  playtimes: Map<number, PlaytimeEntry> | null;
  libraryGames: InstalledGame[];
  customRunning: string[] | null;
  onLaunchCustom: (id: string) => Promise<'ok' | 'missing-file' | 'no-process' | 'unsupported'>;
  onStopCustom: (id: string) => Promise<'ok' | 'missing-file' | 'no-process' | 'unsupported'>;
  onEditCustom: (game: InstalledGame) => void;
  onBoost: () => void; // depois de iniciar/encerrar: confere o estado com mais frequência
  onStopGame: (appid: number) => Promise<'ok' | 'no-process' | 'unsupported'>;
  onClose: () => void;
}

type Tab = 'overview' | 'media' | 'achievements' | 'news' | 'notes';

// Tempo e curva da abertura de cada tema. O fechamento é sempre um pouco mais rápido.
const OPEN_MOTION: Record<string, { duration: number; easing: string }> = {
  liquid: { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  steam: { duration: 380, easing: 'cubic-bezier(0.25, 0.9, 0.3, 1)' },
  paper: { duration: 480, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' },
  arcade: { duration: 420, easing: 'cubic-bezier(0.3, 1.3, 0.5, 1)' },
  graphite: { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
};
const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
// Margem extra no recorte final, para a sombra do painel não ser cortada.
const CLIP_PAD = 60;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Estilo de transição escolhido no painel de aparência. "theme" mantém a abertura própria de cada tema
// (o painel nasce da capa clicada); os outros estilos usam o mesmo movimento do resto do site.
type MotionStyle = 'theme' | 'rise' | 'slide' | 'zoom' | 'fade' | 'none';

function motionStyle(): MotionStyle {
  return (document.documentElement.dataset.motion as MotionStyle | undefined) ?? 'theme';
}

const STYLE_HIDDEN: Record<'rise' | 'slide' | 'zoom' | 'fade', Keyframe> = {
  rise: { opacity: 0, transform: 'translateY(24px)' },
  slide: { opacity: 0, transform: 'translateX(40px)' },
  zoom: { opacity: 0, transform: 'scale(0.94)' },
  fade: { opacity: 0 },
};
const STYLE_SHOWN: Keyframe = { opacity: 1, transform: 'none' };
const STYLE_EXIT: Record<'rise' | 'slide' | 'zoom' | 'fade', Keyframe> = {
  rise: { opacity: 0, transform: 'translateY(-14px)' },
  slide: { opacity: 0, transform: 'translateX(-28px)' },
  zoom: { opacity: 0, transform: 'scale(1.04)' },
  fade: { opacity: 0 },
};

function openMotion() {
  const skin = document.documentElement.dataset.skin ?? 'liquid';
  return OPEN_MOTION[skin] ?? OPEN_MOTION.liquid;
}

// Recorte que mostra só a região "rect" de dentro do painel "target".
function insetFor(rect: DOMRect, target: DOMRect, radius: number): string {
  const top = rect.top - target.top;
  const right = target.right - rect.right;
  const bottom = target.bottom - rect.bottom;
  const left = rect.left - target.left;
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

function startShape(origin: OpenOrigin | null | undefined, target: DOMRect): { rect: DOMRect; radius: number } {
  if (origin) return origin;
  const width = target.width * 0.4;
  const height = target.height * 0.4;
  const left = target.left + (target.width - width) / 2;
  const top = target.top + (target.height - height) / 2;
  return { rect: new DOMRect(left, top, width, height), radius: 24 };
}

const stagger = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export default function GameDetail({
  game,
  origin,
  user,
  hasKey,
  steamStatus,
  runningAppId,
  playtimes,
  libraryGames,
  customRunning,
  onLaunchCustom,
  onStopCustom,
  onEditCustom,
  onBoost,
  onStopGame,
  onClose,
}: GameDetailProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [achievements, setAchievements] = useState<AchievementSummary | null>(null);
  const [loadingAch, setLoadingAch] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [playtimeMinutes, setPlaytimeMinutes] = useState<number | null>(null);
  const [loadingPlaytime, setLoadingPlaytime] = useState(false);
  const [note, setNote] = useState<GameNote | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [artworkIndex, setArtworkIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const originRef = useRef(origin);
  originRef.current = origin;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // A faixa do topo é larga, então usa a arte horizontal (library_hero) e deixa a capa vertical por último.
  const headerArt = gameArtworkUrls(game.appid).filter((url) => url.endsWith('/header.jpg'));
  const artwork = (
    game.custom
      ? [game.library_image]
      : [
          `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`,
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_hero.jpg`,
          game.header_image,
          ...headerArt,
          game.library_image,
          ...gameArtworkUrls(game.appid),
        ]
  ).filter((url, index, urls) => url && urls.indexOf(url) === index);
  const artworkSource = artwork[artworkIndex];
  // Arte larga preenche a faixa; imagens de outra proporção aparecem inteiras, sem corte.
  const { fit: heroFit, onLoad: onHeroLoad } = useArtFit(1920 / 620, 0.4);

  const steamRunning = steamStatus === 'running' || steamStatus === 'starting';
  const storeUrl = `https://store.steampowered.com/app/${game.appid}`;

  // Load everything in parallel when the overlay opens.
  useEffect(() => {
    // Jogo de fora da Steam: não existe nada para pedir à Steam.
    if (game.custom) {
      setLoadingAch(false);
      setLoadingNews(false);
      return;
    }
    let cancelled = false;
    setLoadingAch(true);
    setLoadingNews(true);

    fetchAchievements(game.appid).then((a) => {
      if (cancelled) return;
      setAchievements(a);
      setLoadingAch(false);
    });
    fetchNews(game.appid).then((n) => {
      if (cancelled) return;
      setNews(n);
      setLoadingNews(false);
    });

    // Sync playtime from Steam if we have credentials.
    if (user && hasKey) {
      setLoadingPlaytime(true);
      fetchPlaytime(game.appid).then((p) => {
        if (cancelled) return;
        setPlaytimeMinutes(p?.playtime_forever ?? null);
        setLoadingPlaytime(false);
      });
    }

    if (user?.steamId) {
      loadNote(user.steamId, game.appid).then((n) => {
        if (cancelled) return;
        setNote(n);
        setNoteDraft(n?.content ?? '');
      });
    }

    return () => {
      cancelled = true;
    };
  }, [game.appid, game.name, game.custom, user?.steamId, hasKey]);

  // Detalhes da loja: descrição, curiosidades e trailers.
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  useEffect(() => {
    if (game.custom) return;
    let cancelled = false;
    setDetails(null);
    setLoadingDetails(true);
    void fetchGameDetails(game.appid).then((d) => {
      if (cancelled) return;
      setDetails(d);
      setLoadingDetails(false);
    });
    return () => {
      cancelled = true;
    };
  }, [game.appid, game.custom]);

  // Abertura: o painel se expande a partir da capa clicada e o fundo escurece.
  useLayoutEffect(() => {
    const panel = scrollRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop || prefersReducedMotion()) return;

    const style = motionStyle();
    if (style === 'none') return;
    if (style !== 'theme') {
      panel.animate([STYLE_HIDDEN[style], STYLE_SHOWN], {
        duration: 480,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'backwards',
      });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 340, easing: 'ease-out', fill: 'backwards' });
      return;
    }

    const motion = openMotion();
    const target = panel.getBoundingClientRect();
    const start = startShape(originRef.current, target);
    const finalRadius = (parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0) + CLIP_PAD;

    panel.animate(
      [
        { clipPath: insetFor(start.rect, target, start.radius) },
        { clipPath: `inset(-${CLIP_PAD}px round ${finalRadius}px)` },
      ],
      { duration: motion.duration, easing: motion.easing, fill: 'backwards' }
    );
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: motion.duration * 0.7,
      easing: 'ease-out',
      fill: 'backwards',
    });
  }, []);

  // Fechamento: faz o caminho inverso, encolhendo de volta para a capa, e só então desmonta.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const panel = scrollRef.current;
    const backdrop = backdropRef.current;
    const style = motionStyle();
    if (!panel || !backdrop || prefersReducedMotion() || style === 'none') {
      onCloseRef.current();
      return;
    }

    if (style !== 'theme') {
      const leaving = panel.animate([STYLE_SHOWN, STYLE_EXIT[style]], {
        duration: 240,
        easing: 'ease-in',
        fill: 'forwards',
      });
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
      leaving.finished.then(
        () => onCloseRef.current(),
        () => onCloseRef.current()
      );
      return;
    }

    const duration = Math.round(openMotion().duration * 0.65);
    const target = panel.getBoundingClientRect();
    const end = startShape(originRef.current, target);
    const startRadius = (parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0) + CLIP_PAD;

    const closing = panel.animate(
      [
        { clipPath: `inset(-${CLIP_PAD}px round ${startRadius}px)` },
        { clipPath: insetFor(end.rect, target, end.radius) },
      ],
      { duration, easing: CLOSE_EASING, fill: 'forwards' }
    );
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-in', fill: 'forwards' });
    closing.finished.then(
      () => onCloseRef.current(),
      () => onCloseRef.current()
    );
  }, []);

  // Esc fecha; a página de trás não rola enquanto o detalhe está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const handleSaveNote = async () => {
    if (!user?.steamId) return;
    setSavingNote(true);
    setNoteSaved(false);
    const saved = await saveNote(user.steamId, game.appid, game.name, noteDraft);
    setSavingNote(false);
    if (saved) {
      setNote(saved);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    }
  };

  // Estado do jogo, como no botão da Steam: executar, iniciando, em execução (encerrar) e encerrando.
  // Só com o helper (ele informa o jogo em execução); sem ele o botão só executa.
  const isCustom = !!game.custom;
  const gameAware = isCustom ? customRunning !== null : runningAppId !== null;
  const thisRunning = isCustom
    ? !!game.customId && !!customRunning?.includes(game.customId)
    : gameAware && runningAppId === game.appid;
  const otherRunning = !isCustom && gameAware && (runningAppId ?? 0) > 0 && runningAppId !== game.appid;
  // Jogo da Steam precisa da Steam aberta; jogo de fora só precisa do helper.
  const canRun = isCustom ? gameAware : steamRunning;
  const [gameBusy, setGameBusy] = useState<'launching' | 'stopping' | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  // O estado real chegou: o jogo abriu ou fechou.
  useEffect(() => {
    if (gameBusy === 'launching' && thisRunning) setGameBusy(null);
    if (gameBusy === 'stopping' && !thisRunning) setGameBusy(null);
  }, [gameBusy, thisRunning]);

  // Se o estado não mudar a tempo, volta ao normal.
  useEffect(() => {
    if (!gameBusy) return;
    const timer = window.setTimeout(() => setGameBusy(null), gameBusy === 'launching' ? 40000 : 15000);
    return () => window.clearTimeout(timer);
  }, [gameBusy]);

  // Encerrar pede uma segunda confirmação rápida: finalizar o jogo pode perder o que não foi salvo.
  useEffect(() => {
    if (!confirmStop) return;
    const timer = window.setTimeout(() => setConfirmStop(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmStop]);

  const handleRun = async () => {
    if (!canRun || gameBusy) return;
    setStopError(null);
    if (gameAware) setGameBusy('launching');
    if (isCustom && game.customId) {
      const result = await onLaunchCustom(game.customId);
      if (result !== 'ok') {
        setGameBusy(null);
        setStopError(
          result === 'missing-file'
            ? 'O arquivo deste jogo não está mais no lugar onde você o escolheu. Clique em Editar e escolha o programa (.exe) de novo.'
            : 'Não consegui abrir o jogo. O Helper pode estar desligado ou desatualizado: abra o botão "Helper" na biblioteca e atualize-o.'
        );
      }
      onBoost();
      return;
    }
    launchGame(game.appid);
    onBoost();
  };

  const handleStop = async () => {
    if (gameBusy) return;
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    setConfirmStop(false);
    setStopError(null);
    setGameBusy('stopping');
    const result =
      isCustom && game.customId ? await onStopCustom(game.customId) : await onStopGame(game.appid);
    if (result !== 'ok') {
      setGameBusy(null);
      setStopError(
        result === 'no-process' || result === 'missing-file'
          ? 'Não encontrei o jogo aberto para fechar. Feche-o pela janela do próprio jogo.'
          : 'Não consegui fechar o jogo. O Helper pode estar desatualizado: abra o botão "Helper" na biblioteca e atualize-o.'
      );
    }
  };

  const achPct =
    achievements && achievements.total > 0
      ? Math.round((achievements.achieved / achievements.total) * 100)
      : 0;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-canvas/[0.78] p-0 backdrop-blur-md md:p-5"
    >
      {/* Moldura da luz do cursor: o painel rola, então o brilho da borda fica numa camada parada por cima. */}
      <div className="relative flex h-full w-full max-w-6xl md:h-[calc(100vh-40px)]">
      {/* Fechar: fica fora da área que rola, então acompanha a página inteira. */}
      <button
        type="button"
        onClick={requestClose}
        className="absolute right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-snow/20 bg-black/55 text-snow shadow-lg backdrop-blur-xl transition-all hover:border-snow/40 hover:bg-black/70 md:right-6 md:top-5"
        aria-label="Fechar"
        title="Fechar (Esc)"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="detail-panel relative flex h-full w-full flex-col overflow-y-auto bg-surface/[0.94] shadow-2xl md:rounded-[32px] md:border md:border-white/12 md:backdrop-blur-2xl"
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-label={game.name}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero: full game art */}
        <div
          className="detail-hero relative h-[42vh] min-h-[300px] w-full shrink-0 overflow-hidden md:rounded-t-[32px]"
          data-fit={heroFit}
          style={artBackdrop(artworkSource) as CSSProperties}
        >
          {artworkSource ? (
            <img
              src={artworkSource}
              alt={game.name}
              className="h-full w-full object-cover"
              onLoad={onHeroLoad}
              onError={() => setArtworkIndex((index) => index + 1)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface to-canvas">
              <SteamIcon className="h-16 w-16 text-white/25" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/80 via-transparent to-transparent" />

          {/* Title + run */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 md:px-10 md:pb-8">
            <h2
              className="detail-rise mb-4 max-w-3xl text-3xl font-semibold tracking-[-0.03em] hero-title text-white md:text-5xl"
              style={stagger(180)}
            >
              {game.name}
            </h2>
            <div className="detail-rise flex flex-wrap items-center gap-3" style={stagger(260)}>
              {gameAware && thisRunning && gameBusy !== 'stopping' ? (
                <button
                  type="button"
                  onClick={handleStop}
                  title={confirmStop ? 'Clique de novo para encerrar' : 'Em execução. Clique para encerrar o jogo.'}
                  className="reveal group relative flex h-11 items-center gap-2.5 overflow-hidden rounded-full border border-ok/40 bg-ok/15 px-6 text-sm font-semibold text-white transition-all hover:bg-ok/20 active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-5 w-5 text-ok" />
                  <span className="tracking-tight">{confirmStop ? 'Confirmar encerramento' : 'Encerrar jogo'}</span>
                  <Power className="ml-1 h-4 w-4 opacity-60" />
                </button>
              ) : gameAware && gameBusy ? (
                <button
                  type="button"
                  disabled
                  className="relative flex h-11 cursor-wait items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold text-white/70"
                >
                  <Loader2 className="theme-accent h-4 w-4 animate-spin" />
                  {gameBusy === 'launching' ? 'Iniciando…' : 'Encerrando…'}
                </button>
              ) : otherRunning ? (
                <button
                  type="button"
                  disabled
                  title="Só dá para ter um jogo aberto por vez. Feche o outro jogo primeiro."
                  className="relative flex h-11 cursor-not-allowed items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-6 text-sm font-semibold text-white/40"
                >
                  <Lock className="h-4 w-4" />
                  Outro jogo em execução
                </button>
              ) : (
                <button
                  onClick={() => void handleRun()}
                  disabled={!canRun}
                  className={`reveal group relative flex h-11 items-center gap-2.5 overflow-hidden rounded-full px-6 text-sm font-semibold transition-all ${
                    canRun
                      ? 'bg-[var(--accent-color)] text-[color:var(--on-accent)] hover:brightness-110 active:scale-[0.98]'
                      : 'cursor-not-allowed border border-white/15 bg-white/[0.06] text-white/40'
                  }`}
                >
                  {canRun ? (
                    <>
                      <Play className="h-5 w-5 fill-current" />
                      Executar
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      {isCustom ? 'Precisa do Helper para executar' : 'Abra a Steam para executar'}
                    </>
                  )}
                </button>
              )}
              {!isCustom && (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="reveal relative flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-light text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Loja
              </a>
              )}
              {thisRunning && (
                <span className="flex items-center gap-2 text-xs font-medium text-ok">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok motion-safe:animate-pulse" />
                  Em execução
                </span>
              )}
              {stopError && (
                <p role="alert" className="basis-full text-xs text-bad">
                  {stopError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs + content */}
        <div className="mx-auto w-full flex-1 px-6 py-6 md:px-10 md:py-8">
          <div
            className="detail-rise mb-7 flex gap-5 overflow-x-auto border-b border-white/10 pb-px"
            style={stagger(340)}
          >
            <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<HardDrive className="h-4 w-4" />}>
              Visão geral
            </TabButton>
            {!isCustom && (
              <>
                <TabButton active={tab === 'media'} onClick={() => setTab('media')} icon={<Clapperboard className="h-4 w-4" />}>
                  Mídia
                </TabButton>
                <TabButton active={tab === 'achievements'} onClick={() => setTab('achievements')} icon={<Trophy className="h-4 w-4" />}>
                  Conquistas
                </TabButton>
                <TabButton active={tab === 'news'} onClick={() => setTab('news')} icon={<Newspaper className="h-4 w-4" />}>
                  Atualizações
                </TabButton>
                <TabButton active={tab === 'notes'} onClick={() => setTab('notes')} icon={<StickyNote className="h-4 w-4" />}>
                  Anotações
                </TabButton>
              </>
            )}
          </div>

          <div key={tab} className="fx-in">
          {tab === 'overview' && isCustom && <CustomOverview game={game} onEdit={() => onEditCustom(game)} />}
          {tab === 'overview' && !isCustom && (
            <OverviewTab
              game={game}
              achPct={achPct}
              achievements={achievements}
              playtimeMinutes={playtimeMinutes}
              loadingPlaytime={loadingPlaytime}
              hasSync={!!(user && hasKey)}
              details={details}
              playFacts={playtimes ? playtimeFacts(game, playtimes, libraryGames) : []}
              storeFacts={details ? gameFacts(details) : []}
            />
          )}
          {tab === 'achievements' && (
            <AchievementsTab loading={loadingAch} data={achievements} />
          )}
          {tab === 'media' && <MediaTab details={details} loading={loadingDetails} appid={game.appid} />}
          {tab === 'news' && <NewsTab loading={loadingNews} news={news} />}
          {tab === 'notes' && (
            <NotesTab
              draft={noteDraft}
              onChange={setNoteDraft}
              onSave={handleSaveNote}
              saving={savingNote}
              saved={noteSaved}
              hasUser={!!user}
              updatedAt={note?.updatedAt}
            />
          )}
          </div>
        </div>
      </div>
      <span aria-hidden className="reveal pointer-events-none absolute inset-0 md:rounded-[32px]" />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-10 shrink-0 items-center gap-2 px-1 text-sm font-medium tracking-tight transition-all after:absolute after:-bottom-[1px] after:left-0 after:right-0 after:h-0.5 after:rounded-full after:transition-all ${
        active ? 'text-white after:bg-[var(--accent-color)]' : 'text-white/45 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function CustomOverview({ game, onEdit }: { game: InstalledGame; onEdit: () => void }) {
  const added = game.added
    ? new Date(game.added).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<SteamIcon className="h-4 w-4" />} label="Origem" value="Fora da Steam" />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="Adicionado em" value={added} />
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="reveal relative flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm text-white/85 transition hover:border-white/30 hover:text-white"
      >
        <StickyNote className="h-4 w-4" />
        Editar jogo
      </button>
      <p className="text-xs leading-relaxed text-white/45">
        Jogos de fora da Steam não têm conquistas, notícias nem tempo de jogo da Steam.
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 text-white/50">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${accent ?? 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

function OverviewTab({
  game,
  achPct,
  achievements,
  playtimeMinutes,
  loadingPlaytime,
  hasSync,
  details,
  playFacts,
  storeFacts,
}: {
  game: InstalledGame;
  achPct: number;
  achievements: AchievementSummary | null;
  playtimeMinutes: number | null;
  loadingPlaytime: boolean;
  hasSync: boolean;
  details: GameDetails | null;
  playFacts: string[];
  storeFacts: string[];
}) {
  const size = game.size_on_disk ? formatSize(game.size_on_disk) : '—';
  const playtime =
    playtimeMinutes != null
      ? formatPlaytime(playtimeMinutes)
      : loadingPlaytime
        ? 'Sincronizando…'
        : '—';

  return (
    <div className="space-y-5">
      {details?.shortDescription && (
        <p className="max-w-3xl text-[15px] font-light leading-relaxed text-white/70">{details.shortDescription}</p>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Tamanho"
          value={size}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Tempo de jogo"
          value={playtime}
          accent={playtimeMinutes != null ? 'theme-accent' : 'text-white/60'}
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Conquistas"
          value={
            achievements?.hasPersonal
              ? `${achievements.achieved}/${achievements.total}`
              : achievements
                ? `${achievements.total} disponíveis`
                : '—'
          }
          accent={achievements?.hasPersonal ? 'theme-accent' : 'text-white/60'}
        />
        <StatCard
          icon={<SteamIcon className="h-4 w-4" />}
          label="App ID"
          value={String(game.appid)}
        />
      </div>

      {achievements && achievements.total > 0 && achievements.hasPersonal && (
        <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white/80">Progresso de conquistas</span>
            <span className="text-sm font-light text-white/55">{achPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--accent-color)] transition-all"
              style={{ width: `${achPct}%` }}
            />
          </div>
        </div>
      )}

      {!hasSync && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light leading-relaxed">
          Seu tempo de jogo e suas conquistas pessoais ainda não aparecem aqui. Para mostrá-los, entre com a Steam e
          cole a sua chave da Steam na tela de conta (é grátis e só permite leitura).
        </div>
      )}
      {hasSync && achievements && !achievements.hasPersonal && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light leading-relaxed">
          A Steam não liberou suas conquistas pessoais. Verifique se seu perfil e os detalhes dos jogos
          estão públicos nas configurações de privacidade da Steam.
        </div>
      )}

      {(playFacts.length > 0 || storeFacts.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {playFacts.length > 0 && <FactsCard title="Suas horas" icon={<Clock className="h-4 w-4" />} facts={playFacts} />}
          {storeFacts.length > 0 && (
            <FactsCard title="Curiosidades do jogo" icon={<Sparkles className="h-4 w-4" />} facts={storeFacts} />
          )}
        </div>
      )}

      <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
        <p className="text-sm font-light leading-relaxed text-white/60">
          Clique em <span className="font-medium text-white">Executar</span> para iniciar o jogo
          pela Steam. A Steam precisa estar aberta em segundo plano — use o botão
          <span className="font-medium text-white"> Abrir Steam</span> no topo do app.
        </p>
      </div>
    </div>
  );
}

function FactsCard({ title, icon, facts }: { title: string; icon: React.ReactNode; facts: string[] }) {
  return (
    <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-white/60">
        <span className="theme-accent">{icon}</span>
        <span className="text-sm font-medium text-white/85">{title}</span>
      </div>
      <ul className="grid gap-2">
        {facts.map((fact) => (
          <li key={fact} className="flex gap-2.5 text-sm font-light leading-relaxed text-white/65">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent-color)]" />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Mídia do jogo, como na loja da Steam: um visualizador grande (o trailer principal primeiro, depois as
// imagens) e uma faixa de miniaturas embaixo. Os arquivos tocam e aparecem do próprio servidor da Steam.
type MediaItem =
  | { type: 'video'; id: string; name: string; url: string; hls: boolean; poster: string }
  | { type: 'image'; id: string; thumb: string; full: string };

// hls.js é carregado só quando precisa (navegadores sem HLS nativo, como o Chrome), direto de um CDN.
interface HlsInstance {
  loadSource(url: string): void;
  attachMedia(video: HTMLVideoElement): void;
  on(event: string, callback: (event: unknown, data: { fatal?: boolean }) => void): void;
  destroy(): void;
}
interface HlsStatic {
  new (config?: object): HlsInstance;
  isSupported(): boolean;
  Events: { ERROR: string };
}

let hlsLoader: Promise<HlsStatic | null> | null = null;
function loadHls(): Promise<HlsStatic | null> {
  if (!hlsLoader) {
    const sources = ['https://esm.sh/hls.js@1', 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.mjs'];
    hlsLoader = (async () => {
      for (const source of sources) {
        try {
          const module = (await import(/* @vite-ignore */ source)) as { default?: HlsStatic };
          if (module.default) return module.default;
        } catch {
          // tenta o próximo
        }
      }
      return null;
    })();
  }
  return hlsLoader;
}

// Player do trailer. Arquivo direto toca na hora; streaming (HLS) usa o suporte do navegador ou o hls.js.
function StoreVideo({
  url,
  hls,
  poster,
  onFail,
}: {
  url: string;
  hls: boolean;
  poster: string;
  onFail: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // O aviso de falha muda a cada renderização; guardá-lo num ref evita recriar o player toda vez.
  const failRef = useRef(onFail);
  failRef.current = onFail;
  useEffect(() => {
    const video = ref.current;
    if (!video || !hls) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    let cancelled = false;
    let instance: HlsInstance | null = null;
    void loadHls().then((Hls) => {
      if (cancelled) return;
      if (!Hls || !Hls.isSupported()) {
        failRef.current();
        return;
      }
      instance = new Hls({ maxBufferLength: 20 });
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) failRef.current();
      });
      instance.loadSource(url);
      instance.attachMedia(video);
    });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [url, hls]);

  return (
    <video
      ref={ref}
      src={hls ? undefined : url}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full bg-black"
      onError={hls ? undefined : onFail}
    />
  );
}

function MediaTab({ details, loading, appid }: { details: GameDetails | null; loading: boolean; appid: number }) {
  const [index, setIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Carregando mídia…
      </div>
    );
  }
  const items: MediaItem[] = [
    ...(details?.movies ?? [])
      .map((movie): MediaItem => {
        // Hoje a Steam só entrega trailer por streaming (HLS); o arquivo direto só existe em jogos antigos.
        const file = fullVideoUrl(movie);
        return {
          type: 'video',
          id: `v${movie.id}`,
          name: movie.name || 'Trailer',
          url: file || hlsVideoUrl(movie),
          hls: !file,
          poster: movie.thumbnail,
        };
      })
      .filter((item) => item.type !== 'video' || item.url),
    ...(details?.screenshots ?? []).map(
      (shot): MediaItem => ({ type: 'image', id: `i${shot.id}`, thumb: shot.thumb, full: shot.full })
    ),
  ];
  if (items.length === 0) {
    const reason = detailsError(appid);
    const text = !reason
      ? 'A loja da Steam não tem trailers nem imagens para este jogo.'
      : /desconhecida|unknown/i.test(reason)
        ? 'O serviço que busca as imagens e vídeos do site está desatualizado. Avise o responsável pelo LiquiSteam.'
        : reason === 'not-in-store'
          ? 'Este jogo não está mais na loja da Steam, por isso não há imagens nem vídeos.'
          : reason.startsWith('store-')
            ? `A loja da Steam recusou o pedido (código ${reason.slice(6)}). Costuma ser excesso de pedidos: espere alguns minutos e tente de novo.`
            : `Não foi possível carregar as imagens e vídeos (${reason}). Tente de novo mais tarde.`;
    return <EmptyState icon={<Clapperboard className="h-8 w-8" />} title="Sem mídia" text={text} />;
  }

  const current = items[Math.min(index, items.length - 1)];
  const go = (next: number) => {
    setVideoFailed(false);
    setIndex((next + items.length) % items.length);
  };

  return (
    <div className="space-y-3">
      <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-black">
        {current.type === 'video' ? (
          videoFailed ? (
            <div className="grid aspect-video w-full place-items-center p-6 text-center text-sm text-white/60">
              <p>
                Não consegui tocar este vídeo aqui.{' '}
                <a
                  href={`https://store.steampowered.com/app/${appid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-white"
                >
                  Ver na loja da Steam
                </a>
              </p>
            </div>
          ) : (
            <StoreVideo
              key={current.id}
              url={current.url}
              hls={current.hls}
              poster={current.poster}
              onFail={() => setVideoFailed(true)}
            />
          )
        ) : (
          <img key={current.id} src={current.full} alt="" className="aspect-video w-full bg-black object-contain" />
        )}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Anterior"
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white/85 backdrop-blur-xl transition hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Próximo"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/50 text-white/85 backdrop-blur-xl transition hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-white/45">
        <span className="truncate">{current.type === 'video' ? current.name : 'Imagem do jogo'}</span>
        <span className="tabular-nums">
          {Math.min(index, items.length - 1) + 1} / {items.length}
        </span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {items.map((item, i) => {
          const active = i === Math.min(index, items.length - 1);
          const thumb = item.type === 'video' ? item.poster : item.thumb;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(i)}
              aria-label={item.type === 'video' ? `Vídeo: ${item.name}` : `Imagem ${i + 1}`}
              aria-pressed={active}
              className={`reveal relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg border transition-all ${
                active ? 'theme-accent-border' : 'border-white/10 opacity-65 hover:opacity-100'
              }`}
            >
              <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
              {item.type === 'video' && (
                <span className="absolute inset-0 grid place-items-center bg-black/25">
                  <Play className="h-5 w-5 fill-white text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AchievementsTab({
  loading,
  data,
}: {
  loading: boolean;
  data: AchievementSummary | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Carregando conquistas…
      </div>
    );
  }
  if (!data || data.total === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-8 w-8" />}
        title="Sem conquistas"
        text="Este jogo não tem conquistas, ou elas não puderam ser carregadas agora. Se o seu perfil da Steam estiver privado, as conquistas também não aparecem."
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-light text-white/55">
          {data.hasPersonal
            ? `${data.achieved} de ${data.total} desbloqueadas`
            : 'Progresso pessoal indisponível'}
        </span>
        {data.hasPersonal && (
          <span className="text-sm font-medium theme-accent">
            {Math.round((data.achieved / data.total) * 100)}%
          </span>
        )}
      </div>
      <div className="grid gap-2">
        {data.achievements
          .slice()
          .sort((a, b) => Number(b.achieved) - Number(a.achieved))
          .map((a) => (
            <div
              key={a.id}
              className={`flex items-center gap-4 rounded-2xl border p-3 backdrop-blur-xl transition-colors ${
                a.achieved
                  ? 'border-ok/25 bg-ok/[0.08]'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <AchievementImage
                  icon={a.icon}
                  iconGray={a.iconGray}
                  achieved={a.achieved}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${a.achieved ? 'text-white' : 'text-white/55'}`}>
                  {a.name}
                </p>
                {a.description && (
                  <p className="truncate text-xs font-light text-white/40">{a.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {a.achieved ? (
                  a.unlockTime ? (
                    <span className="text-xs font-light text-ok/80">
                      {new Date(a.unlockTime * 1000).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-ok" />
                  )
                ) : (
                  a.globalPercent != null && (
                    <span className="text-xs font-light text-white/40">
                      {a.globalPercent.toFixed(1)}% globais
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function AchievementImage({
  icon,
  iconGray,
  achieved,
}: {
  icon: string;
  iconGray: string;
  achieved: boolean;
}) {
  const candidates = [icon, iconGray].filter(
    (value, index, values) => value.length > 0 && values.indexOf(value) === index
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = candidates[sourceIndex];

  if (!source) {
    return achieved ? (
      <CheckCircle2 className="h-6 w-6 text-ok" />
    ) : (
      <Circle className="h-6 w-6 text-white/30" />
    );
  }

  return (
    <img
      src={source}
      alt=""
      className={`h-full w-full object-cover ${achieved ? '' : 'opacity-40 grayscale'}`}
      onError={() => {
        setSourceIndex((index) => index + 1);
      }}
    />
  );
}

function NewsTab({ loading, news }: { loading: boolean; news: NewsItem[] }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Carregando atualizações…
      </div>
    );
  }
  if (news.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper className="h-8 w-8" />}
        title="Sem notícias recentes"
        text="Não há notícias nem avisos recentes dos criadores deste jogo."
      />
    );
  }
  return (
    <div className="grid gap-3">
      {news.map((n, i) => (
        <a
          key={i}
          href={n.url}
          target="_blank"
          rel="noreferrer"
          className="reveal theme-glass group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/[0.08]"
        >
          <div className="mb-2 flex items-center gap-3 text-xs font-light text-white/45">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(n.date * 1000).toLocaleDateString('pt-BR')}
            {n.author && <span>· {n.author}</span>}
          </div>
          <h4 className="theme-accent mb-1.5 text-base font-semibold tracking-tight text-white group-hover:brightness-125">
            {n.title}
          </h4>
          <p className="line-clamp-3 text-sm font-light leading-relaxed text-white/55">
            {n.summary}
          </p>
        </a>
      ))}
    </div>
  );
}

function NotesTab({
  draft,
  onChange,
  onSave,
  saving,
  saved,
  hasUser,
  updatedAt,
}: {
  draft: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  hasUser: boolean;
  updatedAt?: string;
}) {
  return (
    <div className="space-y-4">
      {!hasUser && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light">
          Entre com a sua conta da Steam (na tela de conta) para suas anotações ficarem salvas e aparecerem em outros computadores.
        </div>
      )}
      <div className="reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-xl">
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escreva um lembrete, nota ou dica sobre este jogo…"
          rows={10}
          className="w-full resize-none bg-transparent p-5 text-[15px] font-light leading-relaxed text-white placeholder:text-white/35 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving || !hasUser}
          className="reveal relative flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-5 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/[0.18] disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo' : 'Salvar anotação'}
        </button>
        {updatedAt && (
          <span className="text-xs font-light text-white/40">
            Última atualização: {new Date(updatedAt).toLocaleString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/30">
        {icon}
      </div>
      <h4 className="mb-1 text-lg font-semibold tracking-tight text-white">{title}</h4>
      <p className="max-w-sm text-sm font-light text-white/45">{text}</p>
    </div>
  );
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = minutes / 60;
  if (hours < 1) return `${minutes}min`;
  if (hours < 100) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours).toLocaleString('pt-BR')}h`;
}
