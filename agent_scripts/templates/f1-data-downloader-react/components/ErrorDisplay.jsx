import React from 'react';

export default function ErrorDisplay({ error }) {
  if (!error) return null;

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '20px',
      color: '#fca5a5',
      fontSize: '14px'
    }}>
      <strong>Error:</strong> {error}
    </div>
  );
}

