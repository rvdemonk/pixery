import { useState } from 'react';
import type { ModelInfo } from '../lib/types';

interface GenerateFormProps {
  models: ModelInfo[];
  generating: boolean;
  error: string | null;
  onGenerate: (prompt: string, model: string, tags: string[]) => void;
  onCollapse: () => void;
}

export function GenerateForm({
  models,
  generating,
  error,
  onGenerate,
  onCollapse,
}: GenerateFormProps) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0]?.id || 'gemini-2.0-flash-exp');
  const [tagsInput, setTagsInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || generating) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onGenerate(prompt.trim(), model, tags);
  };

  const selectedModel = models.find((m) => m.id === model);

  return (
    <form className="generate-form" onSubmit={handleSubmit}>
      <div className="generate-header">
        <h3>Generate</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCollapse}>
          ×
        </button>
      </div>

      <div className="generate-body">
        <div className="generate-main">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            rows={3}
            disabled={generating}
          />
        </div>

        <div className="generate-options">
          <div className="generate-field">
            <label>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={generating}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            {selectedModel && (
              <span className="generate-cost">${selectedModel.cost_per_image.toFixed(3)}</span>
            )}
          </div>

          <div className="generate-field">
            <label>Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2, ..."
              disabled={generating}
            />
          </div>
        </div>

        <div className="generate-actions">
          {error && <p className="generate-error">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!prompt.trim() || generating}
          >
            {generating ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>

      <style>{`
        .generate-form {
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
        }
        .generate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm) var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }
        .generate-header h3 {
          font-size: 14px;
        }
        .generate-body {
          padding: var(--spacing-md);
          display: flex;
          gap: var(--spacing-md);
        }
        .generate-main {
          flex: 1;
        }
        .generate-main textarea {
          width: 100%;
          resize: none;
        }
        .generate-options {
          width: 200px;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        .generate-field {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }
        .generate-field label {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .generate-field select,
        .generate-field input {
          width: 100%;
        }
        .generate-cost {
          font-size: 11px;
          color: var(--text-muted);
        }
        .generate-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--spacing-sm);
          min-width: 120px;
        }
        .generate-error {
          color: var(--error);
          font-size: 12px;
          text-align: right;
        }
      `}</style>
    </form>
  );
}
