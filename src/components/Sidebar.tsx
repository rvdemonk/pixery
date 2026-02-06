import { useState } from 'react';
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

  const isAllActive = !starredOnly && !showTrashed && !showUncategorized && activeCollection === null;

  const handleCreateSubmit = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      onCreateCollection(trimmed);
    }
    setNewName('');
    setCreating(false);
  };

  return (
    <aside className={`sidebar ${pinned ? 'sidebar-pinned' : ''}`}>
      <button className="sidebar-hamburger" onClick={onTogglePin} title={pinned ? 'Collapse sidebar' : 'Pin sidebar'}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect y="3" width="20" height="2" rx="1" />
          <rect y="9" width="20" height="2" rx="1" />
          <rect y="15" width="20" height="2" rx="1" />
        </svg>
      </button>
      <div className="sidebar-content">
        <div className="column-header">
          <h1 className="sidebar-title">pixery</h1>
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
        .sidebar-pinned .sidebar-hamburger {
          color: var(--accent);
        }
        .sidebar-content .column-header {
          border-bottom: none;
          padding-bottom: var(--spacing-sm);
        }
        .sidebar-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--accent);
        }
        .sidebar-section {
          padding: var(--spacing-md) 0;
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
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 16px;
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
          background: var(--accent-muted);
          color: var(--text-primary);
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
          border-top: 1px solid var(--border);
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
