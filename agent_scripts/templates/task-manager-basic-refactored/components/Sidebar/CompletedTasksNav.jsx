/**
 * CompletedTasksNav component - completed tasks navigation item
 */

import React from 'react';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function CompletedTasksNav({ 
  currentView, 
  onViewChange,
  completedTasks 
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        onClick={() => onViewChange({ type: VIEW_TYPES.COMPLETED })}
        style={{
          padding: '10px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '8px',
          background: currentView.type === VIEW_TYPES.COMPLETED ? '#E3F2FD' : 'transparent',
          color: currentView.type === VIEW_TYPES.COMPLETED ? '#1976D2' : '#666',
          fontWeight: currentView.type === VIEW_TYPES.COMPLETED ? '600' : '500',
          fontSize: '14px',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span>Completed Tasks</span>
        {completedTasks > 0 && (
          <span style={{
            background: currentView.type === VIEW_TYPES.COMPLETED ? '#1976D2' : 'rgba(0, 0, 0, 0.1)',
            color: currentView.type === VIEW_TYPES.COMPLETED ? 'white' : '#666',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {completedTasks}
          </span>
        )}
      </div>
    </div>
  );
}
