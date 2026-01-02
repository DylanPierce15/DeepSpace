import React from 'react';

export default function QualiVsRaceChart({ comparison }) {
  if (!comparison || comparison.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No qualifying data available</div>;
  }

  const width = 800;
  const barHeight = 20;
  const gap = 5;
  const padding = { top: 60, right: 20, bottom: 40, left: 200 };
  const height = Math.max(400, comparison.length * (barHeight + gap) + padding.top + padding.bottom);

  return (
    <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
      <svg width={width} height={height}>
        <text x={width / 2} y={30} fill="#e2e8f0" fontSize="16" fontWeight="700" textAnchor="middle">
          Qualifying vs Race Finish
        </text>

        {comparison.map((driver, idx) => {
          const y = padding.top + idx * (barHeight + gap);
          const gained = driver.positionChange > 0;
          const lost = driver.positionChange < 0;
          const color = gained ? '#10b981' : lost ? '#ef4444' : '#64748b';

          return (
            <g key={driver.driverId}>
              <text
                x={padding.left - 10}
                y={y + barHeight / 2 + 4}
                fill="#e2e8f0"
                fontSize="11"
                textAnchor="end"
              >
                {driver.driverName}
              </text>

              <rect
                x={padding.left}
                y={y}
                width={20}
                height={barHeight}
                fill="#475569"
              />
              <text
                x={padding.left + 10}
                y={y + barHeight / 2 + 4}
                fill="white"
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
              >
                Q{driver.qualPosition}
              </text>

              <line
                x1={padding.left + 25}
                y1={y + barHeight / 2}
                x2={padding.left + 75}
                y2={y + barHeight / 2}
                stroke="#64748b"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />

              <rect
                x={padding.left + 80}
                y={y}
                width={20}
                height={barHeight}
                fill={color}
              />
              <text
                x={padding.left + 90}
                y={y + barHeight / 2 + 4}
                fill="white"
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
              >
                P{driver.racePosition}
              </text>

              {driver.positionChange !== 0 && (
                <text
                  x={padding.left + 110}
                  y={y + barHeight / 2 + 4}
                  fill={color}
                  fontSize="12"
                  fontWeight="700"
                >
                  {driver.positionChange > 0 ? '+' : ''}{driver.positionChange}
                </text>
              )}
            </g>
          );
        })}

        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

