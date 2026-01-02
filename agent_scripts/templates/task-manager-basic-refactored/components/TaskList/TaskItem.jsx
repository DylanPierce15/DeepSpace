/**
 * Task Item component - individual task card with all functionality
 */

import React from 'react';
import PriorityBadge from '../UI/PriorityBadge.jsx';
import UserAvatar from '../UI/UserAvatar.jsx';
import CommentSection from '../TaskComments/CommentSection.jsx';
import { formatDateLocal } from '../../utils/dateUtils.js';
import { getPriorityColor } from '../../utils/priorityUtils.js';

export default function TaskItem({
  task,
  project,
  isOverdue,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleComplete,
  onEdit,
  onDelete,
  onClearCompleted,
  // Comments props
  expandedComments,
  onToggleComments,
  comments,
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
    <div 
      draggable={!task.completed}
      onDragStart={(e) => onDragStart(e, task)}
      onDragOver={(e) => onDragOver(e, task)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, task)}
      onDragEnd={onDragEnd}
      style={{
        padding: '12px',
        marginBottom: '8px',
        background: task.completed ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.8)',
        borderRadius: '8px',
        border: isDragOver ? '2px solid #2196F3' : '1px solid rgba(0, 0, 0, 0.1)',
        opacity: task.completed ? 0.6 : (isDragging ? 0.5 : 1),
        cursor: task.completed ? 'default' : 'grab',
        transition: 'all 0.2s',
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Drag Handle (only for incomplete tasks) */}
        {!task.completed && (
          <div style={{
            cursor: 'grab',
            color: '#999',
            fontSize: '16px',
            lineHeight: '18px',
            marginTop: '2px',
            userSelect: 'none'
          }}>
            ⋮⋮
          </div>
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggleComplete(task.id)}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            marginTop: '2px',
            flexShrink: 0
          }}
        />

        {/* Task Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: '500',
            textDecoration: task.completed ? 'line-through' : 'none',
            marginBottom: task.description ? '4px' : '0'
          }}>
            {task.name}
          </div>
          
          {task.description && (
            <div style={{
              fontSize: '12px',
              opacity: 0.7,
              marginBottom: '8px',
              lineHeight: '1.4'
            }}>
              {task.description}
            </div>
          )}

          {/* Task Metadata */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '12px',
            marginTop: '8px'
          }}>
            {/* Priority Badge */}
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'rgba(0, 0, 0, 0.05)',
              color: getPriorityColor(task.priority || 'medium'),
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {task.priority || 'medium'}
            </span>

            {/* Project Badge */}
            {project && (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: project.color || '#667eea',
                color: 'white',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                {project.name}
              </span>
            )}

            {/* Due Date */}
            {task.dueDate && (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: isOverdue ? '#ffebee' : 'rgba(0, 0, 0, 0.05)',
                color: isOverdue ? '#c62828' : '#666',
                fontSize: '11px',
                fontWeight: '500'
              }}>
                📅 {formatDateLocal(task.dueDate)}
              </span>
            )}

            {/* Assigned User */}
            {task.assignedUser && (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'rgba(0, 0, 0, 0.05)',
                color: '#666',
                fontSize: '11px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <UserAvatar 
                  userName={task.assignedUser.name} 
                  size={16} 
                  fontSize={9}
                  style={{
                    background: task.assignedUser.isOwner ? '#ff9800' : '#2196f3'
                  }}
                />
                {task.assignedUser.name}
              </span>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && task.tags.map(tag => (
              <span 
                key={tag}
                style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  background: '#007bff',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '500'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {task.completed ? (
            // Show "Clear" button for completed tasks
            <button
              onClick={() => onClearCompleted(task.id)}
              style={{
                padding: '6px 12px',
                border: '1px solid #f44336',
                borderRadius: '6px',
                background: 'white',
                color: '#f44336',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f44336';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#f44336';
              }}
            >
              Clear
            </button>
          ) : (
            // Show Edit, Delete and Comments buttons for incomplete tasks
            <>
              <button
                onClick={() => onToggleComments(task.id)}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: expandedComments === task.id ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: expandedComments === task.id ? '#2196F3' : '#666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = expandedComments === task.id ? 'rgba(33, 150, 243, 0.15)' : 'rgba(0, 0, 0, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = expandedComments === task.id ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              >
                💬
                {comments.length > 0 && (
                  <span>({comments.length})</span>
                )}
              </button>
              <button
                onClick={() => onEdit(task)}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(task)}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'rgba(244, 67, 54, 0.1)',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Comments Section */}
      {expandedComments === task.id && (
        <CommentSection
          taskId={task.id}
          comments={comments}
          currentUser={currentUser}
          onAddComment={onAddComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          onStartEditComment={onStartEditComment}
          onToggleComments={onToggleComments}
          editingCommentId={editingCommentId}
          newCommentText={newCommentText}
          setNewCommentText={setNewCommentText}
          editCommentText={editCommentText}
          setEditCommentText={setEditCommentText}
        />
      )}
    </div>
  );
}
