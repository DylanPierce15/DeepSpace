import React from 'react';
import { CHART_COLORS } from '../utils/constants';

export default function PitStopChart({ pitStopData, maxLap }) {
  if (!pitStopData) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No pit stop data available</div>;
  }

  const drivers = Object.keys(pitStopData).sort(); // All drivers alphabetically
  const width = 800;
  const height = Math.max(400, drivers.length * 30 + 100);
  const padding = { top: 60, right: 20, bottom: 40, left: 150 };
  const chartWidth = width - padding.left - padding.right;
  const rowHeight = 25;

  const xScale = (lap) => padding.left + (lap / maxLap) * chartWidth;

  return (
    <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
      <svg width={width} height={height}>
        <text x={width / 2} y={30} fill="#e2e8f0" fontSize="16" fontWeight="700" textAnchor="middle">
          Pit Stop Strategy
        </text>

        {drivers.map((driverId, idx) => {
          const y = padding.top + idx * rowHeight;
          const stops = pitStopData[driverId];
          const color = CHART_COLORS[idx % CHART_COLORS.length];

          return (
            <g key={driverId}>
              {/* Driver label */}
              <text
                x={padding.left - 10}
                y={y + 12}
                fill="#e2e8f0"
                fontSize="11"
                textAnchor="end"
              >
                {driverId.toUpperCase()}
              </text>

              {/* Timeline */}
              <line
                x1={padding.left}
                y1={y + 5}
                x2={width - padding.right}
                y2={y + 5}
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Pit stops */}
              {stops.map((stop, stopIdx) => (
                <g key={stopIdx}>
                  <circle
                    cx={xScale(stop.lap)}
                    cy={y + 5}
                    r="6"
                    fill={color}
                  />
                  <text
                    x={xScale(stop.lap)}
                    y={y - 5}
                    fill={color}
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {stop.duration.toFixed(1)}s
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + drivers.length * rowHeight + 10}
          x2={width - padding.right}
          y2={padding.top + drivers.length * rowHeight + 10}
          stroke="#475569"
          strokeWidth="2"
        />
        <text
          x={width / 2}
          y={height - 10}
          fill="#94a3b8"
          fontSize="12"
          textAnchor="middle"
        >
          Lap Number
        </text>
      </svg>
    </div>
  );
}

