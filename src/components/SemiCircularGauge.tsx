import { useMemo, useState } from 'react';

interface GaugeDatum {
  id: string;
  name: string;
  value: number;
  accent: string;
}

interface SemiCircularGaugeProps {
  data: GaugeDatum[];
  total: number;
  formatCurrency: (value: number) => string;
  defaultLabel: string;
  ariaLabel?: string;
}

const START_ANGLE = Math.PI;
const END_ANGLE = 0;
const CENTER_X = 160;
const CENTER_Y = 160;
const BASE_OUTER_RADIUS = 120;
const BASE_INNER_RADIUS = 84;
const ACTIVE_GROWTH = 6;

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
  const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? '1' : '0';

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} ${endAngle > startAngle ? 1 : 0} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} ${endAngle > startAngle ? 0 : 1} ${innerEnd.x} ${innerEnd.y}`,
    'Z'
  ].join(' ');
}

export function SemiCircularGauge({
  data,
  total,
  formatCurrency,
  defaultLabel,
  ariaLabel = 'Semi circular gauge'
}: SemiCircularGaugeProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const slices = useMemo(() => {
    const computedTotal = data.reduce((sum, datum) => sum + datum.value, 0);
    if (!computedTotal) {
      return [] as Array<
        GaugeDatum & {
          startAngle: number;
          endAngle: number;
          percentage: number;
        }
      >;
    }

    let currentAngle = START_ANGLE;

    return data.map((datum, index) => {
      const ratio = datum.value / computedTotal;
      const sliceAngle = ratio * Math.PI;
      const startAngle = currentAngle;
      const endAngle = index === data.length - 1 ? END_ANGLE : currentAngle - sliceAngle;
      currentAngle = endAngle;

      return {
        ...datum,
        startAngle,
        endAngle,
        percentage: ratio * 100
      };
    });
  }, [data]);

  const totalValue = useMemo(() => {
    const computedTotal = data.reduce((sum, datum) => sum + datum.value, 0);
    return computedTotal || total;
  }, [data, total]);

  const activeSlice = slices.find((slice) => slice.id === hoveredId) ?? null;

  const trackPath = describeDonutSlice(
    CENTER_X,
    CENTER_Y,
    BASE_INNER_RADIUS,
    BASE_OUTER_RADIUS,
    START_ANGLE,
    END_ANGLE
  );

  return (
    <div className="gauge" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 320 200" className="gauge-svg">
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={trackPath} className="gauge-track" />
        {slices.map((slice) => {
          const isActive = hoveredId === slice.id;
          const outerRadius = isActive ? BASE_OUTER_RADIUS + ACTIVE_GROWTH : BASE_OUTER_RADIUS;
          const innerRadius = BASE_INNER_RADIUS;
          const path = describeDonutSlice(
            CENTER_X,
            CENTER_Y,
            innerRadius,
            outerRadius,
            slice.startAngle,
            slice.endAngle
          );

          return (
            <path
              key={slice.id}
              d={path}
              fill={slice.accent}
              className={`gauge-slice ${isActive ? 'active' : ''}`}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ filter: isActive ? 'url(#gauge-glow)' : 'none' }}
            />
          );
        })}
        <text x={CENTER_X} y={94} textAnchor="middle" className="gauge-value">
          {formatCurrency(activeSlice ? activeSlice.value : totalValue)}
        </text>
        <text x={CENTER_X} y={120} textAnchor="middle" className="gauge-label">
          {activeSlice ? activeSlice.name : defaultLabel}
        </text>
      </svg>
      <ul className="gauge-legend">
        {slices.map((slice) => (
          <li
            key={slice.id}
            className={`gauge-legend-item ${hoveredId === slice.id ? 'active' : ''}`}
            onMouseEnter={() => setHoveredId(slice.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span className="gauge-legend-swatch" style={{ background: slice.accent }} />
            <span className="gauge-legend-text">
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
