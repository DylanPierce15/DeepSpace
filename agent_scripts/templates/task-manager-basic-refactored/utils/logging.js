/**
 * Logging utilities for task manager events
 */

/**
 * Log a task manager event
 */
export function logEvent(type, summary, details = {}) {
  console.log('🔍 logEvent called:', { type, summary, details });
  console.log('🔍 window.miyagiWidgetLog exists?', typeof window !== 'undefined' && !!window.miyagiWidgetLog);
  
  if (typeof window !== 'undefined' && window.miyagiWidgetLog) {
    console.log('🔍 Calling window.miyagiWidgetLog.addEvent');
    window.miyagiWidgetLog.addEvent(type, summary, details);
  } else {
    console.warn('⚠️ miyagiWidgetLog not available!');
  }
}

/**
 * Log task creation
 */
export function logTaskCreated(taskName, userName, userId, details = {}) {
  logEvent('task-created', `${userName} created task "${taskName}"`, {
    taskName,
    createdBy: userName,
    createdByUserId: userId,
    ...details
  });
}

/**
 * Log task update
 */
export function logTaskUpdated(taskName, userName, userId, details = {}) {
  logEvent('task-updated', `${userName} updated task "${taskName}"`, {
    taskName,
    updatedBy: userName,
    updatedByUserId: userId,
    ...details
  });
}

/**
 * Log task deletion
 */
export function logTaskDeleted(taskName, userName, userId, taskId) {
  logEvent('task-deleted', `${userName} deleted task "${taskName}"`, {
    taskId,
    taskName,
    deletedBy: userName,
    deletedByUserId: userId
  });
}

/**
 * Log task completion toggle
 */
export function logTaskCompleted(taskName, completed, userName, userId, taskId) {
  const action = completed ? 'completed' : 'uncompleted';
  logEvent(`task-${action}`, `${userName} ${action} task "${taskName}"`, {
    taskId,
    taskName,
    completed,
    completedBy: userName,
    completedByUserId: userId
  });
}

/**
 * Log project creation
 */
export function logProjectCreated(projectName, userName, userId, projectId) {
  logEvent('project-created', `${userName} created project "${projectName}"`, {
    projectId,
    projectName,
    createdBy: userName,
    createdByUserId: userId
  });
}

/**
 * Log project update
 */
export function logProjectRenamed(projectId, newName, userName, userId) {
  logEvent('project-renamed', `${userName} renamed project to "${newName}"`, {
    projectId,
    newName,
    renamedBy: userName,
    renamedByUserId: userId
  });
}

/**
 * Log project deletion
 */
export function logProjectDeleted(projectName, userName, userId, projectId) {
  logEvent('project-archived', `${userName} archived project "${projectName}"`, {
    projectId,
    projectName,
    archivedBy: userName,
    archivedByUserId: userId
  });
}

/**
 * Log project unarchive
 */
export function logProjectUnarchived(projectName, userName, userId, projectId) {
  logEvent('project-unarchived', `${userName} unarchived project "${projectName}"`, {
    projectId,
    projectName,
    unarchivedBy: userName,
    unarchivedByUserId: userId
  });
}

/**
 * Log comment added
 */
export function logCommentAdded(taskName, userName, userId, commentId, taskId) {
  logEvent('comment-added', `${userName} commented on "${taskName}"`, {
    commentId,
    taskId,
    taskName,
    commentedBy: userName,
    commentedByUserId: userId
  });
}

/**
 * Log comment updated
 */
export function logCommentUpdated(taskName, userName, userId, commentId, taskId) {
  logEvent('comment-updated', `${userName} updated their comment on "${taskName}"`, {
    commentId,
    taskId,
    taskName,
    updatedBy: userName,
    updatedByUserId: userId
  });
}

/**
 * Log comment deleted
 */
export function logCommentDeleted(taskName, userName, userId, commentId, taskId) {
  logEvent('comment-deleted', `${userName} deleted their comment on "${taskName}"`, {
    commentId,
    taskId,
    taskName,
    deletedBy: userName,
    deletedByUserId: userId
  });
}

/**
 * Log task from idea
 */
export function logTaskFromIdea(taskName, ideaText, userName, userId, taskId, ideaId) {
  logEvent('task-from-idea', `${userName} created task from idea: "${ideaText}"`, {
    taskId,
    taskName,
    ideaId,
    ideaText,
    createdBy: userName,
    createdByUserId: userId
  });
}

/**
 * Log bulk clear completed tasks
 */
export function logTasksCleared(count, userName, userId) {
  logEvent('tasks-cleared', `${userName} cleared ${count} completed tasks`, {
    tasksCleared: count,
    clearedBy: userName,
    clearedByUserId: userId
  });
}

/**
 * Log single completed task cleared
 */
export function logCompletedTaskCleared(taskName, userName, userId, taskId) {
  logEvent('completed-task-cleared', `${userName} cleared completed task "${taskName}"`, {
    taskId,
    taskName,
    clearedBy: userName,
    clearedByUserId: userId
  });
}

/**
 * Log tasks sorted
 */
export function logTaskSorted(sortType, taskCount, userName) {
  logEvent('tasks-sorted', `${userName} sorted ${taskCount} tasks by ${sortType}`, {
    sortType,
    taskCount,
    sortedBy: userName
  });
}
