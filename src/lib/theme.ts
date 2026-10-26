export interface ThemePreferences {
  accent: string;
  accentRgb: string;
  glowIntensity: number;
  glassOpacity: number;
}

export const defaultTheme: ThemePreferences = {
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
