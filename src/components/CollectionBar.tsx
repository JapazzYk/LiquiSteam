import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { DragEvent } from 'react';
import { Check, Folder, LayoutGrid, Lock, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { motionDisabled } from '@/lib/motion';
import { DRAG_TYPE, MAX_GROUPS, MAX_GROUP_NAME, type CollectionsApi } from '@/lib/collections';

export type CollectionFilter = 'all' | 'favorites' | string; // string = id de um grupo

interface CollectionBarProps {
  api: CollectionsApi;
  active: CollectionFilter;
  onSelect: (filter: CollectionFilter) => void;
  // Jogos que existem agora na biblioteca mostrada (para contar sem contar o que foi desinstalado).
  available: Set<number>;
  totalCount: number;
  // Algo à direita da faixa (ex.: escolher entre jogos instalados e toda a conta).
  rightSlot?: ReactNode;
  // Sem a Steam conectada: Favoritos e grupos aparecem bloqueados e avisam ao serem tocados.
  locked?: boolean;
  onLocked?: () => void;
}

// Faixa de filtros da biblioteca: Todos, Favoritos e os grupos. Aceita jogos arrastados dos cartões.
export default function CollectionBar({ api, active, onSelect, available, totalCount, rightSlot, locked = false, onLocked }: CollectionBarProps) {
  const { favorites, groups } = api.collections;
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState('');
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Grupo saindo (animação de exclusão) e grupo que acabou de ser criado ou renomeado (brilho).
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeGroup = groups.find((g) => g.id === active) ?? null;

  useEffect(() => {
    if (creating || renaming) inputRef.current?.focus();
  }, [creating, renaming]);
  useEffect(() => {
    setConfirmDelete(false);
    setRenaming(false);
  }, [active]);
  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 1100);
    return () => window.clearTimeout(timer);
  }, [flashId]);
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = window.setTimeout(() => setConfirmDelete(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirmDelete]);

  const count = (ids: number[]) => ids.filter((id) => available.has(id)).length;

  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE);
  const dropProps = (key: string, onDropGame: (appid: number) => void) => ({
    onDragOver: (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
    onDrop: (event: DragEvent) => {
      if (!accepts(event)) return;
      event.preventDefault();
      setDropTarget(null);
      const appid = Number(event.dataTransfer.getData(DRAG_TYPE));
      if (Number.isFinite(appid)) onDropGame(appid);
    },
  });

  const chip = (key: string, selected: boolean) =>
    `coll-chip ${selected ? 'coll-chip-on' : ''} ${dropTarget === key ? 'coll-chip-drop' : ''} ${flashId === key ? 'coll-chip-flash' : ''} ${leavingId === key ? 'coll-chip-out' : ''}`;

  const submitCreate = () => {
    const id = api.createGroup(draft);
    setDraft('');
    setCreating(false);
    if (id) {
      onSelect(id);
      setFlashId(id);
    }
  };
  const submitRename = () => {
    if (activeGroup) {
      api.renameGroup(activeGroup.id, draft);
      setFlashId(activeGroup.id);
    }
    setRenaming(false);
  };
  // Excluir: o grupo encolhe e some, e só então é removido.
  const removeGroup = (id: string) => {
    setConfirmDelete(false);
    const finish = () => {
      api.deleteGroup(id);
      onSelect('all');
      setLeavingId(null);
    };
    if (motionDisabled()) {
      finish();
      return;
    }
    setLeavingId(id);
    window.setTimeout(finish, 280);
  };

  if (locked) {
    const lockedTitle = 'Disponível depois de entrar com a Steam';
    return (
      <div className="fx-soft mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Favoritos e grupos (bloqueado)">
        <span className="coll-chip coll-chip-on">
          <LayoutGrid className="h-3.5 w-3.5" />
          Todos <span className="coll-count">{totalCount}</span>
        </span>
        <button type="button" className="coll-chip coll-chip-locked" title={lockedTitle} aria-disabled onClick={onLocked}>
          <Star className="h-3.5 w-3.5" />
          Favoritos
          <Lock className="h-3 w-3" />
        </button>
        <button type="button" className="coll-chip coll-chip-locked" title={lockedTitle} aria-disabled onClick={onLocked}>
          <Plus className="h-3.5 w-3.5" />
          Novo grupo
          <Lock className="h-3 w-3" />
        </button>
        <span className="text-xs text-white/40">Favoritos e grupos: entre com a Steam para usar</span>
      </div>
    );
  }

  return (
    <div className="fx-soft mb-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Favoritos e grupos">
      <button type="button" className={chip('all', active === 'all')} aria-pressed={active === 'all'} onClick={() => onSelect('all')}>
        <LayoutGrid className="h-3.5 w-3.5" />
        Todos <span className="coll-count">{totalCount}</span>
      </button>
      <button
        type="button"
        className={chip('favorites', active === 'favorites')}
        aria-pressed={active === 'favorites'}
        onClick={() => onSelect('favorites')}
        {...dropProps('favorites', api.addToFavorites)}
      >
        <Star className="h-3.5 w-3.5" fill={active === 'favorites' ? 'currentColor' : 'none'} />
        Favoritos <span className="coll-count">{count(favorites)}</span>
      </button>

      {groups.map((group, index) =>
        renaming && activeGroup?.id === group.id ? (
          <form
            key={group.id}
            className="coll-chip coll-chip-on coll-chip-edit gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              maxLength={MAX_GROUP_NAME}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setRenaming(false)}
              aria-label="Novo nome do grupo"
              className="w-28 bg-transparent text-xs text-white focus:outline-none"
            />
            <button type="submit" aria-label="Salvar nome" className="grid h-5 w-5 place-items-center text-ok">
              <Check className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            key={group.id}
            type="button"
            className={chip(group.id, active === group.id)}
            style={{ '--i': index } as CSSProperties}
            aria-pressed={active === group.id}
            onClick={() => onSelect(group.id)}
            {...dropProps(group.id, (appid) => api.addToGroup(group.id, appid))}
          >
            <Folder className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate">{group.name}</span>
            <span className="coll-count">{count(group.games)}</span>
          </button>
        )
      )}

      {creating ? (
        <form
          className="coll-chip coll-chip-on coll-chip-edit gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            submitCreate();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            maxLength={MAX_GROUP_NAME}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && (setCreating(false), setDraft(''))}
            placeholder="Nome do grupo"
            aria-label="Nome do novo grupo"
            className="w-32 bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} aria-label="Criar grupo" className="grid h-5 w-5 place-items-center text-ok disabled:opacity-40">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => {
              setCreating(false);
              setDraft('');
            }}
            className="grid h-5 w-5 place-items-center text-white/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        groups.length < MAX_GROUPS && (
          <button
            type="button"
            className="coll-chip coll-chip-add"
            title="Criar um grupo (pasta) para organizar os seus jogos"
            onClick={() => {
              setDraft('');
              setCreating(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo grupo
          </button>
        )
      )}

      {rightSlot && <span className="ml-auto">{rightSlot}</span>}

      {activeGroup && !renaming && (
        <span className={`flex items-center gap-1.5 ${rightSlot ? '' : 'ml-auto'}`}>
          <button
            type="button"
            className="coll-mini"
            title="Renomear este grupo"
            aria-label="Renomear grupo"
            onClick={() => {
              setDraft(activeGroup.name);
              setRenaming(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`coll-mini ${confirmDelete ? 'coll-mini-danger' : ''}`}
            title="Excluir este grupo (os jogos continuam na biblioteca)"
            aria-label={confirmDelete ? 'Clique de novo para excluir o grupo' : 'Excluir grupo'}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              removeGroup(activeGroup.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete && <span className="text-xs">Clique de novo</span>}
          </button>
        </span>
      )}
    </div>
  );
}
