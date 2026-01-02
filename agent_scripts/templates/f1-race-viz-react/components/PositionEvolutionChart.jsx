import React from 'react';

export default function PositionEvolutionChart({ data }) {
  if (!data || !data.driverData || data.driverData.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No lap data available</div>;
  }

  const { driverData, maxLap } = data;
  const width = 800;
  const height = 500;
  const padding = { top: 40, right: 150, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxPosition = 20;
  const xScale = (lap) => padding.left + (lap / maxLap) * chartWidth;
  const yScale = (pos) => padding.top + ((pos - 1) / (maxPosition - 1)) * chartHeight;

  return (
    <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 5, 10, 15, 20].map(pos => (
          <line
            key={pos}
            x1={padding.left}
            y1={yScale(pos + 1)}
            x2={width - padding.right}
            y2={yScale(pos + 1)}
            stroke="#334155"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}

        {/* Y-axis labels (positions) */}
        {[1, 5, 10, 15, 20].map(pos => (
          <text
            key={pos}
            x={padding.left - 10}
            y={yScale(pos) + 5}
            fill="#94a3b8"
            fontSize="12"
            textAnchor="end"
          >
            P{pos}
          </text>
        ))}

        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 10}
          fill="#94a3b8"
          fontSize="12"
          textAnchor="middle"
        >
          Lap
        </text>

        {/* Driver lines */}
        {driverData.map((driver, idx) => {
          const points = driver.positions.map(p => ({
            x: xScale(p.lap),
            y: yScale(p.position)
          }));

          const pathData = points.map((p, i) => 
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
          ).join(' ');

          return (
            <g key={driver.driverId}>
              <path
                d={pathData}
                stroke={driver.color}
                strokeWidth="2"
                fill="none"
                opacity="0.8"
              />
              {/* End point marker */}
              {points.length > 0 && (
                <circle
                  cx={points[points.length - 1].x}
                  cy={points[points.length - 1].y}
                  r="4"
                  fill={driver.color}
                />
              )}
              {/* Driver label at end */}
              <text
                x={width - padding.right + 10}
                y={points[points.length - 1]?.y || 0}
                fill={driver.color}
                fontSize="11"
                fontWeight="600"
              >
                {driver.driverId.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Title */}
        <text
          x={width / 2}
          y={20}
          fill="#e2e8f0"
          fontSize="16"
          fontWeight="700"
          textAnchor="middle"
        >
          Position Evolution - All Drivers ({driverData.length} drivers, {maxLap} laps)
        </text>
      </svg>
    </div>
  );
}

