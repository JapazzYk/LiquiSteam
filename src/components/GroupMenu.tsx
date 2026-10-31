import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Folder, Plus, Star } from 'lucide-react';
import { MAX_GROUPS, MAX_GROUP_NAME, type CollectionsApi } from '@/lib/collections';
import { motionDisabled } from '@/lib/motion';

interface GroupMenuProps {
  appid: number;
  gameName: string;
  anchor: HTMLElement;
  api: CollectionsApi;
  onClose: () => void;
}

// Menu "Guardar em…": marca o jogo como favorito, coloca ou tira de cada grupo e cria um grupo novo.
export default function GroupMenu({ appid, gameName, anchor, api, onClose: closeNow }: GroupMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [name, setName] = useState('');
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeNowRef = useRef(closeNow);
  closeNowRef.current = closeNow;
  // Fecha com a animação de saída (a mesma dos outros pop-ups); sem animação, fecha na hora.
  const onClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (motionDisabled()) {
      closeNowRef.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => closeNowRef.current(), 180);
  }, []);
  const { groups } = api.collections;
  const inGroup = (id: string) => groups.find((g) => g.id === id)?.games.includes(appid) ?? false;

  // Posição ao lado do botão, sem sair da tela.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = rect.right - width;
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8);
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
    setPos({ left, top });
  }, [anchor, groups.length]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    const onScroll = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [anchor, onClose]);

  const create = () => {
    if (!name.trim()) return;
    api.createGroup(name, appid);
    setName('');
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Guardar ${gameName}`}
      className={`overlay-surface ${closing ? 'fx-out' : 'fx-in'} fixed z-[70] w-[min(300px,calc(100vw-16px))] rounded-2xl p-3`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
    >
      <p className="truncate px-2 pb-2 text-xs text-white/50">
        Guardar <span className="text-white/80">{gameName}</span> em…
      </p>
      <ul className="grid max-h-[40vh] gap-0.5 overflow-y-auto">
        <li>
          <button type="button" className="group-menu-row" onClick={() => api.toggleFavorite(appid)}>
            <Star className="h-4 w-4 text-[color:var(--accent-color)]" fill={api.isFavorite(appid) ? 'currentColor' : 'none'} />
            <span className="min-w-0 flex-1 truncate text-left">Favoritos</span>
            {api.isFavorite(appid) && <Check className="h-4 w-4 text-ok" />}
          </button>
        </li>
        {groups.map((group) => (
          <li key={group.id}>
            <button type="button" className="group-menu-row" onClick={() => api.toggleInGroup(group.id, appid)}>
              <Folder className="h-4 w-4 text-white/60" />
              <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
              {inGroup(group.id) && <Check className="h-4 w-4 text-ok" />}
            </button>
          </li>
        ))}
      </ul>
      {groups.length < MAX_GROUPS ? (
        <form
          className="mt-2 flex items-center gap-2 border-t border-white/10 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_GROUP_NAME}
            placeholder="Novo grupo…"
            aria-label="Nome do novo grupo"
            className="h-9 min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.05] px-3 text-sm text-white placeholder:text-white/35 focus:border-[rgba(var(--accent-rgb),0.5)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            aria-label="Criar grupo"
            title="Criar grupo e guardar o jogo nele"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-color)] text-[color:var(--on-accent)] transition hover:brightness-110 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <p className="mt-2 border-t border-white/10 px-2 pt-3 text-xs text-white/45">Limite de {MAX_GROUPS} grupos atingido.</p>
      )}
    </div>,
    document.body
  );
}
