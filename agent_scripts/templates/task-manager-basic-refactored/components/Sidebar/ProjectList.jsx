/**
 * ProjectList component - displays and manages projects
 */

import React from 'react';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function ProjectList({
  activeProjects = [],
  archivedProjects = [],
  tasksByProject = {},
  currentView,
  onViewChange,
  onAddProject,
  editingProjectId,
  editingProjectName = '',
  onEditProjectName,
  onStartEditProject,
  onSaveProjectName,
  onDeleteProject,
  onUnarchiveProject,
  sidebarExpanded,
  onToggleAccordion
}) {
  return (
    <>
      {/* Projects Section */}
      <div style={{ marginBottom: '8px' }}>
        <div
          onClick={() => onToggleAccordion('projects')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'transparent',
            color: '#666',
            fontWeight: '500',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
        >
          <span>Projects</span>
          <span style={{
            fontSize: '12px',
            transition: 'transform 0.2s'
          }}>
            {sidebarExpanded.projects ? '▼' : '▶'}
          </span>
        </div>

        {sidebarExpanded.projects && (
          <div style={{ marginTop: '8px', marginLeft: '8px' }}>
            {activeProjects.map(project => (
              <div
                key={project.id}
                style={{
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: 0
                }}
              >
                {editingProjectId === project.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: '4px', minWidth: 0 }}>
                    <input
                      type="text"
                      value={editingProjectName}
                      onChange={(e) => onEditProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveProjectName(project.id);
                        if (e.key === 'Escape') onStartEditProject(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        border: '1px solid #2196F3',
                        borderRadius: '4px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => onSaveProjectName(project.id)}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: '#4caf50',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onStartEditProject(null)}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: '#f44336',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => onViewChange({ type: VIEW_TYPES.PROJECT, id: project.id })}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: currentView.type === VIEW_TYPES.PROJECT && currentView.id === project.id 
                          ? '#E3F2FD' 
                          : 'transparent',
                        color: currentView.type === VIEW_TYPES.PROJECT && currentView.id === project.id 
                          ? '#1976D2' 
                          : '#666',
                        fontWeight: currentView.type === VIEW_TYPES.PROJECT && currentView.id === project.id 
                          ? '600' 
                          : '400',
                        fontSize: '13px',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: project.color || '#667eea',
                        flexShrink: 0
                      }}></span>
                      <span style={{ 
                        flex: 1,
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {project.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartEditProject(project.id);
                      }}
                      style={{
                        padding: '4px 6px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#999',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: '500',
                        opacity: 0.6,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project);
                      }}
                      style={{
                        padding: '4px 6px',
                        border: 'none',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#ff9800',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: '500',
                        opacity: 0.6,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                      title="Archive project"
                    >
                      Archive
                    </button>
                  </>
                )}
              </div>
            ))}
            
            <button
              onClick={onAddProject}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '6px 12px',
                border: '1px dashed rgba(0, 0, 0, 0.3)',
                borderRadius: '4px',
                background: 'transparent',
                color: '#666',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5';
                e.currentTarget.style.borderStyle = 'solid';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderStyle = 'dashed';
              }}
            >
              + New Project
            </button>
          </div>
        )}
      </div>

      {/* Archived Projects Section */}
      <div style={{ marginBottom: '8px' }}>
        <div
          onClick={() => onToggleAccordion('archivedProjects')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: 'transparent',
            color: '#999',
            fontWeight: '500',
            fontSize: '14px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>Archived Projects</span>
          <span style={{ 
            fontSize: '12px',
            transition: 'transform 0.2s'
          }}>
            {sidebarExpanded.archivedProjects ? '▼' : '▶'}
          </span>
        </div>
        {sidebarExpanded.archivedProjects && (
          <div style={{ paddingLeft: '12px' }}>
            {archivedProjects.map(project => (
              <div
                key={project.id}
                onClick={() => onViewChange({ type: VIEW_TYPES.PROJECT, id: project.id })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: currentView.type === VIEW_TYPES.PROJECT && currentView.id === project.id ? '#E3F2FD' : 'transparent',
                  color: currentView.type === VIEW_TYPES.PROJECT && currentView.id === project.id ? '#1976D2' : '#999',
                  fontSize: '13px',
                  marginBottom: '2px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  minWidth: 0
                }}
              >
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0
                }}>
                  {project.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnarchiveProject(project.id);
                  }}
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: '#4caf50',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '500',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  title="Unarchive project"
                >
                  Unarchive
                </button>
              </div>
            ))}
            {archivedProjects.length === 0 && (
              <div style={{
                padding: '8px 12px',
                fontSize: '12px',
                color: '#999',
                fontStyle: 'italic'
              }}>
                No archived projects
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
