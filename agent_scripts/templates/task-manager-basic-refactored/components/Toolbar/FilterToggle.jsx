/**
 * Filter Toggle component - toggle for showing/hiding completed tasks
 */

import React from 'react';

export default function FilterToggle({ showCompleted, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '10px 16px',
        border: '1px solid rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        background: showCompleted ? '#E3F2FD' : 'white',
        color: showCompleted ? '#1976D2' : '#666',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px'
      }}
    >
      {showCompleted ? '✓ ' : ''}Show Completed
    </button>
  );
}
