import { useEffect } from 'react';

// Trava a rolagem da página enquanto há uma janela aberta por cima (card do jogo, aparência, etc.).
// Conta quantas janelas pedem a trava, para funcionar com várias abertas ao mesmo tempo.
let locks = 0;

function apply() {
  const on = locks > 0;
  document.documentElement.toggleAttribute('data-scroll-locked', on);
}

export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    apply();
    return () => {
      locks = Math.max(0, locks - 1);
      apply();
    };
  }, [active]);
}
