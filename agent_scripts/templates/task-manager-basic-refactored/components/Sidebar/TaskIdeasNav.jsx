/**
 * Task Ideas Nav component - sidebar navigation for task ideas
 */

import React from 'react';

export default function TaskIdeasNav({ 
  currentView, 
  onViewChange, 
  unprocessedIdeasCount 
}) {
  const isActive = currentView.type === 'task-ideas';

  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        onClick={() => onViewChange({ type: 'task-ideas' })}
        style={{
          padding: '10px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '8px',
          background: isActive ? '#F3E5F5' : 'transparent',
          color: isActive ? '#7B1FA2' : '#666',
          fontWeight: isActive ? '600' : '500',
          fontSize: '14px',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
      >
        <span>Task Ideas</span>
        {unprocessedIdeasCount > 0 && (
          <span style={{
            background: isActive ? '#7B1FA2' : 'rgba(123, 31, 162, 0.15)',
            color: isActive ? 'white' : '#7B1FA2',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {unprocessedIdeasCount}
          </span>
        )}
      </div>
    </div>
  );
}
