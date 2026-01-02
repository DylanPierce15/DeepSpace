import React from 'react';
import { CHART_COLORS } from '../utils/constants';

export default function FastestLapsChart({ fastestLaps }) {
  if (!fastestLaps || fastestLaps.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No fastest lap data available</div>;
  }

  const width = 800;
  const barHeight = 25;
  const gap = 8;
  const padding = { top: 60, right: 20, bottom: 40, left: 200 };
  const height = Math.max(400, fastestLaps.length * (barHeight + gap) + padding.top + padding.bottom);

  const lapsToShow = fastestLaps;
  
  // Parse lap times to milliseconds for comparison
  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d+):(\d+)\.(\d+)/);
    if (!match) return 0;
    const [_, min, sec, ms] = match;
    return parseInt(min) * 60000 + parseInt(sec) * 1000 + parseInt(ms);
  };

  const times = lapsToShow.map(l => parseTime(l.time));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const chartWidth = width - padding.left - padding.right;

  const xScale = (time) => {
    if (maxTime === minTime) return chartWidth;
    return ((time - minTime) / (maxTime - minTime)) * chartWidth;
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
      <svg width={width} height={height}>
        <text x={width / 2} y={30} fill="#e2e8f0" fontSize="16" fontWeight="700" textAnchor="middle">
          Fastest Laps ({lapsToShow.length} drivers)
        </text>

        {lapsToShow.map((lap, idx) => {
          const y = padding.top + idx * (barHeight + gap);
          const time = times[idx];
          const barWidth = xScale(time);
          const color = idx === 0 ? '#a855f7' : CHART_COLORS[idx % CHART_COLORS.length];

          return (
            <g key={lap.driverId}>
              <text
                x={padding.left - 10}
                y={y + barHeight / 2 + 4}
                fill="#e2e8f0"
                fontSize="11"
                textAnchor="end"
              >
                {lap.driverName}
              </text>

              <rect
                x={padding.left}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity="0.8"
                rx="4"
              />

              <text
                x={padding.left + barWidth + 8}
                y={y + barHeight / 2 + 4}
                fill="#e2e8f0"
                fontSize="11"
                fontWeight="600"
              >
                {lap.time}
              </text>

              <text
                x={padding.left + barWidth + 80}
                y={y + barHeight / 2 + 4}
                fill="#94a3b8"
                fontSize="10"
              >
                Lap {lap.lap}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

