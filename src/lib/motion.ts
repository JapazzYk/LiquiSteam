import { useEffect, useState } from 'react';

// Animações desligadas: estilo "Nenhuma" escolhido no painel de aparência ou "reduzir movimento" no sistema.
export function motionDisabled(): boolean {
  return (
    document.documentElement.dataset.motion === 'none' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Mantém um elemento na tela durante a animação de saída. Use `mounted` para decidir se renderiza e
// `closing` para trocar a classe de entrada (fx-in) pela de saída (fx-out).
export function usePresence(open: boolean, exitMs = 180): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (motionDisabled()) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);

  return { mounted: open || mounted, closing: !open && mounted };
}
