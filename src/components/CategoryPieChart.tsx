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
  defaultLabel?: string;
  ariaLabel?: string;
}

const TWO_PI = Math.PI * 2;
const CENTER = 110;
const BASE_OUTER_RADIUS = 94;
const BASE_INNER_RADIUS = 64;
const ACTIVE_GROWTH = 6;
const ACTIVE_OFFSET = 10;

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? '1' : '0';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z'
  ].join(' ');
}

export function CategoryPieChart({
  data,
  total,
  formatCurrency,
  defaultLabel = 'Total',
  ariaLabel = 'Category breakdown'
}: CategoryPieChartProps) {
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
    <div className="pie-chart" role="img" aria-label={ariaLabel}>
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
          const offsetRadius = isActive ? ACTIVE_OFFSET : 0;
          const outerRadius = isActive
            ? BASE_OUTER_RADIUS + ACTIVE_GROWTH
            : BASE_OUTER_RADIUS;
          const innerRadius = BASE_INNER_RADIUS;
          const { x: offsetX, y: offsetY } = polarToCartesian(
            CENTER,
            CENTER,
            offsetRadius,
            midAngle
          );
          const path = describeDonutSlice(
            CENTER,
            CENTER,
            innerRadius,
            outerRadius,
            slice.startAngle,
            slice.endAngle
          );

          return (
            <g
              key={slice.id}
              transform={`translate(${offsetX}, ${offsetY})`}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <path
                d={path}
                fill={slice.accent}
                stroke="rgba(15, 23, 42, 0.12)"
                strokeWidth={1}
                className={`pie-slice ${isActive ? 'active' : ''}`}
                style={{ filter: isActive ? 'url(#glow)' : 'none' }}
              />
            </g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r={BASE_INNER_RADIUS - 4} className="pie-center" />
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
          {activeSlice ? activeSlice.name : defaultLabel}
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
