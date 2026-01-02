import React from 'react';

/**
 * FormulaBar - Cell reference display and value editor
 */
const FormulaBar = React.forwardRef(function FormulaBar({
  cellRef,
  value,
  onChange,
  onKeyDown,
  onFocus
}, ref) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '6px 10px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      gap: '10px',
      flexShrink: 0
    }}>
      <div style={{
        padding: '4px 10px',
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        color: '#374151',
        minWidth: '50px',
        textAlign: 'center'
      }}>
        {cellRef}
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{
          flex: 1,
          padding: '6px 10px',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          fontSize: '13px',
          outline: 'none',
          backgroundColor: '#fff'
        }}
      />
    </div>
  );
});

export default FormulaBar;

