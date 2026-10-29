import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { headerImageUrl } from '@/lib/steamLibrary';
import { formatSize } from '@/lib/format';
import { formatEta, type FinishedUpdate, type UpdateItem } from '@/lib/updates';
import type { UpdatesState } from '@/lib/useUpdates';
import type { HelperLink, SteamStatus } from '@/lib/useSteamStatus';
import { installerCommand } from '@/components/HelperInstall';

interface UpdatesViewProps {
  updates: UpdatesState;
  helper: HelperLink;
  steamStatus: SteamStatus;
  onOpenSteam: () => void;
  onBack: () => void;
}

const CARD =
  'reveal theme-glass relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] backdrop-blur-2xl';

// A Steam não informa o ritmo; depois deste tempo sem andamento sugerimos outro caminho.
const STUCK_MS = 20000;

export default function UpdatesView({ updates, helper, steamStatus, onOpenSteam, onBack }: UpdatesViewProps) {
  const { downloading, available, supported, history, requested } = updates;
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

  const steamRunning = steamStatus === 'running' || steamStatus === 'starting';
  const openDownloads = () => {
    window.location.href = 'steam://open/downloads';
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
          <h2 className="text-2xl font-semibold tracking-tight text-white">Atualizações</h2>
          <p className="text-sm font-light text-white/50">Veja o que precisa atualizar e acompanhe o download</p>
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
            As atualizações vêm da própria Steam, que anota o andamento de cada jogo no seu computador. O Helper lê
            essas anotações e entrega ao site. Instale-o pelo botão Helper no topo da biblioteca; leva um minuto e não
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
      ) : (
        <>
          {!steamRunning && (
            <div className="notice-warn mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 text-sm leading-relaxed">
              <span className="min-w-0 flex-1">
                A Steam está fechada. A lista abaixo é o que ela sabia na última vez; abra a Steam para conferir de novo
                e baixar.
              </span>
              <button
                type="button"
                onClick={onOpenSteam}
                className="h-9 rounded-full border border-current px-4 text-xs font-semibold transition hover:bg-white/10"
              >
                Abrir Steam
              </button>
            </div>
          )}

          {downloading.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-white/85">Em andamento</h3>
              <div className="grid gap-3">
                {downloading.map((item: UpdateItem) => (
                  <DownloadCard key={item.appid} item={item} />
                ))}
              </div>
              <button
                type="button"
                onClick={openDownloads}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/50 underline underline-offset-2 transition-colors hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver downloads na Steam (pausar, reordenar)
              </button>
            </section>
          )}

          {available.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-white/85">
                  Disponíveis <span className="text-white/40">({available.length})</span>
                </h3>
                {available.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void updates.updateAll()}
                    className="reveal relative flex h-9 items-center gap-2 rounded-full bg-[var(--accent-color)] px-4 text-xs font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Atualizar todos
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                {available.map((item: UpdateItem) => (
                  <AvailableRow
                    key={item.appid}
                    item={item}
                    requestedAt={requested[item.appid]}
                    onUpdate={() => void updates.update(item.appid)}
                    onAlternate={() => void updates.update(item.appid, item.isInstall ? 'validate' : 'install')}
                    onOpenDownloads={openDownloads}
                  />
                ))}
              </div>
            </section>
          )}

          {downloading.length === 0 && available.length === 0 && (
            <div className={`${CARD} flex flex-col items-center px-7 py-14 text-center`}>
              <div className="theme-accent-surface mb-4 grid h-14 w-14 place-items-center rounded-2xl">
                <PackageCheck className="theme-accent h-6 w-6" />
              </div>
              <p className="text-lg font-medium tracking-tight text-white">Tudo em dia</p>
              <p className="mt-2 max-w-sm text-sm font-light text-white/50">
                Nenhum jogo está esperando atualização. Quando a Steam encontrar uma, ela aparece aqui sozinha.
              </p>
            </div>
          )}

          {history.length > 0 && (
            <section className="mt-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white/85">Concluídas</h3>
                <button
                  type="button"
                  onClick={updates.clearHistory}
                  className="text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white"
                >
                  Limpar
                </button>
              </div>
              <ul className="grid gap-1.5">
                {history.map((entry: FinishedUpdate) => (
                  <li
                    key={`${entry.appid}-${entry.at}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
                    <span className="min-w-0 flex-1 truncate text-white/80">{entry.name}</span>
                    <span className="shrink-0 text-xs text-white/40">
                      {entry.install ? 'Instalado' : 'Atualizado'} às{' '}
                      {new Date(entry.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GameThumb({ appid }: { appid: number }) {
  return (
    <img
      src={headerImageUrl(appid)}
      alt=""
      loading="lazy"
      width={92}
      height={43}
      className="aspect-[460/215] w-[92px] shrink-0 rounded-lg bg-white/[0.06] object-cover sm:w-[120px]"
    />
  );
}

const PHASE_LABEL: Record<UpdateItem['phase'], string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  staging: 'Aplicando arquivos',
  idle: 'Aguardando a Steam',
};

function DownloadCard({ item }: { item: UpdateItem }) {
  const percent = Math.round(item.progress * 100);
  const total = item.phase === 'staging' ? item.bytesToStage : item.bytesToDownload;
  const done = item.phase === 'staging' ? item.bytesStaged : item.bytesDownloaded;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-4">
        <GameThumb appid={item.appid} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium tracking-tight text-white">{item.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-white/50">
            {item.phase === 'downloading' && <Loader2 className="theme-accent h-3 w-3 animate-spin" />}
            {item.isInstall ? 'Instalando' : 'Atualizando'} · {PHASE_LABEL[item.phase]}
          </p>
        </div>
        <span className="shrink-0 text-lg font-semibold tabular-nums tracking-tight text-white">{percent}%</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Progresso de ${item.name}`}
      >
        <div
          className="h-full rounded-full bg-[var(--accent-color)] transition-[width] duration-700 ease-linear"
          style={{ width: `${percent}%` } as CSSProperties}
        />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-white/50">
        {total > 0 && (
          <span>
            {formatSize(done)} de {formatSize(total)}
          </span>
        )}
        {item.phase === 'downloading' && item.speed > 0 && <span>{formatSize(item.speed)}/s</span>}
        {item.eta !== null && <span>{formatEta(item.eta)} restantes</span>}
      </p>
    </div>
  );
}

function AvailableRow({
  item,
  requestedAt,
  onUpdate,
  onAlternate,
  onOpenDownloads,
}: {
  item: UpdateItem;
  requestedAt: number | undefined;
  onUpdate: () => void;
  onAlternate: () => void;
  onOpenDownloads: () => void;
}) {
  const requested = requestedAt !== undefined;
  // Garante uma nova renderização quando o tempo de espera acaba, mesmo sem novas leituras.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (requestedAt === undefined) return;
    const wait = Math.max(0, STUCK_MS - (Date.now() - requestedAt)) + 150;
    const timer = window.setTimeout(() => setTick((n: number) => n + 1), wait);
    return () => window.clearTimeout(timer);
  }, [requestedAt]);
  // Pedido feito e a Steam ainda não começou: oferece outros caminhos.
  const stuck = requested && Date.now() - requestedAt > STUCK_MS;
  const sizeLabel = item.bytesToDownload > 0 ? formatSize(item.bytesToDownload) : null;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-4">
        <GameThumb appid={item.appid} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium tracking-tight text-white">{item.name}</p>
          <p className="mt-0.5 text-xs text-white/50">
            {item.isInstall ? 'Instalação pendente' : 'Atualização disponível'}
            {sizeLabel ? ` · ${sizeLabel} para baixar` : ''}
            {item.buildId > 0 && item.targetBuildId > 0 && item.buildId !== item.targetBuildId
              ? ` · versão ${item.buildId} → ${item.targetBuildId}`
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onUpdate}
          disabled={requested && !stuck}
          className="reveal relative flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--accent-color)] px-5 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110 disabled:opacity-60"
        >
          {requested && !stuck ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {requested && !stuck ? 'Pedido enviado' : 'Atualizar'}
        </button>
      </div>
      {requested && !stuck && (
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Pedido enviado. A Steam confere os arquivos do jogo antes de começar a baixar; isso pode levar alguns
          segundos.
        </p>
      )}
      {stuck && (
        <p className="mt-3 text-xs leading-relaxed text-white/55">
          A Steam ainda não começou. Ela pode estar com a fila ocupada ou pedindo confirmação numa janela.{' '}
          <button type="button" onClick={onUpdate} className="underline underline-offset-2 hover:text-white">
            Tentar de novo
          </button>
          ,{' '}
          <button type="button" onClick={onOpenDownloads} className="underline underline-offset-2 hover:text-white">
            abrir os downloads da Steam
          </button>{' '}
          ou{' '}
          <button type="button" onClick={onAlternate} className="underline underline-offset-2 hover:text-white">
            {item.isInstall ? 'verificar os arquivos' : 'tentar pelo atalho de instalação'}
          </button>
          .
        </p>
      )}
    </div>
  );
}
