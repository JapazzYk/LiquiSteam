import { useEffect, useRef, useState } from 'react';
import { FolderOpen, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { InstalledGame } from '@/types';
import {
  helperPickResult,
  helperRemoveCustomGame,
  helperSaveCustomGame,
  helperStartPick,
  type PickKind,
} from '@/lib/steamHelper';
import { installerCommand } from '@/components/HelperInstall';
import { placeholderHue } from '@/lib/customGames';

interface AddGameDialogProps {
  helperOnline: boolean;
  // Com um jogo: edita o nome e a capa (ou remove). Sem ele: adiciona um novo.
  editing?: InstalledGame | null;
  onClose: () => void;
  onSaved: () => void; // adicionou, editou ou removeu: recarrega a biblioteca
}

type Step = 'idle' | 'waiting-exe' | 'waiting-cover' | 'saving' | 'removing';

const POLL_MS = 700;
const POLL_LIMIT_MS = 5 * 60 * 1000;

// Adicionar um jogo de fora da Steam: o helper abre a janela de escolha de arquivo do Windows (o site
// não consegue ver caminhos de arquivo), e o site só confirma o nome e a capa.
export default function AddGameDialog({ helperOnline, editing, onClose, onSaved }: AddGameDialogProps) {
  const isEdit = !!editing?.customId;
  const [step, setStep] = useState<Step>('idle');
  const [name, setName] = useState(editing?.name ?? '');
  const [exePick, setExePick] = useState<string | null>(null);
  const [exeChosen, setExeChosen] = useState(false);
  const [coverPick, setCoverPick] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(editing?.library_image || null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step === 'idle') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  // Abre a janela do Windows e espera a escolha.
  const pick = async (kind: PickKind) => {
    setError(null);
    setStep(kind === 'exe' ? 'waiting-exe' : 'waiting-cover');
    const id = await helperStartPick(kind);
    if (!id) {
      if (alive.current) {
        setStep('idle');
        setError('Não consegui abrir a janela de escolha. Atualize o LiquiSteam Helper e tente de novo.');
      }
      return;
    }
    const started = Date.now();
    while (alive.current && Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
      if (!alive.current) return;
      const result = await helperPickResult(id);
      if (!result || result.status === 'pending') continue;
      if (result.status !== 'ok') break;
      if (kind === 'exe') {
        setExePick(id);
        setExeChosen(true);
        setName((current: string) => (current.trim() ? current : result.name ?? ''));
      } else {
        setCoverPick(id);
        if (result.cover) setCoverPreview(result.cover);
      }
      setStep('idle');
      return;
    }
    if (alive.current) setStep('idle');
  };

  const canSave = name.trim().length > 0 && (isEdit || exeChosen) && step === 'idle';

  const save = async () => {
    if (!canSave) return;
    setStep('saving');
    setError(null);
    const savedId = await helperSaveCustomGame({
      id: editing?.customId,
      name: name.trim(),
      exePick: exePick ?? undefined,
      coverPick: coverPick ?? undefined,
    });
    if (!alive.current) return;
    if (!savedId) {
      setStep('idle');
      setError('Não consegui salvar. Tente escolher o arquivo de novo.');
      return;
    }
    onSaved();
    onClose();
  };

  const remove = async () => {
    if (!editing?.customId) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      window.setTimeout(() => alive.current && setConfirmRemove(false), 4000);
      return;
    }
    setStep('removing');
    const ok = await helperRemoveCustomGame(editing.customId);
    if (!alive.current) return;
    if (!ok) {
      setStep('idle');
      setError('Não consegui remover.');
      return;
    }
    onSaved();
    onClose();
  };

  const copyUpdateCommand = async () => {
    try {
      await navigator.clipboard.writeText(installerCommand());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão para a área de transferência
    }
  };

  const busy = step !== 'idle';
  const hue = placeholderHue(name || 'Jogo');

  return (
    <div
      className="panel-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-game-title"
        className="fx-in theme-glass reveal relative my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 bg-surface/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-game-title" className="text-xl font-semibold tracking-tight text-white">
              {isEdit ? 'Editar jogo' : 'Adicionar jogo'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              {isEdit
                ? 'Jogo de fora da Steam. Mude o nome ou a capa.'
                : 'Adicione um programa de fora da Steam (Epic, GOG, emulador, jogo avulso).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!helperOnline ? (
          <p className="mt-5 text-sm leading-relaxed text-white/65">
            Para adicionar jogos, o LiquiSteam precisa do Helper, que é quem abre o arquivo no Windows. Instale ou
            atualize o Helper pelo botão no topo da biblioteca e volte aqui.
          </p>
        ) : (
          <>
            <div className="mt-5 flex gap-4">
              <div
                className="relative grid aspect-[2/3] w-[96px] shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10"
                style={{
                  background: coverPreview
                    ? undefined
                    : `linear-gradient(145deg, hsl(${hue} 55% 34%), hsl(${(hue + 40) % 360} 60% 16%))`,
                }}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-4xl font-bold text-white/85">
                    {name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void pick('image')}
                  disabled={busy}
                  className="reveal relative flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm text-white/85 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                >
                  {step === 'waiting-cover' ? (
                    <Loader2 className="theme-accent h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {step === 'waiting-cover' ? 'Escolha na janela…' : coverPreview ? 'Trocar capa' : 'Escolher capa'}
                </button>
                <p className="text-xs leading-relaxed text-white/45">
                  Opcional. Sem imagem, o jogo aparece com a inicial do nome. Qualquer proporção funciona.
                </p>
              </div>
            </div>

            {!isEdit && (
              <button
                type="button"
                onClick={() => void pick('exe')}
                disabled={busy}
                className="reveal relative mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:border-white/30 disabled:opacity-60"
              >
                {step === 'waiting-exe' ? (
                  <Loader2 className="theme-accent h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
                {step === 'waiting-exe'
                  ? 'Escolha o arquivo na janela do Windows…'
                  : exeChosen
                    ? 'Arquivo escolhido. Trocar'
                    : 'Escolher o executável (.exe)'}
              </button>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs text-white/55">Nome</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                placeholder="Nome do jogo"
                className="h-11 w-full rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-sm text-white placeholder:text-white/30 transition-all focus:border-[rgba(var(--accent-rgb),0.5)] focus:outline-none"
              />
            </label>

            {error && (
              <p role="alert" className="mt-3 text-xs leading-relaxed text-bad">
                {error}{' '}
                <button type="button" onClick={copyUpdateCommand} className="underline underline-offset-2">
                  {copied ? 'Comando copiado' : 'Copiar comando de atualização do Helper'}
                </button>
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="flex h-11 items-center gap-2 rounded-full border border-white/12 px-4 text-sm text-white/65 transition hover:border-bad/50 hover:text-bad disabled:opacity-50"
                >
                  {step === 'removing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {confirmRemove ? 'Confirmar remoção' : 'Remover'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!canSave}
                className="ml-auto flex h-11 items-center gap-2 rounded-full bg-[var(--accent-color)] px-6 text-sm font-semibold text-[color:var(--on-accent)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
            {isEdit && (
              <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                Remover tira o jogo só do LiquiSteam; o programa continua no seu computador.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
