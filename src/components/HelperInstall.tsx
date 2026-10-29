import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MonitorCheck, MonitorDown, ShieldAlert, Trash2, X } from 'lucide-react';
import { helperUninstall, type HelperAccess, type HelperAccessResult } from '@/lib/steamHelper';

// Instalar e desinstalar o LiquiSteam Helper (Windows), ao lado do botão da Steam.
// O helper é opcional: sem ele o site funciona, só que o status da Steam fica menos preciso.
function installerCommand(extra = ''): string {
  const base = `${window.location.origin}/helper`;
  return (
    `$r = Invoke-WebRequest -UseBasicParsing '${base}/instalar.ps1'; ` +
    `$t = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { $r.Content }; ` +
    `& ([scriptblock]::Create($t)) -Base '${base}'${extra}`
  );
}

type RemoveState = 'idle' | 'confirm' | 'working' | 'done' | 'unsupported';

interface HelperInstallProps {
  installed: boolean; // o helper está rodando neste computador
  access: HelperAccess; // permissão do navegador para falar com apps neste computador
  hint: boolean; // este navegador já teve (ou vai ter) o helper
  onChanged: () => void; // pede ao app para conferir o helper de novo
  onRequestAccess: () => Promise<HelperAccessResult>; // abre o pop-up de permissão do navegador
  onForget: () => void; // "não tenho o helper": esconde o botão de permissão
}

export default function HelperInstall({
  installed,
  access,
  hint,
  onChanged,
  onRequestAccess,
  onForget,
}: HelperInstallProps) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [lastResult, setLastResult] = useState<HelperAccessResult | null>(null);
  const [copiedInstall, setCopiedInstall] = useState(false); // já copiou o comando nesta visita
  const [copied, setCopied] = useState<'install' | 'remove' | null>(null);
  const [removeState, setRemoveState] = useState<RemoveState>('idle');
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Acompanha o resultado real: quando o helper deixa de responder, a remoção terminou.
  useEffect(() => {
    if (!installed && removeState === 'working') setRemoveState('done');
    if (installed && removeState === 'done') setRemoveState('idle');
  }, [installed, removeState]);

  // Se o helper continuar respondendo depois de um tempo, volta ao estado normal.
  useEffect(() => {
    if (removeState !== 'working') return;
    const timer = window.setTimeout(() => setRemoveState((s) => (s === 'working' ? 'idle' : s)), 8000);
    return () => window.clearTimeout(timer);
  }, [removeState]);

  // O helper foi instalado antes (ou o comando foi copiado), mas o navegador ainda não deixou o site
  // falar com ele. O pop-up só aparece por este botão, nunca ao abrir o site.
  const needsAccess = !installed && hint && (access === 'prompt' || access === 'denied');

  const ask = async () => {
    setAsking(true);
    const result = await onRequestAccess();
    setLastResult(result);
    setAsking(false);
  };

  const copy = async (kind: 'install' | 'remove') => {
    // Copiar o comando de instalação é o momento de baixar o helper: é aqui que o navegador
    // pergunta sobre o acesso, para o site já enxergar o helper assim que ele iniciar.
    if (kind === 'install' && !installed) {
      setCopiedInstall(true);
      void onRequestAccess();
    }
    try {
      await navigator.clipboard.writeText(installerCommand(kind === 'remove' ? ' -Remover' : ''));
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Sem permissão para a área de transferência: nada a fazer.
    }
  };

  const uninstall = async () => {
    setRemoveState('working');
    const ok = await helperUninstall();
    if (!ok) {
      setRemoveState('unsupported');
      return;
    }
    onForget();
    // O helper se encerra logo depois de responder; confere de novo em seguida.
    window.setTimeout(onChanged, 1500);
  };

  // Pedido de permissão (botão) ou, se já foi bloqueada, como liberar nas configurações do site.
  const accessBlock = (
    <>
      <p className="mt-2 text-[13px] leading-relaxed text-white/65">
        Para o helper funcionar, o navegador precisa deixar o LiquiSteam acessar apps e serviços neste
        dispositivo. Sem isso o site não enxerga o helper, mesmo instalado. A pergunta só aparece quando
        você clica aqui, nunca ao abrir o site.
      </p>
      {access === 'prompt' ? (
        <button
          type="button"
          onClick={ask}
          disabled={asking}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110 disabled:opacity-60"
        >
          <ShieldAlert className="h-4 w-4" />
          {asking ? 'Aguardando você no navegador…' : 'Permitir acesso'}
        </button>
      ) : (
        <div className="mt-3 grid gap-2 text-[13px] leading-relaxed text-white/65">
          <p className="text-white/80">O acesso está bloqueado neste navegador, então a pergunta não volta a aparecer.</p>
          <ol className="grid list-decimal gap-1.5 pl-5">
            <li>Clique no ícone à esquerda do endereço do site (cadeado ou controles).</li>
            <li>Em Configurações do site, ache Apps e serviços neste dispositivo e escolha Permitir.</li>
            <li>Volte aqui: o site confere sozinho e o botão do helper fica verde.</li>
          </ol>
        </div>
      )}
      {lastResult === 'dismissed' && access === 'prompt' && (
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          A pergunta foi fechada sem resposta. Clique em Permitir acesso de novo e escolha Permitir.
        </p>
      )}
    </>
  );

  const Icon = installed ? MonitorCheck : needsAccess ? ShieldAlert : MonitorDown;
  const label = installed ? 'Helper ativo' : needsAccess ? 'Permitir helper' : 'Helper';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          installed
            ? 'Helper ativo: gerenciar ou desinstalar'
            : needsAccess
              ? 'Permitir que o LiquiSteam acesse o helper neste computador'
              : 'Helper opcional: sincronizar o status com a Steam'
        }
        title={
          installed
            ? 'LiquiSteam Helper ativo'
            : needsAccess
              ? 'O navegador ainda não deixa o site falar com o helper'
              : 'Helper opcional: deixa o status da Steam sempre exato'
        }
        className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 text-sm text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
      >
        <Icon className={`h-4 w-4 ${installed ? 'text-ok' : needsAccess ? 'text-warn' : ''}`} />
        <span className="hidden whitespace-nowrap xl:inline">
          {label} {!installed && !needsAccess && <span className="text-white/45">· opcional</span>}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="LiquiSteam Helper"
          className="install-pop absolute right-0 top-full z-40 mt-3 w-[min(380px,calc(100vw-32px))] rounded-2xl border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-white">
              {installed ? 'LiquiSteam Helper' : needsAccess ? 'Permitir o acesso ao helper' : 'Sincronizar com a Steam'}
              {!needsAccess && (
                <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-white/55">
                  Opcional
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/50 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {installed ? (
            <>
              <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                O helper está ativo neste computador: o status da Steam é lido direto do Windows e o botão abre a Steam
                em segundo plano (na bandeja, sem a janela da loja) e a encerra. Ele só responde ao LiquiSteam e inicia junto com o Windows.
              </p>
              <button
                type="button"
                onClick={() => copy('install')}
                className="mt-2 text-[13px] text-white/60 underline underline-offset-2 transition-colors hover:text-white"
              >
                {copied === 'install' ? 'Comando copiado' : 'Copiar comando de atualização'}
              </button>

              {removeState === 'idle' && (
                <button
                  type="button"
                  onClick={() => setRemoveState('confirm')}
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-sm font-medium text-white/85 transition hover:border-white/30 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Desinstalar helper
                </button>
              )}

              {removeState === 'confirm' && (
                <div className="mt-4 grid gap-2">
                  <p className="text-[13px] text-white/75">
                    Remover o helper deste computador? O status da Steam volta a ser estimado.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRemoveState('idle')}
                      className="h-10 rounded-full border border-white/15 text-sm text-white/80 transition hover:border-white/30"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={uninstall}
                      className="h-10 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
                    >
                      Desinstalar
                    </button>
                  </div>
                </div>
              )}

              {removeState === 'working' && (
                <p className="mt-4 text-[13px] text-white/70">Removendo…</p>
              )}

              {removeState === 'unsupported' && (
                <div className="mt-4 grid gap-2">
                  <p className="text-[13px] leading-relaxed text-white/70">
                    Esta versão do helper é antiga e não sabe se desinstalar pelo site. Copie o comando abaixo, cole
                    no PowerShell e aperte Enter.
                  </p>
                  <button
                    type="button"
                    onClick={() => copy('remove')}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
                  >
                    {copied === 'remove' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'remove' ? 'Comando copiado' : 'Copiar comando de remoção'}
                  </button>
                </div>
              )}
            </>
          ) : needsAccess && !copiedInstall ? (
            <>
              {accessBlock}
              <button
                type="button"
                onClick={() => {
                  onForget();
                  setOpen(false);
                }}
                className="mt-3 block text-xs text-white/45 underline underline-offset-2 transition-colors hover:text-white"
              >
                Não instalei o helper
              </button>
            </>
          ) : removeState === 'done' ? (
            <p className="mt-3 text-[13px] leading-relaxed text-white/70">
              Helper removido. Se mudar de ideia, é só instalar de novo por este mesmo botão.
              <button
                type="button"
                onClick={() => setRemoveState('idle')}
                className="mt-3 block text-white/55 underline underline-offset-2 hover:text-white"
              >
                Ver como instalar
              </button>
            </p>
          ) : (
            <>
              {lastResult === 'no-helper' && (
                <p className="mt-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] leading-relaxed text-white/75">
                  O navegador já deixa o site falar com o helper, mas ele não respondeu. Se acabou de instalar, espere
                  alguns segundos; senão, rode o comando de instalação de novo.
                </p>
              )}
              <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                Este botão é opcional e não faz parte do app. Ele aparece porque o LiquiSteam Helper não está
                rodando neste computador. Instale-o, uma vez só, para o status da Steam bater sempre e para o
                botão abrir e encerrar o cliente. Só para Windows, sem precisar de administrador.
              </p>
              <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[13px] leading-relaxed text-white/65">
                <li>Abra o PowerShell (tecla Windows, digite PowerShell).</li>
                <li>Clique em Copiar comando, cole lá e aperte Enter.</li>
                <li>Quando o navegador perguntar se o LiquiSteam pode acessar apps e serviços neste dispositivo, escolha Permitir.</li>
                <li>Volte aqui: o ponto no botão da Steam fica verde.</li>
              </ol>
              <button
                type="button"
                onClick={() => copy('install')}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
              >
                {copied === 'install' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'install' ? 'Comando copiado' : 'Copiar comando'}
              </button>
              {copiedInstall && (access === 'prompt' || access === 'denied') && (
                <div className="mt-4 border-t border-white/10 pt-3">{accessBlock}</div>
              )}
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                O helper só responde ao LiquiSteam e inicia junto com o Windows. Sem ele, o site ainda funciona,
                só que o status da Steam fica estimado. Dá para desinstalar por aqui a qualquer momento.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
