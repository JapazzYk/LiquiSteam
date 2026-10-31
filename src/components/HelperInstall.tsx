import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MonitorCheck, MonitorDown, ShieldAlert, Trash2, X } from 'lucide-react';
import { usePresence } from '@/lib/motion';
import { helperUninstall, type HelperAccess, type HelperAccessResult } from '@/lib/steamHelper';

// Instalar e desinstalar o LiquiSteam Helper (Windows), ao lado do botão da Steam.
// O helper é opcional: sem ele o site funciona, só que o status da Steam fica menos preciso.
export function installerCommand(extra = ''): string {
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
  const pop = usePresence(open);
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
        O Helper já pode estar instalado, mas o seu navegador (Chrome ou Edge) precisa de uma permissão para o
        site conversar com ele. É uma proteção do navegador: ela só vale para este endereço e a pergunta nunca
        aparece sozinha, apenas quando você clicar abaixo.
      </p>
      {access === 'prompt' ? (
        <button
          type="button"
          onClick={ask}
          disabled={asking}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110 disabled:opacity-60"
        >
          <ShieldAlert className="h-4 w-4" />
          {asking ? 'Responda a pergunta no navegador…' : 'Permitir acesso'}
        </button>
      ) : (
        <div className="mt-3 grid gap-2 text-[13px] leading-relaxed text-white/65">
          <p className="text-white/80">Essa permissão está bloqueada no navegador, por isso a pergunta não aparece mais. Dá para liberar manualmente:</p>
          <ol className="grid list-decimal gap-1.5 pl-5">
            <li>Clique no ícone ao lado esquerdo do endereço do site, lá em cima (cadeado ou dois traços).</li>
            <li>Abra "Configurações do site", procure "Apps e serviços neste dispositivo" e escolha "Permitir".</li>
            <li>Volte para esta página: o site percebe sozinho e o botão do Helper fica verde.</li>
          </ol>
        </div>
      )}
      {lastResult === 'dismissed' && access === 'prompt' && (
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          A pergunta do navegador foi fechada sem resposta. Clique em "Permitir acesso" de novo e, na caixa que aparecer, escolha "Permitir".
        </p>
      )}
    </>
  );

  const Icon = installed ? MonitorCheck : needsAccess ? ShieldAlert : MonitorDown;
  const label = installed ? 'Helper funcionando' : needsAccess ? 'Permitir Helper' : 'Helper';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          installed
            ? 'Helper ativo: ver detalhes ou desinstalar'
            : needsAccess
              ? 'Dar ao site a permissão para falar com o Helper deste computador'
              : 'Helper (opcional): saiba o que é e como instalar'
        }
        title={
          installed
            ? 'LiquiSteam Helper está funcionando'
            : needsAccess
              ? 'O navegador ainda precisa da sua permissão para falar com o Helper'
              : 'Helper opcional: deixa o status da Steam sempre exato'
        }
        className="reveal relative flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 text-sm text-white/80 backdrop-blur-xl transition-all hover:border-white/30 hover:text-white"
      >
        <Icon className={`h-4 w-4 ${installed ? 'text-ok' : needsAccess ? 'text-warn' : ''}`} />
        <span className="hidden whitespace-nowrap xl:inline">
          {label} {!installed && !needsAccess && <span className="text-white/45">· opcional</span>}
        </span>
      </button>

      {pop.mounted && (
        <div
          role="dialog"
          aria-label="LiquiSteam Helper"
          className={`${pop.closing ? 'fx-out' : 'fx-in'} install-pop overlay-surface absolute right-0 top-full z-40 mt-3 w-[min(380px,calc(100vw-32px))] rounded-2xl border p-4`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold tracking-tight text-white">
              {installed ? 'LiquiSteam Helper' : needsAccess ? 'Falta uma permissão do navegador' : 'O que é o Helper?'}
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
                Está tudo certo: o Helper está funcionando neste computador. Graças a ele o LiquiSteam sabe se a Steam
                e os seus jogos estão abertos, consegue abrir e fechar a Steam, executar jogos que não são da Steam
                e mostrar as atualizações pendentes. Ele só obedece ao site do LiquiSteam e liga sozinho junto com o Windows.
              </p>
              <button
                type="button"
                onClick={() => copy('install')}
                className="mt-2 text-[13px] text-white/60 underline underline-offset-2 transition-colors hover:text-white"
              >
                {copied === 'install' ? 'Comando copiado' : 'Copiar o comando para atualizar o Helper'}
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
                    Desinstalar o Helper deste computador? O site continua funcionando, mas perde o que depende dele (executar jogos, jogos avulsos, atualizações e o status exato da Steam). Você pode instalar de novo quando quiser.
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
                <p className="mt-4 text-[13px] text-white/70">Desinstalando o Helper…</p>
              )}

              {removeState === 'unsupported' && (
                <div className="mt-4 grid gap-2">
                  <p className="text-[13px] leading-relaxed text-white/70">
                    Seu Helper é de uma versão antiga e não sabe se desinstalar sozinho por aqui. Sem problema: copie o
                    comando abaixo, abra o PowerShell (tecla Windows, digite PowerShell), cole o comando com Ctrl+V e aperte Enter.
                  </p>
                  <button
                    type="button"
                    onClick={() => copy('remove')}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent-color)] text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110"
                  >
                    {copied === 'remove' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied === 'remove' ? 'Comando copiado' : 'Copiar o comando para desinstalar'}
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
                Eu não instalei o Helper
              </button>
            </>
          ) : removeState === 'done' ? (
            <p className="mt-3 text-[13px] leading-relaxed text-white/70">
              O Helper foi desinstalado. Se mudar de ideia, é só instalar de novo por este mesmo botão.
              <button
                type="button"
                onClick={() => setRemoveState('idle')}
                className="mt-3 block text-white/55 underline underline-offset-2 hover:text-white"
              >
                Ver como instalar de novo
              </button>
            </p>
          ) : (
            <>
              {lastResult === 'no-helper' && (
                <p className="mt-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] leading-relaxed text-white/75">
                  A permissão do navegador está certa, mas o Helper não respondeu. Se você acabou de instalar, espere uns
                  segundos e clique de novo. Se continuar assim, rode o comando de instalação mais uma vez.
                </p>
              )}
              <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                O LiquiSteam funciona direto no navegador, e por segurança um site não pode abrir programas no seu
                computador. O Helper é um miniprograma gratuito, opcional, que você instala uma única vez no Windows
                para liberar isso: executar e encerrar jogos (inclusive os que não são da Steam), abrir e fechar a
                Steam, ver o status exato e listar as atualizações pendentes. Não precisa de administrador e não
                mexe nos seus jogos.
              </p>
              <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-[13px] leading-relaxed text-white/65">
                <li>Aperte a tecla Windows, digite PowerShell e abra o programa (uma janela azul ou preta).</li>
                <li>Clique no botão "Copiar comando" abaixo, cole na janela com Ctrl+V e aperte Enter.</li>
                <li>Se o navegador perguntar se este site pode acessar "apps e serviços neste dispositivo", escolha "Permitir". É isso que deixa o site falar com o Helper.</li>
                <li>Volte para esta página: o botão do Helper vira "Helper funcionando" e o ponto no botão da Steam fica verde.</li>
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
                O Helper só aceita pedidos do site do LiquiSteam, não envia nada seu para a internet e liga junto com o
                Windows. Sem ele o site continua funcionando para ver a biblioteca; você só não terá os recursos
                acima. Dá para desinstalar por aqui a qualquer momento.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
