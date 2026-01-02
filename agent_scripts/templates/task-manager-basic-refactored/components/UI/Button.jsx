/**
 * Reusable Button component
 */

import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  variant = 'default',
  disabled = false,
  style = {},
  ...props 
}) {
  const baseStyle = {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'all 0.2s',
    opacity: disabled ? 0.6 : 1,
    ...style
  };

  const variants = {
    default: {
      border: '1px solid rgba(0, 0, 0, 0.2)',
      background: 'white',
      color: '#666'
    },
    primary: {
      background: '#2196F3',
      color: 'white'
    },
    danger: {
      background: 'rgba(244, 67, 54, 0.1)',
      color: '#f44336'
    },
    success: {
      background: '#4CAF50',
      color: 'white'
    }
  };

  const variantStyle = variants[variant] || variants.default;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...variantStyle }}
      onMouseEnter={(e) => {
        if (!disabled) {
          if (variant === 'default') {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
          } else if (variant === 'danger') {
            e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = variantStyle.background;
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
