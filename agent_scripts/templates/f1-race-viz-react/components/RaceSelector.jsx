import React from 'react';

export default function RaceSelector({ season, schedule, selectedRound, onSelect }) {
  if (!schedule || schedule.length === 0) {
    return (
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        textAlign: 'center',
        color: '#94a3b8'
      }}>
        No schedule data available for {season}. Use F1 Data Downloader widget first.
      </div>
    );
  }

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '14px' }}>
        Select Race
      </label>
      <select
        value={selectedRound || ''}
        onChange={(e) => onSelect(parseInt(e.target.value))}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: '14px',
          background: '#0f172a',
          border: '1px solid #475569',
          borderRadius: '8px',
          color: '#e2e8f0',
          outline: 'none'
        }}
      >
        <option value="">-- Select a race --</option>
        {schedule.map(race => (
          <option key={race.round} value={race.round}>
            Round {race.round}: {race.raceName}
          </option>
        ))}
      </select>
    </div>
  );
}

