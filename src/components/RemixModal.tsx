import { useState, useEffect } from 'react';
import type { Generation, ModelInfo, Reference } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface RemixModalProps {
  generation: Generation;
  models: ModelInfo[];
  references: Reference[];
  onClose: () => void;
  onGenerate: (prompt: string, model: string, referencePaths: string[]) => void;
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

  // Reset local state when generation changes
  useEffect(() => {
    setPrompt(generation.prompt);
    setSelectedModel(generation.model);
  }, [generation.id]);

  const handleGenerate = () => {
    const referencePaths = references.map((ref) => ref.path);
    onGenerate(prompt, selectedModel, referencePaths);
  };

  return (
    <div className="remix-overlay" onClick={onClose}>
      <div className="remix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="remix-header">
          <h2>Remix</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="remix-body">
          {/* Left: Source image */}
          <div className="remix-source">
            <img src={getImageUrl(generation.image_path)} alt={generation.slug} />
            <span className="source-id">#{generation.id}</span>
          </div>

          {/* Right: Editor */}
          <div className="remix-editor">
            {/* References row */}
            <div className="remix-section">
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

            {/* Model selector */}
            <div className="remix-section">
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

            {/* Prompt textarea */}
            <div className="remix-section remix-prompt-section">
              <label className="remix-label">Prompt</label>
              <textarea
                className="remix-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                rows={8}
              />
            </div>

            {/* Generate button */}
            <div className="remix-actions">
              <button
                className="btn btn-primary remix-generate"
                onClick={handleGenerate}
                disabled={!prompt.trim()}
              >
                Generate
              </button>
            </div>
          </div>
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
          z-index: 500;
          backdrop-filter: blur(2px);
        }

        .remix-modal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          width: 94%;
          max-width: 1100px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        .remix-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border);
        }

        .remix-header h2 {
          font-size: 18px;
          margin: 0;
        }

        .remix-header .btn {
          min-width: 44px;
          min-height: 44px;
        }

        .remix-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-xl);
          padding: var(--spacing-lg) var(--spacing-xl);
          overflow: hidden;
          min-height: 0;
          flex: 1;
        }

        .remix-source {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .remix-source img {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          border-radius: var(--radius-md);
        }

        .source-id {
          position: absolute;
          bottom: var(--spacing-sm);
          left: var(--spacing-sm);
          background: rgba(0, 0, 0, 0.6);
          color: var(--text-primary);
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 13px;
        }

        .remix-editor {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
          overflow-y: auto;
          padding-right: var(--spacing-sm);
        }

        .remix-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .remix-prompt-section {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .remix-label {
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .remix-references {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-md);
        }

        .remix-ref-thumb {
          position: relative;
          width: 100px;
          height: 100px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 2px solid var(--border);
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
          top: 4px;
          right: 4px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 16px;
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
          width: 100px;
          height: 100px;
          border-radius: var(--radius-md);
          border: 2px dashed var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 32px;
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

        .remix-select {
          width: 100%;
          min-height: 44px;
          font-size: 15px;
          padding: var(--spacing-sm) var(--spacing-md);
        }

        .remix-prompt {
          width: 100%;
          flex: 1;
          min-height: 200px;
          resize: vertical;
          font-size: 15px;
          line-height: 1.6;
          padding: var(--spacing-md);
        }

        .remix-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: var(--spacing-md);
        }

        .remix-generate {
          min-width: 140px;
          min-height: 44px;
          font-size: 15px;
        }
      `}</style>
    </div>
  );
}
