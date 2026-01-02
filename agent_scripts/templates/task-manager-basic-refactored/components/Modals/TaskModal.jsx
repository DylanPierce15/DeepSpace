/**
 * TaskModal component - modal for adding or editing a task
 */

import React from 'react';
import Button from '../UI/Button.jsx';
import UserAvatar from '../UI/UserAvatar.jsx';
import { PRIORITIES } from '../../utils/constants/priorities.js';

export default function TaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  projects = [],
  users = [],
  editMode = false
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState(PRIORITIES.MEDIUM);
  const [dueDate, setDueDate] = React.useState('');
  const [assignedUserId, setAssignedUserId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [tagSearch, setTagSearch] = React.useState('');
  const [newTagInput, setNewTagInput] = React.useState('');

  // Get available tags from global storage
  const [availableTags, setAvailableTags] = useGlobalStorage('task-tags', [
    'bug', 'feature', 'documentation', 'urgent', 'blocked', 'research'
  ]);

  // Reset form when modal opens or task changes
  React.useEffect(() => {
    if (isOpen) {
      if (task) {
        // Editing existing task
        setName(task.name || '');
        setDescription(task.description || '');
        setPriority(task.priority || PRIORITIES.MEDIUM);
        setDueDate(task.dueDate || '');
        setAssignedUserId(task.assignedUser?.id || '');
        setProjectId(task.projectId || '');
        setSelectedTags(task.tags || []);
      } else {
        // Adding new task - reset to defaults
        setName('');
        setDescription('');
        setPriority(PRIORITIES.MEDIUM);
        setDueDate('');
        setAssignedUserId('');
        setProjectId('');
        setSelectedTags([]);
      }
      // Reset search and new tag input
      setTagSearch('');
      setNewTagInput('');
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      priority,
      dueDate,
      assignedUserId: assignedUserId || null,
      projectId: projectId || null,
      tags: selectedTags
    });

    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Tag management functions
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addNewTag = () => {
    const trimmedTag = newTagInput.trim().toLowerCase();
    if (!trimmedTag) return;
    
    // Check if tag already exists
    if (availableTags.includes(trimmedTag)) {
      // Just select it if it exists
      if (!selectedTags.includes(trimmedTag)) {
        setSelectedTags([...selectedTags, trimmedTag]);
      }
    } else {
      // Add to available tags and select it
      setAvailableTags([...availableTags, trimmedTag]);
      setSelectedTags([...selectedTags, trimmedTag]);
    }
    
    setNewTagInput('');
    setTagSearch('');
  };

  const handleNewTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTag();
    }
  };

  // Filter tags based on search
  const filteredTags = availableTags.filter(tag =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  );

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
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 600 }}>
          {editMode ? 'Edit Task' : 'Add New Task'}
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Task Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter task name..."
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Priority */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value={PRIORITIES.LOW}>Low</option>
              <option value={PRIORITIES.MEDIUM}>Medium</option>
              <option value={PRIORITIES.HIGH}>High</option>
            </select>
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Assigned To */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Assign To
            </label>
            <select
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'white',
                boxSizing: 'border-box'
              }}
            >
              <option value="">No Project</option>
              {projects
                .filter(p => !p.archived)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Tags
            </label>

            {/* Selected tags display */}
            {selectedTags.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '14px',
                        lineHeight: '1',
                        marginLeft: '2px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag search */}
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
            />

            {/* Available tags list (scrollable) */}
            <div style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '8px',
              marginBottom: '8px'
            }}>
              {filteredTags.length > 0 ? (
                filteredTags.map(tag => (
                  <label
                    key={tag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontSize: '14px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                      style={{
                        marginRight: '8px',
                        cursor: 'pointer'
                      }}
                    />
                    {tag}
                  </label>
                ))
              ) : (
                <div style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '14px'
                }}>
                  {tagSearch ? 'No tags match your search' : 'No tags available'}
                </div>
              )}
            </div>

            {/* Add new tag */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyPress={handleNewTagKeyPress}
                placeholder="Add new tag..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addNewTag}
                disabled={!newTagInput.trim()}
              >
                Add Tag
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!name.trim()}>
              {editMode ? 'Save Changes' : 'Add Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
