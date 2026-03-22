import { useState, useEffect } from 'react';
import type { Generation, ModelInfo, Reference } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface RemixModalProps {
  generation: Generation;
  models: ModelInfo[];
  references: Reference[];
  onClose: () => void;
  onGenerate: (prompt: string, model: string, referencePaths: string[], tags: string[], numRuns?: number, referenceSourceIds?: (number | null)[]) => void;
  onAddReference: () => void;
  onRemoveReference: (refId: number) => void;
}

export function RemixModal({
  generation,
  models,
  references,
  onClose,
  onGenerate,
  onAddReference,
  onRemoveReference,
}: RemixModalProps) {
  const [prompt, setPrompt] = useState(generation.prompt);
  const [selectedModel, setSelectedModel] = useState(generation.model);
  const [tagsInput, setTagsInput] = useState(generation.tags.join(', '));
  const [numRuns, setNumRuns] = useState(1);

  // Reset local state when generation changes
  useEffect(() => {
    setPrompt(generation.prompt);
    setSelectedModel(generation.model);
    setTagsInput(generation.tags.join(', '));
  }, [generation.id]);

  const handleGenerate = () => {
    const referencePaths = references.map((ref) => ref.path);
    const referenceSourceIds = references.map((ref) => ref.source_generation_id);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onGenerate(prompt, selectedModel, referencePaths, tags, numRuns, referenceSourceIds);
  };

  return (
    <div className="remix-overlay" onClick={onClose}>
      <div className="remix-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="remix-header">
          <h2>Remix <span className="remix-source-id">#{generation.id}</span></h2>
          <button className="remix-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>

        {/* Two-column body */}
        <div className="remix-body">
          {/* Left column: source image + settings */}
          <div className="remix-left">
            <div className="remix-source">
              <img src={getImageUrl(generation.image_path)} alt={generation.slug} />
            </div>
            <div className="remix-settings">
              <div className="remix-field">
                <label className="remix-label">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="remix-select"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} (${m.cost_per_image.toFixed(3)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="remix-field">
                <label className="remix-label">Tags</label>
                <input
                  type="text"
                  className="remix-tags-input"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag1, tag2, ..."
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>
              <div className="remix-field">
                <label className="remix-label">References</label>
                <div className="remix-references">
                  {references.map((ref) => (
                    <div key={ref.id} className="remix-ref-thumb">
                      <img src={getImageUrl(ref.path)} alt="Reference" />
                      <button
                        className="remix-ref-remove"
                        onClick={() => onRemoveReference(ref.id)}
                        title="Remove reference"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="remix-ref-add"
                    onClick={onAddReference}
                    title="Add reference from gallery"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column: prompt */}
          <div className="remix-right">
            <label className="remix-label">Prompt</label>
            <textarea
              className="remix-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="remix-footer">
          <div className="remix-runs">
            <span className="remix-label">Runs</span>
            <button
              className="remix-stepper-btn"
              onClick={() => setNumRuns(Math.max(1, numRuns - 1))}
              disabled={numRuns <= 1}
            >
              −
            </button>
            <span className="remix-stepper-value">{numRuns}</span>
            <button
              className="remix-stepper-btn"
              onClick={() => setNumRuns(Math.min(20, numRuns + 1))}
              disabled={numRuns >= 20}
            >
              +
            </button>
          </div>
          <span className="remix-cost">
            ~${((models.find((m) => m.id === selectedModel)?.cost_per_image ?? 0) * numRuns).toFixed(3)}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!prompt.trim()}
          >
            {numRuns > 1 ? `Generate ×${numRuns}` : 'Generate'}
          </button>
        </div>
      </div>

      <style>{`
        .remix-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-popover);
          backdrop-filter: blur(4px);
        }

        .remix-modal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          width: 94%;
          max-width: 1200px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        /* Header */
        .remix-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .remix-header h2 {
          font-family: var(--font-brand);
          letter-spacing: 0.03em;
          font-size: 18px;
          margin: 0;
        }

        .remix-source-id {
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 400;
          margin-left: var(--spacing-xs);
        }

        .remix-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          border: none;
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
        }

        .remix-close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        /* Two-column body */
        .remix-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Left column */
        .remix-left {
          width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
        }

        .remix-source {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: var(--spacing-md);
        }

        .remix-source img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: var(--radius-md);
        }

        .remix-settings {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          padding: var(--spacing-md);
          border-top: 1px solid var(--border);
        }

        .remix-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .remix-label {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .remix-select {
          width: 100%;
          height: 32px;
          font-size: 13px;
          padding: 0 var(--spacing-sm);
        }

        .remix-tags-input {
          width: 100%;
          height: 32px;
          font-size: 13px;
          padding: 0 var(--spacing-sm);
        }

        .remix-references {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          align-items: center;
        }

        .remix-ref-thumb {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border);
          transition: border-color var(--transition-fast);
        }

        .remix-ref-thumb:hover {
          border-color: var(--accent);
        }

        .remix-ref-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remix-ref-remove {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast), background var(--transition-fast);
        }

        .remix-ref-thumb:hover .remix-ref-remove {
          opacity: 1;
        }

        .remix-ref-remove:hover {
          background: var(--error);
        }

        .remix-ref-add {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          border: 1px dashed var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .remix-ref-add:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--bg-hover);
        }

        /* Right column */
        .remix-right {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          padding: var(--spacing-md);
        }

        .remix-prompt {
          width: 100%;
          flex: 1;
          min-height: 0;
          resize: none;
          font-size: 15px;
          line-height: 1.6;
          padding: var(--spacing-md);
        }

        /* Footer */
        .remix-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-sm) var(--spacing-lg);
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .remix-runs {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .remix-stepper-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          color: var(--text-muted);
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 16px;
          transition: background var(--transition-fast), color var(--transition-fast);
        }

        .remix-stepper-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .remix-stepper-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        .remix-stepper-value {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          min-width: 20px;
          text-align: center;
        }

        .remix-cost {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .remix-footer .btn-primary {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
