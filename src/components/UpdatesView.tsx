import { useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { headerImageUrl } from '@/lib/steamLibrary';
import { formatSize } from '@/lib/format';
import type { UpdatesState } from '@/lib/useUpdates';
import type { HelperLink } from '@/lib/useSteamStatus';
import { installerCommand } from '@/components/HelperInstall';

interface UpdatesViewProps {
  updates: UpdatesState;
  helper: HelperLink;
  onBack: () => void;
}

const CARD =
  'reveal theme-glass relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] backdrop-blur-2xl';

// A Steam é quem baixa: o LiquiSteam só mostra o que está pendente e abre a página de Downloads dela
// (se a Steam estiver fechada, o próprio atalho a abre).
function openSteamDownloads(): void {
  window.location.href = 'steam://open/downloads';
}

export default function UpdatesView({ updates, helper, onBack }: UpdatesViewProps) {
  const { pending, supported } = updates;
  const [copied, setCopied] = useState(false);

  const copyUpdateCommand = async () => {
    try {
      await navigator.clipboard.writeText(installerCommand());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão para a área de transferência
    }
  };

  return (
    <div className="fx-stack mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col">
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={onBack}
          className="reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
          aria-label="Voltar para a biblioteca"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Atualizações pendentes</h2>
          <p className="text-sm font-light text-white/50">Jogos que a Steam já sabe que precisam atualizar</p>
        </div>
        {helper === 'online' && supported && (
          <button
            type="button"
            onClick={updates.refresh}
            className="reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
            aria-label="Conferir de novo"
            title="Conferir de novo"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      {helper !== 'online' ? (
        <div className={`${CARD} p-7`}>
          <h3 className="text-lg font-semibold tracking-tight text-white">Precisa do LiquiSteam Helper</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
            As atualizações pendentes vêm da própria Steam, que anota o estado de cada jogo no seu computador. O Helper
            lê essas anotações e entrega ao site. Instale-o pelo botão Helper no topo da biblioteca; leva um minuto e não
            pede administrador.
          </p>
        </div>
      ) : supported === false ? (
        <div className={`${CARD} p-7`}>
          <h3 className="text-lg font-semibold tracking-tight text-white">Atualize o Helper</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
            Seu Helper é de uma versão antiga e ainda não informa as atualizações. Copie o comando abaixo, cole no
            PowerShell e aperte Enter; depois volte aqui.
          </p>
          <button
            type="button"
            onClick={copyUpdateCommand}
            className="mt-4 flex h-10 items-center gap-2 rounded-full bg-[var(--accent-color)] px-5 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Comando copiado' : 'Copiar comando de atualização'}
          </button>
        </div>
      ) : supported === null ? (
        <div className={`${CARD} flex items-center gap-3 p-7 text-sm text-white/60`}>
          <Loader2 className="theme-accent h-4 w-4 animate-spin" />
          Lendo as atualizações…
        </div>
      ) : pending.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center px-7 py-14 text-center`}>
          <div className="theme-accent-surface mb-4 grid h-14 w-14 place-items-center rounded-2xl">
            <PackageCheck className="theme-accent h-6 w-6" />
          </div>
          <p className="text-lg font-medium tracking-tight text-white">Tudo em dia</p>
          <p className="mt-2 max-w-sm text-sm font-light text-white/50">
            Nenhum jogo está esperando atualização. Quando a Steam encontrar uma, ela aparece aqui sozinha.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-white/85">
              {pending.length} {pending.length === 1 ? 'jogo' : 'jogos'}
            </h3>
            {pending.length > 1 && (
              <button
                type="button"
                onClick={openSteamDownloads}
                className="reveal relative flex h-9 items-center gap-2 rounded-full bg-[var(--accent-color)] px-4 text-xs font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir na Steam
              </button>
            )}
          </div>
          <div className="grid gap-3">
            {pending.map((item) => (
              <div key={item.appid} className={`${CARD} p-4`}>
                <div className="flex items-center gap-4">
                  <img
                    src={headerImageUrl(item.appid)}
                    alt=""
                    loading="lazy"
                    width={92}
                    height={43}
                    className="aspect-[460/215] w-[92px] shrink-0 rounded-lg bg-white/[0.06] object-cover sm:w-[120px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium tracking-tight text-white">{item.name}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      Atualização disponível
                      {item.bytesToDownload > 0 ? ` · ${formatSize(item.bytesToDownload)} para baixar` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openSteamDownloads}
                    className="reveal relative flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--accent-color)] px-5 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir na Steam
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/40">
            O botão abre a página de Downloads da Steam; quem baixa e atualiza é a Steam.
          </p>
        </>
      )}
    </div>
  );
}
