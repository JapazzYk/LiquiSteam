export type SkinId = 'liquid' | 'steam' | 'paper' | 'arcade' | 'graphite';
export type LayoutId = 'grid' | 'list' | 'featured';

export const SKIN_IDS: SkinId[] = ['liquid', 'steam', 'paper', 'arcade', 'graphite'];
export const LAYOUT_IDS: LayoutId[] = ['grid', 'list', 'featured'];

export interface ThemePreferences {
  skin: SkinId;
  layout: LayoutId;
  accent: string;
  accentRgb: string;
  glowIntensity: number;
  glassOpacity: number;
}

export const defaultTheme: ThemePreferences = {
  skin: 'liquid',
  layout: 'grid',
  accent: '#38bdf8',
  accentRgb: '56, 189, 248',
  glowIntensity: 0.7,
  glassOpacity: 0.06,
};

const THEME_KEY = 'liquid_steam_theme';

// Garante que um valor vindo do banco ou do navegador tenha o formato esperado.
export function normalizeTheme(value: unknown): ThemePreferences {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ThemePreferences>;
  return {
    skin: SKIN_IDS.includes(v.skin as SkinId) ? (v.skin as SkinId) : defaultTheme.skin,
    layout: LAYOUT_IDS.includes(v.layout as LayoutId) ? (v.layout as LayoutId) : defaultTheme.layout,
    accent: typeof v.accent === 'string' ? v.accent : defaultTheme.accent,
    accentRgb: typeof v.accentRgb === 'string' ? v.accentRgb : defaultTheme.accentRgb,
    glowIntensity: typeof v.glowIntensity === 'number' ? v.glowIntensity : defaultTheme.glowIntensity,
    glassOpacity: typeof v.glassOpacity === 'number' ? v.glassOpacity : defaultTheme.glassOpacity,
  };
}

// Cache local do tema (para a primeira pintura da tela). A fonte de verdade é a conta.
export function loadTheme(): ThemePreferences {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return defaultTheme;
    return normalizeTheme(JSON.parse(raw));
  } catch {
    return defaultTheme;
  }
}

export function saveTheme(theme: ThemePreferences): void {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  } catch {
    // ignora
  }
}

// Cor do texto sobre a cor de destaque: escuro em destaques claros, branco nos escuros.
export function onAccentColor(rgb: string): string {
  const channels = rgb.split(',').map((part) => Number(part.trim()) / 255);
  if (channels.length !== 3 || channels.some((c) => !Number.isFinite(c))) return '#04101f';
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.18 ? '#04101f' : '#ffffff';
}
