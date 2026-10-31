import { useRef } from 'react';
import type { PointerEvent, MouseEvent } from 'react';

// Fechar clicando fora, mas só quando o clique INTEIRO foi no fundo: apertar e soltar o botão do mouse
// em cima do próprio fundo. Se o clique começou dentro da janela (ex.: ao selecionar um texto) e o botão
// foi solto fora dela, nada fecha.
export function useOutsideClose(onClose: () => void, enabled = true) {
  const pressedOnBackdrop = useRef(false);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      pressedOnBackdrop.current = enabled && event.button === 0 && event.target === event.currentTarget;
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      const ok = pressedOnBackdrop.current && event.target === event.currentTarget;
      pressedOnBackdrop.current = false;
      if (ok) onClose();
    },
  };
}
