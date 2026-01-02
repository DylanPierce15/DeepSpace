/**
 * DeleteProjectModal component - confirmation dialog for archiving a project
 */

import React from 'react';
import Button from '../UI/Button.jsx';

export default function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  taskCount
}) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
          Archive Project
        </h3>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '14px',
          color: '#666',
          lineHeight: '1.5'
        }}>
          Are you sure you want to archive "{projectName}"?
          {taskCount > 0 && (
            <>
              <br />
              <br />
              <strong>This project has {taskCount} task{taskCount === 1 ? '' : 's'}.</strong> Tasks will remain visible but the project will be archived.
            </>
          )}
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
