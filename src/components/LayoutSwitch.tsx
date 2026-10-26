import { GalleryVerticalEnd, LayoutGrid, List } from 'lucide-react';
import type { LayoutId } from '@/lib/theme';
import { LAYOUTS } from '@/lib/skins';

export const layoutIcons: Record<LayoutId, typeof LayoutGrid> = {
  grid: LayoutGrid,
  list: List,
  featured: GalleryVerticalEnd,
};

interface LayoutSwitchProps {
  value: LayoutId;
  onChange: (layout: LayoutId) => void;
}

// Troca rápida de layout no topo da biblioteca.
export default function LayoutSwitch({ value, onChange }: LayoutSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Layout da biblioteca"
      className="layout-switch flex h-10 items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.06] p-1"
    >
      {LAYOUTS.map((layout) => {
        const Icon = layoutIcons[layout.id];
        const active = layout.id === value;
        return (
          <button
            key={layout.id}
            type="button"
            aria-pressed={active}
            aria-label={layout.name}
            title={layout.name}
            onClick={() => onChange(layout.id)}
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
              active ? 'theme-accent-surface text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
