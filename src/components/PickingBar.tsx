import type { SelectedRef } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface PickingBarProps {
  selectedRefs: SelectedRef[];
  onDone: () => void;
  onCancel: () => void;
}

export function PickingBar({ selectedRefs, onDone, onCancel }: PickingBarProps) {
  const count = selectedRefs.length;

  return (
    <div className="picking-bar">
      <span className="picking-count">
        {count} selected
      </span>

      {count > 0 && (
        <div className="picking-thumbs">
          {selectedRefs.map((ref) => (
            <div key={ref.id} className="picking-thumb">
              <img
                src={getImageUrl(ref.thumbPath || ref.path)}
                alt={ref.id > 0 ? `#${ref.id}` : 'file'}
              />
            </div>
          ))}
        </div>
      )}

      <div className="picking-actions">
        <button className="picking-done" onClick={onDone}>
          {count > 0 ? `Done (${count})` : 'Done'}
        </button>
        <button className="picking-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <style>{`
        .picking-bar {
          position: fixed;
          bottom: var(--spacing-lg);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          background: rgba(59, 54, 92, 0.85);
          backdrop-filter: blur(12px);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-sticky);
        }

        .picking-count {
          font-weight: 600;
          color: var(--text-primary);
          padding: 0 var(--spacing-sm);
          white-space: nowrap;
        }

        .picking-thumbs {
          display: flex;
          gap: var(--spacing-xs);
          max-width: 300px;
          overflow-x: auto;
        }

        .picking-thumb {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .picking-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .picking-actions {
          display: flex;
          gap: var(--spacing-xs);
        }

        .picking-done {
          padding: var(--spacing-sm) var(--spacing-md);
          background: #818cf8;
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 600;
          cursor: pointer;
          transition: background var(--transition-fast);
          white-space: nowrap;
        }

        .picking-done:hover {
          background: #6366f1;
        }

        .picking-cancel {
          padding: var(--spacing-sm) var(--spacing-md);
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .picking-cancel:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
