import { useState, useEffect, useRef } from 'react';
import type { Collection, TodayCost } from '../lib/types';

interface SidebarProps {
  collections: Collection[];
  activeCollection: number | null;
  starredOnly: boolean;
  showTrashed: boolean;
  showUncategorized: boolean;
  onShowAll: () => void;
  onShowStarred: () => void;
  onShowTrashed: () => void;
  onShowUncategorized: () => void;
  onSelectCollection: (id: number) => void;
  onCreateCollection: (name: string) => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  todayCost: TodayCost;
}

export function Sidebar({
  collections,
  activeCollection,
  starredOnly,
  showTrashed,
  showUncategorized,
  onShowAll,
  onShowStarred,
  onShowTrashed,
  onShowUncategorized,
  onSelectCollection,
  onCreateCollection,
  onOpenDashboard,
  onOpenSettings,
  pinned,
  onTogglePin,
  todayCost,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const isAllActive = !starredOnly && !showTrashed && !showUncategorized && activeCollection === null;

  // Close on click outside (only when open but not pinned)
  useEffect(() => {
    if (!open || pinned) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, pinned]);

  const handleHamburgerClick = () => {
    if (pinned) {
      onTogglePin();
      setOpen(false);
    } else if (open) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  const handlePin = () => {
    onTogglePin();
    setOpen(false);
  };

  const handleCreateSubmit = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      onCreateCollection(trimmed);
    }
    setNewName('');
    setCreating(false);
  };

  const sidebarClass = `sidebar ${pinned ? 'sidebar-pinned' : ''} ${open && !pinned ? 'sidebar-open' : ''}`;

  return (
    <aside ref={sidebarRef} className={sidebarClass}>
      <button className="sidebar-hamburger" onClick={handleHamburgerClick} title={pinned ? 'Collapse sidebar' : 'Open sidebar'}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect y="3" width="20" height="2" rx="1" />
          <rect y="9" width="20" height="2" rx="1" />
          <rect y="15" width="20" height="2" rx="1" />
        </svg>
      </button>
      <div className="sidebar-content">
        <div className="sidebar-content-header">
          <h1 className="sidebar-title">pixery</h1>
          <button className="sidebar-pin-btn" onClick={handlePin} title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ transform: pinned ? 'rotate(45deg)' : 'none', transition: 'transform 150ms ease-out' }}>
              <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826L4.456.734z"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-section">
          <button
            className={`sidebar-item ${isAllActive ? 'sidebar-item-active' : ''}`}
            onClick={onShowAll}
          >
            <span>All</span>
          </button>
          <button
            className={`sidebar-item ${starredOnly ? 'sidebar-item-active' : ''}`}
            onClick={onShowStarred}
          >
            <span>Starred</span>
          </button>
          <button
            className={`sidebar-item ${showTrashed ? 'sidebar-item-active' : ''}`}
            onClick={onShowTrashed}
          >
            <span>Trash</span>
          </button>
          <button
            className={`sidebar-item ${showUncategorized ? 'sidebar-item-active' : ''}`}
            onClick={onShowUncategorized}
          >
            <span>Uncategorized</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <h3 className="sidebar-section-title">Collections</h3>
            <button
              className="sidebar-add-btn"
              onClick={() => setCreating(!creating)}
              title="Create collection"
            >
              +
            </button>
          </div>
          {creating && (
            <div className="sidebar-create-input">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubmit();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder="Collection name..."
                autoFocus
                onBlur={handleCreateSubmit}
              />
            </div>
          )}
          <div className="sidebar-collections">
            {collections.map((col) => (
              <button
                key={col.id}
                className={`sidebar-item ${activeCollection === col.id ? 'sidebar-item-active' : ''}`}
                onClick={() => onSelectCollection(col.id)}
              >
                <span className="truncate">{col.name}</span>
                <span className="sidebar-count">{col.count}</span>
              </button>
            ))}
            {collections.length === 0 && !creating && (
              <p className="sidebar-empty">No collections</p>
            )}
          </div>
        </div>

        {todayCost.total > 0 && (
          <div className="sidebar-today-cost">
            <div className="sidebar-cost-header">Today</div>
            {todayCost.byModel.map(([model, cost]) => (
              <div key={model} className="sidebar-cost-row">
                <span className="sidebar-cost-model truncate">{model}</span>
                <span className="sidebar-cost-amount">${cost.toFixed(3)}</span>
              </div>
            ))}
            <div className="sidebar-cost-row sidebar-cost-total">
              <span>Total</span>
              <span>${todayCost.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <button className="sidebar-item" onClick={onOpenDashboard}>
            <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 14h14v1H1v-1zm1-3h2v3H2v-3zm3-2h2v5H5V9zm3-3h2v8H8V6zm3-4h2v12h-2V2z"/>
            </svg>
            <span>Costs</span>
          </button>
          <button className="sidebar-item" onClick={onOpenSettings}>
            <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
              <path d="M14.5 7h-.79a5.61 5.61 0 0 0-.44-1.06l.56-.56a.5.5 0 0 0 0-.71l-.71-.71a.5.5 0 0 0-.71 0l-.56.56A5.61 5.61 0 0 0 10.79 4h-.01V3.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v.79c-.37.11-.72.26-1.06.44l-.56-.56a.5.5 0 0 0-.71 0l-.71.71a.5.5 0 0 0 0 .71l.56.56c-.18.34-.33.69-.44 1.06H5.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h.79c.11.37.26.72.44 1.06l-.56.56a.5.5 0 0 0 0 .71l.71.71a.5.5 0 0 0 .71 0l.56-.56c.34.18.69.33 1.06.44v.79a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-.79c.37-.11.72-.26 1.06-.44l.56.56a.5.5 0 0 0 .71 0l.71-.71a.5.5 0 0 0 0-.71l-.56-.56c.18-.34.33-.69.44-1.06h.79a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>

      <style>{`
        .sidebar-hamburger {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 56px;
          width: 48px;
          color: var(--text-muted);
          flex-shrink: 0;
          cursor: pointer;
          transition: color var(--transition-fast);
          z-index: 1;
        }
        .sidebar-hamburger:hover {
          color: var(--text-primary);
        }
        .sidebar-pinned .sidebar-hamburger,
        .sidebar-open .sidebar-hamburger {
          color: var(--accent);
        }
        .sidebar-content-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          padding: 0 var(--spacing-md);
        }
        .sidebar-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--accent);
        }
        .sidebar-pin-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sidebar-pin-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-pinned .sidebar-pin-btn {
          color: var(--accent);
        }
        .sidebar-section {
          padding: var(--spacing-sm) 0;
        }
        .sidebar-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-right: var(--spacing-md);
        }
        .sidebar-section-title {
          padding: var(--spacing-xs) var(--spacing-md);
          margin-bottom: var(--spacing-xs);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .sidebar-add-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 18px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sidebar-add-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-create-input {
          padding: var(--spacing-xs) var(--spacing-md);
        }
        .sidebar-create-input input {
          width: 100%;
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 13px;
        }
        .sidebar-create-input input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-sm);
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
          cursor: pointer;
          min-height: 36px;
        }
        .sidebar-icon {
          flex-shrink: 0;
          opacity: 0.7;
        }
        .sidebar-item:hover .sidebar-icon {
          opacity: 1;
        }
        .sidebar-footer .sidebar-item {
          justify-content: flex-start;
        }
        .sidebar-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .sidebar-item-active {
          color: var(--text-primary);
          position: relative;
        }
        .sidebar-item-active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: 3px;
          background: var(--accent);
          border-radius: 0 2px 2px 0;
        }
        .sidebar-count {
          font-size: 12px;
          color: var(--text-muted);
        }
        .sidebar-empty {
          padding: var(--spacing-sm) var(--spacing-md);
          color: var(--text-muted);
          font-size: 13px;
        }
        .sidebar-collections {
          max-height: 300px;
          overflow-y: auto;
        }
        .sidebar-today-cost {
          margin-top: auto;
          padding: var(--spacing-sm) 0;
        }
        .sidebar-cost-header {
          padding: var(--spacing-xs) var(--spacing-md) 2px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .sidebar-cost-row {
          display: flex;
          justify-content: space-between;
          padding: 1px var(--spacing-md);
          font-size: 12px;
          color: var(--text-muted);
        }
        .sidebar-cost-model {
          flex: 1;
          min-width: 0;
        }
        .sidebar-cost-amount {
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
          margin-left: var(--spacing-sm);
        }
        .sidebar-cost-total {
          margin-top: 2px;
          padding-top: 3px;
          border-top: 1px solid var(--border);
          color: var(--text-secondary);
          font-weight: 600;
        }
        .sidebar-footer {
          padding: var(--spacing-sm) 0 var(--spacing-md);
        }
      `}</style>
    </aside>
  );
}
