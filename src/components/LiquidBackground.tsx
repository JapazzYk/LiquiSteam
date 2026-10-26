import { useEffect, useRef } from 'react';

// Slowly drifting colored blobs that form the living dark backdrop.
// Rendered on a single canvas for performance; everything is procedural.
export default function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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
      'rgba(56, 189, 248, 0.55)', // cyan
      'rgba(99, 102, 241, 0.45)', // soft indigo (used sparingly)
      'rgba(16, 185, 129, 0.45)', // emerald
      'rgba(236, 72, 153, 0.40)', // magenta
      'rgba(245, 158, 11, 0.35)', // amber
      'rgba(20, 184, 166, 0.45)', // teal
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
    };

    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    const render = () => {
      t += 0.004;
      // Deep base
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        b.x += b.vx + Math.sin(t + b.phase) * 0.15;
        b.y += b.vy + Math.cos(t * 0.8 + b.phase) * 0.15;

        // gentle bounds wrap
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;

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

      // subtle vignette
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

      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      aria-hidden
    />
  );
}
