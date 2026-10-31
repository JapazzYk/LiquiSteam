import type { KeyboardEvent, MouseEvent } from 'react';
import { FolderPlus, Star } from 'lucide-react';
import { useCollectionsUi } from '@/lib/collections';

interface CollectionButtonsProps {
  appid: number;
  className?: string;
}

// Estrela (favoritar) e pasta (guardar em um grupo). Usado dentro de cartões e linhas, que já são botões:
// por isso são <span role="button">, e o clique não chega ao cartão.
export default function CollectionButtons({ appid, className = '' }: CollectionButtonsProps) {
  const ui = useCollectionsUi();
  if (!ui) return null;
  const favorite = ui.api.isFavorite(appid);
  const inGroups = ui.api.groupsOf(appid).length;

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
    <span className={`coll-actions ${className}`} data-has={favorite || inGroups > 0 ? '' : undefined}>
      <span
        role="button"
        tabIndex={0}
        className="coll-btn"
        data-on={favorite ? '' : undefined}
        aria-pressed={favorite}
        aria-label={favorite ? 'Tirar dos favoritos' : 'Adicionar aos favoritos'}
        title={favorite ? 'Tirar dos favoritos' : 'Favoritar'}
        onClick={(event) => {
          stop(event);
          ui.api.toggleFavorite(appid);
        }}
        onKeyDown={onKey(() => ui.api.toggleFavorite(appid))}
      >
        <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
      </span>
      <span
        role="button"
        tabIndex={0}
        className="coll-btn"
        data-on={inGroups > 0 ? '' : undefined}
        aria-haspopup="dialog"
        aria-label="Guardar em um grupo"
        title={inGroups > 0 ? `Em ${inGroups} ${inGroups === 1 ? 'grupo' : 'grupos'}` : 'Guardar em um grupo'}
        onClick={(event) => {
          stop(event);
          ui.openGroupMenu(appid, event.currentTarget);
        }}
        onKeyDown={onKey((target) => ui.openGroupMenu(appid, target))}
      >
        <FolderPlus className="h-4 w-4" />
      </span>
    </span>
  );
}
