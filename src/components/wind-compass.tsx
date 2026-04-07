"use client";

interface WindCompassProps {
  windDirectionDeg: number;
  size?: number;
  className?: string;
}

const CARDINAL_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function WindCompass({
  windDirectionDeg,
  size = 48,
  className = "",
}: WindCompassProps) {
  const r = size / 2;
  const spokeLength = r * 0.65;
  const tickLength = r * 0.45;
  const labelOffset = r * 0.88;
  const showLabels = size >= 40;
  const fontSize = Math.max(6, size * 0.14);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label={`Wind from ${Math.round(windDirectionDeg)}°`}
    >
      {/* Outer ring */}
      <circle
        cx={r}
        cy={r}
        r={r - 1}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        opacity={0.15}
      />

      {/* 8-point ticks */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180 - Math.PI / 2;
        const isCardinal = i % 2 === 0;
        const len = isCardinal ? spokeLength : tickLength;
        const x1 = r + Math.cos(angle) * (r * 0.2);
        const y1 = r + Math.sin(angle) * (r * 0.2);
        const x2 = r + Math.cos(angle) * len;
        const y2 = r + Math.sin(angle) * len;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={isCardinal ? 1.2 : 0.8}
            strokeLinecap="round"
            opacity={isCardinal ? 0.25 : 0.12}
          />
        );
      })}

      {/* Cardinal labels */}
      {showLabels &&
        CARDINAL_LABELS.filter((_, i) => i % 2 === 0).map((label, idx) => {
          const angle = (idx * 90 * Math.PI) / 180 - Math.PI / 2;
          const x = r + Math.cos(angle) * labelOffset;
          const y = r + Math.sin(angle) * labelOffset;
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              fontSize={fontSize}
              fontWeight={500}
              opacity={0.35}
            >
              {label}
            </text>
          );
        })}

      {/* Wind direction arrow — points FROM where wind is coming */}
      <g
        transform={`rotate(${windDirectionDeg}, ${r}, ${r})`}
        className="text-primary"
      >
        {/* Arrow shaft */}
        <line
          x1={r}
          y1={r + spokeLength * 0.6}
          x2={r}
          y2={r - spokeLength * 0.85}
          stroke="currentColor"
          strokeWidth={size >= 40 ? 2 : 1.5}
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <polygon
          points={`${r},${r - spokeLength * 0.95} ${r - size * 0.08},${r - spokeLength * 0.55} ${r + size * 0.08},${r - spokeLength * 0.55}`}
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
