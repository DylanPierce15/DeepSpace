import React from 'react';
import { CHART_TYPES } from '../utils/constants';

const CHART_OPTIONS = [
  { value: CHART_TYPES.POSITION_EVOLUTION, label: '📈 Position Evolution', description: 'Driver positions lap-by-lap' },
  { value: CHART_TYPES.LEAD_CHANGES, label: '👑 Lead Changes', description: 'Who led when' },
  { value: CHART_TYPES.PIT_STRATEGY, label: '⛽ Pit Stop Strategy', description: 'When drivers pitted' },
  { value: CHART_TYPES.LAP_TIMES, label: '⏱️ Fastest Laps', description: 'Fastest lap comparison' },
  { value: CHART_TYPES.QUALI_VS_RACE, label: '🔄 Quali vs Race', description: 'Position changes from qualifying' }
];

export default function ChartSelector({ selectedChart, onSelect }) {
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
        Visualization Type
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {CHART_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            style={{
              padding: '12px',
              background: selectedChart === option.value ? '#f97316' : '#0f172a',
              border: `1px solid ${selectedChart === option.value ? '#f97316' : '#334155'}`,
              borderRadius: '8px',
              color: selectedChart === option.value ? 'white' : '#e2e8f0',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              {option.label}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

