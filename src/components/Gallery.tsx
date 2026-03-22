import { useRef, useEffect, useCallback, useState, memo } from 'react';
import type { Generation } from '../lib/types';
import type { ThumbnailSize } from '../hooks/useSettings';
import { Thumbnail } from './Thumbnail';

interface GalleryProps {
  generations: Generation[];
  selectedId: number | null;
  markedIds: Set<number>;
  thumbnailSize: ThumbnailSize;
  onSelect: (id: number, event: React.MouseEvent) => void;
  onDoubleClick: (id: number) => void;
  onContextMenu: (generation: Generation, position: { x: number; y: number }) => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  pickingMode?: boolean;
  pickedIds?: Set<number>;
  onPickToggle?: (generation: Generation) => void;
}


const COLUMN_WIDTHS: Record<ThumbnailSize, number> = {
  small: 140,
  medium: 180,
  large: 240,
  xl: 420,
  xxl: 570,
};

/**
 * Wrapper component that provides stable callbacks for each thumbnail
 */
const ThumbnailWrapper = memo(function ThumbnailWrapper({
  generation,
  selected,
  marked,
  picked,
  thumbnailSize,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: {
  generation: Generation;
  selected: boolean;
  marked: boolean;
  picked?: boolean;
  thumbnailSize: ThumbnailSize;
  onSelect: (id: number, event: React.MouseEvent) => void;
  onDoubleClick: (id: number) => void;
  onContextMenu: (generation: Generation, position: { x: number; y: number }) => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent) => onSelect(generation.id, e), [onSelect, generation.id]);
  const handleDoubleClick = useCallback(() => onDoubleClick(generation.id), [onDoubleClick, generation.id]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(generation, { x: e.clientX, y: e.clientY });
  }, [onContextMenu, generation]);

  return (
    <Thumbnail
      generation={generation}
      selected={selected}
      marked={marked}
      picked={picked}
      thumbnailSize={thumbnailSize}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

export const Gallery = memo(function Gallery({
  generations,
  selectedId,
  markedIds,
  thumbnailSize,
  onSelect,
  onDoubleClick,
  onContextMenu,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  pickingMode,
  pickedIds,
  onPickToggle,
}: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const minColWidth = COLUMN_WIDTHS[thumbnailSize];
  const [actualColWidth, setActualColWidth] = useState(minColWidth);
  const gap = 8;

  // Use refs for values accessed in observer callback to avoid reconnecting observer
  const loadingMoreRef = useRef(loadingMore);
  const onLoadMoreRef = useRef(onLoadMore);
  loadingMoreRef.current = loadingMore;
  onLoadMoreRef.current = onLoadMore;

  // Measure actual column width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const numCols = Math.max(1, Math.floor((w + gap) / (minColWidth + gap)));
      setActualColWidth((w - gap * (numCols - 1)) / numCols);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minColWidth]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedId && containerRef.current) {
      const selected = containerRef.current.querySelector(`[data-id="${selectedId}"]`);
      selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    // Don't set up observer while initial loading (sentinel doesn't exist yet)
    if (loading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      { root: containerRef.current, rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore]);

  // In picking mode, clicks toggle pick instead of normal selection
  const handlePickingSelect = useCallback((id: number, _event: React.MouseEvent) => {
    if (onPickToggle) {
      const gen = generations.find(g => g.id === id);
      if (gen) onPickToggle(gen);
    }
  }, [generations, onPickToggle]);

  const handlePickingDoubleClick = useCallback((id: number) => {
    if (onPickToggle) {
      const gen = generations.find(g => g.id === id);
      if (gen) onPickToggle(gen);
    }
  }, [generations, onPickToggle]);

  const getRowSpan = useCallback((gen: Generation) => {
    const ratio = (gen.height && gen.width) ? gen.height / gen.width : 1;
    return Math.ceil(actualColWidth * ratio) + gap;
  }, [actualColWidth]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="empty-state">
        <p>No generations yet</p>
        <p className="text-muted">Press G to generate your first image</p>
      </div>
    );
  }

  return (
    <div
      className="gallery"
      ref={containerRef}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))` }}
    >
      {generations.map((gen) => (
        <div key={gen.id} data-id={gen.id} className="gallery-item" style={{ gridRowEnd: `span ${getRowSpan(gen)}` }}>
          <ThumbnailWrapper
            generation={gen}
            selected={!pickingMode && gen.id === selectedId}
            marked={!pickingMode && markedIds.has(gen.id)}
            picked={pickingMode && pickedIds?.has(gen.id)}
            thumbnailSize={thumbnailSize}
            onSelect={pickingMode ? handlePickingSelect : onSelect}
            onDoubleClick={pickingMode ? handlePickingDoubleClick : onDoubleClick}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="gallery-sentinel">
          {loadingMore && <div className="spinner spinner-small" />}
        </div>
      )}
      <style>{`
        .gallery {
          display: grid;
          grid-auto-rows: 1px;
          column-gap: ${gap}px;
          padding: var(--spacing-sm);
          overflow-y: auto;
          flex: 1;
          align-content: start;
        }
        .gallery-item {
          overflow: hidden;
          margin-bottom: ${gap}px;
        }
        .gallery-sentinel {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: var(--spacing-lg);
          min-height: 60px;
        }
        .spinner-small {
          width: 24px;
          height: 24px;
        }
      `}</style>
    </div>
  );
});
