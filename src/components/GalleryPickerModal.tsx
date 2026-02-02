import { useState, useEffect, useMemo } from 'react';
import type { Generation } from '../lib/types';
import { getImageUrl } from '../lib/api';
import * as api from '../lib/api';

interface GalleryPickerModalProps {
  selectedRefIds: Set<number>;
  onSelect: (generation: Generation) => void;
  onClose: () => void;
}

export function GalleryPickerModal({
  selectedRefIds,
  onSelect,
  onClose,
}: GalleryPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load generations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (searchQuery.trim()) {
          const results = await api.searchGenerations(searchQuery, 50);
          setGenerations(results);
        } else {
          const results = await api.listGenerations({ limit: 50 });
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

  // Track which generations are already selected as references
  const selectedIds = useMemo(() => selectedRefIds, [selectedRefIds]);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h2>Add Reference</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="picker-search">
          <input
            type="text"
            placeholder="Search by prompt or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="picker-grid">
          {loading ? (
            <div className="picker-loading">Loading...</div>
          ) : generations.length === 0 ? (
            <div className="picker-empty">No images found</div>
          ) : (
            generations.map((gen) => {
              const isSelected = selectedIds.has(gen.id);
              return (
                <div
                  key={gen.id}
                  className={`picker-item ${isSelected ? 'picker-item-selected' : ''}`}
                  onClick={() => onSelect(gen)}
                  title={gen.prompt.slice(0, 100)}
                >
                  <img
                    src={getImageUrl(gen.thumb_path || gen.image_path)}
                    alt={gen.slug}
                  />
                  {isSelected && <span className="picker-check">✓</span>}
                  <span className="picker-id">#{gen.id}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="picker-footer">
          <span className="picker-hint">Click images to add as references</span>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <style>{`
        .picker-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 600;
          backdrop-filter: blur(2px);
        }

        .picker-modal {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          width: 90%;
          max-width: 700px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg);
        }

        .picker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }

        .picker-header h2 {
          font-size: 16px;
          margin: 0;
        }

        .picker-search {
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }

        .picker-search input {
          width: 100%;
        }

        .picker-grid {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-md);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          grid-auto-rows: 120px;
          gap: var(--spacing-md);
          height: 400px;
          align-content: start;
        }

        .picker-loading,
        .picker-empty {
          grid-column: 1 / -1;
          text-align: center;
          color: var(--text-muted);
          padding: var(--spacing-xl);
          height: auto;
        }

        .picker-item {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all var(--transition-fast);
        }

        .picker-item:hover {
          border-color: var(--accent);
          transform: scale(1.02);
        }

        .picker-item-selected {
          border-color: var(--success);
          opacity: 0.7;
        }

        .picker-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .picker-check {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          background: var(--success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .picker-id {
          position: absolute;
          bottom: 2px;
          left: 2px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 1px 4px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 10px;
        }

        .picker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-top: 1px solid var(--border);
        }

        .picker-hint {
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
