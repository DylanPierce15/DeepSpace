/**
 * Comment Section component - container for all comments on a task
 */

import React from 'react';
import Comment from './Comment.jsx';
import CommentForm from './CommentForm.jsx';

export default function CommentSection({
  taskId,
  comments = [],
  currentUser,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onStartEditComment,
  onToggleComments,
  editingCommentId,
  newCommentText = '',
  setNewCommentText,
  editCommentText = '',
  setEditCommentText
}) {
  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      background: 'rgba(0, 0, 0, 0.02)',
      borderRadius: '6px',
      border: '1px solid rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
      }}>
        <span style={{ fontWeight: '600', fontSize: '13px' }}>Comments</span>
        <button
          onClick={() => onToggleComments(taskId)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#999',
            padding: '0',
            lineHeight: '1'
          }}
        >
          ✕
        </button>
      </div>

      {/* Comments List */}
      <div style={{ marginBottom: '12px' }}>
        {comments.length === 0 ? (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            color: '#999',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            No comments yet
          </div>
        ) : (
          comments.map(comment => (
            <Comment
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              isEditing={editingCommentId === comment.id}
              editText={editCommentText}
              onEditTextChange={setEditCommentText}
              onSave={() => onUpdateComment(comment.id)}
              onCancelEdit={() => {
                setEditCommentText('');
                onStartEditComment(null);
              }}
              onStartEdit={() => onStartEditComment(comment)}
              onDelete={() => onDeleteComment(comment.id)}
            />
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <CommentForm
        value={newCommentText}
        onChange={setNewCommentText}
        onSubmit={() => onAddComment(taskId)}
      />
    </div>
  );
}
