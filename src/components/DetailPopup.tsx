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
  onClose: () => void;
  children: ReactNode;
}

// Aba flutuante por cima do card grande (anotações, mídia, conquistas, atualizações, saber mais).
// Mesmo visual dos outros pop-ups: fundo escurecido, entrada e saída em fade, X no canto.
export default function DetailPopup({ title, icon, wide, onClose, children }: DetailPopupProps) {
  useScrollLock();
  const [closing, setClosing] = useState(false);
  const closeNow = useRef(onClose);
  closeNow.current = onClose;
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (motionDisabled()) {
      closeNow.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => closeNow.current(), 220);
  }, []);

  // Esc fecha só esta aba (antes de o card grande por trás receber a tecla).
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
        className={`${closing ? 'fx-out' : 'fx-in'} overlay-surface reveal relative my-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[28px] ${
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
      </div>
    </div>,
    document.body
  );
}
