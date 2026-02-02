import type { TagCount } from '../lib/types';

interface SidebarProps {
  tags: TagCount[];
  filterTags: string[];
  onToggleTag: (tag: string) => void;
  starredOnly: boolean;
  onToggleStarred: () => void;
  onOpenDashboard: () => void;
  onOpenSettings: () => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function Sidebar({
  tags,
  filterTags,
  onToggleTag,
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
            className={`sidebar-item ${filterTags.length === 0 && !starredOnly ? 'sidebar-item-active' : ''}`}
            onClick={() => {
              // Clear all filter tags when clicking "All"
              filterTags.forEach((tag) => onToggleTag(tag));
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
                className={`sidebar-item ${filterTags.includes(tag.name) ? 'sidebar-item-active' : ''}`}
                onClick={() => onToggleTag(tag.name)}
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
          gap: var(--spacing-sm);
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
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
        .sidebar-footer {
          margin-top: auto;
          padding: var(--spacing-lg) 0 var(--spacing-md);
        }
      `}</style>
    </aside>
  );
}
