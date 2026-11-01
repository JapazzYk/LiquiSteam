import { useEffect } from 'react';
import { motionDisabled } from '@/lib/motion';

// Movimento comum a todos os botões e ícones (ver "Sistema de movimento" em index.css).
//  1. Ícones: ao passar o mouse ou focar, o traço do ícone é "redesenhado". Para isso cada forma do ícone
//     (path, circle, line...) recebe pathLength="1" e o CSS anima o traço de 0 a 1. Nenhum ícone muda de tamanho.
//  2. Toque: todo botão dá um aperto curto ao ser clicado e volta sozinho. Usa a Web Animations API na propriedade
//     scale, então não interfere nas animações CSS que o botão já tenha (nada reinicia ao soltar).
const SHAPES = 'path, circle, line, polyline, polygon, rect, ellipse';
const TAPPABLE = "button, [role='button'], a[href]";

function mark(root: ParentNode): void {
  root.querySelectorAll<SVGElement>(`svg.lucide :is(${SHAPES})`).forEach((shape) => {
    if (!shape.hasAttribute('pathLength')) shape.setAttribute('pathLength', '1');
  });
}

export function useUiMotion(): void {
  useEffect(() => {
    mark(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) mark(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || motionDisabled()) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TAPPABLE) : null;
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      // Cartões grandes (capa dos jogos) ficam de fora: só o hover deles já basta.
      if (target.classList.contains('game-card') || target.classList.contains('game-row')) return;
      target.animate([{ scale: 1 }, { scale: 0.96, offset: 0.4 }, { scale: 1 }], {
        duration: 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);
}
