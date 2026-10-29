import { useEffect, useRef } from 'react';
import type { Ambient } from '@/lib/skins';

// Fundo de cada tema. Liquid Glass usa manchas de luz animadas num canvas leve (meia resolução,
// 30 quadros por segundo); os outros temas animam só com CSS (transform/opacity, sem repintar).
// Com `live` desligado, o canvas desenha um quadro e para, e o CSS pausa as animações.
export default function LiquidBackground({ ambient, live = true }: { ambient: Ambient; live?: boolean }) {
  if (ambient === 'liquid') return <LiquidCanvas live={live} />;
  if (ambient === 'arcade') {
    return (
      <div className="ambient ambient-arcade" aria-hidden>
        <div className="arcade-stars" />
        <div className="arcade-sun" />
        <div className="arcade-floor">
          <div className="arcade-grid" />
        </div>
      </div>
    );
  }
  return (
    <div className={`ambient ambient-${ambient}`} aria-hidden>
      <span className="ambient-orb ambient-orb-a" />
      <span className="ambient-orb ambient-orb-b" />
      <span className="ambient-orb ambient-orb-c" />
    </div>
  );
}

// Resolução interna do canvas em relação à tela: as manchas são macias, então meia resolução
// esticada pelo CSS é igual a olho nu e custa um quarto dos pixels.
const CANVAS_SCALE = 0.5;
const FRAME_MS = 1000 / 30;

function LiquidCanvas({ live }: { live: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Com "reduzir movimento" no sistema, ou com o fundo animado desligado, desenha uma vez e para.
    const still = !live || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let last = 0;
    const dpr = CANVAS_SCALE;

    const blobs: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      color: string;
      phase: number;
    }[] = [];

    const palette = [
      'rgba(56, 189, 248, 0.55)',
      'rgba(99, 102, 241, 0.45)',
      'rgba(16, 185, 129, 0.45)',
      'rgba(236, 72, 153, 0.40)',
      'rgba(245, 158, 11, 0.35)',
      'rgba(20, 184, 166, 0.45)',
    ];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (blobs.length === 0) {
        const count = 7;
        for (let i = 0; i < count; i++) {
          blobs.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            r: 280 + Math.random() * 320,
            color: palette[i % palette.length],
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      if (still) draw();
    };

    let t = 0;
    const draw = () => {
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const r = b.r * (1 + Math.sin(t * 0.6 + b.phase) * 0.08);
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      const vg = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.3,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    };

    const step = (now = 0) => {
      raf = requestAnimationFrame(step);
      if (now - last < FRAME_MS) return;
      last = now;
      t += 0.0065;
      for (const b of blobs) {
        b.x += b.vx + Math.sin(t + b.phase) * 0.15;
        b.y += b.vy + Math.cos(t * 0.8 + b.phase) * 0.15;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
      }
      draw();
    };

    resize();
    window.addEventListener('resize', resize);
    if (still) draw();
    else raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [live]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      aria-hidden
    />
  );
}
