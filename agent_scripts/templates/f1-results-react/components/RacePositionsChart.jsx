import React, { useState } from 'react';
import { DRIVER_COLORS, CHART_CONFIG } from '../utils/constants';

/**
 * Chart showing driver race finishing positions over the season
 */
const RacePositionsChart = ({ year, roundStore }) => {
  const seasonRounds = roundStore?.[year] || {};
  const rounds = Object.keys(seasonRounds).map(Number).sort((a, b) => a - b);
  
  const [visibleDrivers, setVisibleDrivers] = useState(new Set());
  const [hoveredDriver, setHoveredDriver] = useState(null);
  
  if (rounds.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        No race data available. Use "Preload All Data" to fetch race results.
      </div>
    );
  }
  
  // Collect driver data
  const driverData = new Map();
  rounds.forEach(round => {
    const race = seasonRounds[round];
    if (race?.results) {
      race.results.forEach(result => {
        const driverCode = result.driverCode || result.driverName;
        if (!driverData.has(driverCode)) {
          driverData.set(driverCode, {
            name: result.driverName,
            constructor: result.constructor,
            positions: []
          });
        }
        driverData.get(driverCode).positions.push({
          round,
          position: Number(result.position),
          raceName: race.raceName
        });
      });
    }
  });
  
  // Initialize visible drivers on mount
  React.useEffect(() => {
    if (visibleDrivers.size === 0 && driverData.size > 0) {
      setVisibleDrivers(new Set(Array.from(driverData.keys())));
    }
  }, [driverData.size]);
  
  const maxRounds = Math.max(...rounds);
  const chartHeight = CHART_CONFIG.height;
  const chartWidth = Math.min(CHART_CONFIG.maxWidth, rounds.length * 40);
  const margin = CHART_CONFIG.margin;
  
  const toggleDriver = (driverCode) => {
    setVisibleDrivers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(driverCode)) {
        newSet.delete(driverCode);
      } else {
        newSet.add(driverCode);
      }
      return newSet;
    });
  };

  const selectAllDrivers = () => {
    setVisibleDrivers(new Set(Array.from(driverData.keys())));
  };

  const deselectAllDrivers = () => {
    setVisibleDrivers(new Set());
  };
  
  return (
    <div style={{ position: 'relative' }}>
      <svg width={chartWidth + margin.left + margin.right} height={chartHeight + margin.top + margin.bottom} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {Array.from({ length: maxRounds + 1 }, (_, i) => (
          <g key={`grid-x-${i}`}>
            <line
              x1={margin.left + (i * chartWidth) / maxRounds}
              y1={margin.top}
              x2={margin.left + (i * chartWidth) / maxRounds}
              y2={margin.top + chartHeight}
              stroke="#233047"
              strokeWidth={1}
            />
            <text
              x={margin.left + (i * chartWidth) / maxRounds}
              y={margin.top + chartHeight + 20}
              textAnchor="middle"
              fontSize="12"
              fill="#94a3b8"
            >
              Rd {i}
            </text>
          </g>
        ))}
        
        {/* Position grid lines */}
        {[1, 5, 10, 15, 20].map(pos => (
          <g key={`grid-y-${pos}`}>
            <line
              x1={margin.left}
              y1={margin.top + ((pos - 1) * chartHeight) / 19}
              x2={margin.left + chartWidth}
              y2={margin.top + ((pos - 1) * chartHeight) / 19}
              stroke="#233047"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text
              x={margin.left - 10}
              y={margin.top + ((pos - 1) * chartHeight) / 19 + 4}
              textAnchor="end"
              fontSize="12"
              fill="#94a3b8"
            >
              {pos}
            </text>
          </g>
        ))}
        
        {/* Driver lines */}
        {Array.from(driverData.entries()).map(([driverCode, data], driverIndex) => {
          if (!visibleDrivers.has(driverCode)) return null;
          
          const color = DRIVER_COLORS[driverIndex % DRIVER_COLORS.length];
          const points = data.positions
            .sort((a, b) => a.round - b.round)
            .map(point => ({
              x: margin.left + ((point.round - 1) * chartWidth) / maxRounds,
              y: margin.top + ((point.position - 1) * chartHeight) / 19,
              position: point.position
            }));
          
          return (
            <g key={driverCode}>
              <polyline
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={hoveredDriver === driverCode ? 4 : 2}
                opacity={hoveredDriver === driverCode ? 1 : 0.8}
                onMouseEnter={() => setHoveredDriver(driverCode)}
                onMouseLeave={() => setHoveredDriver(null)}
                style={{ cursor: 'pointer' }}
              />
              {points.map((point, index) => (
                <circle
                  key={`${driverCode}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredDriver === driverCode ? 5 : 3}
                  fill={point.position === 1 ? '#fbbf24' : color}
                  stroke="#0f172a"
                  strokeWidth={1}
                  onMouseEnter={() => setHoveredDriver(driverCode)}
                  onMouseLeave={() => setHoveredDriver(null)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </g>
          );
        })}
      </svg>
      
      {/* Hover tooltip */}
      {hoveredDriver && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 6,
            padding: '8px 12px',
            color: '#e2e8f0',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            zIndex: 10
          }}
        >
          {driverData.get(hoveredDriver)?.name} ({hoveredDriver})
        </div>
      )}
      
      {/* Legend */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={selectAllDrivers}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Select All
          </button>
          <button
            onClick={deselectAllDrivers}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Deselect All
          </button>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 120, overflowY: 'auto' }}>
          {Array.from(driverData.entries()).map(([driverCode, data], index) => {
            const isVisible = visibleDrivers.has(driverCode);
            const color = DRIVER_COLORS[index % DRIVER_COLORS.length];
            
            return (
              <div 
                key={driverCode} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: isVisible ? '#1f2937' : '#0b1220',
                  border: `1px solid ${isVisible ? color : '#374151'}`,
                  cursor: 'pointer',
                  opacity: isVisible ? 1 : 0.5,
                  transition: 'all 0.2s'
                }}
                onClick={() => toggleDriver(driverCode)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isVisible ? '#374151' : '#1f2937';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isVisible ? '#1f2937' : '#0b1220';
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: color,
                    borderRadius: 2
                  }}
                />
                <span style={{ fontSize: 12, color: '#e2e8f0' }}>
                  {data.name.split(' ')[1] || data.name} ({data.constructor})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RacePositionsChart;

