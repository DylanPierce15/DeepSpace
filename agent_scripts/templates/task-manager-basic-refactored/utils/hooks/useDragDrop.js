/**
 * Hook for drag and drop task reordering
 */

import { useState } from 'react';
import { DEFAULT_TASK_DATA } from '../constants/defaults.js';

export function useDragDrop(currentUser) {
  const [taskData, setTaskData] = useGlobalStorage('tasks', DEFAULT_TASK_DATA);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTask, setDragOverTask] = useState(null);

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, task) => {
    e.preventDefault();
    setDragOverTask(task);
  };

  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  const handleDrop = (e, dropTarget) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.id === dropTarget.id) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }

    const tasks = taskData?.tasks || [];
    const draggedIndex = tasks.findIndex(t => t.id === draggedTask.id);
    const dropIndex = tasks.findIndex(t => t.id === dropTarget.id);

    if (draggedIndex === -1 || dropIndex === -1) return;

    // Reorder tasks
    const reorderedTasks = [...tasks];
    const [removed] = reorderedTasks.splice(draggedIndex, 1);
    reorderedTasks.splice(dropIndex, 0, removed);

    // Update order field
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      order: index
    }));

    setTaskData({ ...taskData, tasks: updatedTasks });

    // Log the reorder
    const userName = currentUser?.name || 'Unknown User';
    if (typeof window !== 'undefined' && window.miyagiWidgetLog) {
      window.miyagiWidgetLog.addEvent('task-reordered', `${userName} reordered task "${draggedTask.name}"`, {
        taskId: draggedTask.id,
        taskName: draggedTask.name,
        fromIndex: draggedIndex,
        toIndex: dropIndex,
        reorderedBy: userName,
        reorderedByUserId: currentUser?.id || null
      });
    }

    setDraggedTask(null);
    setDragOverTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverTask(null);
  };

  return {
    draggedTask,
    dragOverTask,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  };
}
