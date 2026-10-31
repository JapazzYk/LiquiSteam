import { useEffect } from 'react';

// Luz do cursor no estilo "Reveal" do menu do Windows 10/11: em vez de uma bola de luz solta, o cursor
// acende a interface. Cartões, linhas, busca e botões marcados com a classe "reveal" recebem a posição
// do cursor (--rx, --ry, em pixels, relativa a cada elemento) e desenham, pelo CSS, um brilho na borda e
// um clarão suave na superfície. Elementos vizinhos só acendem a borda quando o cursor está bem perto deles.
// Só os elementos perto do cursor são atualizados; o resto não é tocado.
const REVEAL_SELECTOR = '.reveal, .game-card, .game-row, .search-shell';
// Distância (px) além da borda de um elemento em que ele ainda recebe a luz.
const RANGE = 60;

export default function CursorGlow() {
  useEffect(() => {
    let elements: HTMLElement[] = [];
    let stale = true;
    let x = -9999;
    let y = -9999;
    let frame = 0;
    const lit = new Set<HTMLElement>();
    const last = new Map<HTMLElement, string>();

    const clear = (el: HTMLElement) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--ra');
      last.delete(el);
    };

    const update = () => {
      frame = 0;
      if (stale) {
        elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
        stale = false;
      }

      // Primeiro lê todas as posições, depois escreve: uma única passagem de layout por quadro.
      const near: { el: HTMLElement; rx: number; ry: number }[] = [];
      // Com uma janela aberta por cima, só o que está dentro dela recebe luz (o resto está escondido atrás).
      const locked = document.documentElement.hasAttribute('data-scroll-locked');
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const el of elements) {
        if (!el.isConnected) continue;
        if (locked && !el.closest('.overlay-scrim')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        // Fora da tela não há o que acender.
        if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const dy = Math.max(rect.top - y, 0, y - rect.bottom);
        if (dx * dx + dy * dy > RANGE * RANGE) continue;
        // O retângulo medido já inclui escala e deslocamento (hover, animação de entrada); o brilho é
        // desenhado no espaço do próprio elemento, então a posição precisa ser convertida de volta.
        const sx = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
        const sy = el.offsetHeight > 0 ? rect.height / el.offsetHeight : 1;
        near.push({ el, rx: (x - rect.left) / (sx || 1), ry: (y - rect.top) / (sy || 1) });
      }

      const next = new Set<HTMLElement>();
      for (const { el, rx, ry } of near) {
        const px = Math.round(rx);
        const py = Math.round(ry);
        // Só escreve quando muda, para não forçar repintura à toa (evita cintilar).
        const key = `${px},${py}`;
        if (last.get(el) !== key || !lit.has(el)) {
          last.set(el, key);
          el.style.setProperty('--rx', String(px));
          el.style.setProperty('--ry', String(py));
        }
        if (!lit.has(el)) el.style.setProperty('--ra', '1');
        next.add(el);
      }
      for (const el of lit) if (!next.has(el)) clear(el);
      lit.clear();
      next.forEach((el) => lit.add(el));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      schedule();
    };

    const onLeave = () => {
      x = -9999;
      y = -9999;
      schedule();
    };

    // Rolar a página move os elementos debaixo do cursor parado; novos elementos entram na lista.
    const onScroll = () => {
      if (x > -9000) schedule();
    };

    let mutationTimer = 0;
    const observer = new MutationObserver(() => {
      stale = true;
      window.clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(() => {
        if (x > -9000) schedule();
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('scroll', onScroll, true);
      observer.disconnect();
      window.clearTimeout(mutationTimer);
      if (frame) cancelAnimationFrame(frame);
      lit.forEach(clear);
    };
  }, []);

  return null;
}
