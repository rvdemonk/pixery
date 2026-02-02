import { useState } from 'react';
import type { TagCount } from '../lib/types';

interface SettingsProps {
  tags: TagCount[];
  hiddenTags: string[];
  onToggleHiddenTag: (tag: string) => void;
  onClose: () => void;
}

type SettingsSection = 'hidden-tags' | null;

export function Settings({ tags, hiddenTags, onToggleHiddenTag, onClose }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);

  const visibleTags = tags.filter((t) => !hiddenTags.includes(t.name));
  const hiddenTagsList = tags.filter((t) => hiddenTags.includes(t.name));

  return (
    <div className="settings-overlay">
      <div className="settings-container">
        <div className="settings-header">
          {activeSection ? (
            <>
              <button className="settings-back" onClick={() => setActiveSection(null)}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <h2>{activeSection === 'hidden-tags' ? 'Hidden Tags' : 'Settings'}</h2>
            </>
          ) : (
            <h2>Settings</h2>
          )}
          <button className="btn btn-ghost settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {activeSection === null && (
            <div className="settings-menu">
              <button
                className="settings-menu-item"
                onClick={() => setActiveSection('hidden-tags')}
              >
                <div className="settings-menu-item-content">
                  <span className="settings-menu-item-label">Hidden Tags</span>
                  <span className="settings-menu-item-value">
                    {hiddenTags.length > 0 ? `${hiddenTags.length} hidden` : 'None'}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {activeSection === 'hidden-tags' && (
            <div className="settings-section">
              <p className="settings-description">
                Hidden tags and their images won't appear in the gallery or search.
              </p>

              {hiddenTagsList.length > 0 && (
                <div className="settings-tag-group">
                  <h4>Currently Hidden</h4>
                  <div className="settings-tag-list">
                    {hiddenTagsList.map((tag) => (
                      <button
                        key={tag.name}
                        className="settings-tag settings-tag-hidden"
                        onClick={() => onToggleHiddenTag(tag.name)}
                        title="Click to show"
                      >
                        <span className="settings-tag-name">{tag.name}</span>
                        <span className="settings-tag-count">{tag.count}</span>
                        <span className="settings-tag-action">Show</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-tag-group">
                <h4>Visible Tags</h4>
                <div className="settings-tag-list">
                  {visibleTags.length === 0 ? (
                    <p className="settings-empty">All tags are hidden</p>
                  ) : (
                    visibleTags.map((tag) => (
                      <button
                        key={tag.name}
                        className="settings-tag"
                        onClick={() => onToggleHiddenTag(tag.name)}
                        title="Click to hide"
                      >
                        <span className="settings-tag-name">{tag.name}</span>
                        <span className="settings-tag-count">{tag.count}</span>
                        <span className="settings-tag-action">Hide</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .settings-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .settings-container {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          width: 400px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .settings-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }
        .settings-header h2 {
          flex: 1;
        }
        .settings-back {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xs);
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        .settings-back:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .settings-close {
          font-size: 24px;
          line-height: 1;
          padding: var(--spacing-xs) var(--spacing-sm);
        }
        .settings-content {
          padding: var(--spacing-md);
          overflow-y: auto;
        }
        .settings-menu {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .settings-menu-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          text-align: left;
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }
        .settings-menu-item:hover {
          background: var(--bg-hover);
        }
        .settings-menu-item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .settings-menu-item-label {
          font-weight: 500;
        }
        .settings-menu-item-value {
          font-size: 12px;
          color: var(--text-muted);
        }
        .settings-menu-item svg {
          color: var(--text-muted);
        }
        .settings-section h3 {
          margin-bottom: var(--spacing-xs);
        }
        .settings-description {
          color: var(--text-muted);
          font-size: 13px;
          margin-bottom: var(--spacing-lg);
        }
        .settings-tag-group {
          margin-bottom: var(--spacing-lg);
        }
        .settings-tag-group h4 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: var(--spacing-sm);
        }
        .settings-tag-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: var(--spacing-xs);
        }
        .settings-tag {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-sm);
          text-align: left;
          color: var(--text-secondary);
          transition: all var(--transition-fast);
        }
        .settings-tag:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .settings-tag:hover .settings-tag-action {
          opacity: 1;
        }
        .settings-tag-hidden {
          color: var(--text-muted);
        }
        .settings-tag-name {
          flex: 1;
        }
        .settings-tag-count {
          font-size: 12px;
          color: var(--text-muted);
        }
        .settings-tag-action {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--accent);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .settings-empty {
          padding: var(--spacing-md);
          color: var(--text-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
