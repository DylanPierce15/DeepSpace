/**
 * Task filtering and sorting utilities
 */

import { isUpcoming } from './dateUtils.js';

/**
 * Sort tasks by priority (high -> medium -> low)
 */
export function sortByPriority(tasks) {
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  
  return [...tasks].sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 2;
    const bPriority = priorityOrder[b.priority] || 2;
    return bPriority - aPriority;
  });
}

/**
 * Sort tasks by due date (earliest first)
 */
export function sortByDueDate(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    
    // Parse dates as local to avoid timezone issues
    const [yearA, monthA, dayA] = a.dueDate.split('-').map(num => parseInt(num, 10));
    const dateA = new Date(yearA, monthA - 1, dayA);
    
    const [yearB, monthB, dayB] = b.dueDate.split('-').map(num => parseInt(num, 10));
    const dateB = new Date(yearB, monthB - 1, dayB);
    
    return dateA - dateB;
  });
}

/**
 * Sort tasks by order field
 */
export function sortByOrder(tasks) {
  return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Filter tasks by completion status
 */
export function filterByCompletion(tasks, showCompleted) {
  if (showCompleted) return tasks;
  return tasks.filter(task => !task.completed);
}

/**
 * Get tasks for a specific project
 */
export function filterByProject(tasks, projectId) {
  return tasks.filter(task => task.projectId === projectId);
}

/**
 * Get upcoming tasks (within specified days)
 */
export function filterUpcomingTasks(tasks, daysAhead) {
  return tasks.filter(task => {
    if (task.completed) return false;
    return task.dueDate && isUpcoming(task.dueDate, daysAhead);
  });
}

/**
 * Get tasks assigned to a specific user
 */
export function filterByUser(tasks, userId) {
  return tasks.filter(task => task.assignedUser && task.assignedUser.id === userId);
}

/**
 * Get completed tasks
 */
export function filterCompletedTasks(tasks) {
  return tasks.filter(task => task.completed);
}

/**
 * Get unassigned tasks
 */
export function filterUnassignedTasks(tasks) {
  return tasks.filter(task => !task.assignedUser);
}
