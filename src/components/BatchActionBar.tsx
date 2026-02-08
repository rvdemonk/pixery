import { useState, useRef, useEffect } from 'react';
import type { TagCount, Collection } from '../lib/types';

interface BatchActionBarProps {
  count: number;
  availableTags: TagCount[];
  collections: Collection[];
  tagPopoverOpen: boolean;
  onTagPopoverOpenChange: (open: boolean) => void;
  onTag: (tag: string) => void;
  onAddToCollection: (collectionName: string) => void;
  onUseAsRefs: () => void;
  onRegen: () => void;
  onCompare: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BatchActionBar({
  count,
  availableTags,
  collections,
  tagPopoverOpen,
  onTagPopoverOpenChange,
  onTag,
  onAddToCollection,
  onUseAsRefs,
  onRegen,
  onCompare,
  onDelete,
  onClear,
}: BatchActionBarProps) {
  const [collectionPopoverOpen, setCollectionPopoverOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tagPopoverOpen && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [tagPopoverOpen]);

  const filteredTags = availableTags
    .filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 8);

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagInput.trim()) {
      onTag(tagInput.trim());
      setTagInput('');
      onTagPopoverOpenChange(false);
    }
  };

  const handleTagSelect = (tag: string) => {
    onTag(tag);
    setTagInput('');
    onTagPopoverOpenChange(false);
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    onDelete();
    setDeleteConfirmOpen(false);
  };

  return (
    <div className="batch-bar">
      <span className="batch-count">{count} selected</span>

      <div className="batch-actions">
        <div className="batch-action-wrapper">
          <button
            className="batch-btn"
            onClick={() => onTagPopoverOpenChange(!tagPopoverOpen)}
            title="Tag selected (t)"
          >
            <kbd>t</kbd> Tag
          </button>
          {tagPopoverOpen && (
            <div className="batch-popover tag-popover">
              <form onSubmit={handleTagSubmit}>
                <input
                  ref={tagInputRef}
                  type="text"
                  placeholder="Enter tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </form>
              {filteredTags.length > 0 && (
                <div className="tag-suggestions">
                  {filteredTags.map((t) => (
                    <button
                      key={t.name}
                      className="tag-suggestion"
                      onClick={() => handleTagSelect(t.name)}
                    >
                      {t.name}
                      <span className="tag-count">({t.count})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {collections.length > 0 && (
          <div className="batch-action-wrapper">
            <button
              className="batch-btn"
              onClick={() => {
                setCollectionPopoverOpen(!collectionPopoverOpen);
                onTagPopoverOpenChange(false);
              }}
              title="Add to collection"
            >
              Collection
            </button>
            {collectionPopoverOpen && (
              <div className="batch-popover collection-popover">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    className="tag-suggestion"
                    onClick={() => {
                      onAddToCollection(c.name);
                      setCollectionPopoverOpen(false);
                    }}
                  >
                    {c.name}
                    <span className="tag-count">({c.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          className="batch-btn"
          onClick={onUseAsRefs}
          title="Use as references (r)"
        >
          <kbd>r</kbd> Refs
        </button>

        <button
          className="batch-btn"
          onClick={onRegen}
          title="Regenerate (g)"
        >
          <kbd>g</kbd> Regen
        </button>

        {count === 2 && (
          <button
            className="batch-btn"
            onClick={onCompare}
            title="Compare selected (c)"
          >
            <kbd>c</kbd> Compare
          </button>
        )}

        <div className="batch-action-wrapper">
          <button
            className="batch-btn batch-btn-danger"
            onClick={handleDeleteClick}
            title="Delete selected (Backspace)"
          >
            <kbd>Del</kbd> Delete
          </button>
          {deleteConfirmOpen && (
            <div className="batch-popover delete-confirm">
              <p>Delete {count} images?</p>
              <div className="confirm-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="batch-clear"
        onClick={onClear}
        title="Clear selection (u)"
      >
        ×
      </button>

      <style>{`
        .batch-bar {
          position: fixed;
          bottom: var(--spacing-lg);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-md);
          background: rgba(43, 42, 47, 0.85);
          backdrop-filter: blur(12px);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-sticky);
        }

        .batch-count {
          font-weight: 600;
          color: var(--text-primary);
          padding: 0 var(--spacing-sm);
          white-space: nowrap;
        }

        .batch-actions {
          display: flex;
          gap: var(--spacing-xs);
        }

        .batch-action-wrapper {
          position: relative;
        }

        .batch-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .batch-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-light);
        }

        .batch-btn kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 18px;
          padding: 0 4px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }

        .batch-btn-danger:hover {
          background: var(--error);
          border-color: var(--error);
          color: white;
        }

        .batch-btn-danger:hover kbd {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.3);
          color: white;
        }

        .batch-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          min-height: 32px;
          border-radius: 50%;
          background: transparent;
          color: var(--text-muted);
          font-size: 18px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .batch-clear:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .batch-popover {
          position: absolute;
          bottom: calc(100% + var(--spacing-sm));
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          min-width: 200px;
          z-index: var(--z-overlay);
        }

        .tag-popover input {
          width: 100%;
          border: none;
          border-bottom: 1px solid var(--border);
          border-radius: var(--radius-md) var(--radius-md) 0 0;
          padding: var(--spacing-sm) var(--spacing-md);
        }

        .tag-suggestions {
          display: flex;
          flex-direction: column;
          max-height: 200px;
          overflow-y: auto;
        }

        .tag-suggestion {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .tag-suggestion:hover {
          background: var(--bg-hover);
        }

        .tag-suggestion .tag-count {
          color: var(--text-muted);
          font-size: 12px;
        }

        .delete-confirm {
          padding: var(--spacing-md);
          text-align: center;
        }

        .delete-confirm p {
          margin-bottom: var(--spacing-md);
          font-weight: 500;
        }

        .confirm-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: center;
        }

      `}</style>
    </div>
  );
}
