import React from 'react';

export default function ActivityLog({ log }) {
  if (log.length === 0) return null;

  return (
    <div style={{ 
      background: '#1e293b', 
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '16px',
      maxHeight: '300px',
      overflow: 'auto'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>
        Activity Log
      </h3>
      <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
        {log.map((entry, idx) => (
          <div 
            key={idx} 
            style={{ 
              padding: '6px 0',
              borderBottom: idx < log.length - 1 ? '1px solid #334155' : 'none',
              color: entry.type === 'error' ? '#fca5a5' : 
                     entry.type === 'success' ? '#86efac' :
                     entry.type === 'warning' ? '#fcd34d' : '#94a3b8'
            }}
          >
            <span style={{ color: '#64748b' }}>[{entry.timestamp}]</span> {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}

