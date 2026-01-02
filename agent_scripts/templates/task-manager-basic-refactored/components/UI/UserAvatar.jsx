/**
 * User Avatar component - displays user initial in a colored circle
 */

import React from 'react';

export default function UserAvatar({ 
  userName, 
  size = 24, 
  fontSize = 12,
  style = {} 
}) {
  const initial = userName ? userName.charAt(0).toUpperCase() : '?';

  return (
    <span style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: '#2196f3',
      color: 'white',
      fontSize: `${fontSize}px`,
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style
    }}>
      {initial}
    </span>
  );
}
