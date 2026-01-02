/**
 * View Header component - displays current view title
 */

import React from 'react';
import { getViewTitle } from '../../utils/viewUtils.js';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function ViewHeader({ currentView, projects, tasksByUser, taskCount, completedCount }) {
  const title = getViewTitle(currentView, projects, tasksByUser);

  return (
    <div>
      <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '600' }}>
        {title}
      </h2>
      <div style={{ fontSize: '14px', opacity: 0.7 }}>
        {taskCount} tasks
        {currentView.type === VIEW_TYPES.ALL && completedCount > 0 && ` (${completedCount} completed)`}
      </div>
    </div>
  );
}
