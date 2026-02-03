import { useState } from 'react';
import type { Job } from '../lib/types';

interface JobsIndicatorProps {
  jobs: Job[];
  activeCount: number;
  failedJobs: Job[];
  failedCount: number;
  onDismissFailedJob: (id: number) => void;
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

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncatePrompt(prompt: string, maxLength: number = 50): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + '...';
}

function truncateError(error: string, maxLength: number = 100): string {
  if (error.length <= maxLength) return error;
  return error.slice(0, maxLength) + '...';
}

export function JobsIndicator({ jobs, activeCount, failedJobs, failedCount, onDismissFailedJob }: JobsIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showFailedTooltip, setShowFailedTooltip] = useState(false);

  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'running');

  return (
    <div className="jobs-indicators">
      {/* Failed jobs indicator */}
      {failedCount > 0 && (
        <div
          className="jobs-indicator"
          onMouseEnter={() => setShowFailedTooltip(true)}
          onMouseLeave={() => setShowFailedTooltip(false)}
        >
          <span className="jobs-pill jobs-pill-failed">
            <span className="jobs-failed-icon">!</span>
            {failedCount}
          </span>

          {showFailedTooltip && (
            <div className="jobs-tooltip jobs-tooltip-failed">
              <div className="jobs-tooltip-title">Recent Failures</div>
              {failedJobs.map((job) => (
                <div key={job.id} className="jobs-tooltip-item jobs-tooltip-item-failed">
                  <div className="jobs-tooltip-header">
                    <span className="jobs-tooltip-model">{job.model}</span>
                    <span className="jobs-tooltip-time">
                      {formatTimeAgo(job.completed_at || job.created_at)}
                    </span>
                    <button
                      className="jobs-dismiss-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissFailedJob(job.id);
                      }}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                  <div className="jobs-tooltip-prompt">
                    "{truncatePrompt(job.prompt, 40)}"
                  </div>
                  {job.error && (
                    <div className="jobs-tooltip-error">
                      {truncateError(job.error)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active jobs indicator */}
      {activeCount > 0 && (
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

        .jobs-indicators {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }

        .jobs-pill-failed {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .jobs-failed-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          font-size: 10px;
          font-weight: bold;
        }

        .jobs-tooltip-failed {
          border-color: rgba(239, 68, 68, 0.3);
        }

        .jobs-tooltip-title {
          padding: var(--spacing-sm);
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: #ef4444;
          border-bottom: 1px solid var(--border);
        }

        .jobs-tooltip-item-failed {
          border-left: 3px solid #ef4444;
        }

        .jobs-tooltip-error {
          margin-top: var(--spacing-xs);
          padding: var(--spacing-xs);
          background: rgba(239, 68, 68, 0.1);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          color: #ef4444;
          font-family: var(--font-mono);
          word-break: break-word;
        }

        .jobs-dismiss-btn {
          background: none;
          border: none;
          color: var(--text-tertiary);
          font-size: 16px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          margin-left: auto;
        }

        .jobs-dismiss-btn:hover {
          color: var(--text-primary);
        }

        .jobs-tooltip-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xs);
        }

        .jobs-tooltip-time {
          font-size: var(--font-size-xs);
          color: var(--text-tertiary);
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  );
}
