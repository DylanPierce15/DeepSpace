import React from 'react';
import { VALID_YEARS } from '../utils/constants';

/**
 * Year selection dropdown with navigation arrows
 */
const YearSelector = ({ year, onChange }) => {
  const changeYear = (delta) => {
    const idx = VALID_YEARS.indexOf(year);
    if (idx === -1) return;
    const nextIdx = Math.min(Math.max(idx + delta, 0), VALID_YEARS.length - 1);
    const nextYear = VALID_YEARS[nextIdx];
    onChange(nextYear);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <button
        onClick={() => changeYear(1)}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #334155',
          background: '#0b1220',
          color: '#e2e8f0',
          cursor: 'pointer'
        }}
        title="Next season"
      >
        ↑
      </button>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: 8,
          background: '#0b1220',
          color: '#e2e8f0',
          border: '1px solid #334155'
        }}
      >
        {VALID_YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        onClick={() => changeYear(-1)}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #334155',
          background: '#0b1220',
          color: '#e2e8f0',
          cursor: 'pointer'
        }}
        title="Previous season"
      >
        ↓
      </button>
    </div>
  );
};

export default YearSelector;

