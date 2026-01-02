/**
 * View-related utility functions
 */

import { VIEW_TYPES } from './constants/viewTypes.js';

/**
 * Get the display title for the current view
 */
export function getViewTitle(currentView, projects, users) {
  switch (currentView.type) {
    case VIEW_TYPES.ALL:
      return 'All Tasks';
    
    case VIEW_TYPES.PROJECT:
      if (currentView.id) {
        const project = projects?.find(p => p.id === currentView.id);
        return project ? `${project.name}` : 'Project Tasks';
      }
      return 'Project Tasks';
    
    case VIEW_TYPES.UPCOMING:
      return 'Upcoming Tasks';
    
    case VIEW_TYPES.USER:
      if (currentView.id) {
        const userTasks = users?.[currentView.id];
        return userTasks?.user?.name 
          ? `${userTasks.user.name}'s Tasks`
          : 'User Tasks';
      }
      if (currentView.filter === 'unassigned') {
        return 'Unassigned Tasks';
      }
      return 'User Tasks';
    
    case VIEW_TYPES.COMPLETED:
      return 'Completed Tasks';
    
    default:
      return 'Tasks';
  }
}
