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

export function loadTheme(): ThemePreferences {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return defaultTheme;
    const value = JSON.parse(raw) as Partial<ThemePreferences>;
    return {
      accent: typeof value.accent === 'string' ? value.accent : defaultTheme.accent,
      accentRgb: typeof value.accentRgb === 'string' ? value.accentRgb : defaultTheme.accentRgb,
      glowIntensity: typeof value.glowIntensity === 'number' ? value.glowIntensity : defaultTheme.glowIntensity,
      glassOpacity: typeof value.glassOpacity === 'number' ? value.glassOpacity : defaultTheme.glassOpacity,
    };
  } catch {
    return defaultTheme;
  }
}

export function saveTheme(theme: ThemePreferences): void {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
}
