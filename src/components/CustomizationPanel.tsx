import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { onAccentColor, type ThemePreferences } from '@/lib/theme';
import { ACCENTS, LAYOUTS, SKINS, getSkin, type SkinDefinition } from '@/lib/skins';
import { layoutIcons } from '@/components/LayoutSwitch';
import { runThemeTransition } from '@/lib/viewTransition';

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
  const skin = getSkin(theme.skin);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/12 bg-surface/95 p-6 shadow-[-20px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="appearance-title" className="text-2xl font-semibold tracking-tight text-white">
              Aparência
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Tema, layout e cor ficam salvos neste navegador e, com login, na sua conta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:border-white/25 hover:text-white"
            aria-label="Fechar aparência"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="Tema">
          <div className="grid gap-2.5">
            {SKINS.map((option) => {
              const selected = option.id === theme.skin;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={(event) => {
                    if (selected) return;
                    // A troca nasce no ponto clicado e se espalha pela tela.
                    runThemeTransition(
                      () =>
                        onChange({
                          ...theme,
                          skin: option.id,
                          accent: option.accent.value,
                          accentRgb: option.accent.rgb,
                        }),
                      { x: event.clientX, y: event.clientY }
                    );
                  }}
                  className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[rgba(var(--accent-rgb),0.6)] bg-[rgba(var(--accent-rgb),0.08)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <SkinPreview skin={option} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{option.name}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-white/50">
                      {option.description}
                    </span>
                  </span>
                  {selected && <Check className="theme-accent h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Layout da biblioteca">
          <div className="grid grid-cols-3 gap-2.5">
            {LAYOUTS.map((layout) => {
              const Icon = layoutIcons[layout.id];
              const selected = layout.id === theme.layout;
              return (
                <button
                  key={layout.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...theme, layout: layout.id })}
                  className={`flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[rgba(var(--accent-rgb),0.6)] bg-[rgba(var(--accent-rgb),0.08)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${selected ? 'theme-accent' : 'text-white/60'}`} />
                  <span>
                    <span className="block text-sm font-medium text-white">{layout.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                      {layout.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Cor de destaque">
          <div className="grid grid-cols-5 gap-2">
            {ACCENTS.map((option) => {
              const selected = option.value === theme.accent;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...theme, accent: option.value, accentRgb: option.rgb })}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors ${
                    selected ? 'border-white/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/25'
                  }`}
                  aria-label={`Destaque ${option.name}`}
                >
                  <span
                    className="grid h-8 w-8 place-items-center rounded-full"
                    style={{ backgroundColor: option.value }}
                  >
                    {selected && (
                      <Check className="h-4 w-4" style={{ color: onAccentColor(option.rgb) }} />
                    )}
                  </span>
                  <span className="text-[10px] text-white/55">{option.name}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {(skin.glow || skin.glass) && (
          <Section title="Efeitos">
            <div className="grid gap-3">
              {skin.glow && (
                <Slider
                  label="Brilho do cursor"
                  value={theme.glowIntensity}
                  min={0}
                  max={1}
                  step={0.05}
                  display={`${Math.round(theme.glowIntensity * 100)}%`}
                  accent={theme.accent}
                  onChange={(glowIntensity) => onChange({ ...theme, glowIntensity })}
                />
              )}
              {skin.glass && (
                <Slider
                  label="Opacidade dos vidros"
                  value={theme.glassOpacity}
                  min={0.03}
                  max={0.14}
                  step={0.01}
                  display={`${Math.round(theme.glassOpacity * 100)}%`}
                  accent={theme.accent}
                  onChange={(glassOpacity) => onChange({ ...theme, glassOpacity })}
                />
              )}
            </div>
          </Section>
        )}

        <button
          type="button"
          onClick={onReset}
          className="mt-10 flex h-10 items-center gap-2 rounded-full border border-white/12 px-4 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar padrão
        </button>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-sm font-medium text-white/85">{title}</h3>
      {children}
    </section>
  );
}

// Formato dos dois cartões na miniatura de cada tema, para dar para ver a diferença sem aplicar.
function previewCardStyle(skin: SkinDefinition): CSSProperties {
  const base: CSSProperties = { background: skin.preview.card };
  switch (skin.id) {
    case 'steam':
      return { ...base, borderRadius: 2, boxShadow: `0 0 0 1px ${skin.accent.value}` };
    case 'paper':
      return { ...base, borderRadius: 6, boxShadow: '0 3px 6px rgba(24,27,33,0.18)' };
    case 'arcade':
      return {
        ...base,
        borderRadius: 0,
        border: `1px solid ${skin.accent.value}`,
        clipPath: 'polygon(0 0, 78% 0, 100% 22%, 100% 100%, 22% 100%, 0 78%)',
        boxShadow: `2px 2px 0 ${skin.accent.value}`,
      };
    case 'graphite':
      return { ...base, borderRadius: 1, border: '1px solid rgba(255,255,255,0.18)' };
    default:
      return { ...base, borderRadius: 7, border: '1px solid rgba(255,255,255,0.22)' };
  }
}

// Miniatura do tema: fundo, dois cartões no formato do tema, a fonte e a cor de destaque sugerida.
function SkinPreview({ skin }: { skin: SkinDefinition }) {
  return (
    <span
      aria-hidden
      className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10"
      style={{ background: skin.preview.bg, fontFamily: `'${skin.font}', system-ui, sans-serif` }}
    >
      <span className="absolute left-2 top-2 h-6 w-7" style={previewCardStyle(skin)} />
      <span className="absolute left-10 top-2 h-6 w-7" style={previewCardStyle(skin)} />
      <span
        className="absolute bottom-1.5 left-2 text-[13px] font-semibold leading-none"
        style={{ color: skin.preview.ink }}
      >
        Aa
      </span>
      <span
        className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full"
        style={{ background: skin.accent.value }}
      />
    </span>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  accent,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  accent: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="mb-3 flex items-center justify-between text-sm text-white/80">
        {label}
        <span className="text-xs text-white/45">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
        style={{ accentColor: accent }}
      />
    </label>
  );
}
