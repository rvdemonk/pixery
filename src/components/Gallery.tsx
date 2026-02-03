import { useRef, useEffect, useCallback, memo } from 'react';
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
}

const GRID_SIZES: Record<ThumbnailSize, string> = {
  small: '120px',
  medium: '160px',
  large: '220px',
  xl: '400px',
  xxl: '550px',
};

/**
 * Wrapper component that provides stable callbacks for each thumbnail
 */
const ThumbnailWrapper = memo(function ThumbnailWrapper({
  generation,
  selected,
  marked,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: {
  generation: Generation;
  selected: boolean;
  marked: boolean;
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
}: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridSize = GRID_SIZES[thumbnailSize];

  // Use refs for values accessed in observer callback to avoid reconnecting observer
  const loadingMoreRef = useRef(loadingMore);
  const onLoadMoreRef = useRef(onLoadMore);
  loadingMoreRef.current = loadingMore;
  onLoadMoreRef.current = onLoadMore;

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
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore]);

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
    <div className="gallery" ref={containerRef} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}, 1fr))` }}>
      {generations.map((gen) => (
        <div key={gen.id} data-id={gen.id}>
          <ThumbnailWrapper
            generation={gen}
            selected={gen.id === selectedId}
            marked={markedIds.has(gen.id)}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
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
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
          align-content: start;
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
