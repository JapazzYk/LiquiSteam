import { flushSync } from 'react-dom';

type ViewTransition = { ready: Promise<void> };
type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

// Troca o tema com uma revelação circular a partir do ponto clicado.
// Em navegadores sem View Transitions (ou com "reduzir movimento"), só aplica a troca.
export function runThemeTransition(update: () => void, origin?: { x: number; y: number }): void {
  const doc = document as DocumentWithTransitions;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduceMotion) {
    update();
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(() => {
    flushSync(update);
  });

  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 700,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => undefined);
}
