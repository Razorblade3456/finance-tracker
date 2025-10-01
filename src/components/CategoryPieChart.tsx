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
const BASE_OUTER_RADIUS = 92;
const BASE_INNER_RADIUS = 60;
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
    const computedTotal = data.reduce((sum, item) => sum + item.value, 0);
    if (!computedTotal) {
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

    return data.map((item, index) => {
      const ratio = item.value / computedTotal;
      const sliceAngle = ratio * TWO_PI;
      const startAngle = currentAngle;
      const endAngle =
        index === data.length - 1 ? -Math.PI / 2 + TWO_PI : currentAngle + sliceAngle;
      currentAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
        percentage: ratio * 100
      };
    });
  }, [data]);

  const totalValue = useMemo(() => {
    const computedTotal = data.reduce((sum, item) => sum + item.value, 0);
    return computedTotal || total;
  }, [data, total]);

  const activeSlice = slices.find((slice) => slice.id === hoveredId) ?? null;

  const centerPercentage = activeSlice ? activeSlice.percentage : 100;
  const centerLabel = activeSlice ? activeSlice.name : defaultLabel;
  const centerAmount = activeSlice
    ? formatCurrency(activeSlice.value)
    : formatCurrency(totalValue);

  return (
    <div className="donut-chart" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 220 220" className="donut-chart-svg">
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
                stroke={isActive ? 'rgba(15, 23, 42, 0.12)' : 'none'}
                strokeWidth={isActive ? 1 : 0}
                strokeLinejoin="round"
                className={`donut-slice ${isActive ? 'active' : ''}`}
                style={{ filter: isActive ? 'url(#glow)' : 'none' }}
              />
            </g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r={BASE_INNER_RADIUS - 6} className="donut-center" />
        <text x="110" y="98" textAnchor="middle" className="donut-percentage">
          {Math.round(centerPercentage)}%
        </text>
        <text x="110" y="118" textAnchor="middle" className="donut-label">
          {centerLabel}
        </text>
        <text x="110" y="138" textAnchor="middle" className="donut-amount">
          {centerAmount}
        </text>
      </svg>
      <ul className="donut-legend">
        {slices.map((slice) => (
          <li
            key={slice.id}
            className={`donut-legend-item ${hoveredId === slice.id ? 'active' : ''}`}
            onMouseEnter={() => setHoveredId(slice.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span className="donut-legend-swatch" style={{ background: slice.accent }} />
            <span className="donut-legend-text">
              <strong>{slice.name}</strong>
              <span className="donut-legend-meta">
                <span>{slice.percentage.toFixed(1)}%</span>
                <span>{formatCurrency(slice.value)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
