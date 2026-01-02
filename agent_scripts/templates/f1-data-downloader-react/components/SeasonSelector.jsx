import React from 'react';
import { MIN_YEAR, MAX_YEAR } from '../utils/constants';

export default function SeasonSelector({ season, onChange, disabled }) {
  return (
    <div style={{ 
      background: '#1e293b', 
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
        Select Season
      </label>
      <input
        type="number"
        value={season}
        onChange={(e) => onChange(parseInt(e.target.value))}
        min={MIN_YEAR}
        max={MAX_YEAR}
        disabled={disabled}
        style={{
          width: '150px',
          padding: '10px 14px',
          fontSize: '16px',
          background: '#0f172a',
          border: '1px solid #475569',
          borderRadius: '8px',
          color: '#e2e8f0',
          outline: 'none'
        }}
      />
    </div>
  );
}

