import type { Generation } from '../lib/types';
import { getImageUrl } from '../lib/api';

interface CompareProps {
  left: Generation;
  right: Generation;
  onClose: () => void;
}

export function Compare({ left, right, onClose }: CompareProps) {
  return (
    <div className="compare-overlay">
      <div className="compare-container">
        <div className="compare-header">
          <h2>Compare</h2>
          <button className="btn btn-ghost" onClick={onClose}>×</button>
        </div>

        <div className="compare-content">
          <div className="compare-side">
            <div className="compare-image">
              <img src={getImageUrl(left.image_path)} alt={left.slug} />
            </div>
            <div className="compare-info">
              <span className="compare-model">{left.model}</span>
              <span className="compare-date">{left.date}</span>
            </div>
            <p className="compare-prompt">{left.prompt}</p>
          </div>

          <div className="compare-divider" />

          <div className="compare-side">
            <div className="compare-image">
              <img src={getImageUrl(right.image_path)} alt={right.slug} />
            </div>
            <div className="compare-info">
              <span className="compare-model">{right.model}</span>
              <span className="compare-date">{right.date}</span>
            </div>
            <p className="compare-prompt">{right.prompt}</p>
          </div>
        </div>
      </div>

      <style>{`
        .compare-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .compare-container {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          width: 90vw;
          max-width: 1200px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .compare-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border);
        }
        .compare-content {
          display: flex;
          padding: var(--spacing-lg);
          gap: var(--spacing-lg);
          overflow: auto;
        }
        .compare-side {
          flex: 1;
          min-width: 0;
        }
        .compare-divider {
          width: 1px;
          background: var(--border);
        }
        .compare-image {
          margin-bottom: var(--spacing-md);
        }
        .compare-image img {
          width: 100%;
          border-radius: var(--radius-md);
        }
        .compare-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: var(--spacing-sm);
        }
        .compare-model {
          font-weight: 500;
          color: var(--accent);
        }
        .compare-date {
          color: var(--text-muted);
          font-size: 13px;
        }
        .compare-prompt {
          color: var(--text-secondary);
          font-size: 13px;
          line-height: 1.5;
          background: var(--bg-primary);
          padding: var(--spacing-sm);
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
}
