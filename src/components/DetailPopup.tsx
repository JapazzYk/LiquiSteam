import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOutsideClose } from '@/lib/outsideClose';
import { useScrollLock } from '@/lib/scrollLock';
import { motionDisabled } from '@/lib/motion';

interface DetailPopupProps {
  title: string;
  icon?: ReactNode;
  wide?: boolean;
  tall?: boolean;
  dirty?: boolean;
  canSave?: boolean;
  onSave?: () => Promise<boolean> | boolean;
  onDiscard?: () => void;
  onClose: () => void;
  children: ReactNode;
}

// Aba flutuante por cima do card grande (anotações, mídia, conquistas, atualizações, saber mais).
// Mesmo visual dos outros pop-ups: fundo escurecido, entrada e saída em fade, X no canto.
export default function DetailPopup({ title, icon, wide, tall, dirty, canSave, onSave, onDiscard, onClose, children }: DetailPopupProps) {
  useScrollLock();
  const [closing, setClosing] = useState(false);
  const closeNow = useRef(onClose);
  closeNow.current = onClose;
  const closingRef = useRef(false);
  const [asking, setAsking] = useState(false);
  const [savingAsk, setSavingAsk] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = !!dirty;

  const finish = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (motionDisabled()) {
      closeNow.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => closeNow.current(), 220);
  }, []);

  // Com alterações sem salvar, perguntar antes de fechar.
  const close = useCallback(() => {
    if (dirtyRef.current) setAsking(true);
    else finish();
  }, [finish]);

  // Esc fecha só esta aba (ou pergunta antes, se houver algo sem salvar) (antes de o card grande por trás receber a tecla).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);

  const outsideClose = useOutsideClose(close);

  return createPortal(
    <div
      className="panel-backdrop overlay-scrim fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4"
      data-closing={closing ? '' : undefined}
      {...outsideClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${closing ? 'fx-out' : 'fx-in'} overlay-surface reveal relative my-auto flex w-full flex-col ${tall ? 'h-[min(86vh,760px)]' : 'max-h-[88vh]'} overflow-hidden rounded-[28px] ${
          wide ? 'max-w-3xl' : 'max-w-xl'
        }`}
      >
        <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-6">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-white">
            {icon}
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/70 hover:border-white/30 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {asking && (
          <div className="fx-soft absolute inset-0 z-10 grid place-items-center bg-black/55 p-6 backdrop-blur-sm">
            <div role="alertdialog" className="fx-in overlay-surface w-full max-w-sm rounded-3xl p-6 text-center">
              <h3 className="text-lg font-semibold tracking-tight text-white">Alterações não salvas</h3>
              <p className="mt-1.5 text-sm font-light text-white/60">Você escreveu algo que ainda não foi salvo. O que fazer?</p>
              <div className="mt-5 grid gap-2">
                {canSave && (
                  <button
                    type="button"
                    disabled={savingAsk}
                    onClick={async () => {
                      setSavingAsk(true);
                      const ok = await onSave?.();
                      setSavingAsk(false);
                      if (ok) {
                        dirtyRef.current = false;
                        setAsking(false);
                        finish();
                      }
                    }}
                    className="h-10 rounded-full border border-white/20 bg-white/[0.12] text-sm font-medium text-white hover:border-white/40 disabled:opacity-50"
                  >
                    {savingAsk ? 'Salvando…' : 'Salvar e fechar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onDiscard?.();
                    dirtyRef.current = false;
                    setAsking(false);
                    finish();
                  }}
                  className="h-10 rounded-full border border-white/10 text-sm font-light text-white/70 hover:border-bad/40 hover:text-bad"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  className="h-10 rounded-full text-sm font-light text-white/55 hover:text-white"
                >
                  Continuar editando
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
