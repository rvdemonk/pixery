import { useState, useEffect, memo } from 'react';
import Markdown from 'react-markdown';
import type { Generation, ModelInfo, Collection } from '../lib/types';
import { getImageUrl } from '../lib/api';
import { TagChips } from './TagChips';

interface DetailsProps {
  generation: Generation;
  models: ModelInfo[];
  collections: Collection[];
  onClose: () => void;
  onToggleStar: () => void;
  onUpdateTitle: (title: string | null) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddToCollection: (collectionName: string) => void;
  onFilterByTag: (tag: string) => void;
  onRemix: () => void;
  onReference: () => void;
  onTrash: () => void;
  onOpenFullViewer: () => void;
}

export const Details = memo(function Details({
  generation,
  models,
  collections,
  onClose,
  onToggleStar,
  onUpdateTitle,
  onAddTag,
  onRemoveTag,
  onAddToCollection,
  onFilterByTag,
  onRemix,
  onReference,
  onTrash,
  onOpenFullViewer,
}: DetailsProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(generation.title || '');
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [metadataExpanded, setMetadataExpanded] = useState(false);

  // Sync local state when selected generation changes
  useEffect(() => {
    setTitleValue(generation.title || '');
    setEditingTitle(false);
    setShowTrashConfirm(false);
    setPromptExpanded(false);
    setMetadataExpanded(false);
  }, [generation.id]);

  const handleTitleSave = () => {
    const newTitle = titleValue.trim() || null;
    if (newTitle !== generation.title) {
      onUpdateTitle(newTitle);
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setTitleValue(generation.title || '');
      setEditingTitle(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const modelInfo = models.find(m => m.id === generation.model);

  return (
    <div className="panel details-panel">
      <div className="column-header details-header">
        <h2>Details</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
      </div>

      <div className="details-image">
        <img
          src={getImageUrl(generation.image_path)}
          alt={generation.slug}
          onClick={onOpenFullViewer}
        />
      </div>

      <div className="details-content">
        {/* ID + Title */}
        <div className="details-title-section">
          <span className="image-id">#{generation.id}</span>
          {editingTitle ? (
            <input
              type="text"
              className="title-input"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              placeholder="Add a title..."
              autoFocus
            />
          ) : (
            <div
              className={`title-display ${!generation.title ? 'title-placeholder' : ''}`}
              onClick={() => setEditingTitle(true)}
            >
              {generation.title || 'Click to add title...'}
            </div>
          )}
        </div>

        {/* Model + Star row */}
        <div className="model-star-row">
          <span className="model-badge">{modelInfo?.display_name || generation.model}</span>
          <button
            className={`star-btn ${generation.starred ? 'starred' : ''}`}
            onClick={onToggleStar}
            title={generation.starred ? 'Remove star' : 'Add star'}
          >
            {generation.starred ? '★' : '☆'}
          </button>
        </div>

        {/* References */}
        {generation.references.length > 0 && (
          <div className="details-section">
            <label className="details-label">References</label>
            <div className="references-grid">
              {generation.references.map((ref) => (
                <div key={ref.id} className="reference-thumb" title={ref.path.split('/').pop()}>
                  <img src={getImageUrl(ref.path)} alt="Reference" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="details-section">
          <label className="details-label">Tags</label>
          <TagChips
            tags={generation.tags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
            onClickTag={onFilterByTag}
          />
        </div>

        {/* Collection */}
        {collections.length > 0 && (
          <div className="details-section">
            <label className="details-label">Collection</label>
            <select
              className="collection-select"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddToCollection(e.target.value);
                }
              }}
            >
              <option value="">Add to collection...</option>
              {collections.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Prompt (collapsible, read-only) */}
        <div className="details-section">
          <button
            className="collapse-header"
            onClick={() => setPromptExpanded(!promptExpanded)}
          >
            <span className={`collapse-arrow ${promptExpanded ? 'expanded' : ''}`}>▶</span>
            <span className="details-label" style={{ marginBottom: 0 }}>Prompt</span>
          </button>
          {promptExpanded && (
            <div className="collapse-content">
              <div className="prompt-text">
                <Markdown>{generation.prompt}</Markdown>
              </div>
            </div>
          )}
        </div>

        {/* Metadata (collapsible) */}
        <div className="details-section">
          <button
            className="collapse-header"
            onClick={() => setMetadataExpanded(!metadataExpanded)}
          >
            <span className={`collapse-arrow ${metadataExpanded ? 'expanded' : ''}`}>▶</span>
            <span className="details-label" style={{ marginBottom: 0 }}>Metadata</span>
          </button>
          {metadataExpanded && (
            <div className="collapse-content">
              <div className="metadata-grid">
                <span className="meta-label">ID</span>
                <span>{generation.id}</span>

                <span className="meta-label">Date</span>
                <span>{generation.date}</span>

                {generation.width && generation.height && (
                  <>
                    <span className="meta-label">Size</span>
                    <span>{generation.width} × {generation.height}</span>
                  </>
                )}

                {generation.generation_time_seconds && (
                  <>
                    <span className="meta-label">Time</span>
                    <span>{generation.generation_time_seconds.toFixed(1)}s</span>
                  </>
                )}

                {generation.cost_estimate_usd && (
                  <>
                    <span className="meta-label">Cost</span>
                    <span>${generation.cost_estimate_usd.toFixed(3)}</span>
                  </>
                )}

                <span className="meta-label">File</span>
                <span>{formatFileSize(generation.file_size)}</span>

                {generation.seed && (
                  <>
                    <span className="meta-label">Seed</span>
                    <span className="text-mono">{generation.seed}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions (bottom) */}
        <div className="details-actions">
          <div className="details-action-row">
            <button className="btn btn-primary details-action-btn" onClick={onRemix}>
              Remix
            </button>
            <button className="btn btn-secondary details-action-btn" onClick={onReference}>
              Reference
            </button>
          </div>
          <button className="btn btn-ghost btn-danger-text" onClick={() => setShowTrashConfirm(true)}>
            Trash
          </button>
        </div>
      </div>

      {showTrashConfirm && (
        <div className="confirm-overlay" onClick={() => setShowTrashConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Move to Trash?</h3>
            <p>This image will be moved to trash. You can restore it later.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setShowTrashConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowTrashConfirm(false);
                  onTrash();
                }}
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .details-panel {
          display: flex;
          flex-direction: column;
        }
        .details-header {
          justify-content: space-between;
        }
        .details-image {
          padding: var(--spacing-md);
        }
        .details-image img {
          width: 100%;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: opacity var(--transition-fast);
        }
        .details-image img:hover {
          opacity: 0.9;
        }
        .details-content {
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
        }

        /* Title */
        .details-title-section {
          margin-bottom: var(--spacing-sm);
        }
        .image-id {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          font-family: var(--font-mono);
          display: block;
          margin-bottom: 2px;
        }
        .title-display {
          font-size: 18px;
          font-weight: 600;
          padding: var(--spacing-xs) 0;
          cursor: pointer;
          border-bottom: 1px solid transparent;
          transition: border-color var(--transition-fast);
        }
        .title-display:hover {
          border-bottom-color: var(--border-light);
        }
        .title-placeholder {
          color: var(--text-muted);
          font-weight: 400;
          font-style: italic;
        }
        .title-input {
          width: 100%;
          font-size: 18px;
          font-weight: 600;
          padding: var(--spacing-xs);
          background: var(--bg-primary);
          border: 1px solid var(--accent);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
        }
        .title-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--accent-muted);
        }

        /* Model + Star row */
        .model-star-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }
        .model-badge {
          font-size: 13px;
          color: var(--text-secondary);
          background: var(--bg-primary);
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--radius-sm);
        }
        .star-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-muted);
          padding: var(--spacing-xs);
          min-width: 32px;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast), transform var(--transition-fast);
        }
        .star-btn:hover {
          transform: scale(1.1);
        }
        .star-btn.starred {
          color: var(--warning);
        }

        /* Sections */
        .details-section {
          margin-bottom: var(--spacing-md);
        }
        .details-label {
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          display: block;
          margin-bottom: var(--spacing-xs);
        }

        /* Collection select */
        .collection-select {
          width: 100%;
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
        }
        .collection-select:hover {
          border-color: var(--border-light);
        }
        .collection-select:focus {
          outline: none;
          border-color: var(--accent);
        }

        /* Collapsible sections */
        .collapse-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          background: none;
          border: none;
          cursor: pointer;
          padding: var(--spacing-xs) 0;
          width: 100%;
          text-align: left;
          min-height: 32px;
        }
        .collapse-header:hover .details-label {
          color: var(--text-primary);
        }
        .collapse-arrow {
          font-size: 10px;
          color: var(--text-muted);
          transition: transform var(--transition-fast);
          width: 16px;
          text-align: center;
        }
        .collapse-arrow.expanded {
          transform: rotate(90deg);
        }
        .collapse-content {
          margin-top: var(--spacing-sm);
        }

        /* Metadata grid */
        .metadata-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: var(--spacing-xs) var(--spacing-md);
          font-size: 13px;
        }
        .meta-label {
          color: var(--text-muted);
        }
        .text-mono {
          font-family: var(--font-mono);
          font-size: 12px;
        }

        /* References */
        .references-grid {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }
        .reference-thumb {
          width: 60px;
          height: 60px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          border: 1px solid var(--border);
          transition: border-color var(--transition-fast);
        }
        .reference-thumb:hover {
          border-color: var(--accent);
        }
        .reference-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Prompt */
        .prompt-text {
          background: var(--bg-primary);
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
          font-size: 13px;
          line-height: 1.5;
        }
        .prompt-text p {
          margin-bottom: var(--spacing-sm);
        }
        .prompt-text p:last-child {
          margin-bottom: 0;
        }
        .prompt-text h1, .prompt-text h2, .prompt-text h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
        }
        .prompt-text ul, .prompt-text ol {
          margin-left: var(--spacing-md);
          margin-bottom: var(--spacing-sm);
        }
        .prompt-text code {
          background: var(--bg-elevated);
          padding: 1px 4px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .prompt-text pre {
          background: var(--bg-elevated);
          padding: var(--spacing-sm);
          border-radius: var(--radius-sm);
          overflow-x: auto;
          margin-bottom: var(--spacing-sm);
        }
        .prompt-text pre code {
          background: none;
          padding: 0;
        }
        .prompt-text strong {
          font-weight: 600;
        }
        .prompt-text em {
          font-style: italic;
        }

        /* Actions */
        .details-actions {
          margin-top: auto;
          padding-top: var(--spacing-md);
        }
        .details-action-row {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-sm);
        }
        .details-action-btn {
          flex: 1;
        }
        .btn-danger-text {
          color: var(--text-muted);
          width: 100%;
        }
        .btn-danger-text:hover {
          color: var(--error);
          background: var(--bg-hover);
        }

        /* Confirm dialog */
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-lightbox);
        }
        .confirm-dialog {
          background: var(--bg-secondary);
          padding: var(--spacing-lg);
          border-radius: var(--radius-lg);
          max-width: 400px;
          width: 90%;
          box-shadow: var(--shadow-lg);
        }
        .confirm-dialog h3 {
          margin: 0 0 var(--spacing-sm) 0;
          font-size: 18px;
        }
        .confirm-dialog p {
          color: var(--text-secondary);
          margin: 0 0 var(--spacing-lg) 0;
        }
        .confirm-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
        }
        .btn-danger {
          background: var(--error);
          border-color: var(--error);
          color: white;
        }
        .btn-danger:hover {
          background: #c0392b;
          border-color: #c0392b;
        }
      `}</style>
    </div>
  );
});
