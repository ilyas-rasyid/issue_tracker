import { List as ListIcon, Columns3 } from 'lucide-react';

interface IssueBoardControlsProps {
  view: 'list' | 'board';
  total?: number;
  hasFilters: boolean;
  hasUser: boolean;
  mine: boolean;
  update: (key: string, value: string) => void;
  clear: () => void;
  setView: (view: 'list' | 'board') => void;
}

export function IssueBoardControls({
  view,
  total,
  hasFilters,
  hasUser,
  mine,
  update,
  clear,
  setView,
}: IssueBoardControlsProps) {
  return (
    <div className="board-controls">
      <div className="board-context">
        {view === 'list' && total !== undefined ? (
          <>
            <strong>{total.toLocaleString()}</strong> issues
          </>
        ) : (
          <>Issue board</>
        )}
        {hasUser && (
          <label className="mine-filter">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => update('mine', e.target.checked ? 'true' : '')}
            />{' '}
            Created by me
          </label>
        )}
        {hasFilters && (
          <button className="text-button" onClick={clear}>
            Clear filters
          </button>
        )}
      </div>
      <div className="view-switch" role="group" aria-label="Issue view">
        <button onClick={() => setView('list')} aria-pressed={view === 'list'}>
          <ListIcon size={16} /> List
        </button>
        <button onClick={() => setView('board')} aria-pressed={view === 'board'}>
          <Columns3 size={16} /> Board
        </button>
      </div>
    </div>
  );
}
