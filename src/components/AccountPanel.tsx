import { useState } from 'react';
import {
  ArrowLeft,
  LogOut,
  FolderOpen,
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Info,
  Gamepad2,
  KeyRound,
  Trash2,
} from 'lucide-react';
import type { SteamUser, InstalledGame } from '@/types';
import { steamLoginUrl } from '@/lib/steamAuth';
import {
  pickSteamappsDir,
  scanInstalledGames,
  isFileSystemAccessSupported,
} from '@/lib/steamLibrary';
import { fileSystemAccessBlockedByIframe } from '@/lib/pwa';
import { saveSteamKey, removeSteamKey } from '@/lib/steamMeta';

interface AccountPanelProps {
  user: SteamUser | null;
  onUserChange: (user: SteamUser | null) => void;
  onGamesLoaded: (games: InstalledGame[]) => void;
  onApiKeyChange: (has: boolean) => void;
  hasKey: boolean;
  onBack: () => void;
}

export default function AccountPanel({
  user,
  onUserChange,
  onGamesLoaded,
  onApiKeyChange,
  hasKey,
  onBack,
}: AccountPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSteamLogin = () => {
    window.location.href = steamLoginUrl();
  };

  const handleSignOut = () => {
    onUserChange(null);
    onApiKeyChange(false);
    setApiKey('');
    onGamesLoaded([]);
    setLastCount(null);
  };

  const handleSaveApiKey = async () => {
    if (!user) return;
    setApiKeyError(null);
    if (!apiKey.trim()) {
      setApiKeyError('Cole uma chave de API da Steam.');
      return;
    }
    setApiKeyBusy(true);
    const result = await saveSteamKey(apiKey.trim());
    setApiKeyBusy(false);
    if (!result.ok) {
      setApiKeyError(result.error ?? 'Chave inválida.');
      return;
    }
    setApiKey('');
    onApiKeyChange(true);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 1800);
  };

  const handleClearApiKey = async () => {
    await removeSteamKey();
    setApiKey('');
    onApiKeyChange(false);
  };

  const handleScan = async () => {
    setScanError(null);
    setScanning(true);
    try {
      // Always open the picker so the user can switch between Steam libraries.
      // The selected handle replaces the previously saved one only after the
      // user confirms a new folder.
      const dir = await pickSteamappsDir();
      if (!dir) return;
      const games = await scanInstalledGames(dir);
      onGamesLoaded(games);
      setLastCount(games.length);
      if (games.length === 0) {
        setScanError(
          'Nenhum jogo instalado nessa pasta. Confira se você escolheu a pasta "steamapps".'
        );
      }
    } catch (e) {
      setScanError(
        e instanceof Error ? e.message : 'Não foi possível ler a pasta da Steam.'
      );
    } finally {
      setScanning(false);
    }
  };

  const fsSupported = isFileSystemAccessSupported();
  const blockedByIframe = fileSystemAccessBlockedByIframe();
  const folderBlocked = !fsSupported || blockedByIframe;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
          aria-label="Voltar para a biblioteca"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Conta</h2>
          <p className="text-sm font-light text-white/50">
            Entre com a Steam e conecte sua biblioteca local
          </p>
        </div>
      </div>

      {/* Steam identity card */}
      <div className="relative mb-5 overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-7 backdrop-blur-2xl">
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] opacity-60"
          style={{ boxShadow: 'inset 0 0 60px 10px rgba(var(--accent-rgb),0.10)' }}
        />

        {user ? (
          <div className="relative flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.10]">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.personaName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Gamepad2 className="h-7 w-7 text-white/70" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-white">
                {user.personaName}
              </p>
              <p className="truncate text-xs font-light text-white/45">
                SteamID: {user.steamId}
              </p>
              <button
                onClick={handleSignOut}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs font-light text-white/60 transition-all hover:border-bad/40 hover:text-bad"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <h3 className="mb-1 text-lg font-semibold tracking-tight text-white">
              Entrar com a Steam
            </h3>
            <p className="mb-5 text-sm font-light leading-relaxed text-white/55">
              O login acontece no site da Steam. O LiquiSteam recebe só o seu SteamID público
              e o nome do perfil, nunca a sua senha.
            </p>

            {/* Official-styled Steam login button */}
            <button
              onClick={handleSteamLogin}
              className="group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#171a21] px-6 text-snow shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:bg-[#1b2838] active:scale-[0.99]"
            >
              <span
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(102,192,244,0.0) 0%, rgba(102,192,244,0.15) 50%, rgba(102,192,244,0.0) 100%)',
                }}
              />
              <SteamLogo className="h-6 w-6" />
              <span className="text-[15px] font-medium tracking-tight">
                Entrar com sua conta Steam
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Steam Web API key — only after login, since the SteamID comes from OpenID */}
      {user && (
        <div className="theme-glass relative mb-5 overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-7 backdrop-blur-2xl">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="theme-accent h-4 w-4" />
            <h3 className="text-lg font-semibold tracking-tight text-white">
              Chave da Steam Web API
            </h3>
          </div>
          <p className="mb-4 text-sm font-light leading-relaxed text-white/55">
            Necessária para sincronizar seu tempo de jogo e conquistas reais com sua conta Steam.
            A chave é validada no servidor e usada apenas lá — nunca exposta ao navegador.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            spellCheck={false}
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 font-mono text-sm text-white placeholder:text-white/30 backdrop-blur-xl transition-all focus:border-[rgba(var(--accent-rgb),0.5)] focus:bg-white/[0.08] focus:outline-none"
          />
          {apiKeyError && (
            <p className="mt-3 flex items-start gap-2 text-sm font-light text-bad">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {apiKeyError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveApiKey}
              disabled={apiKeyBusy}
              className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-5 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/[0.18] disabled:opacity-50"
            >
              {apiKeyBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : apiKeySaved ? (
                <Check className="h-4 w-4 text-ok" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              {apiKeyBusy ? 'Validando…' : apiKeySaved ? 'Válida e salva' : 'Validar e salvar'}
            </button>
            {hasKey && (
              <button
                onClick={handleClearApiKey}
                className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-light text-white/60 transition-all hover:border-bad/40 hover:text-bad"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            )}
          </div>
          <a
            href="https://steamcommunity.com/dev/apikey"
            target="_blank"
            rel="noreferrer"
            className="theme-accent mt-4 inline-flex items-center gap-1.5 text-sm font-light transition-colors hover:brightness-125"
          >
            Obter uma chave da Steam Web API
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Local library connection */}
      <div className="theme-glass relative mb-5 overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] p-7 backdrop-blur-2xl">
        <h3 className="mb-1 text-lg font-semibold tracking-tight text-white">
          Jogos instalados
        </h3>
        <p className="mb-5 text-sm font-light leading-relaxed text-white/55">
          Escolha a pasta <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">steamapps</code>{' '}
          da Steam para listar os jogos instalados neste computador. As capas vêm do servidor de
          imagens da Steam.
        </p>

        {blockedByIframe && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl notice-info border p-4 text-sm font-light">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Você está vendo o app numa moldura (preview embutido). A seleção da pasta da Steam
              só funciona com o app instalado e aberto numa janela própria. Use o banner
              “Instalar app” no topo da tela, abra em nova aba, ou publique o projeto e instale a partir do link publicado.
            </p>
          </div>
        )}

        {!fsSupported && !blockedByIframe && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl notice-warn border p-4 text-sm font-light">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Seu navegador não suporta a API de acesso a arquivos. Para a experiência completa,
              use Chrome ou Edge no desktop e instale o app.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning || folderBlocked}
            className="flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-6 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/[0.18] disabled:opacity-40"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {scanning ? 'Lendo a pasta…' : 'Escolher pasta steamapps'}
          </button>

          {lastCount !== null && lastCount > 0 && !scanError && (
            <span className="inline-flex items-center gap-1.5 text-sm font-light text-ok">
              <Check className="h-4 w-4" />
              {lastCount} jogos encontrados
            </span>
          )}
        </div>

        {scanError && (
          <p className="mt-4 flex items-start gap-2 text-sm font-light text-bad">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {scanError}
          </p>
        )}
      </div>

      <div className="theme-glass mb-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-light leading-relaxed text-white/55 backdrop-blur-xl">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
        <p>
          O acesso à pasta é pedido uma vez e fica salvo neste navegador. Depois de instalar
          jogos novos, use o botão de atualizar no topo da tela.
        </p>
      </div>

      <a
        href="https://help.steampowered.com/en/faqs/view/57A7-6F22-D5C7-7D38"
        target="_blank"
        rel="noreferrer"
        className="theme-accent inline-flex items-center gap-1.5 text-sm font-light transition-colors hover:brightness-125"
      >
        Onde fica a pasta steamapps?
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// Minimal official-ish Steam logo (wordmark + circle) drawn inline so we
// don’t ship binary assets. Uses Steam’s brand blue (#66c0f4 / #1b2838).
function SteamLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#66c0f4" />
      <path
        fill="#171a21"
        d="M21.6 8.2a4.4 4.4 0 0 0-4.36 5.02l-3.3 4.78a3.4 3.4 0 0 0-.18-.01 3.4 3.4 0 0 0-1.13.2l-1.6-1.17a3.4 3.4 0 0 1 2.73-3.31 3.4 3.4 0 0 1 3.86 2.86 3.4 3.4 0 0 1-2.86 3.86 3.4 3.4 0 0 1-2.14-.45l-1.6-1.17a3.4 3.4 0 0 0-.56 1.84 3.4 3.4 0 0 0 3.4 3.4 3.4 3.4 0 0 0 3.36-2.94l3.3-4.78a3.4 3.4 0 0 0 .13.01 4.4 4.4 0 0 0 4.4-4.4 4.4 4.4 0 0 0-4.4-4.4Z"
      />
    </svg>
  );
}
