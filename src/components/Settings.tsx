import { useState, useEffect } from 'react';
import type { TagCount, SelfHostedStatus } from '../lib/types';
import * as api from '../lib/api';

interface SettingsProps {
  tags: TagCount[];
  hiddenTags: string[];
  onToggleHiddenTag: (tag: string) => void;
  onClose: () => void;
  onSelfHostedChange?: () => void;
}

type SettingsSection = 'hidden-tags' | 'selfhosted' | null;

export function Settings({ tags, hiddenTags, onToggleHiddenTag, onClose, onSelfHostedChange }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);

  // Self-hosted server state
  const [serverUrl, setServerUrl] = useState('');
  const [serverStatus, setServerStatus] = useState<SelfHostedStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current server URL on mount
  useEffect(() => {
    api.getSelfhostedUrl().then((url) => {
      if (url) setServerUrl(url);
    });
    // Also check current health status
    api.checkSelfhostedHealth().then(setServerStatus);
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    // Temporarily save URL to test it
    await api.setSelfhostedUrl(serverUrl.trim());
    const status = await api.checkSelfhostedHealth();
    setServerStatus(status);
    setTesting(false);
  };

  const handleSaveUrl = async () => {
    setSaving(true);
    await api.setSelfhostedUrl(serverUrl.trim() || null);
    const status = await api.checkSelfhostedHealth();
    setServerStatus(status);
    setSaving(false);
    onSelfHostedChange?.();
  };

  const handleClearUrl = async () => {
    setSaving(true);
    setServerUrl('');
    await api.setSelfhostedUrl(null);
    setServerStatus(null);
    setSaving(false);
    onSelfHostedChange?.();
  };

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
              <h2>
                {activeSection === 'hidden-tags' && 'Hidden Tags'}
                {activeSection === 'selfhosted' && 'Self-Hosted Server'}
              </h2>
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
                onClick={() => setActiveSection('selfhosted')}
              >
                <div className="settings-menu-item-content">
                  <span className="settings-menu-item-label">Self-Hosted Server</span>
                  <span className="settings-menu-item-value">
                    {serverStatus?.connected ? (
                      <span className="status-connected">Connected</span>
                    ) : serverUrl ? (
                      <span className="status-offline">Offline</span>
                    ) : (
                      'Not configured'
                    )}
                  </span>
                </div>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
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

          {activeSection === 'selfhosted' && (
            <div className="settings-section">
              <p className="settings-description">
                Connect to a self-hosted inference server for local image generation.
              </p>

              <div className="settings-field">
                <label htmlFor="server-url">Server URL</label>
                <input
                  id="server-url"
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.50:8000"
                  className="settings-input"
                />
              </div>

              <div className="settings-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleTestConnection}
                  disabled={!serverUrl.trim() || testing}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveUrl}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {serverUrl && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleClearUrl}
                    disabled={saving}
                  >
                    Clear
                  </button>
                )}
              </div>

              {serverStatus && (
                <div className={`settings-status ${serverStatus.connected ? 'status-ok' : 'status-error'}`}>
                  <div className="status-header">
                    <span className={`status-dot ${serverStatus.connected ? 'dot-connected' : 'dot-offline'}`} />
                    <span>{serverStatus.connected ? 'Connected' : 'Connection Failed'}</span>
                  </div>
                  {serverStatus.connected && (
                    <div className="status-details">
                      {serverStatus.gpu_name && (
                        <div className="status-row">
                          <span className="status-label">GPU</span>
                          <span className="status-value">{serverStatus.gpu_name}</span>
                        </div>
                      )}
                      {serverStatus.current_model && (
                        <div className="status-row">
                          <span className="status-label">Current Model</span>
                          <span className="status-value">{serverStatus.current_model}</span>
                        </div>
                      )}
                      {serverStatus.available_models.length > 0 && (
                        <div className="status-row">
                          <span className="status-label">Available</span>
                          <span className="status-value">
                            {serverStatus.available_models.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {serverStatus.error && (
                    <div className="status-error-message">{serverStatus.error}</div>
                  )}
                </div>
              )}
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
          z-index: var(--z-modal);
          backdrop-filter: blur(4px);
        }
        .settings-container {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        .settings-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-lg);
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
          padding: var(--spacing-lg) var(--spacing-xl);
          overflow-y: auto;
        }
        .settings-menu {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
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
          font-size: 12px;
          font-weight: 500;
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
        /* Self-hosted server styles */
        .status-connected {
          color: var(--success, #4ade80);
        }
        .status-offline {
          color: var(--warning, #fbbf24);
        }
        .settings-field {
          margin-bottom: var(--spacing-md);
        }
        .settings-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          margin-bottom: var(--spacing-xs);
        }
        .settings-input {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          font-family: monospace;
        }
        .settings-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .settings-actions {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-lg);
        }
        .settings-status {
          padding: var(--spacing-md);
          border-radius: var(--radius-sm);
          background: var(--bg-primary);
        }
        .settings-status.status-ok {
          border-left: 3px solid var(--success);
        }
        .settings-status.status-error {
          border-left: 3px solid var(--error);
        }
        .status-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-weight: 500;
          margin-bottom: var(--spacing-sm);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot-connected {
          background: var(--success, #4ade80);
        }
        .dot-offline {
          background: var(--error, #f87171);
        }
        .status-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .status-label {
          color: var(--text-muted);
        }
        .status-value {
          color: var(--text-secondary);
        }
        .status-error-message {
          margin-top: var(--spacing-sm);
          font-size: 12px;
          color: var(--error, #f87171);
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
