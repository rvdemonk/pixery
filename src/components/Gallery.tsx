import { useRef, useEffect } from 'react';
import type { Generation } from '../lib/types';
import { Thumbnail } from './Thumbnail';

interface GalleryProps {
  generations: Generation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
  loading: boolean;
}

export function Gallery({ generations, selectedId, onSelect, onOpen, loading }: GalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="gallery" ref={containerRef}>
      {generations.map((gen) => (
        <div key={gen.id} data-id={gen.id}>
          <Thumbnail
            generation={gen}
            selected={gen.id === selectedId}
            onClick={() => onSelect(gen.id)}
            onDoubleClick={() => onOpen(gen.id)}
          />
        </div>
      ))}
      <style>{`
        .gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
        }
      `}</style>
    </div>
  );
}
