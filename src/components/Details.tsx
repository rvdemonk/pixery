import { useState } from 'react';
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
  onDelete: () => void;
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
  onDelete,
}: DetailsProps) {
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState(generation.prompt);
  const [selectedModel, setSelectedModel] = useState(generation.model);

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
      <div className="details-header">
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
            <p className="prompt-text" onClick={() => setEditingPrompt(true)}>
              {generation.prompt}
            </p>
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
          <button className="btn btn-secondary btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <style>{`
        .details-panel {
          display: flex;
          flex-direction: column;
        }
        .details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }
        .details-header h2 {
          font-size: 16px;
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
      `}</style>
    </div>
  );
}
