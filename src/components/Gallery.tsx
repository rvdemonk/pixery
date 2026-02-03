import { useRef, useEffect, useCallback, memo } from 'react';
import type { Generation } from '../lib/types';
import type { ThumbnailSize } from '../hooks/useSettings';
import { Thumbnail } from './Thumbnail';

interface GalleryProps {
  generations: Generation[];
  selectedId: number | null;
  thumbnailSize: ThumbnailSize;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
  onContextMenu: (generation: Generation, position: { x: number; y: number }) => void;
  loading: boolean;
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
  onSelect,
  onDoubleClick,
  onContextMenu,
}: {
  generation: Generation;
  selected: boolean;
  onSelect: (id: number) => void;
  onDoubleClick: (id: number) => void;
  onContextMenu: (generation: Generation, position: { x: number; y: number }) => void;
}) {
  const handleClick = useCallback(() => onSelect(generation.id), [onSelect, generation.id]);
  const handleDoubleClick = useCallback(() => onDoubleClick(generation.id), [onDoubleClick, generation.id]);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(generation, { x: e.clientX, y: e.clientY });
  }, [onContextMenu, generation]);

  return (
    <Thumbnail
      generation={generation}
      selected={selected}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

export const Gallery = memo(function Gallery({ generations, selectedId, thumbnailSize, onSelect, onDoubleClick, onContextMenu, loading }: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridSize = GRID_SIZES[thumbnailSize];

  // Scroll selected item into view
  useEffect(() => {
    if (selectedId && containerRef.current) {
      const selected = containerRef.current.querySelector(`[data-id="${selectedId}"]`);
      selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

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
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
      <style>{`
        .gallery {
          display: grid;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
          align-content: start;
        }
      `}</style>
    </div>
  );
});
