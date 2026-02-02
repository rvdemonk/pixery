import { useState } from 'react';
import type { Job } from '../lib/types';

interface JobsIndicatorProps {
  jobs: Job[];
  activeCount: number;
}

function formatElapsed(createdAt: string, startedAt: string | null): string {
  const start = startedAt ? new Date(startedAt) : new Date(createdAt);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function truncatePrompt(prompt: string, maxLength: number = 50): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + '...';
}

export function JobsIndicator({ jobs, activeCount }: JobsIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (activeCount === 0) {
    return null;
  }

  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'running');

  return (
    <div
      className="jobs-indicator"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="jobs-pill">
        <span className="jobs-spinner" />
        {activeCount}
      </span>

      {showTooltip && activeJobs.length > 0 && (
        <div className="jobs-tooltip">
          {activeJobs.map((job) => (
            <div key={job.id} className="jobs-tooltip-item">
              <div className="jobs-tooltip-header">
                <span className="jobs-tooltip-model">{job.model}</span>
                <span className="jobs-tooltip-time">
                  {formatElapsed(job.created_at, job.started_at)}
                </span>
              </div>
              <div className="jobs-tooltip-prompt">
                "{truncatePrompt(job.prompt)}"
              </div>
              {job.tags && job.tags.length > 0 && (
                <div className="jobs-tooltip-tags">
                  {job.tags.map((tag) => (
                    <span key={tag} className="jobs-tooltip-tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .jobs-indicator {
          position: relative;
          display: inline-flex;
        }

        .jobs-pill {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          cursor: default;
        }

        .jobs-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .jobs-tooltip {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: var(--spacing-xs);
          min-width: 280px;
          max-width: 360px;
          background: #1a1a1a;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          z-index: 100;
          overflow: hidden;
        }

        .jobs-tooltip-item {
          padding: var(--spacing-sm);
          border-bottom: 1px solid var(--border);
          background: #1a1a1a;
        }

        .jobs-tooltip-item:last-child {
          border-bottom: none;
        }

        .jobs-tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-xs);
        }

        .jobs-tooltip-model {
          font-weight: 500;
          color: var(--text-primary);
          font-size: var(--font-size-sm);
        }

        .jobs-tooltip-time {
          font-size: var(--font-size-xs);
          color: var(--text-tertiary);
          font-family: var(--font-mono);
        }

        .jobs-tooltip-prompt {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          font-style: italic;
          line-height: 1.4;
        }

        .jobs-tooltip-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
          margin-top: var(--spacing-xs);
        }

        .jobs-tooltip-tag {
          font-size: var(--font-size-xs);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
