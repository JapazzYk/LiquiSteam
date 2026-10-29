import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  LogOut,
  FolderPlus,
  MonitorCheck,
  Check,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Info,
  KeyRound,
  Trash2,
} from 'lucide-react';
import type { SteamUser } from '@/types';
import type { HelperLink } from '@/lib/useSteamStatus';
import { steamLoginUrl } from '@/lib/steamAuth';
import {
  addSteamappsDir,
  listStoredSteamappsDirs,
  regrantSteamappsDir,
  removeSteamappsDir,
  isFileSystemAccessSupported,
  type StoredDir,
} from '@/lib/steamLibrary';
import { fileSystemAccessBlockedByIframe } from '@/lib/pwa';
import { saveSteamKey, removeSteamKey } from '@/lib/steamMeta';

interface AccountPanelProps {
  user: SteamUser | null;
  onUserChange: (user: SteamUser | null) => void;
  onLibraryChanged: () => void; // as pastas mudaram: o app lê a biblioteca de novo
  helper: HelperLink;
  helperGames: number | null; // jogos que o helper enxergou (null = sem helper ou versão antiga)
  onApiKeyChange: (has: boolean) => void;
  hasKey: boolean;
  onBack: () => void;
}

export default function AccountPanel({
  user,
  onUserChange,
  onLibraryChanged,
  helper,
  helperGames,
  onApiKeyChange,
  hasKey,
  onBack,
}: AccountPanelProps) {
  const [dirs, setDirs] = useState<StoredDir[]>([]);
  const [adding, setAdding] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
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
    setDirs([]);
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

  const refreshDirs = useCallback(async () => {
    setDirs(await listStoredSteamappsDirs());
  }, []);

  useEffect(() => {
    void refreshDirs();
  }, [refreshDirs]);

  // Acrescenta uma pasta às que já estão salvas (dá para ter várias bibliotecas).
  const handleAddDir = async () => {
    setScanError(null);
    setScanNotice(null);
    setAdding(true);
    try {
      const result = await addSteamappsDir();
      if (result.status === 'duplicate') {
        setScanNotice(`A pasta "${result.name}" já estava na lista.`);
      } else if (result.status === 'denied') {
        setScanError('O navegador não liberou a leitura dessa pasta.');
      }
      if (result.status === 'added') {
        await refreshDirs();
        onLibraryChanged();
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Não foi possível ler a pasta da Steam.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDir = async (index: number) => {
    await removeSteamappsDir(index);
    await refreshDirs();
    onLibraryChanged();
  };

  // Depois de reiniciar o navegador, ele pode pedir a permissão de novo.
  const handleRegrantDir = async (index: number) => {
    await regrantSteamappsDir(index);
    await refreshDirs();
    onLibraryChanged();
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
                <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />
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
              <img src="/steam-logo.png" alt="" width={24} height={24} className="h-6 w-6" />
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
          Adicione a pasta <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">steamapps</code>{' '}
          de cada biblioteca da Steam (uma por HD ou pasta de jogos) para listar os jogos instalados
          neste computador. As capas vêm do servidor de imagens da Steam.
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

        {helper === 'online' && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl notice-info border p-4 text-sm font-light">
            <MonitorCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            <p>
              {helperGames === null
                ? 'O LiquiSteam Helper está ativo, mas é de uma versão antiga que ainda não lista os jogos. Atualize-o pelo botão "Helper ativo" na biblioteca (Copiar comando de atualização).'
                : `O LiquiSteam Helper está ativo e lê todas as bibliotecas da Steam sozinho, inclusive em Arquivos de Programas (${helperGames} ${helperGames === 1 ? 'jogo' : 'jogos'}). Você não precisa escolher pastas.`}
            </p>
          </div>
        )}

        {dirs.length > 0 && (
          <ul className="mb-4 grid gap-2">
            {dirs.map((dir) => (
              <li
                key={`${dir.index}-${dir.name}`}
                className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm"
              >
                <FolderPlus className="h-4 w-4 shrink-0 text-white/45" />
                <span className="min-w-0 flex-1 truncate font-mono text-white/85">{dir.name}</span>
                {dir.granted ? (
                  <Check className="h-4 w-4 shrink-0 text-ok" aria-label="Acesso liberado" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRegrantDir(dir.index)}
                    className="theme-accent shrink-0 text-xs font-medium underline underline-offset-4"
                  >
                    Permitir acesso
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveDir(dir.index)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:text-white"
                  aria-label={`Remover a pasta ${dir.name}`}
                  title="Remover pasta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleAddDir}
            disabled={adding || folderBlocked}
            className="flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.12] px-6 text-sm font-medium text-white backdrop-blur-xl transition-all hover:border-white/40 hover:bg-white/[0.18] disabled:opacity-40"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            {adding ? 'Lendo a pasta…' : dirs.length > 0 ? 'Adicionar outra pasta' : 'Adicionar pasta steamapps'}
          </button>
          {scanNotice && <span className="text-sm font-light text-white/60">{scanNotice}</span>}
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
          O acesso às pastas é pedido uma vez e fica salvo neste navegador. Depois de instalar
          jogos novos, use o botão de atualizar no topo da tela. O Chrome e o Edge não deixam
          escolher pastas dentro de "Arquivos de Programas"; se a sua Steam estiver lá, instale o
          Helper (botão ao lado de "Abrir Steam" na biblioteca), que lê os jogos sozinho, ou
          adicione uma biblioteca em outro local pela própria Steam (Configurações, Armazenamento).
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
