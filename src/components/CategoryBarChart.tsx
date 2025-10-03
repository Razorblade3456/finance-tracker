import { useMemo, useState } from 'react';

interface CategoryBarChartProps {
  data: Array<{
    id: string;
    name: string;
    value: number;
    accent: string;
  }>;
  total: number;
  formatCurrency: (value: number) => string;
}

export function CategoryBarChart({ data, total, formatCurrency }: CategoryBarChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const bars = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.value / total) * 100 : 0
      })),
    [data, total]
  );

  const maxValue = useMemo(() => data.reduce((max, item) => Math.max(max, item.value), 0), [data]);
  const activeBar = bars.find((bar) => bar.id === hoveredId) ?? null;

  if (!bars.length) {
    return (
      <div className="bar-chart-empty" role="status" aria-live="polite">
        No category spending to visualize yet.
      </div>
    );
  }

  const summaryLabel = activeBar ? activeBar.name : 'Monthly commitments';
  const summaryValue = activeBar ? activeBar.value : total;
  const summaryHelper = activeBar
    ? `${activeBar.percentage.toFixed(1)}% of tracked spending`
    : 'Across all categories';

  return (
    <div className="bar-chart" role="img" aria-label="Spending by category">
      <div className="bar-chart-visual">
        {bars.map((bar) => {
          const isActive = hoveredId === bar.id;
          const height = maxValue > 0 ? (bar.value / maxValue) * 100 : 0;

          return (
            <div key={bar.id} className="bar-chart-column">
              <button
                type="button"
                className={`bar-chart-bar ${isActive ? 'active' : ''}`}
                onMouseEnter={() => setHoveredId(bar.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(bar.id)}
                onBlur={() => setHoveredId(null)}
                aria-label={`${bar.name}: ${formatCurrency(bar.value)} (${bar.percentage.toFixed(1)}%)`}
              >
                <span
                  className="bar-chart-bar-fill"
                  style={{ height: `${height}%`, background: bar.accent }}
                />
              </button>
              <span className="bar-chart-column-label">{bar.name}</span>
            </div>
          );
        })}
      </div>

      <div className="bar-chart-summary">
        <span className="bar-chart-summary-label">{summaryLabel}</span>
        <span className="bar-chart-summary-value">{formatCurrency(summaryValue)}</span>
        <span className="bar-chart-summary-helper">{summaryHelper}</span>
      </div>

      <ul className="bar-chart-legend">
        {bars.map((bar) => {
          const isActive = hoveredId === bar.id;

          return (
            <li
              key={bar.id}
              className={`bar-chart-legend-item ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setHoveredId(bar.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span className="bar-chart-legend-swatch" style={{ background: bar.accent }} />
              <span className="bar-chart-legend-text">
                <strong>{bar.name}</strong>
                <span>
                  {formatCurrency(bar.value)} • {bar.percentage.toFixed(1)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
