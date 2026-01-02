import React from 'react';

export default function SearchBar({ searchQuery, onSearchChange }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{ position: 'relative' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#9ca3af',
            pointerEvents: 'none'
          }}
        >
          <path
            d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM13.5 12.5l-2.5-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 36px 8px 36px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: 'white',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
        
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M9 3L3 9M3 3l6 6"
                stroke="#9ca3af"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
