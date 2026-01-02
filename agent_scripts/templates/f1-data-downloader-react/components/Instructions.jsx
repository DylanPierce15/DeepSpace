import React from 'react';

export default function Instructions() {
  return (
    <div style={{
      marginTop: '24px',
      padding: '16px',
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      borderRadius: '8px',
      fontSize: '13px',
      color: '#93c5fd'
    }}>
      <strong>How it works:</strong>
      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
        <li>Season metadata loads automatically (schedule, drivers, standings)</li>
        <li>Click "Download" on individual races to fetch race data</li>
        <li>Each race includes: results, qualifying, sprint, pit stops, lap times</li>
        <li>Cached races show "✓ Cached" - won't re-download</li>
        <li>Data persists across sessions in global storage</li>
      </ul>
    </div>
  );
}

