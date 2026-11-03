import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Loader2,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { headerImageUrl } from '@/lib/steamLibrary';
import { formatEta, formatSize, formatSpeed } from '@/lib/format';
import type { UpdatesState } from '@/lib/useUpdates';
import type { HelperLink } from '@/lib/useSteamStatus';
import { PHASE_LABEL, type DownloadItem } from '@/lib/updates';
import { steamAction } from '@/lib/steamHelper';
import { launchGame } from '@/lib/steamLaunch';
import { installerCommand } from '@/components/HelperInstall';

interface UpdatesViewProps {
  updates: UpdatesState;
  helper: HelperLink;
  onBack: () => void;
}

const CARD =
  'reveal theme-glass relative overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.06] backdrop-blur-2xl';
const PILL_ACCENT =
  'flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--accent-color)] px-5 text-sm font-semibold text-[color:var(--on-accent)] hover:brightness-110';
const PILL_GHOST =
  'flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white/80 hover:border-white/30 hover:text-white';
const ICON_GHOST =
  'grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 hover:border-white/30 hover:text-white';

// A Steam é quem baixa: o LiquiSteam mostra o andamento e manda os pedidos para ela.
const openDownloads = () => void steamAction('downloads');

export default function UpdatesView({ updates, helper, onBack }: UpdatesViewProps) {
  const { pending, supported, live, downloads, speeds, current, finished } = updates;
  const [copied, setCopied] = useState(false);
  // Cada clique em atualizar gira o ícone uma volta, com suavidade.
  const [turns, setTurns] = useState(0);

  const copyUpdateCommand = async () => {
    try {
      await navigator.clipboard.writeText(installerCommand());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão para a área de transferência
    }
  };

  const updateHelperButton = (
    <button type="button" onClick={copyUpdateCommand} className={`mt-4 ${PILL_ACCENT}`}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Comando copiado' : 'Copiar o comando para atualizar o Helper'}
    </button>
  );

  const queue = downloads.filter((d) => !d.active && (d.phase === 'paused' || d.phase === 'queued'));
  const available = downloads.filter((d) => !d.active && d.phase === 'pending');
  const others = downloads.filter((d) => d.active && d !== current);

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
          <h2 className="text-2xl font-semibold tracking-tight text-white">Downloads</h2>
          <p className="text-sm font-light text-white/50">Instalações e atualizações dos seus jogos da Steam, ao vivo</p>
        </div>
        {helper === 'online' && supported && (
          <>
            <button type="button" onClick={openDownloads} className={`reveal relative hidden sm:flex ${PILL_GHOST}`}>
              <ExternalLink className="h-4 w-4" />
              Abrir na Steam
            </button>
            <button
              type="button"
              onClick={() => {
                setTurns((n) => n + 1);
                updates.refresh();
              }}
              className="reveal relative grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
              aria-label="Procurar de novo"
              title="Procurar de novo"
            >
              <RefreshCw
                className="h-4 w-4"
                style={{ transform: `rotate(${turns * 360}deg)`, transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </button>
          </>
        )}
      </div>

      {helper !== 'online' ? (
        <div className={`${CARD} p-7`}>
          <h3 className="text-lg font-semibold tracking-tight text-white">Precisa do LiquiSteam Helper</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
            Para acompanhar downloads e atualizações, o site precisa ler informações que a Steam guarda no seu
            computador, e o navegador sozinho não pode fazer isso. O Helper (um miniprograma opcional) faz essa leitura.
            Clique no botão "Helper" no topo da biblioteca e siga os passos: leva cerca de um minuto e não pede senha de
            administrador.
          </p>
        </div>
      ) : supported === false ? (
        <div className={`${CARD} p-7`}>
          <h3 className="text-lg font-semibold tracking-tight text-white">Atualize o Helper</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-white/60">
            O Helper instalado no seu computador é de uma versão antiga e ainda não sabe ler os downloads. Copie o
            comando abaixo, abra o PowerShell (tecla Windows, digite PowerShell), cole com Ctrl+V, aperte Enter e volte
            aqui.
          </p>
          {updateHelperButton}
        </div>
      ) : supported === null ? (
        <div className={`${CARD} flex items-center gap-3 p-7 text-sm text-white/60`}>
          <Loader2 className="theme-accent h-4 w-4 animate-spin" />
          Lendo os downloads da Steam…
        </div>
      ) : !live ? (
        <LegacyList pending={pending} helperButton={updateHelperButton} />
      ) : (
        <div className="space-y-8">
          {current ? (
            <ActiveCard item={current} speed={speeds[current.appid] ?? 0} />
          ) : downloads.length === 0 ? (
            <div className={`${CARD} flex flex-col items-center px-7 py-14 text-center`}>
              <div className="theme-accent-surface mb-4 grid h-14 w-14 place-items-center rounded-2xl">
                <PackageCheck className="theme-accent h-6 w-6" />
              </div>
              <p className="text-lg font-medium tracking-tight text-white">Tudo em dia</p>
              <p className="mt-2 max-w-sm text-sm font-light text-white/50">
                Nada baixando e nenhuma atualização esperando. Quando a Steam começar um download, ele aparece aqui na hora.
              </p>
            </div>
          ) : null}

          {others.length > 0 && (
            <Section title="Também em andamento">
              {others.map((item) => (
                <Row key={item.appid} item={item} speed={speeds[item.appid]} />
              ))}
            </Section>
          )}

          {queue.length > 0 && (
            <Section title="Na fila" hint="A Steam baixa um jogo por vez. Para pausar, retomar ou mudar a ordem, use a página de Downloads dela.">
              {queue.map((item) => (
                <Row
                  key={item.appid}
                  item={item}
                  action={
                    <button type="button" onClick={openDownloads} className={PILL_GHOST}>
                      {item.phase === 'paused' ? <Play className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                      {item.phase === 'paused' ? 'Retomar' : 'Abrir'}
                    </button>
                  }
                />
              ))}
            </Section>
          )}

          {available.length > 0 && (
            <Section title={`Atualizações disponíveis · ${available.length}`}>
              {available.map((item) => (
                <Row
                  key={item.appid}
                  item={item}
                  action={
                    <>
                      <button
                        type="button"
                        onClick={() => void steamAction('validate', item.appid)}
                        className={`hidden sm:grid ${ICON_GHOST}`}
                        title="Verificar os arquivos do jogo (a Steam baixa também o que faltar)"
                        aria-label={`Verificar os arquivos de ${item.name}`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={openDownloads} className={PILL_ACCENT}>
                        <ExternalLink className="h-4 w-4" />
                        Atualizar
                      </button>
                    </>
                  }
                />
              ))}
            </Section>
          )}

          {finished.length > 0 && (
            <Section
              title="Concluídos agora há pouco"
              extra={
                <button type="button" onClick={updates.clearFinished} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-white/50 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </button>
              }
            >
              {finished.map((f) => (
                <div key={f.appid} className={`fx-soft ${CARD} flex items-center gap-4 p-4`}>
                  <Cover appid={f.appid} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium tracking-tight text-white">{f.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ok">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {f.firstInstall ? 'Instalado' : 'Atualizado'} e pronto para jogar
                    </p>
                  </div>
                  <button type="button" onClick={() => launchGame(f.appid)} className={PILL_ACCENT}>
                    <Play className="h-4 w-4" />
                    Jogar
                  </button>
                </div>
              ))}
            </Section>
          )}

          <p className="text-xs leading-relaxed text-white/40">
            Quem baixa é a própria Steam: o LiquiSteam acompanha o andamento lendo o que ela grava no seu computador. A
            velocidade e o tempo restante são estimativas, e a Steam atualiza esses números a cada poucos segundos.
          </p>
        </div>
      )}
    </div>
  );
}

function Cover({ appid, large }: { appid: number; large?: boolean }) {
  return (
    <img
      src={headerImageUrl(appid)}
      alt=""
      loading="lazy"
      width={120}
      height={56}
      className={`aspect-[460/215] shrink-0 rounded-lg bg-white/[0.06] object-cover ${large ? 'w-full sm:w-[220px]' : 'w-[92px] sm:w-[120px]'}`}
    />
  );
}

function Section({ title, hint, extra, children }: { title: string; hint?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-white/85">{title}</h3>
        {extra}
      </div>
      <div className="grid gap-3">{children}</div>
      {hint && <p className="mt-2 text-xs leading-relaxed text-white/40">{hint}</p>}
    </section>
  );
}

function ProgressBar({ value, live }: { value: number; live?: boolean }) {
  return (
    <div className="dl-bar" data-live={live ? '' : undefined} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span className="dl-bar-fill" style={{ width: `${Math.max(value > 0 ? 2 : 0, value * 100)}%` }} />
    </div>
  );
}

// Quanto já foi e quanto falta, conforme a etapa: baixando conta os bytes baixados; instalando, os gravados.
function amounts(item: DownloadItem): string {
  if (item.phase === 'installing' && item.toStage > 0) return `${formatSize(item.staged)} de ${formatSize(item.toStage)} gravados`;
  if (item.toDownload > 0) return `${formatSize(item.downloaded)} de ${formatSize(item.toDownload)}`;
  if (item.toStage > 0) return `${formatSize(item.staged)} de ${formatSize(item.toStage)} gravados`;
  return '';
}

function eta(item: DownloadItem, speed: number): string {
  if (speed <= 0) return '';
  const left = item.phase === 'installing' ? 0 : Math.max(0, item.toDownload - item.downloaded);
  return left > 0 ? formatEta(left / speed) : '';
}

function ActiveCard({ item, speed }: { item: DownloadItem; speed: number }) {
  const percent = Math.floor(item.progress * 100);
  const remaining = eta(item, speed);
  return (
    <div className={`${CARD} p-5 sm:p-6`}>
      <img src={headerImageUrl(item.appid)} alt="" aria-hidden className="dl-glow pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <Cover appid={item.appid} large />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/55">
            <span className="dl-live-dot" aria-hidden />
            {PHASE_LABEL[item.phase]} · {item.firstInstall ? 'instalação' : 'atualização'}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tracking-tight text-white">{item.name}</p>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-white">{percent}%</span>
            <span className="truncate text-xs tabular-nums text-white/55">{amounts(item)}</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={item.progress} live />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums text-white/60">
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" />
              {speed > 0 ? formatSpeed(speed) : item.phase === 'installing' ? 'Gravando no disco' : 'Medindo a velocidade…'}
            </span>
            {remaining && (
              <span className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" />
                faltam ~{remaining}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={openDownloads} className={PILL_GHOST}>
          <Pause className="h-4 w-4" />
          Pausar na Steam
        </button>
      </div>
    </div>
  );
}

function Row({ item, speed, action }: { item: DownloadItem; speed?: number; action?: ReactNode }) {
  const amount = amounts(item);
  const showBar = item.phase !== 'pending' && item.progress > 0;
  return (
    <div className={`fx-lift ${CARD} p-4`}>
      <div className="flex items-center gap-4">
        <Cover appid={item.appid} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium tracking-tight text-white">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">
            {PHASE_LABEL[item.phase]}
            {item.phase === 'pending'
              ? item.toDownload > 0
                ? ` · ${formatSize(item.toDownload)} a baixar`
                : ''
              : amount
                ? ` · ${amount}`
                : ''}
            {speed ? ` · ${formatSpeed(speed)}` : ''}
          </p>
          {showBar && (
            <div className="mt-2">
              <ProgressBar value={item.progress} live={item.active} />
            </div>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

// Helper antigo (sem progresso): só a lista do que está pendente, como antes.
function LegacyList({ pending, helperButton }: { pending: UpdatesState['pending']; helperButton: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className={`${CARD} p-6`}>
        <h3 className="text-base font-semibold tracking-tight text-white">Veja o progresso ao vivo</h3>
        <p className="mt-1.5 text-sm font-light leading-relaxed text-white/60">
          Atualize o Helper para acompanhar aqui a barra de progresso, a velocidade e o tempo restante de cada download.
        </p>
        {helperButton}
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-white/50">Nenhum jogo precisa de atualização agora.</p>
      ) : (
        <Section title={`Atualizações disponíveis · ${pending.length}`}>
          {pending.map((item) => (
            <div key={item.appid} className={`fx-lift ${CARD} flex items-center gap-4 p-4`}>
              <Cover appid={item.appid} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium tracking-tight text-white">{item.name}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  Atualização esperando{item.bytesToDownload > 0 ? ` · ${formatSize(item.bytesToDownload)} a baixar` : ''}
                </p>
              </div>
              <button type="button" onClick={openDownloads} className={PILL_ACCENT}>
                <ExternalLink className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
