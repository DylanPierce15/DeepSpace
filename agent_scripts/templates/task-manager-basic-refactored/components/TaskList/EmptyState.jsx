/**
 * Empty State component - shown when there are no tasks
 */

import React from 'react';

export default function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      opacity: 0.6
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
      <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
        No tasks here
      </div>
      <div style={{ fontSize: '14px' }}>
        Click "Add Task" to create a task
      </div>
    </div>
  );
}
