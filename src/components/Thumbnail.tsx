import { memo } from 'react';
import type { Generation } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface ThumbnailProps {
  generation: Generation;
  selected: boolean;
  marked?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const Thumbnail = memo(function Thumbnail({ generation, selected, marked, onClick, onDoubleClick, onContextMenu }: ThumbnailProps) {
  const imageSrc = generation.thumb_path
    ? getImageUrl(generation.thumb_path)
    : getImageUrl(generation.image_path);

  // Extract short model name (last segment of path)
  const shortModel = generation.model.split('/').pop();

  return (
    <div
      className={`thumbnail ${selected ? 'thumbnail-selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <img src={imageSrc} alt={generation.slug} loading="lazy" />
      {marked && (
        <span className="thumbnail-check">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )}
      {generation.starred && <span className="thumbnail-star">★</span>}
      <span className="thumbnail-id">#{generation.id}</span>
      <div className="thumbnail-overlay">
        <span className="thumbnail-info">#{generation.id}</span>
        <span className="thumbnail-model">{shortModel}</span>
      </div>
      <style>{`
        .thumbnail {
          position: relative;
          border-radius: var(--radius-sm);
          overflow: hidden;
          cursor: pointer;
          transition: transform var(--transition-fast), box-shadow var(--transition-fast);
        }
        .thumbnail:hover {
          transform: scale(1.03);
          box-shadow: var(--shadow-md);
        }
        .thumbnail-selected {
          box-shadow: 0 0 0 2px var(--accent), var(--shadow-md);
        }
        .thumbnail-selected:hover {
          box-shadow: 0 0 0 2px var(--accent), var(--shadow-md);
        }
        .thumbnail img {
          display: block;
          width: 100%;
          height: auto;
        }
        .thumbnail-check {
          position: absolute;
          top: var(--spacing-xs);
          left: var(--spacing-xs);
          width: 22px;
          height: 22px;
          background: var(--success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          box-shadow: var(--shadow-sm);
        }
        .thumbnail-star {
          position: absolute;
          top: var(--spacing-xs);
          right: var(--spacing-xs);
          color: var(--warning);
          font-size: 16px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          z-index: 2;
        }
        .thumbnail-id {
          position: absolute;
          bottom: var(--spacing-xs);
          left: var(--spacing-xs);
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          text-shadow: 0 1px 4px rgba(0,0,0,0.9);
          z-index: 1;
          transition: opacity var(--transition-fast);
        }
        .thumbnail:hover .thumbnail-id {
          opacity: 0;
        }
        .thumbnail-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: var(--spacing-sm) var(--spacing-md);
          background: linear-gradient(transparent, rgba(0,0,0,0.6));
          opacity: 0;
          transition: opacity var(--transition-fast);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .thumbnail:hover .thumbnail-overlay {
          opacity: 1;
        }
        .thumbnail-info {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }
        .thumbnail-model {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  );
});
