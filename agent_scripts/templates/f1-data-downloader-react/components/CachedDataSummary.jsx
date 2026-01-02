import React from 'react';

export default function CachedDataSummary({ season, cached }) {
  const items = [
    { label: 'Schedule', value: cached.schedule },
    { label: 'Race Results', value: cached.races },
    { label: 'Qualifying', value: cached.qualifying },
    { label: 'Sprint Races', value: cached.sprint },
    { label: 'Pit Stops', value: cached.pitStops },
    { label: 'Drivers', value: cached.drivers },
    { label: 'Constructors', value: cached.constructors },
  ];

  return (
    <div style={{ 
      background: '#1e293b', 
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        📊 Cached Data for {season}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {items.map(item => (
          <div key={item.label} style={{ 
            background: '#0f172a',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: item.value > 0 ? '#10b981' : '#64748b' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

