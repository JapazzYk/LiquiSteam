import type { LayoutId, SkinId } from '@/lib/theme';

export type Ambient = 'liquid' | 'arcade' | 'steam' | 'none';

export interface AccentOption {
  name: string;
  value: string;
  rgb: string;
}

export interface SkinDefinition {
  id: SkinId;
  name: string;
  description: string;
  font: string;
  accent: AccentOption;
  ambient: Ambient;
  // Quais controles de efeito fazem sentido neste tema.
  glass: boolean;
  glow: boolean;
  // Cores usadas na miniatura do seletor de temas.
  preview: { bg: string; card: string; ink: string };
}

export const ACCENTS: AccentOption[] = [
  { name: 'Céu', value: '#38bdf8', rgb: '56, 189, 248' },
  { name: 'Steam', value: '#66c0f4', rgb: '102, 192, 244' },
  { name: 'Cobalto', value: '#2563eb', rgb: '37, 99, 235' },
  { name: 'Oceano', value: '#2dd4bf', rgb: '45, 212, 191' },
  { name: 'Menta', value: '#34d399', rgb: '52, 211, 153' },
  { name: 'Âmbar', value: '#f59e0b', rgb: '245, 158, 11' },
  { name: 'Rosa', value: '#fb7185', rgb: '251, 113, 133' },
  { name: 'Neon', value: '#e879f9', rgb: '232, 121, 249' },
  { name: 'Prata', value: '#d4d4d8', rgb: '212, 212, 216' },
];

function accent(name: string): AccentOption {
  return ACCENTS.find((a) => a.name === name) ?? ACCENTS[0];
}

export const SKINS: SkinDefinition[] = [
  {
    id: 'liquid',
    name: 'Liquid Glass',
    description: 'Vidro translúcido sobre luzes em movimento.',
    font: 'Sora',
    accent: accent('Céu'),
    ambient: 'liquid',
    glass: true,
    glow: true,
    preview: { bg: '#05060a', card: 'rgba(255,255,255,0.14)', ink: '#ffffff' },
  },
  {
    id: 'steam',
    name: 'Steam escuro',
    description: 'O azul-marinho do cliente da Steam, sólido e de cantos retos.',
    font: 'Archivo',
    accent: accent('Steam'),
    ambient: 'steam',
    glass: false,
    glow: false,
    preview: { bg: '#171a21', card: '#2a475e', ink: '#c7d5e0' },
  },
  {
    id: 'paper',
    name: 'Minimalista claro',
    description: 'Fundo claro, cartões brancos e nenhum brilho.',
    font: 'Instrument Sans',
    accent: accent('Cobalto'),
    ambient: 'none',
    glass: false,
    glow: false,
    preview: { bg: '#eef0f3', card: '#ffffff', ink: '#181b21' },
  },
  {
    id: 'arcade',
    name: 'Arcade',
    description: 'Neon sobre uma grade em perspectiva, como num fliperama.',
    font: 'Chakra Petch',
    accent: accent('Neon'),
    ambient: 'arcade',
    glass: true,
    glow: true,
    preview: { bg: '#0d0618', card: '#2a1145', ink: '#f4eeff' },
  },
  {
    id: 'graphite',
    name: 'Grafite',
    description: 'Preto puro e tons de cinza, ideal para telas OLED.',
    font: 'Geist',
    accent: accent('Prata'),
    ambient: 'none',
    glass: false,
    glow: false,
    preview: { bg: '#000000', card: '#1c1c1c', ink: '#ececec' },
  },
];

export function getSkin(id: SkinId): SkinDefinition {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export interface LayoutDefinition {
  id: LayoutId;
  name: string;
  description: string;
}

export const LAYOUTS: LayoutDefinition[] = [
  { id: 'grid', name: 'Grade', description: 'Capas lado a lado' },
  { id: 'list', name: 'Lista', description: 'Uma linha por jogo' },
  { id: 'featured', name: 'Destaque', description: 'Sugestão do dia no topo' },
];
