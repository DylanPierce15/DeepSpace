/**
 * Sidebar component - main sidebar container with all navigation
 */

import React from 'react';
import ResizeHandle from './ResizeHandle.jsx';
import SidebarNav from './SidebarNav.jsx';
import ProjectList from './ProjectList.jsx';
import UserList from './UserList.jsx';
import TaskIdeasNav from './TaskIdeasNav.jsx';
import CompletedTasksNav from './CompletedTasksNav.jsx';

export default function Sidebar({
  // Sizing
  sidebarWidth,
  isResizing,
  onResizeStart,
  // Navigation
  currentView,
  onViewChange,
  upcomingDays,
  totalTasks,
  completedTasks,
  unprocessedIdeasCount,
  // Projects
  activeProjects,
  archivedProjects,
  tasksByProject,
  onAddProject,
  editingProjectId,
  editingProjectName,
  onEditProjectName,
  onStartEditProject,
  onSaveProjectName,
  onDeleteProject,
  onUnarchiveProject,
  // Users
  tasksByUser,
  unassignedTasks,
  // Accordion state
  sidebarExpanded,
  onToggleAccordion
}) {
  return (
    <div style={{
      width: `${sidebarWidth}px`,
      flexShrink: 0,
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      paddingRight: '20px',
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative',
      background: 'white'
    }}>
      {/* Resize Handle */}
      <ResizeHandle 
        onResizeStart={onResizeStart}
        isResizing={isResizing}
      />

      {/* Sidebar Header */}
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#333'
      }}>
        Task Manager
      </h3>

      {/* All Tasks & Upcoming */}
      <SidebarNav
        currentView={currentView}
        onViewChange={onViewChange}
        upcomingDays={upcomingDays}
        totalTasks={totalTasks}
        completedTasks={completedTasks}
      />

      {/* Projects (Active & Archived) */}
      <ProjectList
        activeProjects={activeProjects}
        archivedProjects={archivedProjects}
        tasksByProject={tasksByProject}
        currentView={currentView}
        onViewChange={onViewChange}
        onAddProject={onAddProject}
        editingProjectId={editingProjectId}
        editingProjectName={editingProjectName}
        onEditProjectName={onEditProjectName}
        onStartEditProject={onStartEditProject}
        onSaveProjectName={onSaveProjectName}
        onDeleteProject={onDeleteProject}
        onUnarchiveProject={onUnarchiveProject}
        sidebarExpanded={sidebarExpanded}
        onToggleAccordion={onToggleAccordion}
      />

      {/* By User */}
      <UserList
        tasksByUser={tasksByUser}
        unassignedTasks={unassignedTasks}
        currentView={currentView}
        onViewChange={onViewChange}
        sidebarExpanded={sidebarExpanded}
        onToggleAccordion={onToggleAccordion}
      />

      {/* Task Ideas */}
      <TaskIdeasNav
        currentView={currentView}
        onViewChange={onViewChange}
        unprocessedIdeasCount={unprocessedIdeasCount}
      />

      {/* Completed Tasks */}
      <CompletedTasksNav
        currentView={currentView}
        onViewChange={onViewChange}
        completedTasks={completedTasks}
      />
    </div>
  );
}
