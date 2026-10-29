import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { Ambient } from '@/lib/skins';

// Fundo de cada tema. Liquid Glass usa manchas de luz num canvas leve (meia resolução, 30 quadros por
// segundo) mais bolhas de vidro; Arcade, Steam, Minimalista e Grafite animam só com CSS
// (transform/opacity, sem repintar a tela).
// Com `live` desligado, o canvas desenha um quadro e para, e o CSS pausa as animações.
export default function LiquidBackground({ ambient, live = true }: { ambient: Ambient; live?: boolean }) {
  if (ambient === 'liquid') {
    return (
      <>
        <LiquidCanvas live={live} />
        <LiquidBubbles />
      </>
    );
  }
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
  if (ambient === 'steam') return <SteamAmbient />;
  if (ambient === 'paper') return <PaperAmbient />;
  return <GraphiteAmbient />;
}

// Gerador pseudoaleatório com semente fixa: os elementos de fundo nascem sempre nos mesmos lugares,
// então o fundo não "pula" quando o React renderiza de novo.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

// Minimalista claro: pontinhos cinzas que acendem e apagam em lugares aleatórios, bem discretos.
function PaperAmbient() {
  const dots = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: 70 }, () => ({
      '--x': `${range(rand, 1, 99).toFixed(2)}%`,
      '--y': `${range(rand, 1, 99).toFixed(2)}%`,
      '--s': `${range(rand, 3, 7).toFixed(1)}px`,
      '--t': `${range(rand, 5, 11).toFixed(1)}s`,
      '--dl': `-${range(rand, 0, 11).toFixed(1)}s`,
      '--peak': range(rand, 0.18, 0.4).toFixed(2),
    })) as CSSProperties[];
  }, []);
  return (
    <div className="ambient ambient-paper" aria-hidden>
      {dots.map((style, index) => (
        <span key={index} className="ambient-dot" style={style} />
      ))}
    </div>
  );
}

// Steam escuro: vapor. Névoa azulada que passa devagar e fagulhas azuis que sobem.
function SteamAmbient() {
  const motes = useMemo(() => {
    const rand = seeded(21);
    return Array.from({ length: 22 }, () => ({
      '--x': `${range(rand, 2, 98).toFixed(2)}%`,
      '--s': `${range(rand, 2, 5).toFixed(1)}px`,
      '--t': `${range(rand, 14, 30).toFixed(1)}s`,
      '--dl': `-${range(rand, 0, 30).toFixed(1)}s`,
      '--dx': `${range(rand, -60, 60).toFixed(0)}px`,
    })) as CSSProperties[];
  }, []);
  return (
    <div className="ambient ambient-steam" aria-hidden>
      <span className="ambient-orb ambient-orb-a" />
      <span className="ambient-orb ambient-orb-b" />
      <span className="steam-fog steam-fog-a" />
      <span className="steam-fog steam-fog-b" />
      {motes.map((style, index) => (
        <span key={index} className="steam-mote" style={style} />
      ))}
    </div>
  );
}

// Grafite: um facho de luz que atravessa o preto de tempos em tempos e um brilho que respira embaixo.
function GraphiteAmbient() {
  return (
    <div className="ambient ambient-graphite" aria-hidden>
      <span className="graphite-sheen" />
      <span className="graphite-glow" />
    </div>
  );
}

// Liquid Glass: bolhas de vidro que sobem devagar por cima das luzes do canvas.
function LiquidBubbles() {
  const bubbles = useMemo(() => {
    const rand = seeded(3);
    return Array.from({ length: 16 }, () => ({
      '--x': `${range(rand, 2, 98).toFixed(2)}%`,
      '--s': `${range(rand, 12, 48).toFixed(0)}px`,
      '--t': `${range(rand, 20, 42).toFixed(1)}s`,
      '--dl': `-${range(rand, 0, 42).toFixed(1)}s`,
      '--dx': `${range(rand, -90, 90).toFixed(0)}px`,
    })) as CSSProperties[];
  }, []);
  return (
    <div className="ambient ambient-liquid-bubbles" aria-hidden>
      {bubbles.map((style, index) => (
        <span key={index} className="liquid-bubble" style={style} />
      ))}
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
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
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
        b.x += b.vx + Math.sin(t + b.phase) * 0.25;
        b.y += b.vy + Math.cos(t * 0.8 + b.phase) * 0.25;
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
