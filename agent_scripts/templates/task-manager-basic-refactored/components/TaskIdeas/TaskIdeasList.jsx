/**
 * Task Ideas List component - displays unprocessed task ideas
 */

import React from 'react';
import TaskIdeaItem from './TaskIdeaItem.jsx';

export default function TaskIdeasList({ 
  unprocessedIdeas = [], 
  processingIdeaId, 
  onProcessIdea 
}) {
  if (!unprocessedIdeas || unprocessedIdeas.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💡</div>
        <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          No Task Ideas
        </div>
        <div style={{ fontSize: '14px' }}>
          Task ideas from other widgets will appear here
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {unprocessedIdeas.map(idea => (
          <TaskIdeaItem
            key={idea.id}
            idea={idea}
            isProcessing={processingIdeaId === idea.id}
            onProcessIdea={onProcessIdea}
          />
        ))}
      </div>
    </div>
  );
}
