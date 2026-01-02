/**
 * Hook for task CRUD operations
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { DEFAULT_TASK_DATA, DEFAULT_TASK_FORM } from '../constants/defaults.js';
import { 
  logTaskCreated, 
  logTaskUpdated, 
  logTaskDeleted, 
  logTaskCompleted,
  logTasksCleared,
  logCompletedTaskCleared,
  logTaskSorted
} from '../logging.js';
import { sortByPriority, sortByDueDate } from '../taskFilters.js';

export function useTaskData(currentUser) {
  const [taskData, setTaskData] = useGlobalStorage('tasks', DEFAULT_TASK_DATA);
  const taskDataRef = useRef(taskData);
  
  // Get roomId from widget config stored in widget-specific storage
  // useStorage is injected by the widget runtime
  const [widgetConfigStorage] = useStorage('__widget_config', null);
  const roomId = useMemo(() => {
    try {
      if (widgetConfigStorage) {
        const config = typeof widgetConfigStorage === 'string' ? JSON.parse(widgetConfigStorage) : widgetConfigStorage;
        if (config?.roomId) {
          console.log('✅ Found roomId from widget config:', config.roomId);
          return config.roomId;
        }
      }
      // Fallback: try window.miyagiWidgetConfig
      if (typeof window !== 'undefined' && window.miyagiWidgetConfig?.roomId) {
        console.log('✅ Found roomId from window.miyagiWidgetConfig:', window.miyagiWidgetConfig.roomId);
        return window.miyagiWidgetConfig.roomId;
      }
      console.warn('⚠️ Could not find roomId in widget config. widgetConfigStorage:', widgetConfigStorage);
    } catch (err) {
      console.error('❌ Error reading widget config:', err);
    }
    return null;
  }, [widgetConfigStorage]);

  // Task form state
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
  const [editingTask, setEditingTask] = useState(null);
  
  // Modal states
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [showClearCompletedModal, setShowClearCompletedModal] = useState(false);

  // Update ref whenever taskData changes
  useEffect(() => {
    taskDataRef.current = taskData;
  }, [taskData]);

  // Helper: notify assigned user (best-effort)
  const sendAssignmentNotification = async (assignee, taskName, projectId, taskId = null) => {
    try {
      const clerkId = assignee?.clerkUserId || assignee?.id
      if (!clerkId) return
      // Include timestamp in dedupe key so reassignments after unassignment create new notifications
      await miyagiAPI.post('/api/notifications', {
        type: 'task.assigned',
        payload: {
          title: 'You were assigned a task',
          message: `${currentUser?.name || 'Someone'} assigned you "${taskName}"`,
          taskName,
          projectId: projectId || null,
          canvasId: roomId,
          occurredAt: new Date().toISOString(),
        },
        recipientClerkUserIds: [clerkId],
        actorClerkUserId: currentUser?.id || null,
        dedupeKeyPrefix: `${projectId ? `task:${projectId}:${taskName}` : `task:${taskName}`}:${Date.now()}`,
      })
    } catch (_) {
      // ignore
    }
  }

  // Helper: notify previous assignee on unassign (best-effort)
  const sendUnassignmentNotification = async (prevAssignee, taskName, projectId) => {
    try {
      const clerkId = prevAssignee?.clerkUserId || prevAssignee?.id
      if (!clerkId) return
      await miyagiAPI.post('/api/notifications', {
        type: 'task.unassigned',
        payload: {
          title: 'You were unassigned from a task',
          message: `${currentUser?.name || 'Someone'} unassigned you from "${taskName}"`,
          taskName,
          projectId: projectId || null,
          canvasId: roomId,
          occurredAt: new Date().toISOString(),
        },
        recipientClerkUserIds: [clerkId],
        actorClerkUserId: currentUser?.id || null,
        // Include timestamp like assignments so repeated unassignments persist
        dedupeKeyPrefix: `${projectId ? `task:${projectId}:${taskName}` : `task:${taskName}`}:${Date.now()}`,
      })
    } catch (_) {
      // ignore
    }
  }

  // Stats
  const totalTasks = taskData?.tasks?.length || 0;
  const completedTasks = taskData?.tasks?.filter(task => task.completed).length || 0;
  const completedTasksList = useMemo(() => 
    (taskData?.tasks || []).filter(task => task.completed),
    [taskData?.tasks]
  );

  // Open add task modal
  const openAddTaskModal = (projectId = null) => {
    setTaskForm({
      ...DEFAULT_TASK_FORM,
      projectId: projectId || ''
    });
    setEditingTask(null);
    setShowAddTaskModal(true);
  };

  // Open edit task modal
  const openEditTaskModal = (task) => {
    setTaskForm({
      name: task.name || '',
      description: task.description || '',
      dueDate: task.dueDate || '',
      assignedUserId: task.assignedUser?.id || '',
      projectId: task.projectId || '',
      priority: task.priority || 'medium'
    });
    setEditingTask(task);
    setShowAddTaskModal(true);
  };

  // Save task (create or update)
  const saveTask = (canvasUsers) => {
    if (!taskForm.name.trim()) return;

    const assignedUser = taskForm.assignedUserId 
      ? canvasUsers.find(u => u.id === taskForm.assignedUserId) 
      : null;

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;

    if (editingTask) {
      // Update existing task
      const updatedTask = {
        ...editingTask,
        name: taskForm.name,
        description: taskForm.description,
        dueDate: taskForm.dueDate,
        assignedUser: assignedUser,
        projectId: taskForm.projectId,
        priority: taskForm.priority,
        tags: taskForm.tags || [],
        updatedAt: new Date().toISOString()
      };

      const updatedTasks = (taskData?.tasks || []).map(task =>
        task.id === editingTask.id ? updatedTask : task
      );

      setTaskData({ ...taskData, tasks: updatedTasks });
      logTaskUpdated(taskForm.name, userName, userId, {
        taskId: editingTask.id,
        changes: {
          name: taskForm.name,
          description: taskForm.description,
          dueDate: taskForm.dueDate,
          assignedUser: assignedUser?.name || null,
          projectId: taskForm.projectId,
          priority: taskForm.priority
        }
      });
      // Notify assignee if present and changed or still assigned
      if (assignedUser?.id || assignedUser?.clerkUserId) {
        void sendAssignmentNotification(assignedUser, taskForm.name, taskForm.projectId, editingTask?.id)
      }
    } else {
      // Create new task
      const maxOrder = Math.max(
        0,
        ...(taskData?.tasks || []).map(t => t.order ?? 0)
      );

      const newTask = {
        id: `task-${Date.now()}`,
        name: taskForm.name,
        description: taskForm.description,
        dueDate: taskForm.dueDate,
        assignedUser: assignedUser,
        projectId: taskForm.projectId,
        completed: false,
        completedAt: null,
        order: maxOrder + 1,
        priority: taskForm.priority || 'medium',
        tags: taskForm.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setTaskData({
        ...taskData,
        tasks: [...(taskData?.tasks || []), newTask]
      });

      logTaskCreated(taskForm.name, userName, userId, {
        taskId: newTask.id,
        projectId: taskForm.projectId,
        assignedUser: assignedUser?.name || null,
        dueDate: taskForm.dueDate,
        priority: taskForm.priority
      });
      // Notify assignee on create
      if (assignedUser?.id || assignedUser?.clerkUserId) {
        void sendAssignmentNotification(assignedUser, taskForm.name, taskForm.projectId, newTask.id)
      }
    }

    setShowAddTaskModal(false);
    setTaskForm(DEFAULT_TASK_FORM);
    setEditingTask(null);
  };

  // Toggle task completion
  const toggleTaskCompletion = (taskId) => {
    const task = (taskData?.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    const newCompletedState = !task.completed;
    
    // If marking incomplete, give it a new order to appear at top
    let newOrder = task.order;
    if (!newCompletedState && task.completed) {
      // Find the minimum order among incomplete tasks
      const incompleteTasks = (taskData?.tasks || []).filter(t => !t.completed && t.id !== taskId);
      const minOrder = incompleteTasks.length > 0 
        ? Math.min(...incompleteTasks.map(t => t.order ?? new Date(t.createdAt).getTime()))
        : Date.now();
      // Set order to be less than the minimum (so it appears first)
      newOrder = minOrder - 1;
    }
    
    const updatedTask = {
      ...task,
      completed: newCompletedState,
      completedAt: newCompletedState ? new Date().toISOString() : null,
      order: newOrder,
      updatedAt: new Date().toISOString()
    };

    const updatedTasks = (taskData?.tasks || []).map(t =>
      t.id === taskId ? updatedTask : t
    );

    setTaskData({ ...taskData, tasks: updatedTasks });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logTaskCompleted(task.name, updatedTask.completed, userName, userId, taskId);
  };

  // Delete task
  const deleteTask = (taskId) => {
    const task = (taskData?.tasks || []).find(t => t.id === taskId);
    if (task) {
      setTaskToDelete(task);
      setShowDeleteTaskModal(true);
    }
  };

  // Confirm delete task
  const confirmDeleteTask = () => {
    if (!taskToDelete) return;

    const updatedTasks = (taskData?.tasks || []).filter(t => t.id !== taskToDelete.id);
    setTaskData({ ...taskData, tasks: updatedTasks });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logTaskDeleted(taskToDelete.name, userName, userId, taskToDelete.id);

    setShowDeleteTaskModal(false);
    setTaskToDelete(null);
  };

  // Clear all completed tasks
  const clearCompletedTasks = () => {
    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    const completedCount = completedTasksList.length;

    setTaskData({
      ...taskData,
      tasks: (taskData?.tasks || []).filter(task => !task.completed)
    });

    logTasksCleared(completedCount, userName, userId);
    setShowClearCompletedModal(false);
  };

  // Clear single completed task
  const clearSingleCompletedTask = (taskId) => {
    const task = (taskData?.tasks || []).find(t => t.id === taskId);
    if (!task || !task.completed) return;

    const updatedTasks = (taskData?.tasks || []).filter(t => t.id !== taskId);
    setTaskData({ ...taskData, tasks: updatedTasks });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logCompletedTaskCleared(task.name, userName, userId, taskId);
  };

  // Sort tasks - updates order field to persist sort
  const sortTasksBy = (sortType, direction = 'asc') => {
    const allTasks = taskData?.tasks || [];
    const incompleteTasks = allTasks.filter(t => !t.completed);
    
    // Create sorted array based on sort type
    let sortedTasks = [...incompleteTasks];
    
    if (sortType === 'dueDate') {
      sortedTasks.sort((a, b) => {
        // No due date goes to bottom
        if (!a.dueDate && !b.dueDate) return a.id.localeCompare(b.id);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        
        const dateCompare = a.dueDate.localeCompare(b.dueDate);
        if (dateCompare !== 0) {
          return direction === 'asc' ? dateCompare : -dateCompare;
        }
        
        return a.id.localeCompare(b.id);
      });
    } else if (sortType === 'priority') {
      sortedTasks.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const aPriority = priorityOrder[a.priority || 'medium'];
        const bPriority = priorityOrder[b.priority || 'medium'];
        
        if (aPriority !== bPriority) {
          return direction === 'asc' ? (aPriority - bPriority) : (bPriority - aPriority);
        }
        
        return a.id.localeCompare(b.id);
      });
    } else {
      return;
    }
    
    // Update order field for sorted tasks
    const updatedTasks = allTasks.map(task => {
      const sortedIndex = sortedTasks.findIndex(t => t.id === task.id);
      if (sortedIndex !== -1) {
        // This is one of the tasks we sorted
        return { ...task, order: sortedIndex + 1 };
      }
      // Keep other tasks (completed, from other views) as is
      return task;
    });
    
    setTaskData({ ...taskData, tasks: updatedTasks });
    
    const userName = currentUser?.name || 'Unknown User';
    logTaskSorted(sortType, sortedTasks.length, userName);
  };

  return {
    tasks: taskData?.tasks || [],
    addTask: (taskDetails) => {
      const userName = currentUser?.name || 'Unknown User';
      const userId = currentUser?.id || null;
      
      // Get max order from existing tasks
      const maxOrder = Math.max(
        0,
        ...(taskData?.tasks || []).map(t => t.order ?? 0)
      );
      
      const newTask = {
        id: `task-${Date.now()}`,
        name: taskDetails.name,
        description: taskDetails.description || '',
        priority: taskDetails.priority || 'medium',
        dueDate: taskDetails.dueDate || '',
        assignedUser: taskDetails.assignedUser || null,
        projectId: taskDetails.projectId || '',
        tags: taskDetails.tags || [],
        completed: false,
        completedAt: null,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const updatedTasks = [...(taskData?.tasks || []), newTask];
      setTaskData({ ...taskData, tasks: updatedTasks });
      
      logTaskCreated(newTask.name, userName, userId, { taskId: newTask.id });
      // Notify assignee on create
      if (newTask.assignedUser) {
        void sendAssignmentNotification(newTask.assignedUser, newTask.name, newTask.projectId, newTask.id)
      }
    },
    updateTask: (taskId, updates) => {
      const userName = currentUser?.name || 'Unknown User';
      const userId = currentUser?.id || null;
      
      const taskUpdates = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      let previousTask = null
      const updatedTasks = (taskData?.tasks || []).map(task => {
        if (task.id === taskId) {
          previousTask = task
          return { ...task, ...taskUpdates }
        }
        return task
      });
      setTaskData({ ...taskData, tasks: updatedTasks });
      
      logTaskUpdated(taskUpdates.name || 'Task', userName, userId, { taskId });
      // Notify on assignment changes only when assignedUser was explicitly updated
      const assignmentUpdated = Object.prototype.hasOwnProperty.call(updates || {}, 'assignedUser')
      if (assignmentUpdated) {
        const prevAssignee = previousTask?.assignedUser || null
        const nextAssignee = updates?.assignedUser || null
        const prevAssigneeId = prevAssignee?.clerkUserId || prevAssignee?.id || null
        const nextAssigneeId = nextAssignee?.clerkUserId || nextAssignee?.id || null
        const taskNameForMsg = updates?.name || previousTask?.name
        const projectIdForMsg = updates?.projectId || previousTask?.projectId

        // If changed to a new assignee, notify the new assignee
        if (nextAssigneeId && nextAssigneeId !== prevAssigneeId) {
          void sendAssignmentNotification(nextAssignee, taskNameForMsg, projectIdForMsg, previousTask?.id)
        }
        // If previously assigned and now different or removed, notify unassignment to previous
        if (prevAssigneeId && prevAssigneeId !== nextAssigneeId) {
          void sendUnassignmentNotification(prevAssignee, taskNameForMsg, projectIdForMsg)
        }
      }
    },
    deleteTask: (taskId) => {
      const userName = currentUser?.name || 'Unknown User';
      const userId = currentUser?.id || null;
      
      const task = (taskData?.tasks || []).find(t => t.id === taskId);
      if (!task) return;
      
      const updatedTasks = (taskData?.tasks || []).filter(t => t.id !== taskId);
      setTaskData({ ...taskData, tasks: updatedTasks });
      
      logTaskDeleted(task.name, userName, userId, taskId);
    },
    toggleTaskCompletion,
    reorderTasks: (reorderedTasks) => {
      setTaskData({ ...taskData, tasks: reorderedTasks });
    },
    clearCompletedTasks,
    // Legacy exports for backward compatibility
    taskData,
    setTaskData,
    taskDataRef,
    taskForm,
    setTaskForm,
    editingTask,
    totalTasks,
    completedTasks,
    completedTasksList,
    showAddTaskModal,
    setShowAddTaskModal,
    showDeleteTaskModal,
    setShowDeleteTaskModal,
    showClearCompletedModal,
    setShowClearCompletedModal,
    taskToDelete,
    openAddTaskModal,
    openEditTaskModal,
    saveTask,
    confirmDeleteTask,
    clearSingleCompletedTask,
    sortTasksBy
  };
}
