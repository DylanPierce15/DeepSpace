import React from 'react';

export default function ProgressBar({ progress }) {
  const percentage = (progress.current / progress.total) * 100;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ 
        background: '#0f172a',
        height: '32px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
        position: 'relative'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #f97316 0%, #dc2626 100%)',
          transition: 'width 0.3s ease'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '12px',
          fontWeight: '600',
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)'
        }}>
          {progress.status}
        </div>
      </div>
    </div>
  );
}

