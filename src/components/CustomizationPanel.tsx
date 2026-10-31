import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutsideClose } from '@/lib/outsideClose';
import { useScrollLock } from '@/lib/scrollLock';
import type { CSSProperties, ReactNode } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { hexToRgbString, normalizeHex, onAccentColor, type ThemePreferences } from '@/lib/theme';
import { ACCENTS, LAYOUTS, MOTIONS, SKINS, getSkin, type SkinDefinition } from '@/lib/skins';
import { layoutIcons } from '@/components/LayoutSwitch';
import { runThemeTransition } from '@/lib/viewTransition';

interface CustomizationPanelProps {
  theme: ThemePreferences;
  onChange: (theme: ThemePreferences) => void;
  onReset: () => void;
  onClose: () => void;
}

// Duração da saída do painel (mesmo valor de .panel-aside[data-closing] no index.css).
const PANEL_CLOSE_MS = 240;

export default function CustomizationPanel({
  theme,
  onChange,
  onReset,
  onClose,
}: CustomizationPanelProps) {
  const skin = getSkin(theme.skin);
  const customAccent = !ACCENTS.some((option) => option.value.toLowerCase() === theme.accent.toLowerCase());
  const [hexDraft, setHexDraft] = useState(theme.accent);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  useScrollLock();
  const closeRef = useRef<() => void>(() => {});
  const outsideClose = useOutsideClose(() => closeRef.current());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const motionRef = useRef(theme.motion);
  motionRef.current = theme.motion;

  // Fecha com a animação de saída; sem animação (estilo "Nenhuma" ou reduzir movimento), fecha na hora.
  const requestClose = useCallback(() => {
    if (closeTimer.current !== null) return;
    const instant =
      motionRef.current === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), PANEL_CLOSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    []
  );

  useEffect(() => setHexDraft(theme.accent), [theme.accent]);

  const applyCustomAccent = (value: string) => {
    const hex = normalizeHex(value);
    const rgb = hex ? hexToRgbString(hex) : null;
    if (hex && rgb) onChange({ ...theme, accent: hex, accentRgb: rgb });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  closeRef.current = requestClose;

  return (
    <div
      className="panel-backdrop overlay-scrim fixed inset-0 z-50 flex justify-end"
      data-closing={closing ? '' : undefined}
      {...outsideClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        className="panel-aside overlay-surface h-full w-full max-w-md overflow-y-auto p-6 md:p-8"
        data-closing={closing ? '' : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none sticky top-3 z-20 -mt-5 flex h-0 justify-end md:-mt-8">
          <button
            type="button"
            onClick={requestClose}
            className="pointer-events-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-surface/90 text-white/70 shadow-lg backdrop-blur-xl transition-colors hover:border-white/30 hover:text-white"
            aria-label="Fechar aparência"
            title="Fechar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-start justify-between gap-4 pr-12">
          <div>
            <h2 id="appearance-title" className="text-2xl font-semibold tracking-tight text-white">
              Aparência
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Escolha como o LiquiSteam fica: tema, layout, cor e movimento. As escolhas ficam salvas neste navegador e, se você entrou na sua conta, em qualquer lugar em que entrar.
            </p>
          </div>
        </div>

        <Section title="Tema" order={0}>
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
                          // Cor personalizada continua ao trocar de tema; as cores prontas voltam à cor do tema.
                          ...(customAccent
                            ? {}
                            : { accent: option.accent.value, accentRgb: option.accent.rgb }),
                        }),
                      { x: event.clientX, y: event.clientY }
                    );
                  }}
                  className={`reveal relative flex items-center gap-4 rounded-2xl border p-3 text-left transition-colors ${
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

        <Section title="Layout da biblioteca" order={1}>
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
                  className={`reveal relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${
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

        <Section title="Cor de destaque" order={2}>
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
            {/* Seletor de cor livre (RGB): o clique abre o seletor do navegador. */}
            <label
              className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors focus-within:border-white/40 ${
                customAccent ? 'border-white/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/25'
              }`}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full"
                style={{
                  background: customAccent
                    ? theme.accent
                    : 'conic-gradient(from 0deg, #f43f5e, #f59e0b, #84cc16, #22d3ee, #6366f1, #d946ef, #f43f5e)',
                }}
              >
                {customAccent && <Check className="h-4 w-4" style={{ color: onAccentColor(theme.accentRgb) }} />}
              </span>
              <span className="text-[10px] text-white/55">Outra cor</span>
              <input
                type="color"
                value={normalizeHex(theme.accent) ?? '#38bdf8'}
                onChange={(event) => applyCustomAccent(event.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Escolher uma cor de destaque personalizada"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70">
            <span className="shrink-0">Código da cor</span>
            <input
              type="text"
              value={hexDraft}
              onChange={(event) => {
                setHexDraft(event.target.value);
                applyCustomAccent(event.target.value);
              }}
              onBlur={() => setHexDraft(theme.accent)}
              spellCheck={false}
              maxLength={7}
              placeholder="#38bdf8"
              aria-label="Código hexadecimal da cor de destaque"
              className="min-w-0 flex-1 bg-transparent text-right font-mono text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </label>
        </Section>

        <Section title="Transições" order={3}>
          <p className="-mt-1 mb-3 text-xs leading-relaxed text-white/50">
            Como as coisas se movem quando aparecem ou somem: troca de telas, cartões e janelas. Escolha "Nenhuma" se preferir tudo parado.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {MOTIONS.map((motion) => {
              const selected = motion.id === theme.motion;
              return (
                <button
                  key={motion.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...theme, motion: motion.id })}
                  className={`reveal relative flex items-start justify-between gap-2 rounded-2xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-[rgba(var(--accent-rgb),0.6)] bg-[rgba(var(--accent-rgb),0.08)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-white">{motion.name}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                      {motion.description}
                    </span>
                  </span>
                  {selected && <Check className="theme-accent mt-0.5 h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Biblioteca" order={4}>
          <Switch
            label="Prévia de trailer"
            description="Ao passar o mouse sobre a capa de um jogo, o trailer toca sem som. Desligue se o seu computador ou a internet ficarem pesados."
            checked={theme.trailerPreview}
            onChange={(trailerPreview) => onChange({ ...theme, trailerPreview })}
          />
        </Section>

        <Section title="Fundo" order={4}>
          <Switch
            label="Fundo animado"
            description="Luzes e formas se movendo devagar atrás do site, de acordo com o tema. Desligado, o fundo fica simples e sem efeitos."
            checked={theme.liveBackground}
            onChange={(liveBackground) => onChange({ ...theme, liveBackground })}
          />
        </Section>

        <Section title="Efeitos" order={5}>
          <div className="grid gap-3">
            <Slider
              label="Luz do mouse (brilho que segue o cursor)"
              value={theme.glowIntensity}
              min={0}
              max={1}
              step={0.05}
              display={theme.glowIntensity === 0 ? 'Desligado' : `${Math.round(theme.glowIntensity * 100)}%`}
              accent={theme.accent}
              onChange={(glowIntensity) => onChange({ ...theme, glowIntensity })}
            />
            {skin.glass ? (
              <Slider
                label="Transparência do vidro dos painéis"
                value={theme.glassOpacity}
                min={0.03}
                max={0.14}
                step={0.01}
                display={`${Math.round(theme.glassOpacity * 100)}%`}
                accent={theme.accent}
                onChange={(glassOpacity) => onChange({ ...theme, glassOpacity })}
              />
            ) : (
              <Slider
                label="Transparência dos painéis"
                value={theme.panelOpacity}
                min={0.4}
                max={1}
                step={0.05}
                display={`${Math.round(theme.panelOpacity * 100)}%`}
                accent={theme.accent}
                onChange={(panelOpacity) => onChange({ ...theme, panelOpacity })}
              />
            )}
          </div>
        </Section>

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

// Cada seção entra um pouco depois da anterior (efeito em cascata ao abrir o painel).
function Section({ title, order = 0, children }: { title: string; order?: number; children: ReactNode }) {
  return (
    <section className="detail-rise mt-8" style={{ '--d': `${140 + order * 60}ms` } as CSSProperties}>
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

function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:border-white/25"
    >
      <span>
        <span className="block text-sm text-white/80">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-white/50">{description}</span>
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full border border-white/15 transition-colors"
        style={{ background: checked ? 'var(--accent-color)' : 'rgb(255 255 255 / 0.1)' }}
      >
        <span
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
    </button>
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
