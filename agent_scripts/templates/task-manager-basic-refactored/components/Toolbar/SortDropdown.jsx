/**
 * Sort Dropdown component - dropdown menu for sorting tasks
 */

import React from 'react';

export default function SortDropdown({ 
  isOpen, 
  onToggle, 
  onSort,
  currentSort,
  sortDirection,
  onToggleDirection,
  sortActive
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          padding: '10px 16px',
          border: sortActive ? '2px solid #007bff' : '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '8px',
          background: sortActive ? '#e3f2fd' : 'white',
          color: sortActive ? '#007bff' : '#666',
          cursor: 'pointer',
          fontWeight: '500',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s'
        }}
      >
        Sort By
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
            minWidth: '200px',
            overflow: 'hidden'
          }}>
            {/* Priority Sort Option */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                fontSize: '14px',
                transition: 'background 0.2s',
                background: currentSort === 'priority' ? '#f0f7ff' : 'white',
                borderLeft: currentSort === 'priority' ? '3px solid #007bff' : '3px solid transparent'
              }}
            >
              <span
                onClick={() => {
                  if (currentSort === 'priority') {
                    onToggleDirection('priority');
                  } else {
                    onSort('priority', 'asc');
                    // Don't close dropdown
                  }
                }}
                style={{
                  flex: 1,
                  cursor: 'pointer'
                }}
              >
                Priority {currentSort === 'priority' && (
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    ({sortDirection === 'asc' ? 'High → Low' : 'Low → High'})
                  </span>
                )}
              </span>
              {currentSort === 'priority' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSort('priority', 'asc');
                    }}
                    style={{
                      padding: '2px 6px',
                      background: sortDirection === 'asc' ? '#007bff' : '#e0e0e0',
                      color: sortDirection === 'asc' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      lineHeight: '1'
                    }}
                    title="High to Low"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSort('priority', 'desc');
                    }}
                    style={{
                      padding: '2px 6px',
                      background: sortDirection === 'desc' ? '#007bff' : '#e0e0e0',
                      color: sortDirection === 'desc' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      lineHeight: '1'
                    }}
                    title="Low to High"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>

            {/* Due Date Sort Option */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                fontSize: '14px',
                transition: 'background 0.2s',
                background: currentSort === 'dueDate' ? '#f0f7ff' : 'white',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                borderLeft: currentSort === 'dueDate' ? '3px solid #007bff' : '3px solid transparent'
              }}
            >
              <span
                onClick={() => {
                  if (currentSort === 'dueDate') {
                    onToggleDirection('dueDate');
                  } else {
                    onSort('dueDate', 'asc');
                    // Don't close dropdown
                  }
                }}
                style={{
                  flex: 1,
                  cursor: 'pointer'
                }}
              >
                Due Date {currentSort === 'dueDate' && (
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    ({sortDirection === 'asc' ? 'Earliest → Latest' : 'Latest → Earliest'})
                  </span>
                )}
              </span>
              {currentSort === 'dueDate' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSort('dueDate', 'asc');
                    }}
                    style={{
                      padding: '2px 6px',
                      background: sortDirection === 'asc' ? '#007bff' : '#e0e0e0',
                      color: sortDirection === 'asc' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      lineHeight: '1'
                    }}
                    title="Earliest to Latest"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSort('dueDate', 'desc');
                    }}
                    style={{
                      padding: '2px 6px',
                      background: sortDirection === 'desc' ? '#007bff' : '#e0e0e0',
                      color: sortDirection === 'desc' ? 'white' : '#666',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      lineHeight: '1'
                    }}
                    title="Latest to Earliest"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
