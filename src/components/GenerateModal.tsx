import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModelInfo, GenerateFormState, SelectedRef } from '../lib/types';
import { getImageUrl, promptHistory } from '../lib/api';

interface GenerateModalProps {
  models: ModelInfo[];
  formState: GenerateFormState;
  lineage: SelectedRef[];
  onFormChange: (state: GenerateFormState) => void;
  onClose: () => void;
  onGenerate: (prompt: string, model: string, tags: string[], referencePaths: string[], negativePrompt: string | null, numRuns?: number) => void;
  onPickFromGallery: () => void;
  onPickFromFile: () => void;
  onRemoveRef: (refId: number) => void;
}

export function GenerateModal({
  models,
  formState,
  lineage,
  onFormChange,
  onClose,
  onGenerate,
  onPickFromGallery,
  onPickFromFile,
  onRemoveRef,
}: GenerateModalProps) {
  // "+ Reference" dropdown
  const [refDropdownOpen, setRefDropdownOpen] = useState(false);
  const refDropdownRef = useRef<HTMLDivElement>(null);

  // Prompt autocomplete
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { prompt, model: selectedModel, tagsInput, references, numRuns, negativePrompt, advancedOpen } = formState;

  const update = useCallback((partial: Partial<GenerateFormState>) => {
    onFormChange({ ...formState, ...partial });
  }, [formState, onFormChange]);

  // Check if model is compatible with current ref count
  const isModelCompatible = (m: ModelInfo, refCount: number) => {
    if (refCount === 0) return true;
    return (m.max_refs ?? 0) >= refCount;
  };

  // Auto-switch to compatible model when refs change
  useEffect(() => {
    const currentModel = models.find((m) => m.id === selectedModel);
    if (currentModel && !isModelCompatible(currentModel, references.length)) {
      const compatibleModel = models.find((m) => isModelCompatible(m, references.length));
      if (compatibleModel) {
        update({ model: compatibleModel.id });
      }
    }
  }, [references.length, models, selectedModel]);

  // Fetch recent prompts on mount
  useEffect(() => {
    promptHistory(50).then((rows) => {
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
    update({ prompt: value });
    updateSuggestions(value);
  }, [update, updateSuggestions]);

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    update({ prompt: suggestion });
    setShowSuggestions(false);
    promptRef.current?.focus();
  }, [update]);

  // Close suggestions and ref dropdown on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          promptRef.current && !promptRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (refDropdownRef.current && !refDropdownRef.current.contains(e.target as Node)) {
        setRefDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddLineageRef = (ref: SelectedRef) => {
    if (references.some((r) => r.id === ref.id)) return;
    update({ references: [...references, ref] });
  };

  const handleGenerate = () => {
    const referencePaths = references.map((ref) => ref.path);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onGenerate(prompt, selectedModel, tags, referencePaths, negativePrompt.trim() || null, numRuns);
  };

  const selectedRefIds = new Set(references.map((r) => r.id));
  const costPerImage = models.find((m) => m.id === selectedModel)?.cost_per_image ?? 0;
  const estimatedCost = costPerImage * numRuns;

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
          {/* Model */}
          <div className="genmodal-section">
            <label className="genmodal-label">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => update({ model: e.target.value })}
              className="genmodal-select"
            >
              {models.map((m) => {
                const compatible = isModelCompatible(m, references.length);
                const maxRefs = m.max_refs ?? 0;
                return (
                  <option key={m.id} value={m.id} disabled={!compatible}>
                    {m.display_name} (${m.cost_per_image.toFixed(3)})
                    {!compatible && ` - max ${maxRefs} ref${maxRefs !== 1 ? 's' : ''}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tags */}
          <div className="genmodal-section">
            <label className="genmodal-label">Tags</label>
            <input
              type="text"
              className="genmodal-input"
              value={tagsInput}
              onChange={(e) => update({ tagsInput: e.target.value })}
              placeholder="tag1, tag2, ..."
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {/* Lineage quick-add */}
          {lineage.length > 0 && (
            <div className="genmodal-section">
              <label className="genmodal-label">
                Lineage <span className="genmodal-hint">(click to add)</span>
              </label>
              <div className="genmodal-lineage">
                {lineage.map((ref) => {
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

          {/* References */}
          <div className="genmodal-section">
            <label className="genmodal-label">
              References ({references.length})
            </label>
            <div className="genmodal-refs">
              {references.map((ref) => (
                <div key={ref.id} className="genmodal-ref-thumb">
                  <img src={getImageUrl(ref.thumbPath || ref.path)} alt={ref.id > 0 ? `#${ref.id}` : 'file'} />
                  {ref.id > 0 && <span className="genmodal-ref-id">#{ref.id}</span>}
                  <button
                    className="genmodal-ref-remove"
                    onClick={() => onRemoveRef(ref.id)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="genmodal-ref-add-wrapper" ref={refDropdownRef}>
                <button
                  className="genmodal-ref-add"
                  onClick={() => setRefDropdownOpen(!refDropdownOpen)}
                >
                  + Reference
                </button>
                {refDropdownOpen && (
                  <div className="genmodal-ref-dropdown">
                    <button
                      className="genmodal-ref-option"
                      onClick={() => {
                        setRefDropdownOpen(false);
                        onPickFromGallery();
                      }}
                    >
                      Gallery
                    </button>
                    <button
                      className="genmodal-ref-option"
                      onClick={() => {
                        setRefDropdownOpen(false);
                        onPickFromFile();
                      }}
                    >
                      File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

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
              onClick={() => update({ advancedOpen: !advancedOpen })}
            >
              {advancedOpen ? '▾' : '▸'} Advanced
            </button>
            {advancedOpen && (
              <div className="genmodal-advanced">
                <label className="genmodal-label">Negative Prompt</label>
                <textarea
                  className="genmodal-negative-prompt"
                  value={negativePrompt}
                  onChange={(e) => update({ negativePrompt: e.target.value })}
                  placeholder="Things to avoid..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="genmodal-footer">
          <div className="genmodal-runs">
            <label className="genmodal-runs-label">Runs</label>
            <div className="genmodal-stepper">
              <button
                className="genmodal-stepper-btn"
                onClick={() => update({ numRuns: Math.max(1, numRuns - 1) })}
                disabled={numRuns <= 1}
              >
                −
              </button>
              <span className="genmodal-stepper-value">{numRuns}</span>
              <button
                className="genmodal-stepper-btn"
                onClick={() => update({ numRuns: Math.min(20, numRuns + 1) })}
                disabled={numRuns >= 20}
              >
                +
              </button>
            </div>
          </div>
          <span className="genmodal-cost">~${estimatedCost.toFixed(3)}</span>
          <button
            className="btn btn-primary genmodal-generate"
            onClick={handleGenerate}
            disabled={!prompt.trim()}
          >
            {numRuns > 1 ? `Generate ×${numRuns}` : 'Generate'}
          </button>
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
          max-width: 640px;
          max-height: 85vh;
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
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
          padding: var(--spacing-lg);
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .genmodal-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .genmodal-prompt-section {
          flex: 1;
          min-height: 200px;
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

        .genmodal-select,
        .genmodal-input {
          width: 100%;
          min-height: var(--input-height);
          font-size: 14px;
          padding: var(--spacing-sm) var(--spacing-md);
        }

        /* References row */
        .genmodal-refs {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .genmodal-ref-thumb {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border);
          flex-shrink: 0;
        }

        .genmodal-ref-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .genmodal-ref-id {
          position: absolute;
          bottom: 1px;
          left: 1px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 0 3px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 8px;
        }

        .genmodal-ref-remove {
          position: absolute;
          top: 1px;
          right: 1px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast), background var(--transition-fast);
        }

        .genmodal-ref-thumb:hover .genmodal-ref-remove {
          opacity: 1;
        }

        .genmodal-ref-remove:hover {
          background: var(--error);
        }

        .genmodal-ref-add-wrapper {
          position: relative;
        }

        .genmodal-ref-add {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          padding: 0 var(--spacing-md);
          border: 1px dashed var(--border);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .genmodal-ref-add:hover {
          border-color: var(--border-light);
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .genmodal-ref-dropdown {
          position: absolute;
          top: calc(100% + var(--spacing-xs));
          left: 0;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: var(--z-dropdown);
          min-width: 120px;
          overflow: hidden;
        }

        .genmodal-ref-option {
          display: block;
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .genmodal-ref-option:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        /* Lineage */
        .genmodal-lineage {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .genmodal-lineage-thumb {
          position: relative;
          width: 48px;
          height: 48px;
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

        .genmodal-id {
          position: absolute;
          bottom: 1px;
          left: 1px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 0 3px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 8px;
        }

        .genmodal-check {
          position: absolute;
          top: 1px;
          right: 1px;
          width: 16px;
          height: 16px;
          background: var(--success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: bold;
        }

        /* Prompt */
        .genmodal-prompt-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .genmodal-prompt-wrapper .genmodal-prompt {
          flex: 1;
        }

        .genmodal-prompt {
          flex: 1;
          min-height: 120px;
          resize: none;
          font-size: 15px;
          line-height: 1.7;
          padding: var(--spacing-md);
          font-family: var(--font-sans);
          border-radius: var(--radius-md);
          background: var(--bg-primary);
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

        /* Footer */
        .genmodal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md) var(--spacing-lg);
          border-top: 1px solid var(--border);
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
      `}</style>
    </div>
  );
}
