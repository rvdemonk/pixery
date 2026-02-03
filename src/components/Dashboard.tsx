import { useState, useEffect } from 'react';
import type { CostSummary } from '../lib/types';
import * as api from '../lib/api';

interface DashboardProps {
  onClose: () => void;
}

export function Dashboard({ onClose }: DashboardProps) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const since = period === 'all' ? undefined : period;
        const data = await api.getCostSummary(since);
        setSummary(data);
      } catch (e) {
        console.error('Failed to load cost summary:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period]);

  const maxDayCost = summary?.by_day.reduce((max, [, cost]) => Math.max(max, cost), 0) || 0;

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h2>Cost Dashboard</h2>
          <div className="dashboard-controls">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <button className="btn btn-ghost" onClick={onClose}>×</button>
          </div>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner" />
          </div>
        ) : summary ? (
          <div className="dashboard-content">
            <div className="dashboard-stats">
              <div className="stat-card">
                <span className="stat-value">${summary.total_usd.toFixed(2)}</span>
                <span className="stat-label">Total Spent</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{summary.count}</span>
                <span className="stat-label">Generations</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  ${summary.count > 0 ? (summary.total_usd / summary.count).toFixed(3) : '0.000'}
                </span>
                <span className="stat-label">Avg Cost</span>
              </div>
            </div>

            <div className="dashboard-section">
              <h3>By Model</h3>
              <div className="model-list">
                {summary.by_model.map(([model, cost]) => (
                  <div key={model} className="model-row">
                    <span className="model-name truncate">{model}</span>
                    <span className="model-cost">${cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-section">
              <h3>By Day</h3>
              <div className="day-chart">
                {summary.by_day.slice(0, 14).reverse().map(([day, cost]) => (
                  <div
                    key={day}
                    className="day-bar-container"
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    {hoveredDay === day && (
                      <div className="day-tooltip">${cost.toFixed(2)}</div>
                    )}
                    <div
                      className="day-bar"
                      style={{ height: `${maxDayCost > 0 ? (cost / maxDayCost) * 100 : 0}%` }}
                    />
                    <span className="day-label">{day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        .dashboard-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .dashboard-container {
          background: var(--bg-secondary);
          border-radius: var(--radius-lg);
          width: 500px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--border);
        }
        .dashboard-controls {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }
        .dashboard-content {
          padding: var(--spacing-lg) var(--spacing-xl);
          overflow-y: auto;
        }
        .dashboard-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }
        .stat-card {
          background: var(--bg-primary);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          color: var(--accent);
        }
        .stat-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .dashboard-section {
          margin-bottom: var(--spacing-lg);
        }
        .dashboard-section h3 {
          margin-bottom: var(--spacing-sm);
          font-size: 14px;
          color: var(--text-secondary);
        }
        .model-list {
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: var(--spacing-sm);
        }
        .model-row {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-xs) var(--spacing-sm);
        }
        .model-row:not(:last-child) {
          border-bottom: 1px solid var(--border);
        }
        .model-name {
          flex: 1;
          margin-right: var(--spacing-md);
        }
        .model-cost {
          font-family: var(--font-mono);
          color: var(--text-secondary);
        }
        .day-chart {
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          height: 120px;
          gap: 4px;
          background: var(--bg-primary);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
        }
        .day-bar-container {
          flex: 1;
          min-width: 24px;
          max-width: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          position: relative;
          cursor: pointer;
        }
        .day-bar-container:hover .day-bar {
          background: var(--accent-hover, #9090ff);
        }
        .day-tooltip {
          position: absolute;
          top: -24px;
          background: var(--bg-tertiary, #333);
          color: var(--text-primary);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-family: var(--font-mono);
          white-space: nowrap;
          z-index: 10;
        }
        .day-bar {
          width: 100%;
          background: var(--accent);
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          min-height: 2px;
          margin-top: auto;
          transition: background 0.15s ease;
        }
        .day-label {
          font-size: 9px;
          color: var(--text-muted);
          margin-top: var(--spacing-xs);
        }
      `}</style>
    </div>
  );
}
