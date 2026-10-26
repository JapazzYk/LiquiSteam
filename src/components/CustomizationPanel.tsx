import { Check, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import type { ThemePreferences } from '@/lib/theme';

const accentOptions = [
  { name: 'Céu', value: '#38bdf8', rgb: '56, 189, 248' },
  { name: 'Menta', value: '#34d399', rgb: '52, 211, 153' },
  { name: 'Âmbar', value: '#f59e0b', rgb: '245, 158, 11' },
  { name: 'Rosa', value: '#fb7185', rgb: '251, 113, 133' },
  { name: 'Oceano', value: '#2dd4bf', rgb: '45, 212, 191' },
];

interface CustomizationPanelProps {
  theme: ThemePreferences;
  onChange: (theme: ThemePreferences) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function CustomizationPanel({
  theme,
  onChange,
  onReset,
  onClose,
}: CustomizationPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="theme-glass h-full w-full max-w-sm overflow-y-auto border-l border-white/15 bg-[#0b1018]/90 p-6 shadow-[-20px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sky-300" style={{ color: theme.accent }}>
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-[0.18em]">Personalizar</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Seu launcher</h2>
            <p className="mt-2 text-sm font-light leading-relaxed text-white/50">
              Ajuste a cor de destaque, o reflexo do cursor e a transparência dos vidros.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:border-white/25 hover:text-white"
            aria-label="Fechar personalização"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/85">Cor de destaque</h3>
              <span className="text-xs font-light text-white/40">Bordas e luz</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {accentOptions.map((option) => {
                const selected = option.value === theme.accent;
                return (
                  <button
                    key={option.value}
                    onClick={() => onChange({ ...theme, accent: option.value, accentRgb: option.rgb })}
                    className={`group flex flex-col items-center gap-2 rounded-2xl border p-2 transition-all ${
                      selected ? 'border-white/45 bg-white/[0.12]' : 'border-white/10 bg-white/[0.04] hover:border-white/25'
                    }`}
                    aria-label={`Usar tema ${option.name}`}
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full shadow-[0_0_18px_currentColor]"
                      style={{ backgroundColor: option.value, color: option.value }}
                    >
                      {selected && <Check className="h-4 w-4 text-[#071018]" />}
                    </span>
                    <span className="text-[10px] font-light text-white/55">{option.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <span className="mb-3 flex items-center justify-between text-sm text-white/80">
              Intensidade da luz
              <span className="text-xs text-white/40">{Math.round(theme.glowIntensity * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={theme.glowIntensity}
              onChange={(event) => onChange({ ...theme, glowIntensity: Number(event.target.value) })}
              className="w-full accent-sky-400"
              style={{ accentColor: theme.accent }}
            />
          </label>

          <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <span className="mb-3 flex items-center justify-between text-sm text-white/80">
              Transparência dos vidros
              <span className="text-xs text-white/40">{Math.round(theme.glassOpacity * 100)}%</span>
            </span>
            <input
              type="range"
              min="0.03"
              max="0.14"
              step="0.01"
              value={theme.glassOpacity}
              onChange={(event) => onChange({ ...theme, glassOpacity: Number(event.target.value) })}
              className="w-full accent-sky-400"
              style={{ accentColor: theme.accent }}
            />
          </label>
        </section>

        <button
          onClick={onReset}
          className="mt-8 flex h-10 items-center gap-2 rounded-full border border-white/12 px-4 text-sm font-light text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </button>
      </aside>
    </div>
  );
}
