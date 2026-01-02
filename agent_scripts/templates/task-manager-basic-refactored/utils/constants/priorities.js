/**
 * Task priority levels and their visual representations
 */

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

// Alias for compatibility
export const PRIORITIES = PRIORITY_LEVELS;

export const PRIORITY_COLORS = {
  [PRIORITY_LEVELS.LOW]: '#4CAF50',    // Green
  [PRIORITY_LEVELS.MEDIUM]: '#FF9800', // Orange
  [PRIORITY_LEVELS.HIGH]: '#f44336'    // Red
};

export const PRIORITY_LABELS = {
  [PRIORITY_LEVELS.LOW]: 'Low',
  [PRIORITY_LEVELS.MEDIUM]: 'Medium',
  [PRIORITY_LEVELS.HIGH]: 'High'
};

export const DEFAULT_PRIORITY = PRIORITY_LEVELS.MEDIUM;
