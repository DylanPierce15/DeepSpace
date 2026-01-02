import React from 'react';
import { CHART_COLORS } from '../utils/constants';

export default function LeadChangesChart({ leadChanges, maxLap }) {
  if (!leadChanges || leadChanges.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No lead changes data</div>;
  }

  const width = 800;
  const height = 400;
  const padding = { top: 60, right: 20, bottom: 50, left: 50 };

  // Group consecutive laps by leader
  const leadershipPeriods = [];
  let currentPeriod = { leader: leadChanges[0].driverId, startLap: 1, endLap: leadChanges[0].lap };

  leadChanges.forEach((change, idx) => {
    if (idx > 0) {
      leadershipPeriods.push(currentPeriod);
      currentPeriod = { leader: change.driverId, startLap: change.lap, endLap: change.lap };
    }
    if (idx === leadChanges.length - 1) {
      currentPeriod.endLap = maxLap;
      leadershipPeriods.push(currentPeriod);
    } else if (idx < leadChanges.length - 1) {
      currentPeriod.endLap = leadChanges[idx + 1].lap - 1;
    }
  });

  const uniqueLeaders = [...new Set(leadershipPeriods.map(p => p.leader))];
  const colorMap = {};
  uniqueLeaders.forEach((leader, idx) => {
    colorMap[leader] = CHART_COLORS[idx % CHART_COLORS.length];
  });

  const chartWidth = width - padding.left - padding.right;
  const barHeight = 60;
  const xScale = (lap) => padding.left + (lap / maxLap) * chartWidth;

  return (
    <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', overflow: 'auto' }}>
      <svg width={width} height={height}>
        <text x={width / 2} y={30} fill="#e2e8f0" fontSize="16" fontWeight="700" textAnchor="middle">
          Race Leadership ({leadChanges.length} lead changes)
        </text>

        <g transform={`translate(0, ${padding.top})`}>
          {leadershipPeriods.map((period, idx) => {
            const x = xScale(period.startLap);
            const barWidth = xScale(period.endLap) - x;

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={barHeight}
                  fill={colorMap[period.leader]}
                  opacity="0.8"
                />
                <text
                  x={x + barWidth / 2}
                  y={barHeight / 2 + 5}
                  fill="white"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {period.leader.toUpperCase()}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={barHeight + 20}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  Laps {period.startLap}-{period.endLap}
                </text>
              </g>
            );
          })}
        </g>

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + barHeight}
          x2={width - padding.right}
          y2={padding.top + barHeight}
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

