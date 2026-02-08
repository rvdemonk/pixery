import { useEffect, useCallback } from 'react';
import type { Generation } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface LightboxProps {
  generation: Generation;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function Lightbox({
  generation,
  onClose,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious
}: LightboxProps) {
  const imageSrc = getImageUrl(generation.image_path);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'j') {
      if (hasNext) onNext();
    } else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'k') {
      if (hasPrevious) onPrevious();
    }
  }, [onClose, onNext, onPrevious, hasNext, hasPrevious]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={imageSrc} alt={generation.slug} />
      </div>

      {hasPrevious && (
        <button
          className="lightbox-nav lightbox-nav-prev"
          onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          aria-label="Previous image"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {hasNext && (
        <button
          className="lightbox-nav lightbox-nav-next"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next image"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      <style>{`
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-lightbox);
          cursor: zoom-out;
        }
        .lightbox-content {
          max-width: 95vw;
          max-height: 95vh;
          cursor: default;
        }
        .lightbox-content img {
          max-width: 95vw;
          max-height: 95vh;
          object-fit: contain;
          border-radius: var(--radius-md);
        }
        .lightbox-nav {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: var(--spacing-lg);
          opacity: 0.3;
          transition: opacity var(--transition-fast);
        }
        .lightbox-nav:hover {
          opacity: 0.8;
          color: var(--text-primary);
        }
        .lightbox-nav-prev {
          left: var(--spacing-md);
        }
        .lightbox-nav-next {
          right: var(--spacing-md);
        }
      `}</style>
    </div>
  );
}
