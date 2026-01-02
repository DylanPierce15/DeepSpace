/**
 * Comment Form component - for adding new comments
 */

import React from 'react';

export default function CommentForm({
  value,
  onChange,
  onSubmit,
  disabled = false
}) {
  return (
    <div style={{
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      paddingTop: '12px'
    }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="💬 Add a comment..."
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'inherit',
          resize: 'vertical',
          minHeight: '60px',
          boxSizing: 'border-box',
          marginBottom: '8px'
        }}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          background: value.trim() ? '#2196F3' : '#ccc',
          color: 'white',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          fontSize: '12px',
          fontWeight: '500'
        }}
      >
        Add Comment
      </button>
    </div>
  );
}
