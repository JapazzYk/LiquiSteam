import { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { InstalledGame, SteamUser, GameNote, AchievementSummary, NewsItem } from '@/types';
import type { SteamStatus } from '@/lib/useSteamStatus';
import { launchGame } from '@/lib/steamLaunch';
import { fetchAchievements, fetchNews, fetchPlaytime } from '@/lib/steamMeta';
import { loadNote, saveNote } from '@/lib/notes';
import { gameArtworkUrls } from '@/lib/steamLibrary';

interface GameDetailProps {
  game: InstalledGame;
  user: SteamUser | null;
  hasKey: boolean;
  steamStatus: SteamStatus;
  onClose: () => void;
}

type Tab = 'overview' | 'achievements' | 'news' | 'notes';

export default function GameDetail({
  game,
  user,
  hasKey,
  steamStatus,
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
  const artwork = [game.library_image, ...gameArtworkUrls(game.appid), game.header_image].filter(
    (url, index, urls) => url && urls.indexOf(url) === index
  );
  const artworkSource = artwork[artworkIndex];

  const steamRunning = steamStatus === 'running' || steamStatus === 'starting';
  const storeUrl = `https://store.steampowered.com/app/${game.appid}`;

  // Load everything in parallel when the overlay opens.
  useEffect(() => {
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
  }, [game.appid, game.name, user?.steamId, hasKey]);

  // Esc closes, scroll lock on body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

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

  const handleRun = () => {
    if (!steamRunning) return;
    launchGame(game.appid);
  };

  const achPct =
    achievements && achievements.total > 0
      ? Math.round((achievements.achieved / achievements.total) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-canvas/[0.78] p-0 backdrop-blur-md md:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-6xl flex-col overflow-y-auto bg-surface/[0.94] shadow-2xl md:h-[calc(100vh-40px)] md:rounded-[32px] md:border md:border-white/12 md:backdrop-blur-2xl"
        ref={scrollRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero: full game art */}
        <div className="relative h-[42vh] min-h-[300px] w-full shrink-0 overflow-hidden md:rounded-t-[32px]">
          {artworkSource ? (
            <img
              src={artworkSource}
              alt={game.name}
              className="h-full w-full object-cover"
              onError={() => setArtworkIndex((index) => index + 1)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface to-canvas">
              <SteamIcon className="h-16 w-16 text-white/25" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/80 via-transparent to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-snow/20 bg-black/40 text-snow backdrop-blur-xl transition-all hover:border-snow/40 hover:bg-black/60"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Title + run */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-6 md:px-10 md:pb-8">
            <h2 className="mb-4 max-w-3xl text-3xl font-semibold tracking-[-0.03em] hero-title text-white md:text-5xl">
              {game.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleRun}
                disabled={!steamRunning}
                className={`group relative flex h-11 items-center gap-2.5 overflow-hidden rounded-full px-6 text-sm font-semibold transition-all ${
                  steamRunning
                    ? 'bg-[var(--accent-color)] text-[color:var(--on-accent)] hover:brightness-110 active:scale-[0.98]'
                    : 'cursor-not-allowed border border-white/15 bg-white/[0.06] text-white/40'
                }`}
              >
                {steamRunning ? (
                  <>
                    <Play className="h-5 w-5 fill-current" />
                    Executar
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Abra a Steam para executar
                  </>
                )}
              </button>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-sm font-light text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Loja
              </a>
            </div>
          </div>
        </div>

        {/* Tabs + content */}
        <div className="mx-auto w-full flex-1 px-6 py-6 md:px-10 md:py-8">
          <div className="mb-7 flex gap-5 overflow-x-auto border-b border-white/10 pb-px">
            <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={<HardDrive className="h-4 w-4" />}>
              Visão geral
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
          </div>

          {tab === 'overview' && (
            <OverviewTab
              game={game}
              achPct={achPct}
              achievements={achievements}
              playtimeMinutes={playtimeMinutes}
              loadingPlaytime={loadingPlaytime}
              hasSync={!!(user && hasKey)}
            />
          )}
          {tab === 'achievements' && (
            <AchievementsTab loading={loadingAch} data={achievements} />
          )}
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
    <div className="theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
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
}: {
  game: InstalledGame;
  achPct: number;
  achievements: AchievementSummary | null;
  playtimeMinutes: number | null;
  loadingPlaytime: boolean;
  hasSync: boolean;
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
        <div className="theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
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
          Tempo de jogo e conquistas pessoais não sincronizados. Adicione uma chave da Steam Web API
          na tela de conta para sincronizar com sua conta Steam.
        </div>
      )}
      {hasSync && achievements && !achievements.hasPersonal && (
        <div className="rounded-2xl notice-warn border p-4 text-sm font-light leading-relaxed">
          A Steam não liberou suas conquistas pessoais. Verifique se seu perfil e os detalhes dos jogos
          estão públicos nas configurações de privacidade da Steam.
        </div>
      )}

      <div className="theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl">
        <p className="text-sm font-light leading-relaxed text-white/60">
          Clique em <span className="font-medium text-white">Executar</span> para iniciar o jogo
          pela Steam. A Steam precisa estar aberta em segundo plano — use o botão
          <span className="font-medium text-white"> Abrir Steam</span> no topo do app.
        </p>
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
        text="Este jogo não tem conquistas públicas, ou não foi possível carregá-las."
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
        text="Não há atualizações recentes para este jogo."
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
          className="theme-glass group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/[0.08]"
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
          Entre com sua conta Steam (na tela de conta) para salvar anotações que persistem entre sessões.
        </div>
      )}
      <div className="theme-glass relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-xl">
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
          className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-5 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/[0.18] disabled:opacity-40"
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
