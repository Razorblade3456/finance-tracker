import { useMemo } from 'react';

type InsightDatum = {
  id: string;
  name: string;
  value: number;
  accent: string;
};

interface InsightListProps {
  data: InsightDatum[];
  total: number;
  formatCurrency: (value: number) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function InsightList({
  data,
  total,
  formatCurrency,
  emptyMessage = 'Add more details to see this summary.',
  ariaLabel = 'Insight summary list'
}: InsightListProps) {
  const items = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.value / total) * 100 : 0
      })),
    [data, total]
  );

  if (!items.length) {
    return (
      <div className="insight-list-empty" role="status" aria-live="polite">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="insight-list" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.id} className="insight-list-item" role="listitem">
          <div className="insight-list-meta">
            <span className="insight-list-name">{item.name}</span>
            <span className="insight-list-value">{formatCurrency(item.value)}</span>
          </div>
          <div className="insight-list-bar" aria-hidden="true">
            <span
              className="insight-list-fill"
              style={{ width: `${item.percentage}%`, background: item.accent }}
            />
          </div>
          <span className="insight-list-percentage">{item.percentage.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
