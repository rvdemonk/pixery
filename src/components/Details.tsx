import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import type { Generation, ModelInfo } from '../lib/types';
import { getImageUrl } from '../lib/api';
import { TagChips } from './TagChips';

interface DetailsProps {
  generation: Generation;
  models: ModelInfo[];
  onClose: () => void;
  onToggleStar: () => void;
  onUpdatePrompt: (prompt: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onRegenerate: (model: string) => void;
  onTrash: () => void;
}

export function Details({
  generation,
  models,
  onClose,
  onToggleStar,
  onUpdatePrompt,
  onAddTag,
  onRemoveTag,
  onRegenerate,
  onTrash,
}: DetailsProps) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(generation.prompt);
  const [selectedModel, setSelectedModel] = useState(generation.model);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);

  // Sync local state when selected generation changes
  useEffect(() => {
    setPromptValue(generation.prompt);
    setSelectedModel(generation.model);
    setEditingPrompt(false);
    setShowTrashConfirm(false);
  }, [generation.id]);

  const handlePromptSave = () => {
    if (promptValue !== generation.prompt) {
      onUpdatePrompt(promptValue);
    }
    setEditingPrompt(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="panel details-panel">
      <div className="column-header details-header">
        <h2>Details</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
      </div>

      <div className="details-image">
        <img src={getImageUrl(generation.image_path)} alt={generation.slug} />
      </div>

      <div className="details-content">
        <div className="details-section">
          <div className="details-row">
            <span className="details-label">ID</span>
            <span>{generation.id}</span>
          </div>
          <div className="details-row">
            <span className="details-label">Date</span>
            <span>{generation.date}</span>
          </div>
          <div className="details-row">
            <span className="details-label">Model</span>
            <span>{generation.model}</span>
          </div>
          {generation.width && generation.height && (
            <div className="details-row">
              <span className="details-label">Size</span>
              <span>{generation.width} × {generation.height}</span>
            </div>
          )}
          {generation.generation_time_seconds && (
            <div className="details-row">
              <span className="details-label">Time</span>
              <span>{generation.generation_time_seconds.toFixed(1)}s</span>
            </div>
          )}
          {generation.cost_estimate_usd && (
            <div className="details-row">
              <span className="details-label">Cost</span>
              <span>${generation.cost_estimate_usd.toFixed(3)}</span>
            </div>
          )}
          <div className="details-row">
            <span className="details-label">File Size</span>
            <span>{formatFileSize(generation.file_size)}</span>
          </div>
          {generation.seed && (
            <div className="details-row">
              <span className="details-label">Seed</span>
              <span className="text-mono">{generation.seed}</span>
            </div>
          )}
        </div>

        <div className="details-section">
          <label className="details-label">Tags</label>
          <TagChips
            tags={generation.tags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
          />
        </div>

        <div className="details-section">
          <label className="details-label">Prompt</label>
          {editingPrompt ? (
            <div className="prompt-edit">
              <textarea
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                rows={4}
              />
              <div className="prompt-edit-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => setEditingPrompt(false)}>
                  Cancel
                </button>
                <button className="btn btn-sm btn-primary" onClick={handlePromptSave}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="prompt-text" onClick={() => setEditingPrompt(true)}>
              <Markdown>{generation.prompt}</Markdown>
            </div>
          )}
        </div>

        <div className="details-section">
          <label className="details-label">Regenerate with</label>
          <div className="regenerate-form">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} (${m.cost_per_image.toFixed(3)})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => onRegenerate(selectedModel)}
            >
              Regenerate
            </button>
          </div>
        </div>

        <div className="details-actions">
          <button
            className={`btn btn-secondary ${generation.starred ? 'starred' : ''}`}
            onClick={onToggleStar}
          >
            {generation.starred ? '★ Starred' : '☆ Star'}
          </button>
          <button className="btn btn-secondary btn-danger" onClick={() => setShowTrashConfirm(true)}>
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
          background: var(--bg-primary);
        }
        .details-image img {
          width: 100%;
          border-radius: var(--radius-md);
        }
        .details-content {
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
        }
        .details-section {
          margin-bottom: var(--spacing-lg);
        }
        .details-row {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-xs) 0;
          border-bottom: 1px solid var(--border);
        }
        .details-label {
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: block;
          margin-bottom: var(--spacing-xs);
        }
        .details-row .details-label {
          margin-bottom: 0;
        }
        .text-mono {
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .prompt-text {
          background: var(--bg-primary);
          padding: var(--spacing-sm);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 13px;
          line-height: 1.5;
        }
        .prompt-text:hover {
          background: var(--bg-hover);
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
        .prompt-edit textarea {
          width: 100%;
          margin-bottom: var(--spacing-sm);
        }
        .prompt-edit-actions {
          display: flex;
          gap: var(--spacing-sm);
          justify-content: flex-end;
        }
        .regenerate-form {
          display: flex;
          gap: var(--spacing-sm);
        }
        .regenerate-form select {
          flex: 1;
        }
        .details-actions {
          display: flex;
          gap: var(--spacing-sm);
          padding-top: var(--spacing-md);
          border-top: 1px solid var(--border);
        }
        .details-actions .btn {
          flex: 1;
        }
        .btn-danger:hover {
          background: var(--error);
          border-color: var(--error);
          color: white;
        }
        .starred {
          color: var(--warning);
        }
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .confirm-dialog {
          background: var(--bg-secondary);
          padding: var(--spacing-lg);
          border-radius: var(--radius-lg);
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
}
