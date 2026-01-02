/**
 * Priority-related utility functions
 */

import { PRIORITY_COLORS, PRIORITY_LEVELS } from './constants/priorities.js';

/**
 * Get color for a given priority level
 */
export function getPriorityColor(priority) {
  switch (priority) {
    case PRIORITY_LEVELS.HIGH:
      return PRIORITY_COLORS[PRIORITY_LEVELS.HIGH];
    case PRIORITY_LEVELS.MEDIUM:
      return PRIORITY_COLORS[PRIORITY_LEVELS.MEDIUM];
    case PRIORITY_LEVELS.LOW:
      return PRIORITY_COLORS[PRIORITY_LEVELS.LOW];
    default:
      return PRIORITY_COLORS[PRIORITY_LEVELS.MEDIUM];
  }
}
