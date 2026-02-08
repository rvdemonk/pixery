import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Generation, ModelInfo } from '../lib/types';
import { getImageUrl, promptHistory } from '../lib/api';
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
  onGenerate: (prompt: string, model: string, tags: string[], referencePaths: string[], negativePrompt: string | null, numRuns?: number) => void;
}

export function GenerateModal({
  models,
  initialState,
  onClose,
  onGenerate,
}: GenerateModalProps) {
  // Form state
  const [prompt, setPrompt] = useState(initialState?.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialState?.model || models[0]?.id || '');
  const [tagsInput, setTagsInput] = useState(initialState?.tags?.join(', ') || '');
  const [selectedRefs, setSelectedRefs] = useState<SelectedRef[]>(initialState?.references || []);
  const [numRuns, setNumRuns] = useState(1);

  // Prompt autocomplete
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Check if model is compatible with current ref count
  const isModelCompatible = (model: ModelInfo, refCount: number) => {
    if (refCount === 0) return true;
    return (model.max_refs ?? 0) >= refCount;
  };

  // Auto-switch to compatible model when refs change
  useEffect(() => {
    const currentModel = models.find((m) => m.id === selectedModel);
    if (currentModel && !isModelCompatible(currentModel, selectedRefs.length)) {
      // Find first compatible model
      const compatibleModel = models.find((m) => isModelCompatible(m, selectedRefs.length));
      if (compatibleModel) {
        setSelectedModel(compatibleModel.id);
      }
    }
  }, [selectedRefs.length, models, selectedModel]);

  // Fetch recent prompts on mount
  useEffect(() => {
    promptHistory(50).then((rows) => {
      // Deduplicate prompts, keep most recent
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const [, p] of rows) {
        const lower = p.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(p);
        }
      }
      setRecentPrompts(unique);
    }).catch(() => {});
  }, []);

  // Update suggestions as user types
  const updateSuggestions = useCallback((value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lower = value.toLowerCase();
    const matches = recentPrompts
      .filter((p) => p.toLowerCase().includes(lower) && p.toLowerCase() !== lower)
      .slice(0, 5);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [recentPrompts]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);
    updateSuggestions(value);
  }, [updateSuggestions]);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setPrompt(suggestion);
    setShowSuggestions(false);
    promptRef.current?.focus();
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          promptRef.current && !promptRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    onGenerate(prompt, selectedModel, tags, referencePaths, negativePrompt.trim() || null, numRuns);
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
                {models.map((m) => {
                  const compatible = isModelCompatible(m, selectedRefs.length);
                  const maxRefs = m.max_refs ?? 0;
                  return (
                    <option key={m.id} value={m.id} disabled={!compatible}>
                      {m.display_name} (${m.cost_per_image.toFixed(3)})
                      {!compatible && ` - max ${maxRefs} ref${maxRefs !== 1 ? 's' : ''}`}
                    </option>
                  );
                })}
              </select>
              {selectedRefs.length > 0 && (
                <span className="genmodal-hint" style={{ marginTop: '4px' }}>
                  {selectedRefs.length} ref{selectedRefs.length !== 1 ? 's' : ''} selected - some models may be unavailable
                </span>
              )}
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
              <div className="genmodal-prompt-wrapper">
                <textarea
                  ref={promptRef}
                  className="genmodal-prompt"
                  value={prompt}
                  onChange={handlePromptChange}
                  onFocus={() => updateSuggestions(prompt)}
                  placeholder="Describe what you want to generate..."
                  autoFocus
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="genmodal-suggestions" ref={suggestionsRef}>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="genmodal-suggestion"
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        {s.length > 80 ? s.slice(0, 80) + '...' : s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced */}
            <div className="genmodal-section">
              <button
                className="genmodal-advanced-toggle"
                onClick={() => setAdvancedOpen(!advancedOpen)}
              >
                {advancedOpen ? '▾' : '▸'} Advanced
              </button>
              {advancedOpen && (
                <div className="genmodal-advanced">
                  <label className="genmodal-label">Negative Prompt</label>
                  <textarea
                    className="genmodal-negative-prompt"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Things to avoid..."
                  />
                </div>
              )}
            </div>

            {/* Generate button */}
            <div className="genmodal-actions">
              <div className="genmodal-runs">
                <label className="genmodal-runs-label">Runs</label>
                <div className="genmodal-stepper">
                  <button
                    className="genmodal-stepper-btn"
                    onClick={() => setNumRuns(Math.max(1, numRuns - 1))}
                    disabled={numRuns <= 1}
                  >
                    −
                  </button>
                  <span className="genmodal-stepper-value">{numRuns}</span>
                  <button
                    className="genmodal-stepper-btn"
                    onClick={() => setNumRuns(Math.min(20, numRuns + 1))}
                    disabled={numRuns >= 20}
                  >
                    +
                  </button>
                </div>
              </div>
              <span className="genmodal-cost">
                ~${((models.find((m) => m.id === selectedModel)?.cost_per_image ?? 0) * numRuns).toFixed(3)}
              </span>
              <button
                className="btn btn-primary genmodal-generate"
                onClick={handleGenerate}
                disabled={!prompt.trim()}
              >
                {numRuns > 1 ? `Generate ×${numRuns}` : 'Generate'}
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
          z-index: var(--z-popover);
          backdrop-filter: blur(4px);
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
          min-height: var(--input-height);
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
          font-weight: 500;
        }

        .genmodal-hint {
          font-size: 10px;
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
          min-height: var(--input-height);
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
          align-items: center;
          gap: var(--spacing-md);
          padding-top: var(--spacing-sm);
        }

        .genmodal-runs {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .genmodal-runs-label {
          color: var(--text-muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .genmodal-stepper {
          display: flex;
          align-items: center;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .genmodal-stepper-btn {
          width: 36px;
          height: var(--input-height-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: none;
          cursor: pointer;
          font-size: 18px;
          transition: background var(--transition-fast);
        }

        .genmodal-stepper-btn:hover:not(:disabled) {
          background: var(--bg-hover);
        }

        .genmodal-stepper-btn:disabled {
          color: var(--text-muted);
          cursor: default;
          opacity: 0.4;
        }

        .genmodal-stepper-value {
          width: 36px;
          height: var(--input-height-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          background: var(--bg-primary);
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
        }

        .genmodal-cost {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 13px;
        }

        .genmodal-generate {
          min-width: 120px;
          min-height: var(--input-height-lg);
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

        /* Prompt wrapper for autocomplete */
        .genmodal-prompt-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .genmodal-prompt-wrapper .genmodal-prompt {
          flex: 1;
        }

        .genmodal-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-dropdown);
          max-height: 200px;
          overflow-y: auto;
        }

        .genmodal-suggestion {
          display: block;
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.4;
          cursor: pointer;
          transition: background var(--transition-fast);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .genmodal-suggestion:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        /* Advanced section */
        .genmodal-advanced-toggle {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--text-muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: color var(--transition-fast);
        }

        .genmodal-advanced-toggle:hover {
          color: var(--text-primary);
        }

        .genmodal-advanced {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          margin-top: var(--spacing-xs);
        }

        .genmodal-negative-prompt {
          min-height: 60px;
          resize: vertical;
          font-size: 13px;
          line-height: 1.5;
          padding: var(--spacing-sm) var(--spacing-md);
        }
      `}</style>
    </div>
  );
}
