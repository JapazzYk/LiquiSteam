import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Library, Palette, Zap } from 'lucide-react';
import { steamLoginUrl } from '@/lib/steamAuth';

interface WelcomeScreenProps {
  closing: boolean;
  onContinue: () => void; // "Explorar sem entrar": fecha só nesta visita
  onNeverShow: () => void; // não mostrar de novo neste navegador
}

const stagger = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const FEATURES = [
  { icon: Library, title: 'Sua biblioteca', text: 'Os jogos instalados, organizados e com a capa certa.' },
  { icon: Zap, title: 'Steam a um clique', text: 'Abra e encerre a Steam, e veja o status em tempo real.' },
  { icon: Palette, title: 'Do seu jeito', text: 'Temas, cores, transições e fundo animado à sua escolha.' },
];

// Boas-vindas para quem ainda não entrou com a Steam. Aparece sobre o fundo animado do tema e some
// com a mesma transição do resto do site.
export default function WelcomeScreen({ closing, onContinue, onNeverShow }: WelcomeScreenProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className={`${closing ? 'fx-out' : 'fx-soft'} fixed inset-0 z-[45] flex items-center justify-center overflow-y-auto bg-canvas/75 p-5 backdrop-blur-xl`}
    >
      <div className="fx-in theme-glass reveal relative my-auto w-full max-w-[520px] overflow-hidden rounded-[32px] border border-white/15 p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ boxShadow: 'inset 0 0 90px 12px rgba(var(--accent-rgb), 0.12)' }}
        />

        <div className="relative">
          <div className="detail-rise mx-auto grid h-20 w-20 place-items-center" style={stagger(120)}>
            <img
              src="/logo.png"
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 object-contain drop-shadow-[0_6px_24px_rgba(var(--accent-rgb),0.55)]"
            />
          </div>

          <p className="detail-rise mt-5 text-xs font-medium uppercase tracking-[0.22em] text-white/50" style={stagger(200)}>
            Bem-vindo ao
          </p>
          <h1
            id="welcome-title"
            className="hero-title detail-rise mt-1 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl"
            style={stagger(260)}
          >
            LiquiSteam
          </h1>
          <p className="detail-rise mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-white/65" style={stagger(340)}>
            Sua biblioteca da Steam num só lugar, com o visual que você escolher.
          </p>

          <ul className="mt-7 grid gap-3 text-left">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.title}
                className="detail-rise flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                style={stagger(440 + index * 90)}
              >
                <span className="theme-accent-surface grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                  <feature.icon className="theme-accent h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium tracking-tight text-white">{feature.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-white/55">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="detail-rise mt-8 grid gap-3" style={stagger(760)}>
            <button
              type="button"
              onClick={() => {
                window.location.href = steamLoginUrl();
              }}
              className="reveal group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-[#171a21] px-6 text-snow shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all hover:bg-[#1b2838] active:scale-[0.99]"
            >
              <img src="/steam-logo.png" alt="" width={24} height={24} className="h-6 w-6" />
              <span className="text-[15px] font-medium tracking-tight">Entrar com a Steam</span>
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="h-11 w-full rounded-xl text-sm text-white/65 transition-colors hover:text-white"
            >
              Explorar sem entrar
            </button>
          </div>

          <p className="detail-rise mt-4 text-[11px] leading-relaxed text-white/40" style={stagger(840)}>
            O login acontece no site da Steam. O LiquiSteam recebe só o seu SteamID público e o nome do perfil,
            nunca a sua senha.
          </p>
          <button
            type="button"
            onClick={onNeverShow}
            className="detail-rise mt-3 text-[11px] text-white/35 underline underline-offset-2 transition-colors hover:text-white/70"
            style={stagger(900)}
          >
            Não mostrar de novo
          </button>
        </div>
      </div>
    </div>
  );
}
