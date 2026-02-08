import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { TagCount, ModelInfo } from '../lib/types';

type SuggestionItem = {
  type: 'tag' | 'model';
  name: string;
  displayName: string;
  count?: number;
};

interface TagFilterBarProps {
  filterTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  availableTags: TagCount[];
  models: ModelInfo[];
  filterModel: string | null;
  onSetModel: (model: string | null) => void;
}

export function TagFilterBar({
  filterTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
  availableTags,
  models,
  filterModel,
  onSetModel,
}: TagFilterBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Combined suggestions: tags + models
  const suggestions = useMemo(() => {
    const query = inputValue.toLowerCase();
    const items: SuggestionItem[] = [];

    // Add matching tags
    for (const tag of availableTags) {
      if (!filterTags.includes(tag.name) && tag.name.toLowerCase().includes(query)) {
        items.push({ type: 'tag', name: tag.name, displayName: tag.name, count: tag.count });
      }
    }

    // Add matching models (exclude already-selected model)
    for (const model of models) {
      const matchesId = model.id.toLowerCase().includes(query);
      const matchesName = model.display_name.toLowerCase().includes(query);
      if ((matchesId || matchesName) && model.id !== filterModel) {
        items.push({ type: 'model', name: model.id, displayName: model.display_name });
      }
    }

    return items;
  }, [availableTags, models, filterTags, filterModel, inputValue]);

  const hasFilters = filterTags.length > 0 || filterModel !== null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
    setHighlightedIndex(0);
  };

  const handleSelectItem = useCallback((item: SuggestionItem) => {
    if (item.type === 'model') {
      onSetModel(item.name);
    } else {
      onAddTag(item.name);
    }
    setInputValue('');
    setShowDropdown(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }, [onAddTag, onSetModel]);

  const handleClearAll = useCallback(() => {
    onClearTags();
    onSetModel(null);
  }, [onClearTags, onSetModel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && highlightedIndex < suggestions.length) {
        handleSelectItem(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Backspace' && inputValue === '') {
      // Remove last filter (model first if present, then last tag)
      if (filterModel) {
        onSetModel(null);
      } else if (filterTags.length > 0) {
        onRemoveTag(filterTags[filterTags.length - 1]);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const highlighted = dropdownRef.current.querySelector('.tag-suggestion-highlighted');
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showDropdown]);

  return (
    <div className="tag-filter-bar">
      <div className="tag-filter-input-wrapper">
        <input
          ref={inputRef}
          id="tag-filter-input"
          type="text"
          placeholder={hasFilters ? "Add filter..." : "Filter... (press /)"}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {showDropdown && suggestions.length > 0 && (
          <div ref={dropdownRef} className="tag-suggestions">
            {suggestions.slice(0, 8).map((item, index) => (
              <button
                key={`${item.type}-${item.name}`}
                className={`tag-suggestion ${index === highlightedIndex ? 'tag-suggestion-highlighted' : ''}`}
                onClick={() => handleSelectItem(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="tag-suggestion-name">
                  {item.type === 'model' && <span className="tag-suggestion-type">model</span>}
                  {item.displayName}
                </span>
                {item.count !== undefined && (
                  <span className="tag-suggestion-count">{item.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={`tag-filter-clear ${hasFilters ? 'tag-filter-clear-active' : ''}`}
        onClick={handleClearAll}
        disabled={!hasFilters}
        aria-label="Clear all filters"
        title="Clear all filters"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <path d="M10.85 3.85a.5.5 0 0 0-.7-.7L7 6.29 3.85 3.15a.5.5 0 1 0-.7.7L6.29 7l-3.14 3.15a.5.5 0 1 0 .7.7L7 7.71l3.15 3.14a.5.5 0 0 0 .7-.7L7.71 7l3.14-3.15z"/>
        </svg>
      </button>

      {hasFilters && (
        <div className="tag-filter-chips">
          {filterModel && (
            <span className="chip chip-active tag-chip model-chip">
              {models.find(m => m.id === filterModel)?.display_name || filterModel}
              <button
                className="tag-chip-remove"
                onClick={() => onSetModel(null)}
                aria-label={`Remove ${filterModel} filter`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M9.35 3.35a.5.5 0 0 0-.7-.7L6 5.29 3.35 2.65a.5.5 0 1 0-.7.7L5.29 6 2.65 8.65a.5.5 0 1 0 .7.7L6 6.71l2.65 2.64a.5.5 0 0 0 .7-.7L6.71 6l2.64-2.65z"/>
                </svg>
              </button>
            </span>
          )}
          {filterTags.map((tag) => (
            <span key={tag} className="chip chip-active tag-chip">
              {tag}
              <button
                className="tag-chip-remove"
                onClick={() => onRemoveTag(tag)}
                aria-label={`Remove ${tag} filter`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M9.35 3.35a.5.5 0 0 0-.7-.7L6 5.29 3.35 2.65a.5.5 0 1 0-.7.7L5.29 6 2.65 8.65a.5.5 0 1 0 .7.7L6 6.71l2.65 2.64a.5.5 0 0 0 .7-.7L6.71 6l2.64-2.65z"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <style>{`
        .tag-filter-bar {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex: 1;
          min-width: 0;
        }
        .tag-filter-input-wrapper {
          position: relative;
          flex-shrink: 0;
          width: 200px;
        }
        .tag-filter-input-wrapper input {
          width: 100%;
        }
        .tag-suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-lg);
          max-height: 240px;
          overflow-y: auto;
          z-index: var(--z-dropdown);
        }
        .tag-suggestion {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          color: var(--text-secondary);
          transition: background var(--transition-fast);
          min-height: 36px;
        }
        .tag-suggestion:hover,
        .tag-suggestion-highlighted {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .tag-suggestion-name {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tag-suggestion-type {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 2px 6px;
          background: var(--accent-muted);
          color: var(--accent);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .tag-suggestion-count {
          font-size: 12px;
          color: var(--text-muted);
          flex-shrink: 0;
          margin-left: var(--spacing-sm);
        }
        .tag-filter-chips {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          flex-wrap: wrap;
          min-width: 0;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          max-width: 150px;
        }
        .model-chip {
          background: var(--accent-muted);
          border-color: var(--accent);
        }
        .tag-chip-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          color: var(--text-muted);
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }
        .tag-chip-remove:hover {
          background: var(--accent);
          color: white;
        }
        .tag-filter-clear {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          min-height: 32px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          opacity: 0.4;
          cursor: default;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }
        .tag-filter-clear-active {
          opacity: 1;
          cursor: pointer;
          color: var(--text-secondary);
        }
        .tag-filter-clear-active:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
