import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { FolderPlus, Lock, Star } from 'lucide-react';
import { useCollectionsUi } from '@/lib/collections';

interface CollectionButtonsProps {
  appid: number;
  className?: string;
}

// Estrela (favoritar) e pasta (guardar em um grupo). Usado dentro de cartões e linhas, que já são botões:
// por isso são <span role="button">, e o clique não chega ao cartão.
export default function CollectionButtons({ appid, className = '' }: CollectionButtonsProps) {
  const ui = useCollectionsUi();
  // Animação curta ao favoritar ('on') ou desfavoritar ('off').
  const [pop, setPop] = useState<'on' | 'off' | null>(null);
  const popTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (popTimer.current !== null) window.clearTimeout(popTimer.current);
    },
    []
  );
  if (!ui) return null;
  const locked = !ui.enabled;
  const favorite = !locked && ui.api.isFavorite(appid);
  const inGroups = locked ? 0 : ui.api.groupsOf(appid).length;
  const lockedTitle = 'Disponível depois de entrar com a Steam';
  const toggleFavorite = () => {
    if (locked) {
      ui.notifyLocked();
      return;
    }
    setPop(favorite ? 'off' : 'on');
    if (popTimer.current !== null) window.clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => setPop(null), 750);
    ui.api.toggleFavorite(appid);
  };

  const stop = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  const onKey = (action: (target: HTMLElement) => void) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    stop(event);
    action(event.currentTarget);
  };

  return (
    <span className={`coll-actions ${className}`} data-has={favorite || inGroups > 0 ? '' : undefined} data-locked={locked ? '' : undefined}>
      <span
        role="button"
        tabIndex={0}
        className="coll-btn"
        data-on={favorite ? '' : undefined}
        data-pop={pop ?? undefined}
        aria-pressed={favorite}
        aria-disabled={locked}
        aria-label={locked ? `Favoritar (${lockedTitle})` : favorite ? 'Tirar dos favoritos' : 'Adicionar aos favoritos'}
        title={locked ? lockedTitle : favorite ? 'Tirar dos favoritos' : 'Favoritar'}
        onClick={(event) => {
          stop(event);
          toggleFavorite();
        }}
        onKeyDown={onKey(toggleFavorite)}
      >
        <Star className="star-fill h-4 w-4" />
        {locked && <Lock className="coll-lock" />}
      </span>
      <span
        role="button"
        tabIndex={0}
        className="coll-btn"
        data-on={inGroups > 0 ? '' : undefined}
        data-kind="folder"
        aria-haspopup={locked ? undefined : 'dialog'}
        aria-disabled={locked}
        aria-label={locked ? `Guardar em um grupo (${lockedTitle})` : 'Guardar em um grupo'}
        title={
          locked ? lockedTitle : inGroups > 0 ? `Em ${inGroups} ${inGroups === 1 ? 'grupo' : 'grupos'}` : 'Guardar em um grupo'
        }
        onClick={(event) => {
          stop(event);
          if (locked) ui.notifyLocked();
          else ui.openGroupMenu(appid, event.currentTarget);
        }}
        onKeyDown={onKey((target) => (locked ? ui.notifyLocked() : ui.openGroupMenu(appid, target)))}
      >
        <FolderPlus className="h-4 w-4" />
        {locked && <Lock className="coll-lock" />}
      </span>
    </span>
  );
}
