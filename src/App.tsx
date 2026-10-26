import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Settings as SettingsIcon, Gamepad2, Loader2, RefreshCw, SlidersHorizontal, UserCircle2 } from 'lucide-react';
import LiquidBackground from '@/components/LiquidBackground';
import SearchBar from '@/components/SearchBar';
import GameCard from '@/components/GameCard';
import AccountPanel from '@/components/AccountPanel';
import InstallBanner from '@/components/InstallBanner';
import OpenSteamButton from '@/components/OpenSteamButton';
import GameDetail from '@/components/GameDetail';
import UpdateToast from '@/components/UpdateToast';
import CustomizationPanel from '@/components/CustomizationPanel';
import CursorGlow from '@/components/CursorGlow';
import { useSteamStatus } from '@/lib/useSteamStatus';
import { loadUser, saveUser, clearUser, loadApiKey, clearApiKey } from '@/lib/storage';
import {
  getStoredSteamappsDir,
  scanInstalledGames,
  hydrateInstalledSizes,
  isFileSystemAccessSupported,
} from '@/lib/steamLibrary';
import { parseSteamIdFromCallback, cleanAuthFromUrl, fetchSteamUser } from '@/lib/steamAuth';
import { demoGames } from '@/lib/demoGames';
import { defaultTheme, loadTheme, saveTheme, type ThemePreferences } from '@/lib/theme';
import type { SteamUser, InstalledGame, View } from '@/types';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [user, setUser] = useState<SteamUser | null>(() => loadUser());
  const [games, setGames] = useState<InstalledGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingDemo, setUsingDemo] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<InstalledGame | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(() => loadApiKey());
  const [theme, setTheme] = useState<ThemePreferences>(() => loadTheme());
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const { status: steamStatus, markStarting, toggle: toggleSteam } = useSteamStatus();

  const updateTheme = (nextTheme: ThemePreferences) => {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }; 

  const rootStyle = {
    '--accent-rgb': theme.accentRgb,
    '--accent-color': theme.accent,
    '--glow-intensity': theme.glowIntensity,
    '--glass-opacity': theme.glassOpacity,
  } as CSSProperties;

  // Handle Steam OpenID redirect: ?steam_auth=done&openid.claimed_id=...
  useEffect(() => {
    const steamId = parseSteamIdFromCallback();
    if (!steamId) return;
    cleanAuthFromUrl();
    setLoading(true);
    fetchSteamUser(steamId)
      .then((u) => {
        setUser(u);
        saveUser(u);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-load games if we already have a stored steamapps handle.
  useEffect(() => {
    if (!isFileSystemAccessSupported()) return;
    getStoredSteamappsDir().then((dir) => {
      if (!dir) return;
      scanInstalledGames(dir).then((g) => {
        if (g.length > 0) {
          setGames(g);
          setUsingDemo(false);
          hydrateSizes(dir, g);
        }
      });
    });
  }, []);

  const handleUserChange = (u: SteamUser | null) => {
    if (u) {
      setUser(u);
      saveUser(u);
    } else {
      setUser(null);
      clearUser();
      clearApiKey();
      setApiKey(null);
    }
  };

  const handleGamesLoaded = (g: InstalledGame[]) => {
    if (g.length > 0) {
      setGames(g);
      setUsingDemo(false);
    } else {
      setGames([]);
    }
  };

  const hydrateSizes = (dir: FileSystemDirectoryHandle, loadedGames: InstalledGame[]) => {
    void hydrateInstalledSizes(dir, loadedGames, (appid, size) => {
      setGames((current) => current.map((game) => (game.appid === appid ? { ...game, size_on_disk: size } : game)));
      setSelectedGame((current) =>
        current?.appid === appid ? { ...current, size_on_disk: size } : current
      );
    });
  };

  const handleRefresh = async () => {
    const dir = await getStoredSteamappsDir();
    if (!dir) return;
    setLoading(true);
    try {
      const g = await scanInstalledGames(dir);
      handleGamesLoaded(g);
      hydrateSizes(dir, g);
    } finally {
      setLoading(false);
    }
  };

  const filtered = query.trim()
    ? games.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
    : games;

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-white" style={rootStyle}>
      <LiquidBackground />
      <CursorGlow />
      <InstallBanner />

      {/* top bar */}
      <header className="theme-glass glass-reflection sticky top-0 z-20 px-6 py-5 backdrop-blur-md md:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/[0.10] backdrop-blur-xl">
              <Gamepad2 className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-[15px] font-semibold leading-none tracking-tight">
                Liquid Steam
              </h1>
              <p className="mt-1 text-[11px] font-light text-white/45">
                {usingDemo ? 'Demo library' : `${games.length} games`}
              </p>
            </div>
          </div>

          {view === 'library' && (
            <div className="flex-1 px-2 md:px-6">
              <SearchBar value={query} onChange={setQuery} />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {view === 'library' && (
              <OpenSteamButton
                status={steamStatus}
                onOpen={markStarting}
                onToggle={toggleSteam}
              />
            )}
            {view === 'library' && !usingDemo && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white disabled:opacity-50"
                aria-label="Refresh library"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setCustomizationOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
              aria-label="Personalizar launcher"
              title="Personalizar launcher"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView(view === 'account' ? 'library' : 'account')}
              className={`theme-glass flex h-10 items-center gap-2 rounded-full border backdrop-blur-xl transition-all ${
                view === 'account'
                  ? 'theme-accent-border theme-accent-surface text-white'
                  : 'border-white/15 bg-white/[0.07] text-white/80 hover:border-white/30 hover:text-white'
              }`}
              aria-label="Account"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.personaName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 place-items-center">
                  {view === 'account' ? (
                    <SettingsIcon className="h-4 w-4" />
                  ) : user ? (
                    <UserCircle2 className="h-5 w-5" />
                  ) : (
                    <SettingsIcon className="h-4 w-4" />
                  )}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* content */}
      <main className="px-6 pb-16 md:px-10">
        {view === 'account' ? (
          <AccountPanel
            user={user}
            onUserChange={handleUserChange}
            onGamesLoaded={handleGamesLoaded}
            onApiKeyChange={(k) => setApiKey(k)}
            onBack={() => setView('library')}
          />
        ) : (
          <div className="mx-auto max-w-[1400px]">
            {loading && games.length === 0 && (
              <div className="flex items-center justify-center py-32 text-white/70">
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                <span className="font-light tracking-tight">Loading…</span>
              </div>
            )}

            {!loading && filtered.length === 0 && !usingDemo && (
              <div className="py-32 text-center">
                <p className="text-lg font-light text-white/60">
                  {query ? `No games match “${query}”.` : 'No games found yet.'}
                </p>
                <button
                  onClick={() => setView('account')}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.10] px-5 py-2 text-sm font-light text-white backdrop-blur-xl transition-all hover:border-white/40"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Connect your Steam library
                </button>
              </div>
            )}

            {(usingDemo || filtered.length > 0) && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {(filtered.length > 0 ? filtered : demoGames).map((g) => (
                  <GameCard key={g.appid} game={g} onOpen={setSelectedGame} />
                ))}
              </div>
            )}

            {usingDemo && (
              <p className="mt-10 text-center text-sm font-light text-white/35">
                Showing a demo library — sign in with Steam and pick your steamapps folder in
                account settings to load your real installed games.
              </p>
            )}
          </div>
        )}
      </main>

      {selectedGame && (
        <GameDetail
          game={selectedGame}
          user={user}
          apiKey={apiKey}
          steamStatus={steamStatus}
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

      <UpdateToast />
    </div>
  );
}
