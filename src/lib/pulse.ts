import { useEffect } from 'react';
import { motionDisabled } from '@/lib/motion';

// Efeito único de movimento para todos os botões do site: um pulso leve, um anel fino na cor de destaque que se
// abre e some. Dispara ao passar o mouse e ao clicar/tocar. Usa a Web Animations API, então não interfere nas
// animações CSS que o botão já tenha (nada reinicia ao terminar).
const TARGET = "button, [role='button'], a[href]";
const MIN_GAP_MS = 700;

export function useUiPulse(): void {
  useEffect(() => {
    const last = new WeakMap<HTMLElement, number>();

    const pulse = (el: HTMLElement) => {
      if (el.matches(':disabled, [aria-disabled="true"], .game-card, .game-row')) return;
      const style = getComputedStyle(el);
      // Só em botões arredondados: em um botão reto o anel viraria um quadrado.
      if (parseFloat(style.borderTopLeftRadius) <= 0) return;
      const now = performance.now();
      if (now - (last.get(el) ?? 0) < MIN_GAP_MS) return;
      last.set(el, now);
      const rgb = style.getPropertyValue('--accent-rgb').trim() || '120, 200, 255';
      el.animate(
        [
          { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: `rgba(${rgb}, 0.5)`, outlineOffset: '0px' },
          { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: `rgba(${rgb}, 0)`, outlineOffset: '7px' },
        ],
        { duration: 800, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || motionDisabled()) return;
      const el = event.target instanceof Element ? event.target.closest<HTMLElement>(TARGET) : null;
      if (!el) return;
      // Só quando o mouse ENTRA no botão (não ao passar entre os filhos dele).
      const from = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (from && el.contains(from)) return;
      pulse(el);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || motionDisabled()) return;
      const el = event.target instanceof Element ? event.target.closest<HTMLElement>(TARGET) : null;
      if (el) pulse(el);
    };

    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);
}
