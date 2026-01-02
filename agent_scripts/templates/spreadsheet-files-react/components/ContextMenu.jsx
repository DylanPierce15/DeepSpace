import React, { useEffect, useRef } from 'react';

/**
 * ContextMenu - Right-click menu for spreadsheet operations
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay in viewport
  const style = {
    position: 'fixed',
    top: y,
    left: x,
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '180px',
    overflow: 'hidden',
    padding: '4px 0'
  };

  return (
    <div ref={menuRef} style={style}>
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />;
        }
        
        return (
          <button
            key={i}
            onClick={() => { item.action(); onClose(); }}
            disabled={item.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              backgroundColor: 'transparent',
              color: item.danger ? '#dc2626' : (item.disabled ? '#9ca3af' : '#374151'),
              fontSize: '13px',
              textAlign: 'left',
              cursor: item.disabled ? 'default' : 'pointer'
            }}
            onMouseEnter={(e) => !item.disabled && (e.target.style.backgroundColor = '#f3f4f6')}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <span style={{ width: '18px', textAlign: 'center' }}>{item.icon || ''}</span>
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9ca3af' }}>{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

