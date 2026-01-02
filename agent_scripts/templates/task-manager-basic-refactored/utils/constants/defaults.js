/**
 * Default values and configuration
 */

import { VIEW_TYPES } from './viewTypes.js';

export const DEFAULT_SIDEBAR_WIDTH = 220;
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 400;

export const DEFAULT_UPCOMING_DAYS = 7;

export const DEFAULT_TASK_DATA = {
  projects: [],
  tasks: [],
  comments: []
};

export const DEFAULT_TASK_FORM = {
  name: '',
  description: '',
  dueDate: '',
  assignedUserId: '',
  projectId: '',
  priority: 'medium'
};

export const DEFAULT_SIDEBAR_EXPANDED = {
  projects: false,
  archivedProjects: false,
  upcoming: false,
  users: false
};

export const DEFAULT_FILTERS = {
  showCompleted: true
};

export const DEFAULT_VIEW = { type: VIEW_TYPES.ALL };

// Combined defaults object for convenience
export const DEFAULTS = {
  SIDEBAR_WIDTH: DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  UPCOMING_DAYS: DEFAULT_UPCOMING_DAYS,
  TASK_DATA: DEFAULT_TASK_DATA,
  TASK_FORM: DEFAULT_TASK_FORM,
  SIDEBAR_EXPANDED: DEFAULT_SIDEBAR_EXPANDED,
  FILTERS: DEFAULT_FILTERS,
  VIEW: DEFAULT_VIEW
};
