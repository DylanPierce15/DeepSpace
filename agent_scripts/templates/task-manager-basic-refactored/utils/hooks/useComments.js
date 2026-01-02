/**
 * Hook for task comments management
 */

import { useState } from 'react';
import { 
  logCommentAdded, 
  logCommentUpdated, 
  logCommentDeleted 
} from '../logging.js';
import { DEFAULT_TASK_DATA } from '../constants/defaults.js';

export function useComments(currentUser) {
  const [taskData, setTaskData] = useGlobalStorage('tasks', DEFAULT_TASK_DATA);
  
  const [expandedTaskComments, setExpandedTaskComments] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [editCommentText, setEditCommentText] = useState('');

  // Get comments for a specific task
  const getTaskComments = (taskId) => {
    return (taskData?.comments || [])
      .filter(comment => comment.taskId === taskId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  // Add comment
  const addComment = (taskId) => {
    if (!newCommentText.trim()) return;

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;

    const newComment = {
      id: `comment-${Date.now()}`,
      taskId,
      userId,
      userName,
      text: newCommentText.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false
    };

    setTaskData({
      ...taskData,
      comments: [...(taskData?.comments || []), newComment]
    });

    const task = (taskData?.tasks || []).find(t => t.id === taskId);
    const taskName = task?.name || 'Unknown Task';
    logCommentAdded(taskName, userName, userId, newComment.id, taskId);

    setNewCommentText('');
  };

  // Update comment
  const updateComment = (commentId) => {
    if (!editCommentText.trim()) return;

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;

    const updatedComments = (taskData?.comments || []).map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            text: editCommentText.trim(),
            updatedAt: new Date().toISOString()
          }
        : comment
    );

    setTaskData({ ...taskData, comments: updatedComments });

    const comment = (taskData?.comments || []).find(c => c.id === commentId);
    const task = (taskData?.tasks || []).find(t => t.id === comment?.taskId);
    const taskName = task?.name || 'Unknown Task';
    logCommentUpdated(taskName, userName, userId, commentId, comment?.taskId);

    setEditingCommentId(null);
    setEditCommentText('');
  };

  // Delete comment (soft delete)
  const deleteComment = (commentId) => {
    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;

    const updatedComments = (taskData?.comments || []).map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            deleted: true,
            text: '[Comment deleted]',
            updatedAt: new Date().toISOString()
          }
        : comment
    );

    setTaskData({ ...taskData, comments: updatedComments });

    const comment = (taskData?.comments || []).find(c => c.id === commentId);
    const task = (taskData?.tasks || []).find(t => t.id === comment?.taskId);
    const taskName = task?.name || 'Unknown Task';
    logCommentDeleted(taskName, userName, userId, commentId, comment?.taskId);
  };

  // Start editing comment
  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
  };

  // Toggle comments section
  const toggleComments = (taskId) => {
    if (expandedTaskComments === taskId) {
      setExpandedTaskComments(null);
      setEditingCommentId(null);
      setEditCommentText('');
      setNewCommentText('');
    } else {
      setExpandedTaskComments(taskId);
    }
  };

  return {
    comments: taskData?.comments || [],
    expandedTaskComments,
    setExpandedTaskComments,
    editingCommentId,
    newCommentText,
    setNewCommentText,
    editCommentText,
    setEditCommentText,
    getTaskComments,
    addComment,
    updateComment,
    deleteComment,
    startEditingComment,
    toggleComments
  };
}
