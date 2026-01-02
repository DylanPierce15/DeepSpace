/**
 * Resize Handle component - draggable handle for sidebar resizing
 */

import React from 'react';

export default function ResizeHandle({ onResizeStart, isResizing }) {
  return (
    <div
      onMouseDown={onResizeStart}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '5px',
        cursor: 'col-resize',
        zIndex: 10,
        background: isResizing ? 'rgba(33, 150, 243, 0.3)' : 'transparent',
        transition: isResizing ? 'none' : 'background 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!isResizing) {
          e.currentTarget.style.background = 'rgba(33, 150, 243, 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isResizing) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    />
  );
}
