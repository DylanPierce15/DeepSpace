/**
 * SearchBar component - search bar for filtering tasks
 */

import React from 'react';

export default function SearchBar({ 
  searchText, 
  onSearchChange
}) {
  return (
    <div style={{
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      background: 'white',
      padding: '12px 16px'
    }}>
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Filter tasks by keywords..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid rgba(0, 0, 0, 0.2)',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#007bff';
            e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(0, 0, 0, 0.2)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {searchText && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              padding: '10px 16px',
              fontSize: '12px',
              background: '#f0f0f0',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#666',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#e0e0e0';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#f0f0f0';
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
