/**
 * Toolbar component - main toolbar with view header and actions
 */

import React from 'react';
import ViewHeader from './ViewHeader.jsx';
import SortDropdown from './SortDropdown.jsx';
import FilterDropdown from './FilterDropdown.jsx';
import FilterToggle from './FilterToggle.jsx';
import Button from '../UI/Button.jsx';
import { VIEW_TYPES } from '../../utils/constants/viewTypes.js';

export default function Toolbar({
  currentView,
  projects,
  tasksByUser,
  showCompleted,
  onToggleCompleted,
  showSortDropdown,
  onToggleSortDropdown,
  onSort,
  currentSort,
  sortDirection,
  onToggleSortDirection,
  sortActive,
  showFilterDropdown,
  onToggleFilterDropdown,
  availableUsers,
  availableTags,
  selectedUsers,
  selectedTags,
  onToggleUser,
  onToggleTag,
  onAddTask,
  onClearCompleted,
  hasCompletedTasks,
  taskCount,
  completedCount
}) {
  const isCompletedView = currentView.type === VIEW_TYPES.COMPLETED;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '16px',
      borderBottom: '2px solid rgba(0, 0, 0, 0.1)'
    }}>
      {/* View Title */}
      <ViewHeader 
        currentView={currentView}
        projects={projects}
        tasksByUser={tasksByUser}
        taskCount={taskCount}
        completedCount={completedCount}
      />

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}>
        {isCompletedView ? (
          // Show "Clear All Completed" button on completed view
          <Button
            variant="danger"
            onClick={onClearCompleted}
            disabled={!hasCompletedTasks}
          >
            Clear All Completed
          </Button>
        ) : (
          // Show sort, filter, and add task buttons on other views
          <>
            <SortDropdown
              isOpen={showSortDropdown}
              onToggle={onToggleSortDropdown}
              onSort={onSort}
              currentSort={currentSort}
              sortDirection={sortDirection}
              onToggleDirection={onToggleSortDirection}
              sortActive={sortActive}
            />
            <FilterDropdown
              isOpen={showFilterDropdown}
              onToggle={onToggleFilterDropdown}
              availableUsers={availableUsers}
              availableTags={availableTags}
              selectedUsers={selectedUsers}
              selectedTags={selectedTags}
              onToggleUser={onToggleUser}
              onToggleTag={onToggleTag}
            />
            <FilterToggle
              showCompleted={showCompleted}
              onToggle={onToggleCompleted}
            />
            <Button
              variant="primary"
              onClick={() => onAddTask(
                currentView.type === VIEW_TYPES.PROJECT ? currentView.id : null
              )}
            >
              + Add Task
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
