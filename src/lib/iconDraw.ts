import { useEffect } from 'react';
import { motionDisabled } from '@/lib/motion';

// Movimento comum a todos os botões e ícones (ver "Sistema de movimento" em index.css).
//  Tudo acontece no CLIQUE (passar o mouse só muda cor):
//  1. Ícones: ao clicar, o traço do ícone é "redesenhado". Para isso cada forma do ícone (path, circle, line...)
//     recebe pathLength="1" e o CSS anima o traço de 0 a 1 enquanto o botão tem o atributo data-draw.
//     Nenhum ícone muda de tamanho nem de lugar.
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

    const drawTimers = new WeakMap<HTMLElement, number>();
    const feedback = (target: HTMLElement) => {
      if (target.matches(':disabled, [aria-disabled="true"]')) return;
      // Redesenha o traço dos ícones do botão.
      if (target.querySelector('svg.lucide')) {
        const previous = drawTimers.get(target);
        if (previous !== undefined) window.clearTimeout(previous);
        target.removeAttribute('data-draw');
        void target.offsetWidth; // reinicia a animação se o clique for repetido
        target.setAttribute('data-draw', '');
        drawTimers.set(target, window.setTimeout(() => target.removeAttribute('data-draw'), 700));
      }
      // Cartões grandes (capa dos jogos) ficam de fora do toque de escala.
      if (target.classList.contains('game-card') || target.classList.contains('game-row')) return;
      target.animate([{ scale: 1 }, { scale: 0.96, offset: 0.4 }, { scale: 1 }], {
        duration: 420,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || motionDisabled()) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TAPPABLE) : null;
      if (target) feedback(target);
    };
    // Teclado: Enter e Espaço também contam como clique.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat || motionDisabled()) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TAPPABLE) : null;
      if (target) feedback(target);
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown, { passive: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
