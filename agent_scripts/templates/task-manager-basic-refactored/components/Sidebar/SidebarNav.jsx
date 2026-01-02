/**
 * SidebarNav component - main navigation items
 */

import React from 'react';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function SidebarNav({ 
  currentView, 
  onViewChange, 
  upcomingDays,
  totalTasks,
  completedTasks 
}) {
  const navItems = [
    {
      type: VIEW_TYPES.ALL,
      label: 'All Tasks'
    },
    {
      type: VIEW_TYPES.UPCOMING,
      label: `Upcoming (${upcomingDays} days)`
    }
  ];

  return (
    <div style={{ marginBottom: '16px' }}>
      {navItems.map(item => (
        <div
          key={item.type}
          onClick={() => onViewChange({ type: item.type })}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '8px',
            background: currentView.type === item.type ? '#E3F2FD' : 'transparent',
            color: currentView.type === item.type ? '#1976D2' : '#666',
            fontWeight: currentView.type === item.type ? '600' : '500',
            fontSize: '14px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{item.label}</span>
          {item.count !== undefined && item.count > 0 && (
            <span style={{
              background: currentView.type === item.type ? '#1976D2' : 'rgba(0, 0, 0, 0.1)',
              color: currentView.type === item.type ? 'white' : '#666',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {item.count}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
