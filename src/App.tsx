import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Settings as SettingsIcon, RefreshCw, Star, Loader2, Search, Lock, SlidersHorizontal, UserCircle2, SearchX, FolderOpen, ArrowDownToLine, Plus } from 'lucide-react';
import LiquidBackground from '@/components/LiquidBackground';
import SearchBar from '@/components/SearchBar';
import AccountPanel from '@/components/AccountPanel';
import UpdatesView from '@/components/UpdatesView';
import AddGameDialog from '@/components/AddGameDialog';
import InstallButton from '@/components/InstallButton';
import OpenSteamButton from '@/components/OpenSteamButton';
import HelperInstall from '@/components/HelperInstall';
import GameDetail from '@/components/GameDetail';
import UpdateToast from '@/components/UpdateToast';
import CustomizationPanel from '@/components/CustomizationPanel';
import CursorGlow from '@/components/CursorGlow';
import WelcomeScreen from '@/components/WelcomeScreen';
import SiteFooter from '@/components/SiteFooter';
import LibraryView from '@/components/LibraryView';
import LibraryToolbar from '@/components/LibraryToolbar';
import LibrarySummary from '@/components/LibrarySummary';
import LayoutSwitch from '@/components/LayoutSwitch';
import CollectionBar, { type CollectionFilter } from '@/components/CollectionBar';
import GroupMenu from '@/components/GroupMenu';
import ConnectingScreen from '@/components/ConnectingScreen';
import { CollectionsContext, useCollections, type CollectionsUi } from '@/lib/collections';
import { useSteamStatus } from '@/lib/useSteamStatus';
import { useUpdates } from '@/lib/useUpdates';
import { fetchAllPlaytime, searchStore, type PlaytimeEntry } from '@/lib/steamMeta';
import { libraryStats } from '@/lib/facts';
import { loadSort, saveSort, sortGames, type SortState } from '@/lib/sort';
import { usePresence } from '@/lib/motion';
import { loadUser, saveUser, clearUser } from '@/lib/storage';
import {
  listStoredSteamappsDirs,
  scanLibraries,
  mergeGames,
  hydrateInstalledSizes,
  isFileSystemAccessSupported,
  clearStoredSteamappsDirs,
  libraryImageUrl,
  headerImageUrl,
} from '@/lib/steamLibrary';
import { helperLibrary, helperCustomGames, helperLaunchCustom, helperStopCustom } from '@/lib/steamHelper';
import { customToGame } from '@/lib/customGames';
import { readOpenIdParams, cleanAuthFromUrl, completeSteamLogin } from '@/lib/steamAuth';
import { loadAccount, saveRemoteTheme, signOutAccount } from '@/lib/account';
import { demoGames } from '@/lib/demoGames';
import { defaultTheme, loadTheme, saveTheme, onAccentColor, type ThemePreferences } from '@/lib/theme';
import { getSkin } from '@/lib/skins';
import type { OpenOrigin } from '@/lib/openOrigin';
import type { SteamUser, InstalledGame, View } from '@/types';

// Boas-vindas: aparece para quem não está logado, uma vez por visita (sessionStorage) e nunca mais se a
// pessoa pedir (localStorage).
const WELCOME_SEEN_KEY = 'liquid_welcome_seen';
const WELCOME_OFF_KEY = 'liquid_welcome_off';

function welcomeAllowed(): boolean {
  try {
    return !localStorage.getItem(WELCOME_OFF_KEY) && !sessionStorage.getItem(WELCOME_SEEN_KEY);
  } catch {
    return true;
  }
}

// Duração da saída ao trocar de tela (mesmo valor de .fx-out no index.css).
const VIEW_LEAVE_MS = 180;

export default function App() {
  const [view, setView] = useState<View>('library');
  const [leaving, setLeaving] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(welcomeAllowed);
  // Diálogo de jogo de fora da Steam: 'new' adiciona; um jogo edita.
  // Ordenação e filtro da biblioteca (lembrados neste navegador).
  const [sort, setSortState] = useState<SortState>(() => loadSort());
  const setSort = (next: SortState) => {
    setSortState(next);
    saveSort(next);
  };
  // Tempo de jogo de toda a biblioteca, da Steam (null = sem login/chave).
  const [playtimes, setPlaytimes] = useState<Map<number, PlaytimeEntry> | null>(null);
  // Jogo em destaque, sorteado a cada visita.
  const [featuredId, setFeaturedId] = useState<number | null>(null);
  const [customDialog, setCustomDialog] = useState<'new' | InstalledGame | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const [user, setUser] = useState<SteamUser | null>(() => loadUser());
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<InstalledGame | null>(null);
  const [openOrigin, setOpenOrigin] = useState<OpenOrigin | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreferences>(() => loadTheme());
  const [customizationOpen, setCustomizationOpen] = useState(false);
  // Favoritos e grupos; o filtro escolhido na faixa acima da biblioteca.
  const collectionsApi = useCollections(user?.steamId ?? null);
  const [filter, setFilter] = useState<CollectionFilter>('all');
  // Aviso "entre com a Steam para usar favoritos e grupos".
  // Voltas dos ícones do topo: cada clique gira o ícone mais um pouco.
  const [refreshTurns, setRefreshTurns] = useState(0);
  const [plusTurns, setPlusTurns] = useState(0);
  const [lockedNotice, setLockedNotice] = useState(false);
  const lockedPresence = usePresence(lockedNotice, 220);
  useEffect(() => {
    if (!lockedNotice) return;
    const timer = window.setTimeout(() => setLockedNotice(false), 4500);
    return () => window.clearTimeout(timer);
  }, [lockedNotice]);
  const [groupMenu, setGroupMenu] = useState<{ appid: number; anchor: HTMLElement; id: number } | null>(null);
  // Biblioteca: só o que está instalado neste computador ou todos os jogos da conta Steam.
  const [scope, setScopeState] = useState<'installed' | 'account'>(() => {
    try {
      return localStorage.getItem('liquid_scope') === 'account' ? 'account' : 'installed';
    } catch {
      return 'installed';
    }
  });
  const setScope = (next: 'installed' | 'account') => {
    setScopeState(next);
    try {
      localStorage.setItem('liquid_scope', next);
    } catch {
      // ignora
    }
  };
  // Resultados da busca na loja da Steam (para achar qualquer jogo).
  const [storeHits, setStoreHits] = useState<InstalledGame[]>([]);
  const [storeSearching, setStoreSearching] = useState(false);
  // Tela de conexão: espera sessão, helper, biblioteca e tempo de jogo.
  const [bootExpected] = useState(() => {
    try {
      return !!readOpenIdParams() || !!loadUser();
    } catch {
      return false;
    }
  });
  const [libraryLoadedAs, setLibraryLoadedAs] = useState<'online' | 'offline' | null>(null);
  const [playtimesDone, setPlaytimesDone] = useState(false);
  const [connectMinElapsed, setConnectMinElapsed] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  useEffect(() => {
    const min = window.setTimeout(() => setConnectMinElapsed(true), 800);
    const max = window.setTimeout(() => setConnectTimedOut(true), 15000);
    return () => {
      window.clearTimeout(min);
      window.clearTimeout(max);
    };
  }, []);
  const {
    status: steamStatus,
    helper: steamHelper,
    source: steamSource,
    access: helperAccess,
    hint: helperHint,
    open: openSteam,
    stop: stopSteam,
    refresh: refreshSteam,
    runningGame,
    customRunning,
    boost: boostSteam,
    stopGame,
    requestAccess: requestHelperAccess,
    forgetHint: forgetHelperHint,
    helperDisabled,
    setHelperDisabled,
  } = useSteamStatus(!!user && hasKey);
  const updates = useUpdates({ helperOnline: steamHelper === 'online', active: view === 'updates' });
  const skin = getSkin(theme.skin);

  // Grava na conta com um pequeno atraso, para não salvar a cada movimento de um controle.
  const remoteSaveTimer = useRef<number | null>(null);
  const updateTheme = (nextTheme: ThemePreferences) => {
    setTheme(nextTheme);
    saveTheme(nextTheme);
    if (!user) return;
    if (remoteSaveTimer.current !== null) window.clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = window.setTimeout(() => {
      void saveRemoteTheme(nextTheme).catch(() => undefined);
    }, 600);
  };

  // Troca de tela: a tela atual sai rápido e a nova entra no estilo do tema.
  // Sem animação quando o sistema pede para reduzir movimento.
  const goTo = (next: View) => {
    if (leaveTimer.current !== null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    if (next === view) {
      setLeaving(false);
      return;
    }
    const finish = () => {
      setView(next);
      setLeaving(false);
      window.scrollTo({ top: 0 });
    };
    if (theme.motion === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      finish();
    }, VIEW_LEAVE_MS);
  };

  // Logo e nome do canto superior esquerdo: voltam à tela principal da biblioteca.
  const goHome = () => {
    setSelectedGame(null);
    setCustomizationOpen(false);
    setQuery('');
    if (view === 'library') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    goTo('library');
  };

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    []
  );

  const openGame = (game: InstalledGame, origin?: OpenOrigin) => {
    setOpenOrigin(origin ?? null);
    setSelectedGame(game);
  };

  // O tema vale para a página inteira: fundo, barra de rolagem e cor da barra do navegador.
  // Roda antes da pintura para que a troca de tema com transição já encontre o DOM novo.
  useLayoutEffect(() => {
    document.documentElement.dataset.skin = theme.skin;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', getSkin(theme.skin).preview.bg);
  }, [theme.skin]);

  // Estilo de transição e fundo animado também valem para a página inteira (ver src/index.css).
  useLayoutEffect(() => {
    document.documentElement.dataset.motion = theme.motion;
    document.documentElement.dataset.ambient = theme.liveBackground ? 'on' : 'off';
  }, [theme.motion, theme.liveBackground]);

  // Painéis translúcidos nos temas sólidos pedem desfoque do fundo (ver [data-panels] no index.css).
  useLayoutEffect(() => {
    const translucent = !getSkin(theme.skin).glass && theme.panelOpacity < 1;
    document.documentElement.dataset.panels = translucent ? 'glass' : 'solid';
  }, [theme.skin, theme.panelOpacity]);

  const rootStyle = {
    '--accent-rgb': theme.accentRgb,
    '--accent-color': theme.accent,
    '--on-accent': onAccentColor(theme.accentRgb),
    '--glow-intensity': theme.glowIntensity,
    '--glass-opacity': theme.glassOpacity,
    '--panel-a': skin.glass ? 1 : theme.panelOpacity,
  } as CSSProperties;

  // Ao abrir o app: conclui o login Steam (se voltou do login) e carrega a conta.
  // O ref impede que o modo estrito do React rode o login duas vezes.
  const sessionStarted = useRef(false);
  useEffect(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;

    const run = async () => {
      setLoading(true);
      const params = readOpenIdParams();
      if (params) {
        cleanAuthFromUrl();
        try {
          await completeSteamLogin(params);
        } catch (e) {
          setAccountError(e instanceof Error ? e.message : 'Não foi possível entrar com a Steam. Tente de novo em instantes.');
        }
      }

      const account = await loadAccount().catch(() => null);
      if (!account) {
        setUser(null);
        clearUser();
        setHasKey(false);
        return;
      }
      setUser(account.user);
      saveUser(account.user);
      setHasKey(account.hasKey);
      if (account.theme) {
        setTheme(account.theme);
        saveTheme(account.theme);
      }
    };

    void run().finally(() => {
      setLoading(false);
      setSessionReady(true);
    });
  }, []);

  // Junta os jogos de todas as pastas steamapps escolhidas neste navegador com os que o
  // LiquiSteam Helper enxerga no computador (todas as bibliotecas, inclusive em Arquivos de Programas).
  const loadId = useRef(0);
  const helperOnlineRef = useRef(false);
  helperOnlineRef.current = steamHelper === 'online';
  const [helperGames, setHelperGames] = useState<number | null>(null);

  const hydrateSizes = (dir: FileSystemDirectoryHandle, loadedGames: InstalledGame[]) => {
    void hydrateInstalledSizes(dir, loadedGames, (appid, size) => {
      setGames((current) => current.map((game) => (game.appid === appid ? { ...game, size_on_disk: size } : game)));
      setSelectedGame((current) =>
        current?.appid === appid ? { ...current, size_on_disk: size } : current
      );
    });
  };

  const loadLibrary = async () => {
    const id = ++loadId.current;
    let folderGames: InstalledGame[] = [];
    let libraries: Awaited<ReturnType<typeof scanLibraries>>['libraries'] = [];
    if (isFileSystemAccessSupported()) {
      const stored = await listStoredSteamappsDirs();
      const scanned = await scanLibraries(stored.filter((d) => d.granted).map((d) => d.handle));
      folderGames = scanned.games;
      libraries = scanned.libraries;
    }
    const helperUsed = helperOnlineRef.current;
    const fromHelper = helperUsed ? await helperLibrary() : null;
    // Jogos de fora da Steam, guardados pelo helper neste computador.
    const customs = helperOnlineRef.current ? await helperCustomGames() : null;
    if (id !== loadId.current) return; // chegou uma leitura mais nova
    setHelperGames(fromHelper ? fromHelper.length : null);
    const merged = [...mergeGames(folderGames, fromHelper ?? []), ...(customs ?? []).map(customToGame)].sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    setGames(merged);
    setUsingDemo(merged.length === 0);
    setLibraryLoadedAs(helperUsed ? 'online' : 'offline');
    // Jogos sem tamanho no manifesto têm o tamanho calculado pela pasta.
    for (const library of libraries) hydrateSizes(library.dir, library.games);
  };

  useEffect(() => {
    void loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando o helper passa a responder, lê os jogos por ele também.
  const prevHelper = useRef(steamHelper);
  useEffect(() => {
    const before = prevHelper.current;
    prevHelper.current = steamHelper;
    // Reler quando o Helper passa a responder, ou deixa de responder (desativado): os jogos dele somem.
    if (steamHelper === 'online' || (before === 'online' && steamHelper === 'offline')) void loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamHelper]);

  const handleUserChange = (u: SteamUser | null) => {
    if (u) {
      setUser(u);
      saveUser(u);
      return;
    }
    void signOutAccount();
    setUser(null);
    clearUser();
    setHasKey(false);
    // As pastas da Steam escolhidas ficam no navegador, então são removidas ao sair.
    void clearStoredSteamappsDirs().then(() => loadLibrary());
  };

  // Tempo de jogo da Steam: carrega com login e chave, e some ao sair.
  const loadPlaytimes = async () => {
    if (!user || !hasKey) {
      setPlaytimes(null);
      return;
    }
    const map = await fetchAllPlaytime();
    setPlaytimes(map);
    setPlaytimesDone(true);
  };
  useEffect(() => {
    void loadPlaytimes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.steamId, hasKey]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      void loadPlaytimes();
      await loadLibrary();
    } finally {
      setLoading(false);
    }
  };

  // Só depois de conferir a sessão (senão quem está logado veria a tela por um instante).
  const welcome = usePresence(welcomeOpen && sessionReady && !user && view === 'library', 220);
  const dismissWelcome = (forever: boolean) => {
    try {
      sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
      if (forever) localStorage.setItem(WELCOME_OFF_KEY, '1');
    } catch {
      // ignore
    }
    setWelcomeOpen(false);
  };

  // Todos os jogos da conta Steam (com login e chave): instalados ou não.
  const accountGames = useMemo<InstalledGame[]>(() => {
    if (!playtimes) return [];
    const list: InstalledGame[] = [];
    playtimes.forEach((entry, appid) => {
      if (!entry.name) return;
      list.push({
        appid,
        name: entry.name,
        installdir: '',
        library_image: libraryImageUrl(appid),
        header_image: headerImageUrl(appid),
        notInstalled: true,
      });
    });
    return list;
  }, [playtimes]);
  const accountAvailable = accountGames.length > 0;
  // Sem nada instalado, a conta Steam vira a biblioteca; com jogos instalados, a pessoa escolhe.
  const accountMode = accountAvailable && (scope === 'account' || games.length === 0);
  const showDemo = usingDemo && !accountAvailable;
  const source = useMemo<InstalledGame[]>(() => {
    if (showDemo) return demoGames;
    if (!accountMode) return games;
    const installed = new Set(games.map((g) => g.appid));
    return [...games, ...accountGames.filter((g) => !installed.has(g.appid))].sort((a, b) => a.name.localeCompare(b.name));
  }, [showDemo, accountMode, games, accountGames]);
  const available = useMemo(() => new Set(source.map((g) => g.appid)), [source]);

  const search = query.trim().toLowerCase();
  // Favoritos e grupos só existem com a Steam conectada.
  const activeGroup = user ? (collectionsApi.collections.groups.find((g) => g.id === filter) ?? null) : null;
  const effectiveFilter: CollectionFilter = !user ? 'all' : filter === 'all' || filter === 'favorites' || activeGroup ? filter : 'all';
  const inFilter = (g: InstalledGame) =>
    effectiveFilter === 'all'
      ? true
      : effectiveFilter === 'favorites'
        ? collectionsApi.isFavorite(g.appid)
        : (activeGroup?.games.includes(g.appid) ?? false);
  const filtered = source.filter((g) => {
    if (!inFilter(g)) return false;
    if (search && !g.name.toLowerCase().includes(search)) return false;
    if (sort.onlyUnplayed && playtimes && !g.custom && (playtimes.get(g.appid)?.forever ?? 0) > 0) return false;
    return true;
  });
  const visible = sortGames(filtered, sort, playtimes);
  const stats = useMemo(() => (playtimes ? libraryStats(source, playtimes) : null), [source, playtimes]);
  const hasSizes = source.some((g) => (g.size_on_disk ?? 0) > 0);
  const hasPlaytime = !!playtimes && playtimes.size > 0;

  // Busca na loja da Steam: na demonstração, na visão da conta e quando nada na biblioteca combina.
  const storeSearchOn = search.length >= 2 && effectiveFilter === 'all' && (showDemo || accountMode || filtered.length === 0);
  useEffect(() => {
    if (!storeSearchOn) {
      setStoreHits([]);
      setStoreSearching(false);
      return;
    }
    let cancelled = false;
    setStoreSearching(true);
    const timer = window.setTimeout(() => {
      void searchStore(search).then((hits) => {
        if (cancelled) return;
        setStoreHits(
          hits.map((hit) => ({
            appid: hit.appid,
            name: hit.name,
            installdir: '',
            library_image: libraryImageUrl(hit.appid),
            header_image: headerImageUrl(hit.appid),
            unowned: true,
          }))
        );
        setStoreSearching(false);
      });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [storeSearchOn, search]);
  const storeResults = storeSearchOn ? storeHits.filter((hit) => !available.has(hit.appid)) : [];

  const collectionsUi = useMemo<CollectionsUi>(
    () => ({
      api: collectionsApi,
      openGroupMenu: (appid, anchor) => setGroupMenu({ appid, anchor, id: Date.now() }),
      enabled: !!user,
      notifyLocked: () => setLockedNotice(true),
    }),
    [collectionsApi, user]
  );
  const menuGameName =
    groupMenu === null
      ? ''
      : ([...source, ...storeHits, ...(selectedGame ? [selectedGame] : [])].find((g) => g.appid === groupMenu.appid)?.name ?? 'jogo');

  // Tela de conexão com a Steam: some quando sessão, helper, biblioteca e tempo de jogo estão prontos.
  const connectSteps = [
    { label: 'Confirmando o seu login', done: sessionReady },
    { label: 'Procurando o Helper neste computador', done: steamHelper !== 'checking' },
    {
      label: 'Lendo os jogos instalados',
      done: steamHelper !== 'checking' && libraryLoadedAs === (steamHelper === 'online' ? 'online' : 'offline'),
    },
    { label: 'Buscando tempo de jogo e a sua conta', done: sessionReady && (!hasKey || playtimesDone) },
  ];
  const connectDone = connectSteps.every((step) => step.done);
  const connect = usePresence(bootExpected && !connectTimedOut && !(connectDone && connectMinElapsed), 260);

  // Sorteia o jogo em destaque quando a biblioteca carrega (ou se o jogo atual sair da lista).
  useEffect(() => {
    if (source.length === 0) return;
    if (featuredId !== null && source.some((g) => g.appid === featuredId)) return;
    setFeaturedId(source[Math.floor(Math.random() * source.length)].appid);
  }, [source, featuredId]);

  const shuffleFeatured = () => {
    const pool = source.filter((g) => g.appid !== featuredId);
    if (pool.length === 0) return;
    setFeaturedId(pool[Math.floor(Math.random() * pool.length)].appid);
  };

  return (
    <CollectionsContext.Provider value={collectionsUi}>
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden font-sans text-white" style={rootStyle}>
      <LiquidBackground ambient={skin.ambient} live={theme.liveBackground} />
      {skin.glow && theme.glowIntensity > 0 && <CursorGlow />}

      <header className="app-header theme-glass glass-reflection sticky top-0 z-20 px-4 py-4 backdrop-blur-md sm:px-6 md:px-10 md:py-5">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 md:gap-4">
          <a
            href="/"
            onClick={(event) => {
              // Clique normal volta à tela principal sem recarregar; Ctrl/Cmd/botão do meio abrem em outra aba.
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              goHome();
            }}
            aria-label="LiquiSteam: ir para a tela principal"
            title="Ir para a tela principal"
            className="brand-link flex shrink-0 items-center gap-3 rounded-xl text-inherit no-underline transition-transform duration-200 hover:opacity-90 active:scale-[0.97]"
          >
            <img
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_2px_10px_rgba(var(--accent-rgb),0.35)]"
            />
            <div className="hidden sm:block">
              <h1 className="brand-title text-[15px] font-semibold leading-none tracking-tight">LiquiSteam</h1>
              <p className="mt-1 text-[11px] text-white/50">
                {showDemo ? 'Biblioteca de exemplo' : `${source.length} jogos`}
              </p>
            </div>
          </a>

          {view === 'library' && (
            <div className="fx-soft min-w-0 flex-1 md:px-4">
              <SearchBar value={query} onChange={setQuery} />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {view === 'library' && (
              <div className="fx-soft hidden lg:block">
                <LayoutSwitch value={theme.layout} onChange={(layout) => updateTheme({ ...theme, layout })} />
              </div>
            )}
            {view === 'library' && (
              <div className="fx-soft hidden items-center gap-2 md:flex">
                <OpenSteamButton status={steamStatus} source={steamSource} onOpen={openSteam} onStop={stopSteam} />
                {steamHelper !== 'checking' && (
                  <HelperInstall
                    installed={steamHelper === 'online'}
                    access={helperAccess}
                    hint={helperHint}
                    onChanged={refreshSteam}
                    onRequestAccess={requestHelperAccess}
                    onForget={forgetHelperHint}
                    disabled={helperDisabled}
                    onToggleDisabled={setHelperDisabled}
                  />
                )}
              </div>
            )}
            {view === 'library' && !showDemo && (
              <button
                type="button"
                onClick={() => {
                  setRefreshTurns((n) => n + 1);
                  void handleRefresh();
                }}
                disabled={loading}
                data-busy={loading ? '' : undefined}
                className="icon-btn icon-btn-refresh fx-soft reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl hover:border-white/30 hover:text-white disabled:opacity-50"
                aria-label="Atualizar biblioteca"
                title="Reler os jogos instalados (use depois de instalar ou desinstalar algo)"
              >
                <RefreshCw className="h-4 w-4" style={{ '--turn': `${refreshTurns * 360}deg` } as CSSProperties} />
              </button>
            )}
            {view === 'library' && (
              <button
                type="button"
                onClick={() => {
                  setPlusTurns((n) => n + 1);
                  setCustomDialog('new');
                }}
                className="icon-btn icon-btn-plus fx-soft reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl hover:border-white/30 hover:text-white"
                aria-label="Adicionar jogo de fora da Steam"
                title="Adicionar um jogo que não é da Steam (Epic, GOG, emulador…)"
              >
                <Plus className="h-4 w-4" style={{ '--turn': `${plusTurns * 180}deg` } as CSSProperties} />
              </button>
            )}
            <InstallButton />
            <button
              type="button"
              onClick={() => goTo(view === 'updates' ? 'library' : 'updates')}
              className={`icon-btn icon-btn-download reveal relative grid h-10 w-10 place-items-center rounded-full border backdrop-blur-xl ${
                view === 'updates'
                  ? 'theme-accent-border theme-accent-surface text-white'
                  : 'border-white/15 bg-white/[0.07] text-white/80 hover:border-white/30 hover:text-white'
              }`}
              aria-label={
                updates.pendingCount > 0 ? `Atualizações (${updates.pendingCount} pendentes)` : 'Atualizações'
              }
              title="Atualizações pendentes dos seus jogos da Steam"
            >
              <ArrowDownToLine className="h-4 w-4" />
              {updates.pendingCount > 0 && (
                <span key={updates.pendingCount} className="icon-badge absolute -right-1 -top-1 z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--accent-color)] px-1 text-[10px] font-semibold leading-none text-[color:var(--on-accent)] opacity-100 shadow-[0_0_0_2px_rgb(var(--bg))]">
                  {updates.pendingCount > 99 ? '99+' : updates.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setCustomizationOpen(true)}
              className="icon-btn icon-btn-sliders reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl hover:border-white/30 hover:text-white"
              aria-label="Aparência"
              title="Aparência: tema, cores e animações"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(view === 'account' ? 'library' : 'account')}
              className={`icon-btn icon-btn-account reveal relative flex h-10 items-center gap-2 rounded-full border backdrop-blur-xl ${
                view === 'account'
                  ? 'theme-accent-border theme-accent-surface text-white'
                  : 'border-white/15 bg-white/[0.07] text-white/80 hover:border-white/30 hover:text-white'
              }`}
              aria-label="Conta"
              title="Conta: entrar com a Steam e escolher pastas"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-10 w-10 place-items-center">
                  {user ? <UserCircle2 className="h-5 w-5" /> : <SettingsIcon className="h-4 w-4" />}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {accountError && (
        <div className="fx-in px-4 pt-4 sm:px-6 md:px-10">
          <p role="alert" className="mx-auto max-w-[1400px] text-sm text-bad">
            {accountError}
          </p>
        </div>
      )}

      <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 md:px-10 md:pt-8">
        <div key={view} className={leaving ? 'fx-out' : 'fx-soft'}>
          {view === 'updates' ? (
            <UpdatesView
              updates={updates}
              helper={steamHelper}
              onBack={() => goTo('library')}
            />
          ) : view === 'account' ? (
            <AccountPanel
              user={user}
              onUserChange={handleUserChange}
              onLibraryChanged={() => void loadLibrary()}
              helper={steamHelper}
              helperGames={helperGames}
              hasKey={hasKey}
              onApiKeyChange={(has) => setHasKey(has)}
              onBack={() => goTo('library')}
            />
          ) : (
            <div className="mx-auto max-w-[1400px]">
              {showDemo && (
                <p className="fx-in notice-info mb-6 rounded-2xl border px-5 py-4 text-sm leading-relaxed">
                  Você está vendo jogos de exemplo. Pode usá-los à vontade: use a busca para achar{' '}
                  <strong className="font-medium">qualquer jogo da loja da Steam</strong>, abrir o card dele (trailers,
                  imagens, notas). Para ver os seus próprios jogos e criar favoritos e grupos,{' '}
                  <button
                    type="button"
                    onClick={() => goTo('account')}
                    className="font-medium underline underline-offset-4"
                  >
                    entre com a Steam na tela de conta
                  </button>
                  : com a sua chave, a biblioteca inteira da sua conta aparece aqui, mesmo sem a Steam instalada.
                </p>
              )}
              {accountMode && games.length === 0 && (
                <p className="fx-in notice-info mb-6 rounded-2xl border px-5 py-4 text-sm leading-relaxed">
                  Estes são todos os jogos da sua conta Steam. Para saber quais estão instalados neste computador, escolha
                  a pasta steamapps na{' '}
                  <button
                    type="button"
                    onClick={() => goTo('account')}
                    className="font-medium underline underline-offset-4"
                  >
                    tela de conta
                  </button>{' '}
                  ou instale o Helper.
                </p>
              )}

              {source.length > 0 && (
                <>
                  {stats && <LibrarySummary stats={stats} />}
                  <CollectionBar
                    locked={!user}
                    onLocked={() => setLockedNotice(true)}
                    api={collectionsApi}
                    active={effectiveFilter}
                    onSelect={setFilter}
                    available={available}
                    totalCount={source.length}
                    rightSlot={
                      accountAvailable && games.length > 0 ? (
                        <div
                          role="group"
                          aria-label="Quais jogos mostrar"
                          className="layout-switch flex h-9 items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] p-1"
                        >
                          {(['installed', 'account'] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={scope === value}
                              onClick={() => setScope(value)}
                              title={
                                value === 'installed'
                                  ? 'Só os jogos instalados neste computador'
                                  : 'Todos os jogos da sua conta Steam, instalados ou não'
                              }
                              className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                                scope === value ? 'theme-accent-surface text-white' : 'text-white/55 hover:text-white'
                              }`}
                            >
                              {value === 'installed' ? 'Instalados' : 'Toda a conta'}
                            </button>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  <LibraryToolbar
                    sort={sort}
                    onChange={setSort}
                    count={visible.length}
                    hasSizes={hasSizes}
                    hasPlaytime={hasPlaytime}
                  />
                </>
              )}

              {visible.length === 0 && !loading ? (
                storeResults.length > 0 || storeSearching ? null : effectiveFilter !== 'all' && !search ? (
                  <EmptyCollection
                    favorites={effectiveFilter === 'favorites'}
                    name={activeGroup?.name}
                    onShowAll={() => setFilter('all')}
                  />
                ) : (
                  <EmptyLibrary
                    query={query}
                    onClear={() => setQuery('')}
                    onPickFolder={() => goTo('account')}
                  />
                )
              ) : (
                <LibraryView
                  key={`${theme.skin}-${theme.layout}-${theme.motion}-${search}-${sort.key}-${sort.dir}-${sort.onlyUnplayed}-${effectiveFilter}-${accountMode}`}
                  games={visible}
                  layout={theme.layout}
                  loading={loading}
                  onOpen={openGame}
                  playtimes={playtimes}
                  trailerPreview={theme.trailerPreview}
                  featuredId={featuredId}
                  onShuffleFeatured={shuffleFeatured}
                />
              )}

              {storeSearchOn && (storeResults.length > 0 || storeSearching) && (
                <section className="fx-soft mt-10" aria-label="Resultados na loja da Steam">
                  <div className="mb-4 flex items-center gap-3">
                    <Search className="theme-accent h-4 w-4" />
                    <h3 className="text-sm font-medium text-white/85">
                      {showDemo || accountMode ? 'Mais jogos da loja da Steam' : 'Não está na sua biblioteca. Veja na loja da Steam'}
                    </h3>
                    {storeSearching && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
                  </div>
                  {storeResults.length > 0 && (
                    <LibraryView
                      key={`store-${search}-${theme.skin}-${theme.layout}`}
                      games={storeResults}
                      layout={theme.layout === 'list' ? 'list' : 'grid'}
                      loading={false}
                      onOpen={openGame}
                      playtimes={null}
                      trailerPreview={theme.trailerPreview}
                      featuredId={null}
                      onShuffleFeatured={() => undefined}
                    />
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />

      {customDialog && (
        <AddGameDialog
          helperOnline={steamHelper === 'online'}
          editing={customDialog === 'new' ? null : customDialog}
          onClose={() => setCustomDialog(null)}
          onSaved={() => {
            setSelectedGame(null);
            void loadLibrary();
          }}
        />
      )}

      {welcome.mounted && (
        <WelcomeScreen
          closing={welcome.closing}
          onContinue={() => dismissWelcome(false)}
          onNeverShow={() => dismissWelcome(true)}
        />
      )}

      {selectedGame && (
        <GameDetail
          game={selectedGame}
          origin={openOrigin}
          user={user}
          hasKey={hasKey}
          steamStatus={steamStatus}
          runningAppId={runningGame}
          playtimes={playtimes}
          libraryGames={source}
          customRunning={customRunning}
          onLaunchCustom={helperLaunchCustom}
          onStopCustom={helperStopCustom}
          onEditCustom={(game) => setCustomDialog(game)}
          onBoost={boostSteam}
          onStopGame={stopGame}
          onClose={() => setSelectedGame(null)}
        />
      )}

      {customizationOpen && (
        <CustomizationPanel
          theme={theme}
          onChange={updateTheme}
          onReset={() => updateTheme(defaultTheme)}
          onClose={() => setCustomizationOpen(false)}
        />
      )}

      {user && groupMenu && (
        <GroupMenu
          key={groupMenu.id}
          appid={groupMenu.appid}
          gameName={menuGameName}
          anchor={groupMenu.anchor}
          api={collectionsApi}
          onClose={() => setGroupMenu(null)}
        />
      )}

      {lockedPresence.mounted && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 px-4">
          <div
            role="status"
            className={`${lockedPresence.closing ? 'fx-out' : 'fx-in'} overlay-surface pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3`}
          >
            <Lock className="theme-accent h-4 w-4 shrink-0" />
            <p className="text-sm text-white/85">Favoritos e grupos ficam disponíveis depois que você entra com a Steam.</p>
            <button
              type="button"
              onClick={() => {
                setLockedNotice(false);
                setSelectedGame(null);
                goTo('account');
              }}
              className="ml-1 flex h-8 shrink-0 items-center rounded-full bg-[var(--accent-color)] px-4 text-sm font-medium text-[color:var(--on-accent)] transition hover:brightness-110"
            >
              Entrar
            </button>
          </div>
        </div>
      )}

      {connect.mounted && <ConnectingScreen steps={connectSteps} closing={connect.closing} />}

      <UpdateToast />
    </div>
    </CollectionsContext.Provider>
  );
}

function EmptyLibrary({
  query,
  onClear,
  onPickFolder,
}: {
  query: string;
  onClear: () => void;
  onPickFolder: () => void;
}) {
  const searching = query.trim().length > 0;
  return (
    <div className="fx-in flex flex-col items-center py-24 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/40">
        {searching ? <SearchX className="h-6 w-6" /> : <FolderOpen className="h-6 w-6" />}
      </div>
      <p className="text-lg font-medium tracking-tight text-white">
        {searching ? `Nenhum jogo com “${query.trim()}”` : 'Nenhum jogo encontrado'}
      </p>
      <p className="mt-2 max-w-sm text-sm text-white/50">
        {searching
          ? 'Confira se o nome está certo, ou apague a busca para ver todos os jogos de novo.'
          : 'Não achamos jogos instalados nas pastas escolhidas. Na tela de conta você pode adicionar outra pasta steamapps.'}
      </p>
      <button
        type="button"
        onClick={searching ? onClear : onPickFolder}
        className="mt-6 inline-flex h-10 items-center rounded-full border border-white/20 bg-white/[0.08] px-5 text-sm font-medium text-white transition-all hover:border-white/40"
      >
        {searching ? 'Limpar busca' : 'Escolher pasta'}
      </button>
    </div>
  );
}

function EmptyCollection({
  favorites,
  name,
  onShowAll,
}: {
  favorites: boolean;
  name?: string;
  onShowAll: () => void;
}) {
  return (
    <div className="fx-in flex flex-col items-center py-20 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/40">
        <Star className="h-6 w-6" />
      </div>
      <p className="text-lg font-medium tracking-tight text-white">
        {favorites ? 'Nenhum favorito ainda' : `O grupo “${name ?? ''}” está vazio`}
      </p>
      <p className="mt-2 max-w-sm text-sm text-white/50">
        {favorites
          ? 'Passe o mouse sobre um jogo e clique na estrela. Você também pode arrastar um jogo até "Favoritos".'
          : 'Passe o mouse sobre um jogo e clique no ícone de pasta para guardá-lo aqui. Também dá para arrastar o jogo até este grupo.'}
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-6 inline-flex h-10 items-center rounded-full border border-white/20 bg-white/[0.08] px-5 text-sm font-medium text-white transition-all hover:border-white/40"
      >
        Ver todos os jogos
      </button>
    </div>
  );
}
