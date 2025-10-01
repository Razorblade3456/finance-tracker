import { useMemo, useState } from 'react';

interface CategoryPieChartProps {
  data: Array<{
    id: string;
    name: string;
    value: number;
    accent: string;
  }>;
  total: number;
  formatCurrency: (value: number) => string;
}

const TWO_PI = Math.PI * 2;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

  return [`M ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`].join(' ');
}

export function CategoryPieChart({ data, total, formatCurrency }: CategoryPieChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const slices = useMemo(() => {
    if (!total) {
      return [] as Array<{
        id: string;
        name: string;
        value: number;
        accent: string;
        startAngle: number;
        endAngle: number;
        percentage: number;
      }>;
    }

    let currentAngle = -Math.PI / 2;

    return data.map((item) => {
      const sliceAngle = (item.value / total) * TWO_PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
        percentage: (item.value / total) * 100
      };
    });
  }, [data, total]);

  const activeSlice = slices.find((slice) => slice.id === hoveredId) ?? null;

  return (
    <div className="pie-chart" role="img" aria-label="Spending by category">
      <svg viewBox="0 0 220 220" className="pie-chart-svg">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {slices.map((slice) => {
          const isActive = hoveredId === slice.id;
          const midAngle = (slice.startAngle + slice.endAngle) / 2;
          const offset = isActive ? 10 : 0;
          const radius = isActive ? 94 : 88;
          const { x: offsetX, y: offsetY } = polarToCartesian(110, 110, offset, midAngle);
          const path = describeArc(110, 110, radius, slice.startAngle, slice.endAngle);

          return (
            <g
              key={slice.id}
              transform={`translate(${offsetX}, ${offsetY})`}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <path
                d={path}
                fill="none"
                stroke={slice.accent}
                strokeWidth={isActive ? 28 : 24}
                strokeLinecap="round"
                className={`pie-slice ${isActive ? 'active' : ''}`}
                style={{ filter: isActive ? 'url(#glow)' : 'none' }}
              />
            </g>
          );
        })}
        <circle cx="110" cy="110" r="60" className="pie-center" />
        {activeSlice ? (
          <text x="110" y="102" textAnchor="middle" className="pie-value">
            {formatCurrency(activeSlice.value)}
          </text>
        ) : (
          <text x="110" y="102" textAnchor="middle" className="pie-value">
            {formatCurrency(total)}
          </text>
        )}
        <text x="110" y="124" textAnchor="middle" className="pie-label">
          {activeSlice ? activeSlice.name : 'Monthly commitments'}
        </text>
      </svg>
      <ul className="pie-legend">
        {slices.map((slice) => (
          <li
            key={slice.id}
            className={`pie-legend-item ${hoveredId === slice.id ? 'active' : ''}`}
            onMouseEnter={() => setHoveredId(slice.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span className="pie-legend-swatch" style={{ background: slice.accent }} />
            <span className="pie-legend-text">
              <strong>{slice.name}</strong>
              <span>
                {formatCurrency(slice.value)} • {slice.percentage.toFixed(1)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
