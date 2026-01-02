/**
 * Individual Comment component
 */

import React from 'react';
import UserAvatar from '../UI/UserAvatar.jsx';

export default function Comment({
  comment,
  currentUser,
  isEditing,
  editText,
  onEditTextChange,
  onSave,
  onCancelEdit,
  onStartEdit,
  onDelete
}) {
  const isOwnComment = comment.userId === currentUser?.id;
  const isEdited = comment.updatedAt !== comment.createdAt && !comment.deleted;

  return (
    <div
      style={{
        padding: '10px',
        marginBottom: '8px',
        background: comment.deleted ? 'rgba(0, 0, 0, 0.02)' : 'white',
        borderRadius: '4px',
        border: '1px solid rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Comment Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px'
      }}>
        <UserAvatar userName={comment.userName} size={20} fontSize={10} />
        <span style={{ fontWeight: '600', fontSize: '12px' }}>
          {comment.userName}
        </span>
        <span style={{ fontSize: '11px', color: '#999' }}>
          {new Date(comment.createdAt).toLocaleString()}
          {isEdited && ' (edited)'}
        </span>
      </div>

      {/* Comment Body */}
      {isEditing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '60px',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={onSave}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '4px',
                background: '#2196F3',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              style={{
                padding: '6px 12px',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                background: 'white',
                color: '#666',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: '12px',
            lineHeight: '1.4',
            marginBottom: comment.deleted || !isOwnComment ? '0' : '8px',
            color: comment.deleted ? '#999' : '#333',
            fontStyle: comment.deleted ? 'italic' : 'normal'
          }}>
            {comment.text}
          </div>
          {!comment.deleted && isOwnComment && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onStartEdit}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '10px',
                  borderRadius: '3px'
                }}
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'rgba(244, 67, 54, 0.1)',
                  color: '#f44336',
                  cursor: 'pointer',
                  fontSize: '10px',
                  borderRadius: '3px'
                }}
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
