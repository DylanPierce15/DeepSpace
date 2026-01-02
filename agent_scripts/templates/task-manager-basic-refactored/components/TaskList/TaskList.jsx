/**
 * Task List component - container for all tasks
 */

import React from 'react';
import TaskItem from './TaskItem.jsx';
import EmptyState from './EmptyState.jsx';
import { isOverdue } from '../../utils/dateUtils.js';

export default function TaskList({
  tasks = [],
  projects = [],
  // Task operations
  onToggleComplete,
  onEdit,
  onDelete,
  onClearCompleted,
  // Drag and drop
  draggedTask,
  dragOverTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  // Comments
  expandedComments,
  onToggleComments,
  getTaskComments,
  currentUser,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onStartEditComment,
  editingCommentId,
  newCommentText,
  setNewCommentText,
  editCommentText,
  setEditCommentText
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Task List */}
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {tasks.map(task => {
            const project = projects?.find(p => p.id === task.projectId);
            const taskIsOverdue = isOverdue(task.dueDate) && !task.completed;
            const isDragging = draggedTask?.id === task.id;
            const isDragOver = dragOverTask?.id === task.id;
            const comments = getTaskComments(task.id);

            return (
              <TaskItem
                key={task.id}
                task={task}
                project={project}
                isOverdue={taskIsOverdue}
                isDragging={isDragging}
                isDragOver={isDragOver}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onToggleComplete={onToggleComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onClearCompleted={onClearCompleted}
                expandedComments={expandedComments}
                onToggleComments={onToggleComments}
                comments={comments}
                currentUser={currentUser}
                onAddComment={onAddComment}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
                onStartEditComment={onStartEditComment}
                editingCommentId={editingCommentId}
                newCommentText={newCommentText}
                setNewCommentText={setNewCommentText}
                editCommentText={editCommentText}
                setEditCommentText={setEditCommentText}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
