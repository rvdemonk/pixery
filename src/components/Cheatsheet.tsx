interface CheatsheetProps {
  onClose: () => void;
}

const shortcuts = [
  { key: '?', action: 'Show this help' },
  { key: 'j / ↓', action: 'Next image' },
  { key: 'k / ↑', action: 'Previous image' },
  { key: 'Enter', action: 'Open details panel' },
  { key: 'f', action: 'Toggle starred' },
  { key: 'm', action: 'Mark/unmark for batch actions' },
  { key: 'u', action: 'Clear all marks' },
  { key: 't', action: 'Tag (batch when marked)' },
  { key: 'g', action: 'Generate (batch regen when marked)' },
  { key: 'r', action: 'Remix / Use as refs (when marked)' },
  { key: '/', action: 'Focus filter bar' },
  { key: 'c', action: 'Compare mode (2 selected)' },
  { key: 'Esc', action: 'Close panel / clear marks' },
  { key: 'Backspace', action: 'Delete marked (or ⌘+Del for single)' },
];

export function Cheatsheet({ onClose }: CheatsheetProps) {
  return (
    <div className="cheatsheet-overlay" onClick={onClose}>
      <div className="cheatsheet" onClick={(e) => e.stopPropagation()}>
        <div className="cheatsheet-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        <div className="cheatsheet-content">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="cheatsheet-row">
              <kbd className="cheatsheet-key">{key}</kbd>
              <span className="cheatsheet-action">{action}</span>
            </div>
          ))}
        </div>
        <div className="cheatsheet-footer">
          Press <kbd>?</kbd> or <kbd>Esc</kbd> to close
        </div>
      </div>
      <style>{`
        .cheatsheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          backdrop-filter: blur(2px);
        }
        .cheatsheet {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          width: 400px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        .cheatsheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }
        .cheatsheet-header h2 {
          font-size: 16px;
          margin: 0;
        }
        .cheatsheet-content {
          padding: var(--spacing-md);
          max-height: 60vh;
          overflow-y: auto;
        }
        .cheatsheet-row {
          display: flex;
          align-items: center;
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid var(--border);
        }
        .cheatsheet-row:last-child {
          border-bottom: none;
        }
        .cheatsheet-key {
          min-width: 100px;
          padding: 4px 8px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--accent);
          text-align: center;
        }
        .cheatsheet-action {
          margin-left: var(--spacing-md);
          color: var(--text-secondary);
          font-size: 14px;
        }
        .cheatsheet-footer {
          padding: var(--spacing-sm) var(--spacing-md);
          border-top: 1px solid var(--border);
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
        }
        .cheatsheet-footer kbd {
          padding: 2px 6px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
