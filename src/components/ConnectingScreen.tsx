import { Loader2 } from 'lucide-react';
import { useScrollLock } from '@/lib/scrollLock';

export interface ConnectStep {
  label: string;
  done: boolean;
}

interface ConnectingScreenProps {
  steps: ConnectStep[];
  closing: boolean;
}

// Tela cheia enquanto o LiquiSteam termina de ler a conta Steam. Some sozinha quando tudo está pronto.
export default function ConnectingScreen({ steps, closing }: ConnectingScreenProps) {
  useScrollLock();
  const firstPending = steps.findIndex((step) => !step.done);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Conectando à Steam"
      className={`${closing ? 'fx-out' : 'fx-soft'} overlay-scrim fixed inset-0 z-[80] flex items-center justify-center p-5`}
      style={{ backgroundColor: 'rgb(var(--bg) / 0.94)' }}
    >
      <div className="fx-in w-full max-w-sm text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-[color:var(--accent-color)] motion-safe:animate-spin"
          />
          <img src="/logo.png" alt="" width={56} height={56} className="h-14 w-14 object-contain" />
        </div>
        <h2 className="hero-title mt-6 text-2xl font-semibold tracking-tight text-white">Conectando à Steam</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          O LiquiSteam está lendo a sua conta e a sua biblioteca. Isso leva só alguns segundos; a tela some sozinha quando
          terminar.
        </p>
        <ul className="mx-auto mt-6 grid max-w-xs gap-2 text-left">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-3 text-sm">
              <span
                key={step.done ? 'done' : 'wait'}
                className={`conn-mark grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  step.done
                    ? 'border-ok/50 bg-ok/15 text-ok'
                    : index === firstPending
                      ? 'border-[rgba(var(--accent-rgb),0.5)] text-[color:var(--accent-color)]'
                      : 'border-white/15 text-white/25'
                }`}
              >
                {step.done ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path className="conn-check" d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : index === firstPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
              </span>
              <span className={step.done ? 'text-white/80' : index === firstPending ? 'text-white' : 'text-white/40'}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
