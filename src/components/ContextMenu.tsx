import { useEffect, useRef } from 'react';
import type { Generation } from '../lib/types';

interface ContextMenuProps {
  generation: Generation;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleStar: () => void;
  onTrash: () => void;
}

export function ContextMenu({
  generation,
  position,
  onClose,
  onToggleStar,
  onTrash,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const adjustedPosition = { ...position };
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (position.x + rect.width > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - rect.width - 8;
    }
    if (position.y + rect.height > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - rect.height - 8;
    }
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      <button
        className="context-menu-item"
        onClick={() => {
          onToggleStar();
          onClose();
        }}
      >
        {generation.starred ? '☆ Unstar' : '★ Star'}
      </button>
      <div className="context-menu-divider" />
      <button
        className="context-menu-item context-menu-danger"
        onClick={() => {
          onTrash();
          onClose();
        }}
      >
        Trash
      </button>

      <style>{`
        .context-menu {
          position: fixed;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--spacing-xs);
          min-width: 140px;
          box-shadow: var(--shadow-lg);
          z-index: var(--z-lightbox);
        }
        .context-menu-item {
          display: block;
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-md);
          text-align: left;
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 13px;
          cursor: pointer;
          border-radius: var(--radius-sm);
        }
        .context-menu-item:hover {
          background: var(--bg-hover);
        }
        .context-menu-danger:hover {
          background: var(--error);
          color: white;
        }
        .context-menu-divider {
          height: 1px;
          background: var(--border);
          margin: var(--spacing-xs) 0;
        }
      `}</style>
    </div>
  );
}
