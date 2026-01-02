/**
 * Filter Dropdown component - dropdown menu for filtering tasks by user and tag
 */

import React from 'react';

export default function FilterDropdown({ 
  isOpen, 
  onToggle,
  availableUsers = [],
  availableTags = [],
  selectedUsers = [],
  selectedTags = [],
  onToggleUser,
  onToggleTag
}) {
  // Determine if all users/tags are selected
  const allUsersSelected = availableUsers.length > 0 && selectedUsers.length === availableUsers.length;
  const allTagsSelected = availableTags.length > 0 && selectedTags.length === availableTags.length;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          padding: '10px 16px',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          background: 'white',
          color: '#666',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        Filter
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close dropdown when clicking outside */}
          <div 
            onClick={onToggle}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
          />
          
          {/* Dropdown menu */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'white',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '240px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {/* Users Section */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Assigned User
              </div>
              
              {availableUsers.length === 0 ? (
                <div style={{
                  fontSize: '13px',
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  No assigned users
                </div>
              ) : (
                <>
                  {/* Select All Users */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 0',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allUsersSelected}
                      onChange={() => {
                        if (allUsersSelected) {
                          // Deselect all
                          availableUsers.forEach(user => {
                            if (selectedUsers.includes(user)) {
                              onToggleUser(user);
                            }
                          });
                        } else {
                          // Select all
                          availableUsers.forEach(user => {
                            if (!selectedUsers.includes(user)) {
                              onToggleUser(user);
                            }
                          });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>All Users</span>
                  </label>
                  
                  {/* Individual Users */}
                  {availableUsers.map(user => (
                    <label
                      key={user}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0 6px 24px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user)}
                        onChange={() => onToggleUser(user)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{user}</span>
                    </label>
                  ))}
                </>
              )}
            </div>

            {/* Divider */}
            <div style={{
              height: '1px',
              background: 'rgba(0, 0, 0, 0.1)',
              margin: '0 16px'
            }} />

            {/* Tags Section */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#999',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Tags
              </div>
              
              {availableTags.length === 0 ? (
                <div style={{
                  fontSize: '13px',
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  No tags available
                </div>
              ) : (
                <>
                  {/* Select All Tags */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 0',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allTagsSelected}
                      onChange={() => {
                        if (allTagsSelected) {
                          // Deselect all
                          availableTags.forEach(tag => {
                            if (selectedTags.includes(tag)) {
                              onToggleTag(tag);
                            }
                          });
                        } else {
                          // Select all
                          availableTags.forEach(tag => {
                            if (!selectedTags.includes(tag)) {
                              onToggleTag(tag);
                            }
                          });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>All Tags</span>
                  </label>
                  
                  {/* Individual Tags */}
                  {availableTags.map(tag => (
                    <label
                      key={tag}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0 6px 24px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => onToggleTag(tag)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{tag}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
