/**
 * Priority Badge component - displays priority with appropriate color
 */

import React from 'react';
import { getPriorityColor } from '../../utils/priorityUtils.js';

export default function PriorityBadge({ priority }) {
  if (!priority) return null;

  const color = getPriorityColor(priority);

  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: color,
      display: 'inline-block',
      flexShrink: 0
    }} />
  );
}
