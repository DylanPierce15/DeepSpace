/**
 * UserList component - displays list of users with task counts
 */

import React from 'react';
import UserAvatar from '../UI/UserAvatar.jsx';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function UserList({
  tasksByUser = {},
  unassignedTasks = 0,
  currentView,
  onViewChange,
  sidebarExpanded = {},
  onToggleAccordion
}) {
  const userIds = Object.keys(tasksByUser);

  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        onClick={() => onToggleAccordion('users')}
        style={{
          padding: '10px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          background: 'transparent',
          color: '#666',
          fontWeight: '500',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s'
        }}
      >
        <span>By User</span>
        <span style={{ 
          fontSize: '12px',
          transition: 'transform 0.2s'
        }}>
          {sidebarExpanded.users ? '▼' : '▶'}
        </span>
      </div>

      {sidebarExpanded.users && (
        <div style={{ marginTop: '8px', marginLeft: '8px' }}>
          {/* Unassigned Tasks - only show if there are any */}
          {unassignedTasks > 0 && (
            <div
              onClick={() => onViewChange({ type: VIEW_TYPES.USER, id: 'unassigned' })}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '4px',
                background: currentView.type === VIEW_TYPES.USER && currentView.id === 'unassigned'
                  ? '#E3F2FD'
                  : 'transparent',
                color: currentView.type === VIEW_TYPES.USER && currentView.id === 'unassigned'
                  ? '#1976D2'
                  : '#666',
                fontSize: '13px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                if (!(currentView.type === VIEW_TYPES.USER && currentView.id === 'unassigned')) {
                  e.currentTarget.style.background = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!(currentView.type === VIEW_TYPES.USER && currentView.id === 'unassigned')) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                Unassigned
              </span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>
                {unassignedTasks}
              </span>
            </div>
          )}

          {/* Users with assigned tasks */}
          {userIds.map(userId => {
            const userTasks = tasksByUser[userId];
            const user = userTasks.user;

            return (
              <div
                key={userId}
                onClick={() => onViewChange({ type: VIEW_TYPES.USER, id: userId })}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  background: currentView.type === VIEW_TYPES.USER && currentView.id === userId
                    ? '#E3F2FD'
                    : 'transparent',
                  color: currentView.type === VIEW_TYPES.USER && currentView.id === userId
                    ? '#1976D2'
                    : '#666',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!(currentView.type === VIEW_TYPES.USER && currentView.id === userId)) {
                    e.currentTarget.style.background = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(currentView.type === VIEW_TYPES.USER && currentView.id === userId)) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  overflow: 'hidden',
                  flex: 1,
                  minWidth: 0
                }}>
                  <UserAvatar 
                    userName={user.name} 
                    size={20} 
                    fontSize={10}
                    style={{
                      background: user.isOwner ? '#ff9800' : '#2196f3'
                    }}
                  />
                  <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}>
                    {user.name}
                  </span>
                </div>
                <span style={{ fontSize: '11px', opacity: 0.7, flexShrink: 0 }}>
                  {userTasks.tasks.length}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
