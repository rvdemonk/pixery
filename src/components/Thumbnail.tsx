import type { Generation } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface ThumbnailProps {
  generation: Generation;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function Thumbnail({ generation, selected, onClick, onDoubleClick, onContextMenu }: ThumbnailProps) {
  const imageSrc = generation.thumb_path
    ? getImageUrl(generation.thumb_path)
    : getImageUrl(generation.image_path);

  return (
    <div
      className={`thumbnail ${selected ? 'thumbnail-selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <img src={imageSrc} alt={generation.slug} loading="lazy" />
      {generation.starred && <span className="thumbnail-star">★</span>}
      <div className="thumbnail-overlay">
        <span className="thumbnail-model">{generation.model.split('/').pop()}</span>
      </div>
      <style>{`
        .thumbnail {
          position: relative;
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all var(--transition-fast);
        }
        .thumbnail:hover {
          border-color: var(--border-light);
        }
        .thumbnail-selected {
          border-color: var(--accent);
        }
        .thumbnail img {
          display: block;
          width: 100%;
          height: auto;
        }
        .thumbnail-star {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-xs);
          color: var(--warning);
          font-size: 16px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .thumbnail-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: var(--spacing-xs) var(--spacing-sm);
          background: linear-gradient(transparent, rgba(0,0,0,0.7));
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .thumbnail:hover .thumbnail-overlay {
          opacity: 1;
        }
        .thumbnail-model {
          font-size: 11px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
