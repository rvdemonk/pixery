import { useState, useRef } from 'react';

interface TagChipsProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  editable?: boolean;
}

export function TagChips({ tags, onAdd, onRemove, editable = true }: TagChipsProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddClick = () => {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInputValue('');
    setShowInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setInputValue('');
      setShowInput(false);
    }
  };

  return (
    <div className="tag-chips">
      {tags.map((tag) => (
        <span key={tag} className="chip">
          {tag}
          {editable && (
            <button className="chip-remove" onClick={() => onRemove(tag)}>
              ×
            </button>
          )}
        </span>
      ))}
      {editable && !showInput && (
        <button className="chip chip-add" onClick={handleAddClick}>
          + Add
        </button>
      )}
      {showInput && (
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSubmit}
          placeholder="Tag name"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      )}
      <style>{`
        .tag-chips {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
        }
        .chip-remove {
          margin-left: var(--spacing-xs);
          opacity: 0.6;
          font-size: 14px;
          line-height: 1;
        }
        .chip-remove:hover {
          opacity: 1;
          color: var(--error);
        }
        .chip-add {
          cursor: pointer;
          border-style: dashed;
        }
        .chip-add:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .tag-input {
          width: 80px;
          padding: 2px var(--spacing-sm);
          font-size: 12px;
          border-radius: var(--radius-lg);
        }
      `}</style>
    </div>
  );
}
