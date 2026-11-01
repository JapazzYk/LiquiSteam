import type { ReactNode } from 'react';
import {
  Calendar,
  Clapperboard,
  Clock,
  HardDrive,
  History,
  Newspaper,
  Play,
  ThumbsUp,
  Trophy,
  Wallet,
  Gauge,
} from 'lucide-react';
import type { AchievementSummary, InstalledGame, NewsItem } from '@/types';
import type { GameDetails, PlaytimeEntry } from '@/lib/steamMeta';
import { formatHours } from '@/lib/facts';
import { formatAgo, formatDateTime, formatSize } from '@/lib/format';

const CARD =
  'fx-lift reveal theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-xl';

type JumpTab = 'media' | 'achievements' | 'news';

// ---------------------------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------------------------
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

// Anel de progresso (0 a 1) que se desenha ao aparecer.
function Ring({ value, children }: { value: number; children?: ReactNode }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid h-[68px] w-[68px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" width="68" height="68" className="-rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
        {clamped > 0 && (
          <circle
            className="ring-fill"
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--accent-color)"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            style={{ strokeDashoffset: 1 - clamped }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[13px] font-semibold tracking-tight text-white">{children}</div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  accent,
  visual,
  bar,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  visual?: ReactNode;
  bar?: number;
}) {
  return (
    <div className={`${CARD} stat-tile p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-white/50">
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className={`truncate text-2xl font-semibold tracking-tight ${accent ? 'theme-accent' : 'text-white'}`}>{value}</p>
          {sub && <p className="mt-1 text-xs font-light leading-snug text-white/45">{sub}</p>}
        </div>
        {visual}
      </div>
      {bar !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="tile-bar h-full rounded-full bg-[var(--accent-color)]" style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white/60">
          <span className="theme-accent">{icon}</span>
          <h3 className="text-sm font-medium text-white/85">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'ok' | 'warn' | 'bad' | 'accent' }) {
  const tones = {
    plain: 'border-white/12 bg-white/[0.06] text-white/70',
    ok: 'border-ok/35 bg-ok/10 text-ok',
    warn: 'border-warn/35 bg-warn/10 text-warn',
    bad: 'border-bad/35 bg-bad/10 text-bad',
    accent: 'border-[rgba(var(--accent-rgb),0.35)] bg-[rgba(var(--accent-rgb),0.12)] text-white',
  } as const;
  return <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function metacriticTone(score: number): 'ok' | 'warn' | 'bad' {
  return score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'bad';
}

// ---------------------------------------------------------------------------------------------
// Faixa de informações no topo da janela do jogo (ano, gêneros, nota, preço, idioma).
// ---------------------------------------------------------------------------------------------
export function HeroMeta({ game, details, loading }: { game: InstalledGame; details: GameDetails | null; loading: boolean }) {
  if (game.custom) return null;
  if (!details) {
    return loading ? (
      <div className="mb-4 flex gap-2" aria-hidden>
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    ) : null;
  }
  const year = details.releaseDate.match(/\d{4}/)?.[0];
  const ptbr = /portugu[eê]s\s*-\s*brasil/i.test(details.languages);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {details.comingSoon ? <Pill tone="accent">Em breve</Pill> : year ? <Pill>{year}</Pill> : null}
      {details.genres.slice(0, 3).map((genre) => (
        <Pill key={genre}>{genre}</Pill>
      ))}
      {details.metacritic !== null && <Pill tone={metacriticTone(details.metacritic)}>Metacritic {details.metacritic}</Pill>}
      {details.price && <Pill tone={details.price.free ? 'ok' : 'plain'}>{details.price.free ? 'Gratuito' : details.price.final}</Pill>}
      {ptbr && <Pill>PT-BR</Pill>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Faixa de números (fica sobreposta à base da arte, logo abaixo do título)
// ---------------------------------------------------------------------------------------------
interface GameStatsProps {
  game: InstalledGame;
  details: GameDetails | null;
  loadingDetails: boolean;
  achievements: AchievementSummary | null;
  playtimeMinutes: number | null;
  loadingPlaytime: boolean;
  entry: PlaytimeEntry | undefined;
  libraryTotalMinutes: number;
  lastPlayed: number | null;
}

export function GameStats({
  game,
  details,
  loadingDetails,
  achievements,
  playtimeMinutes,
  loadingPlaytime,
  entry,
  libraryTotalMinutes,
  lastPlayed,
}: GameStatsProps) {
  const minutes = playtimeMinutes ?? entry?.forever ?? null;
  const share = minutes !== null && libraryTotalMinutes > 0 ? minutes / libraryTotalMinutes : null;
  const achPct = achievements && achievements.total > 0 ? achievements.achieved / achievements.total : 0;
  const recent = lastPlayed !== null && lastPlayed > 0 && Date.now() / 1000 - lastPlayed < 14 * 86400;
  return (
    <div className="fx-stack">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {game.unowned ? (
          <>
            <Tile icon={<Wallet className="h-4 w-4" />} label="Preço" value={details?.price ? (details.price.free ? 'Gratuito' : details.price.final) : loadingDetails ? '…' : '—'} sub={details?.price && details.price.discount > 0 ? `${details.price.discount}% de desconto agora` : undefined} accent />
            <Tile icon={<Gauge className="h-4 w-4" />} label="Metacritic" value={details?.metacritic ?? '—'} sub={details?.metacritic != null ? 'Nota da crítica' : 'Sem nota da crítica'} />
            <Tile icon={<ThumbsUp className="h-4 w-4" />} label="Recomendações" value={details?.recommendations ? details.recommendations.toLocaleString('pt-BR') : '—'} sub="Jogadores que recomendaram na Steam" />
            <Tile icon={<Calendar className="h-4 w-4" />} label="Lançamento" value={details?.releaseDate || '—'} sub={details?.comingSoon ? 'Ainda não lançado' : undefined} />
          </>
        ) : (
          <>
            <Tile
              icon={<Clock className="h-4 w-4" />}
              label="Tempo de jogo"
              value={minutes !== null ? formatHours(minutes) : loadingPlaytime ? 'Sincronizando…' : '—'}
              sub={
                share !== null && share >= 0.01
                  ? `${Math.round(share * 100)}% de todo o seu tempo`
                  : entry && entry.twoWeeks > 0
                    ? `${formatHours(entry.twoWeeks)} nas últimas 2 semanas`
                    : undefined
              }
              accent={minutes !== null}
              bar={share !== null ? Math.sqrt(share) : undefined}
            />
            <Tile
              icon={<History className="h-4 w-4" />}
              label="Última sessão"
              value={lastPlayed === null ? '—' : lastPlayed > 0 ? formatAgo(lastPlayed * 1000) : 'Nunca jogado'}
              sub={
                lastPlayed !== null && lastPlayed > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    {recent && <i className="gchip-dot text-[color:var(--accent-color)]" aria-hidden />}
                    {formatDateTime(lastPlayed * 1000)}
                  </span>
                ) : undefined
              }
              accent={recent}
            />
            <Tile
              icon={<Trophy className="h-4 w-4" />}
              label="Conquistas"
              value={
                achievements?.hasPersonal
                  ? `${achievements.achieved}/${achievements.total}`
                  : achievements
                    ? `${achievements.total}`
                    : '—'
              }
              sub={
                achievements?.hasPersonal
                  ? 'Desbloqueadas por você'
                  : achievements
                    ? 'Disponíveis no jogo'
                    : undefined
              }
              visual={
                achievements?.hasPersonal && achievements.total > 0 ? <Ring value={achPct}>{Math.round(achPct * 100)}%</Ring> : undefined
              }
            />
            <Tile
              icon={<HardDrive className="h-4 w-4" />}
              label="No disco"
              value={game.notInstalled ? 'Não instalado' : game.size_on_disk ? formatSize(game.size_on_disk) : '—'}
              sub={game.notInstalled ? 'Está na sua conta, mas não neste computador' : game.size_on_disk ? 'Instalado neste computador' : undefined}
            />
          </>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------------------------
interface GameOverviewProps {
  game: InstalledGame;
  details: GameDetails | null;
  loadingDetails: boolean;
  achievements: AchievementSummary | null;
  hasSync: boolean;
  playFacts: string[];
  news: NewsItem[];
  onJump: (tab: JumpTab) => void;
}

export default function GameOverview({
  game,
  details,
  loadingDetails,
  achievements,
  hasSync,
  playFacts,
  news,
  onJump,
}: GameOverviewProps) {
  const media = (details?.movies.length ?? 0) + (details?.screenshots?.length ?? 0);

  return (
    <div className="fx-stack space-y-6">
      {!hasSync && !game.unowned && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light leading-relaxed">
          Seu tempo de jogo e suas conquistas pessoais ainda não aparecem aqui. Para mostrá-los, entre com a Steam e cole a sua
          chave da Steam na tela de conta (é grátis e só permite leitura).
        </div>
      )}
      {hasSync && achievements && !achievements.hasPersonal && !game.unowned && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light leading-relaxed">
          A Steam não liberou suas conquistas pessoais. Verifique se seu perfil e os detalhes dos jogos estão públicos nas
          configurações de privacidade da Steam.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel title="Sobre o jogo" icon={<Newspaper className="h-4 w-4" />}>
            {details?.shortDescription ? (
              <p className="max-w-3xl text-[15px] font-light leading-relaxed text-white/75">{details.shortDescription}</p>
            ) : loadingDetails && !details ? (
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <p className="text-sm font-light text-white/50">A loja da Steam não tem uma descrição para este jogo.</p>
            )}
            {details && details.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {details.categories.slice(0, 8).map((category) => (
                  <Pill key={category}>{category}</Pill>
                ))}
              </div>
            )}
          </Panel>

          {media > 0 && details && (
            <Panel
              title="Trailers e imagens"
              icon={<Clapperboard className="h-4 w-4" />}
              action={
                <button type="button" onClick={() => onJump('media')} data-hover-fx className="rounded-full px-2 py-1 text-xs text-white/55 hover:text-white">
                  Ver tudo ({media})
                </button>
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:grid-rows-2">
                {details.movies[0] && (
                  <button
                    type="button"
                    onClick={() => onJump('media')}
                    aria-label="Abrir os trailers"
                    data-hover-fx
                    className="media-tile relative col-span-2 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:row-span-2 sm:aspect-auto"
                  >
                    {details.movies[0].thumbnail && (
                      <img src={details.movies[0].thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/60 via-black/10 to-transparent">
                      <span className="grid h-14 w-14 place-items-center rounded-full border border-white/40 bg-black/50 backdrop-blur-md">
                        <Play className="h-6 w-6 fill-white text-white" />
                      </span>
                    </span>
                    <span className="absolute bottom-2 left-3 text-xs font-medium text-white/90">
                      {details.movies.length > 1 ? `${details.movies.length} trailers` : 'Trailer'}
                    </span>
                  </button>
                )}
                {(details.screenshots ?? []).slice(0, details.movies[0] ? 4 : 8).map((shot, index, shown) => {
                  const rest = (details.screenshots?.length ?? 0) - shown.length;
                  return (
                    <button
                      key={shot.id}
                      type="button"
                      onClick={() => onJump('media')}
                      aria-label="Abrir as imagens"
                      data-hover-fx
                      className="media-tile relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    >
                      <img src={shot.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {index === shown.length - 1 && rest > 0 && (
                        <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-semibold text-white">+{rest}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          {playFacts.length > 0 && (
            <Panel title="Suas horas" icon={<Clock className="h-4 w-4" />}>
              <ul className="grid gap-2">
                {playFacts.map((fact) => (
                  <li key={fact} className="flex gap-2.5 text-sm font-light leading-relaxed text-white/65">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent-color)]" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-16 lg:self-start">
          <Panel title="Ficha do jogo" icon={<HardDrive className="h-4 w-4" />}>
            {details ? (
              <dl className="grid text-sm">
                {details.releaseDate && <Row label={details.comingSoon ? 'Lançamento previsto' : 'Lançamento'}>{details.releaseDate}</Row>}
                {details.developers.length > 0 && <Row label="Desenvolvedora">{details.developers.slice(0, 2).join(', ')}</Row>}
                {details.publishers.length > 0 && <Row label="Publicadora">{details.publishers.slice(0, 2).join(', ')}</Row>}
                {details.metacritic !== null && (
                  <Row label="Metacritic">
                    <Pill tone={metacriticTone(details.metacritic)}>{details.metacritic}</Pill>
                  </Row>
                )}
                {details.recommendations !== null && details.recommendations > 0 && (
                  <Row label="Recomendações">{details.recommendations.toLocaleString('pt-BR')}</Row>
                )}
                {details.languages && (
                  <Row label="Português do Brasil">
                    {/portugu[eê]s\s*-\s*brasil/i.test(details.languages) ? <Pill tone="ok">Tem tradução</Pill> : <Pill>Sem tradução oficial</Pill>}
                  </Row>
                )}
                <Row label="Plataformas">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {details.platforms.windows && <Pill>Windows</Pill>}
                    {details.platforms.mac && <Pill>macOS</Pill>}
                    {details.platforms.linux && <Pill>Linux</Pill>}
                  </span>
                </Row>
                {details.controllerSupport === 'full' && <Row label="Controle">Suporte completo</Row>}
                {details.dlcCount > 0 && <Row label="Conteúdos extras (DLC)">{details.dlcCount}</Row>}
                {details.price && (
                  <Row label="Preço">
                    {details.price.free ? (
                      <Pill tone="ok">Gratuito</Pill>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {details.price.discount > 0 && <Pill tone="accent">-{details.price.discount}%</Pill>}
                        {details.price.final}
                      </span>
                    )}
                  </Row>
                )}
              </dl>
            ) : loadingDetails ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : (
              <p className="text-sm font-light text-white/50">A loja da Steam não tem a ficha deste jogo.</p>
            )}
          </Panel>

          {news.length > 0 && (
            <Panel
              title="Últimas notícias"
              icon={<Newspaper className="h-4 w-4" />}
              action={
                <button type="button" onClick={() => onJump('news')} data-hover-fx className="rounded-full px-2 py-1 text-xs text-white/55 hover:text-white">
                  Ver todas
                </button>
              }
            >
              <ul className="grid gap-3">
                {news.slice(0, 2).map((item, index) => (
                  <li key={index}>
                    <a href={item.url} target="_blank" rel="noreferrer" className="group block">
                      <p className="text-xs font-light text-white/40">{new Date(item.date * 1000).toLocaleDateString('pt-BR')}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-white/85 group-hover:text-white">{item.title}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-white/45">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium leading-snug text-white/85">{children}</dd>
    </div>
  );
}
