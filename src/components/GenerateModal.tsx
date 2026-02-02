import { useState, useEffect, useMemo } from 'react';
import type { Generation, ModelInfo } from '../lib/types';
import { getImageUrl } from '../lib/api';
import * as api from '../lib/api';

interface SelectedRef {
  id: number;
  path: string;
  thumbPath: string | null;
}

export interface GenerateModalInitialState {
  prompt?: string;
  model?: string;
  tags?: string[];
  references?: SelectedRef[];
  /** Lineage refs shown for quick-add (grandparents) */
  lineage?: SelectedRef[];
}

interface GenerateModalProps {
  models: ModelInfo[];
  initialState?: GenerateModalInitialState;
  onClose: () => void;
  onGenerate: (prompt: string, model: string, tags: string[], referencePaths: string[]) => void;
}

export function GenerateModal({
  models,
  initialState,
  onClose,
  onGenerate,
}: GenerateModalProps) {
  // Form state
  const [prompt, setPrompt] = useState(initialState?.prompt || '');
  const [selectedModel, setSelectedModel] = useState(initialState?.model || models[0]?.id || '');
  const [tagsInput, setTagsInput] = useState(initialState?.tags?.join(', ') || '');
  const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>(initialState?.references || []);

  // Gallery browser state
  const [searchQuery, setSearchQuery] = useState('');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview state - which ref is being previewed larger
  const [previewRef, setPreviewRef] = useState<SelectedRef | null>(null);

  // Load gallery
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (searchQuery.trim()) {
          const results = await api.searchGenerations(searchQuery, 100);
          setGenerations(results);
        } else {
          const results = await api.listGenerations({ limit: 100 });
          setGenerations(results);
        }
      } catch (e) {
        console.error('Failed to load generations:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchQuery]);

  const selectedRefIds = useMemo(() => new Set(selectedRefs.map((r) => r.id)), [selectedRefs]);

  const handleToggleRef = (gen: Generation) => {
    const ref: SelectedRef = {
      id: gen.id,
      path: gen.image_path,
      thumbPath: gen.thumb_path,
    };

    setSelectedRefs((prev) => {
      if (prev.some((r) => r.id === gen.id)) {
        return prev.filter((r) => r.id !== gen.id);
      }
      return [...prev, ref];
    });
  };

  const handleRemoveRef = (refId: number) => {
    setSelectedRefs((prev) => prev.filter((r) => r.id !== refId));
    if (previewRef?.id === refId) {
      setPreviewRef(null);
    }
  };

  const handleAddLineageRef = (ref: SelectedRef) => {
    setSelectedRefs((prev) => {
      if (prev.some((r) => r.id === ref.id)) {
        return prev;
      }
      return [...prev, ref];
    });
  };

  const handleGenerate = () => {
    const referencePaths = selectedRefs.map((ref) => ref.path);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onGenerate(prompt, selectedModel, tags, referencePaths);
  };

  const lineageRefs = initialState?.lineage || [];
  const hasLineage = lineageRefs.length > 0;

  return (
    <div className="genmodal-overlay" onClick={onClose}>
      <div className="genmodal" onClick={(e) => e.stopPropagation()}>
        <div className="genmodal-header">
          <h2>Generate</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="genmodal-body">
          {/* Left: Gallery browser */}
          <div className="genmodal-browser">
            <div className="genmodal-search">
              <input
                type="text"
                placeholder="Search gallery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            <div className="genmodal-gallery">
              {loading ? (
                <div className="genmodal-loading">Loading...</div>
              ) : generations.length === 0 ? (
                <div className="genmodal-empty">No images found</div>
              ) : (
                generations.map((gen) => {
                  const isSelected = selectedRefIds.has(gen.id);
                  return (
                    <div
                      key={gen.id}
                      className={`genmodal-thumb ${isSelected ? 'genmodal-thumb-selected' : ''}`}
                      onClick={() => handleToggleRef(gen)}
                      title={gen.prompt.slice(0, 100)}
                    >
                      <img
                        src={getImageUrl(gen.thumb_path || gen.image_path)}
                        alt={gen.slug}
                      />
                      {isSelected && <span className="genmodal-check">✓</span>}
                      <span className="genmodal-id">#{gen.id}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="genmodal-editor">
            {/* Model */}
            <div className="genmodal-section">
              <label className="genmodal-label">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="genmodal-select"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} (${m.cost_per_image.toFixed(3)})
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="genmodal-section">
              <label className="genmodal-label">Tags</label>
              <input
                type="text"
                className="genmodal-input"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, ..."
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            {/* Lineage quick-add */}
            {hasLineage && (
              <div className="genmodal-section">
                <label className="genmodal-label">
                  Lineage <span className="genmodal-hint">(click to add)</span>
                </label>
                <div className="genmodal-lineage">
                  {lineageRefs.map((ref) => {
                    const alreadyAdded = selectedRefIds.has(ref.id);
                    return (
                      <div
                        key={ref.id}
                        className={`genmodal-lineage-thumb ${alreadyAdded ? 'genmodal-lineage-added' : ''}`}
                        onClick={() => !alreadyAdded && handleAddLineageRef(ref)}
                        title={alreadyAdded ? 'Already added' : 'Click to add'}
                      >
                        <img src={getImageUrl(ref.thumbPath || ref.path)} alt={`#${ref.id}`} />
                        <span className="genmodal-id">#{ref.id}</span>
                        {alreadyAdded && <span className="genmodal-check">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="genmodal-section genmodal-prompt-section">
              <label className="genmodal-label">Prompt</label>
              <textarea
                className="genmodal-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate..."
                autoFocus
              />
            </div>

            {/* Generate button */}
            <div className="genmodal-actions">
              <button
                className="btn btn-primary genmodal-generate"
                onClick={handleGenerate}
                disabled={!prompt.trim()}
              >
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Bottom: Selected references strip */}
        <div className="genmodal-selected">
          <div className="genmodal-selected-header">
            <span className="genmodal-label">
              References ({selectedRefs.length})
            </span>
          </div>
          <div className="genmodal-selected-strip">
            {selectedRefs.length === 0 ? (
              <div className="genmodal-selected-empty">
                Click images in the gallery to add as references
              </div>
            ) : (
              <>
                {selectedRefs.map((ref) => (
                  <div
                    key={ref.id}
                    className={`genmodal-selected-thumb ${previewRef?.id === ref.id ? 'genmodal-selected-active' : ''}`}
                    onClick={() => setPreviewRef(previewRef?.id === ref.id ? null : ref)}
                  >
                    <img src={getImageUrl(ref.thumbPath || ref.path)} alt={`#${ref.id}`} />
                    <span className="genmodal-id">#{ref.id}</span>
                    <button
                      className="genmodal-selected-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRef(ref.id);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Preview panel */}
          {previewRef && (
            <div className="genmodal-preview">
              <img src={getImageUrl(previewRef.path)} alt={`#${previewRef.id}`} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .genmodal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          backdrop-filter: blur(2px);
        }

        .genmodal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          width: 95%;
          max-width: 1200px;
          height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        .genmodal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border);
        }

        .genmodal-header h2 {
          font-size: 18px;
          margin: 0;
        }

        .genmodal-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
          padding: var(--spacing-lg);
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* Gallery browser */
        .genmodal-browser {
          display: flex;
          flex-direction: column;
          min-height: 0;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-primary);
        }

        .genmodal-search {
          padding: var(--spacing-sm);
          border-bottom: 1px solid var(--border);
        }

        .genmodal-search input {
          width: 100%;
        }

        .genmodal-gallery {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-sm);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          grid-auto-rows: 80px;
          gap: var(--spacing-sm);
          align-content: start;
        }

        .genmodal-loading,
        .genmodal-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: var(--text-muted);
          padding: var(--spacing-xl);
        }

        .genmodal-thumb {
          position: relative;
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all var(--transition-fast);
        }

        .genmodal-thumb:hover {
          border-color: var(--accent);
        }

        .genmodal-thumb-selected {
          border-color: var(--success);
        }

        .genmodal-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .genmodal-check {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 18px;
          height: 18px;
          background: var(--success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
        }

        .genmodal-id {
          position: absolute;
          bottom: 2px;
          left: 2px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 1px 4px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 9px;
        }

        /* Editor */
        .genmodal-editor {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          overflow-y: auto;
        }

        .genmodal-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .genmodal-prompt-section {
          flex: 1;
          min-height: 150px;
        }

        .genmodal-label {
          color: var(--text-secondary);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .genmodal-hint {
          font-size: 10px;
          text-transform: none;
          letter-spacing: normal;
          color: var(--text-muted);
        }

        .genmodal-prompt {
          flex: 1;
          min-height: 120px;
          resize: vertical;
          font-size: 15px;
          line-height: 1.6;
          padding: var(--spacing-md);
        }

        .genmodal-select,
        .genmodal-input {
          width: 100%;
          min-height: 40px;
          font-size: 14px;
          padding: var(--spacing-sm) var(--spacing-md);
        }

        /* Lineage */
        .genmodal-lineage {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .genmodal-lineage-thumb {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid var(--border);
          transition: all var(--transition-fast);
        }

        .genmodal-lineage-thumb:hover:not(.genmodal-lineage-added) {
          border-color: var(--accent);
        }

        .genmodal-lineage-added {
          opacity: 0.5;
          cursor: default;
        }

        .genmodal-lineage-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .genmodal-actions {
          display: flex;
          justify-content: flex-end;
          padding-top: var(--spacing-sm);
        }

        .genmodal-generate {
          min-width: 120px;
          min-height: 44px;
          font-size: 15px;
        }

        /* Selected references strip */
        .genmodal-selected {
          border-top: 1px solid var(--border);
          padding: var(--spacing-md) var(--spacing-lg);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          height: 320px;
          flex-shrink: 0;
        }

        .genmodal-selected-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .genmodal-selected-strip {
          display: flex;
          gap: var(--spacing-md);
          overflow-x: auto;
          padding: var(--spacing-sm) 0;
          min-height: 100px;
        }

        .genmodal-selected-empty {
          color: var(--text-muted);
          font-size: 13px;
          display: flex;
          align-items: center;
        }

        .genmodal-selected-thumb {
          position: relative;
          flex-shrink: 0;
          width: 90px;
          height: 90px;
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid var(--border);
          transition: all var(--transition-fast);
        }

        .genmodal-selected-thumb:hover {
          border-color: var(--accent);
        }

        .genmodal-selected-active {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent);
        }

        .genmodal-selected-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .genmodal-selected-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast), background var(--transition-fast);
        }

        .genmodal-selected-thumb:hover .genmodal-selected-remove {
          opacity: 1;
        }

        .genmodal-selected-remove:hover {
          background: var(--error);
        }

        /* Preview panel */
        .genmodal-preview {
          margin-top: var(--spacing-sm);
          max-height: 200px;
          display: flex;
          justify-content: center;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: var(--spacing-sm);
        }

        .genmodal-preview img {
          max-width: 100%;
          max-height: 180px;
          object-fit: contain;
          border-radius: var(--radius-sm);
        }
      `}</style>
    </div>
  );
}
