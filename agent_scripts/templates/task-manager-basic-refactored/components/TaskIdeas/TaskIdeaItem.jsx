/**
 * Task Idea Item component - individual task idea card
 */

import React from 'react';

export default function TaskIdeaItem({ 
  idea, 
  isProcessing, 
  onProcessIdea 
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
        border: '1px solid rgba(102, 126, 234, 0.15)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        transition: 'all 0.2s',
        ':hover': {
          borderColor: 'rgba(102, 126, 234, 0.3)',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)'
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.15)';
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
        <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#333',
            lineHeight: '1.5'
          }}>
            {idea.text}
          </div>
          {idea.source && (
            <div style={{
              fontSize: '12px',
              color: '#999',
              marginTop: '4px'
            }}>
              From {idea.source}
            </div>
          )}
        </div>
      </div>
      
      <button
        onClick={() => onProcessIdea(idea.id)}
        disabled={isProcessing}
        style={{
          padding: '8px 16px',
          border: 'none',
          borderRadius: '6px',
          background: isProcessing 
            ? 'rgba(102, 126, 234, 0.3)' 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
          opacity: isProcessing ? 0.6 : 1,
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {isProcessing ? 'Creating...' : '+ Create Task'}
      </button>
    </div>
  );
}
