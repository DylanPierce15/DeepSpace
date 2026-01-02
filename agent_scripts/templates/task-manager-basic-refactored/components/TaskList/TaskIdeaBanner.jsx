/**
 * Task Idea Banner component - displays unprocessed task ideas
 */

import React from 'react';

export default function TaskIdeaBanner({ 
  unprocessedIdeas = [], 
  processingIdeaId, 
  onProcessIdea 
}) {
  if (!unprocessedIdeas || unprocessedIdeas.length === 0) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      color: 'white'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            Task Ideas ({unprocessedIdeas.length})
          </h4>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {unprocessedIdeas.slice(0, 3).map(idea => (
          <div
            key={idea.id}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1, fontSize: '14px' }}>{idea.text}</div>
            <button
              onClick={() => onProcessIdea(idea.id)}
              disabled={processingIdeaId === idea.id}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'white',
                color: '#667eea',
                cursor: processingIdeaId === idea.id ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                opacity: processingIdeaId === idea.id ? 0.6 : 1
              }}
            >
              {processingIdeaId === idea.id ? 'Creating...' : '+ Create Task'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
