import type { TagCount } from '../lib/types';

interface SidebarProps {
  tags: TagCount[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  starredOnly: boolean;
  onToggleStarred: () => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function Sidebar({
  tags,
  selectedTag,
  onSelectTag,
  starredOnly,
  onToggleStarred,
  onOpenDashboard,
  onOpenSettings,
  pinned,
  onTogglePin,
}: SidebarProps) {
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
            className={`sidebar-item ${!selectedTag && !starredOnly ? 'sidebar-item-active' : ''}`}
            onClick={() => {
              onSelectTag(null);
              if (starredOnly) onToggleStarred();
            }}
          >
            <span>All</span>
          </button>
          <button
            className={`sidebar-item ${starredOnly ? 'sidebar-item-active' : ''}`}
            onClick={onToggleStarred}
          >
            <span>★ Starred</span>
          </button>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Tags</h3>
          <div className="sidebar-tags">
            {tags.map((tag) => (
              <button
                key={tag.name}
                className={`sidebar-item ${selectedTag === tag.name ? 'sidebar-item-active' : ''}`}
                onClick={() => onSelectTag(selectedTag === tag.name ? null : tag.name)}
              >
                <span className="truncate">{tag.name}</span>
                <span className="sidebar-count">{tag.count}</span>
              </button>
            ))}
            {tags.length === 0 && (
              <p className="sidebar-empty">No tags yet</p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-item" onClick={onOpenDashboard}>
            <span>Cost Dashboard</span>
          </button>
          <button className="sidebar-item" onClick={onOpenSettings}>
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
        .sidebar-section-title {
          padding: var(--spacing-xs) var(--spacing-md);
          margin-bottom: var(--spacing-xs);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .sidebar-tags {
          max-height: 300px;
          overflow-y: auto;
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
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
        .sidebar-footer {
          margin-top: auto;
          padding: var(--spacing-lg) 0 var(--spacing-md);
        }
      `}</style>
    </aside>
  );
}
