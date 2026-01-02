import React, { useState } from 'react';

// Hooks
import {
  useUsers,
  useSidebarResize,
  useDragDrop,
  useTaskData,
  useProjects,
  useComments,
  useTaskIdeas
} from './utils/hooks/index.js';

// Components
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Toolbar from './components/Toolbar/Toolbar.jsx';
import TaskList from './components/TaskList/TaskList.jsx';
import TaskIdeasList from './components/TaskIdeas/TaskIdeasList.jsx';
import SearchBar from './components/SearchBar/SearchBar.jsx';
import TaskModal from './components/Modals/TaskModal.jsx';
import DeleteTaskModal from './components/Modals/DeleteTaskModal.jsx';
import DeleteProjectModal from './components/Modals/DeleteProjectModal.jsx';
import ClearCompletedModal from './components/Modals/ClearCompletedModal.jsx';

// Constants
import { VIEW_TYPES } from './utils/constants/viewTypes.js';
import { DEFAULTS } from './utils/constants/defaults.js';

function TaskManagerRefactored() {
  // Load users
  const { currentUser, canvasUsers } = useUsers();

  // View state
  const [currentView, setCurrentView] = useState(DEFAULTS.VIEW);
  
  // Sidebar state
  const [sidebarExpanded, setSidebarExpanded] = useState(DEFAULTS.SIDEBAR_EXPANDED);
  
  // Filter & sort state
  const [showCompleted, setShowCompleted] = useState(true);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [currentSort, setCurrentSort] = useState(null); // 'priority' or 'dueDate'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [sortActive, setSortActive] = useState(false); // whether sort is currently enforced
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchText, setSearchText] = useState('');
  
  // Modal states
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [showClearCompletedModal, setShowClearCompletedModal] = useState(false);
  
  // Project editing state
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Sidebar resize
  const {
    sidebarWidth,
    isResizing,
    handleResizeStart
  } = useSidebarResize();

  // Task data management
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    reorderTasks,
    clearCompletedTasks,
    clearSingleCompletedTask,
    sortTasksBy
  } = useTaskData(currentUser);

  // Project management
  const {
    projects,
    activeProjects,
    archivedProjects,
    tasksByProject,
    addProject,
    updateProject,
    archiveProject,
    unarchiveProject
  } = useProjects(currentUser);

  // Comments management
  const {
    comments,
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
  } = useComments(currentUser);

  // Task ideas integration
  const { unprocessedTaskIdeas, processingIdeaId, processTaskIdea } = useTaskIdeas();

  // Drag and drop
  const {
    draggedTask,
    dragOverTask,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop
  } = useDragDrop(currentUser);

  // Handlers
  const handleAddTask = (projectId = null) => {
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const handleSaveTask = (taskData) => {
    // Convert assignedUserId to full user object
    const taskDataWithUser = {
      ...taskData,
      assignedUser: taskData.assignedUserId 
        ? canvasUsers.find(u => u.id === taskData.assignedUserId) || null
        : null
    };
    delete taskDataWithUser.assignedUserId;
    
    if (editingTask) {
      updateTask(editingTask.id, taskDataWithUser);
    } else {
      // Adding a new task breaks the sort
      addTask(taskDataWithUser);
      breakSort();
    }
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleDeleteTaskClick = (task) => {
    setTaskToDelete(task);
    setShowDeleteTaskModal(true);
  };

  const handleConfirmDeleteTask = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete.id);
    }
    setShowDeleteTaskModal(false);
    setTaskToDelete(null);
  };

  const handleAddProject = (name) => {
    addProject(name);
  };

  const handleEditProject = (projectId, name) => {
    setEditingProjectId(projectId);
    setEditingProjectName(name);
  };

  const handleSaveProject = (projectId) => {
    if (editingProjectName.trim()) {
      updateProject(projectId, { name: editingProjectName.trim() });
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleArchiveProjectClick = (project) => {
    setProjectToDelete(project);
    setShowDeleteProjectModal(true);
  };

  const handleConfirmArchiveProject = () => {
    if (projectToDelete) {
      archiveProject(projectToDelete.id);
      // Reset view if currently viewing this project
      if (currentView.type === VIEW_TYPES.PROJECT && currentView.id === projectToDelete.id) {
        setCurrentView(DEFAULTS.VIEW);
      }
    }
    setShowDeleteProjectModal(false);
    setProjectToDelete(null);
  };

  const handleClearCompletedClick = () => {
    setShowClearCompletedModal(true);
  };

  const handleConfirmClearCompleted = () => {
    clearCompletedTasks();
    setShowClearCompletedModal(false);
  };

  const handleSort = (sortType, direction) => {
    setCurrentSort(sortType);
    setSortDirection(direction);
    setSortActive(true);
    sortTasksBy(sortType, direction);
    // Don't close dropdown - let user see their selection
  };

  const handleToggleSortDirection = (sortType) => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    handleSort(sortType, newDirection);
  };

  // Break sort when these actions occur
  const breakSort = () => {
    setSortActive(false);
    setCurrentSort(null); // Clear the sort selection
  };

  // Wrap toggleTaskCompletion to break sort when marking incomplete
  const handleToggleTaskCompletion = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    // Only break sort if marking a completed task as incomplete
    if (task && task.completed) {
      breakSort();
    }
    toggleTaskCompletion(taskId);
  };

  // Wrap handleDrop to break sort on drag and drop
  const handleDropWithBreakSort = (draggedTaskId, dropTargetTaskId) => {
    breakSort();
    handleDrop(draggedTaskId, dropTargetTaskId);
  };

  const handleToggleSidebar = (section) => {
    setSidebarExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleProcessTaskIdea = (ideaId) => {
    const idea = unprocessedTaskIdeas.find(i => i.id === ideaId);
    if (idea) {
      processTaskIdea(ideaId, currentUser);
    }
  };

  // Get available users and tags from tasks (needed before displayedTasks)
  const availableUsers = React.useMemo(() => {
    const userSet = new Set();
    tasks.forEach(task => {
      if (task.assignedUser) {
        userSet.add(task.assignedUser.name);
      }
    });
    return Array.from(userSet).sort();
  }, [tasks]);

  const availableTags = React.useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      if (task.tags && task.tags.length > 0) {
        task.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Initialize selected filters only once on mount or when available options are first populated
  React.useEffect(() => {
    if (availableUsers.length > 0 && selectedUsers.length === 0) {
      setSelectedUsers(availableUsers);
    }
  }, [availableUsers.join(',')]);

  React.useEffect(() => {
    if (availableTags.length > 0 && selectedTags.length === 0) {
      setSelectedTags(availableTags);
    }
  }, [availableTags.join(',')]);

  // Filter handlers
  const handleToggleUser = (userName) => {
    setSelectedUsers(prev => 
      prev.includes(userName)
        ? prev.filter(u => u !== userName)
        : [...prev, userName]
    );
  };

  const handleToggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Compute filtered & sorted tasks for current view
  const displayedTasks = React.useMemo(() => {
    let filtered = tasks;

    // Filter by view type
    if (currentView.type === VIEW_TYPES.PROJECT) {
      filtered = filtered.filter(t => t.projectId === currentView.id);
    } else if (currentView.type === VIEW_TYPES.USER) {
      if (currentView.id === 'unassigned') {
        filtered = filtered.filter(t => !t.assignedUser);
      } else {
        filtered = filtered.filter(t => t.assignedUser?.id === currentView.id);
      }
    } else if (currentView.type === VIEW_TYPES.UPCOMING) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endDate = new Date(today);
      // Add (days - 1) to include today as day 1
      // e.g., "Next 7 Days" = today + 6 more days
      endDate.setDate(endDate.getDate() + 6);
      
      filtered = filtered.filter(t => {
        if (!t.dueDate) return false;
        // Parse date as local to avoid timezone issues
        const [year, month, day] = t.dueDate.split('-').map(num => parseInt(num, 10));
        const dueDate = new Date(year, month - 1, day);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= endDate;
      });
    } else if (currentView.type === VIEW_TYPES.COMPLETED) {
      filtered = filtered.filter(t => t.completed);
    }

    // Apply showCompleted filter to all views except the Completed view
    if (currentView.type !== VIEW_TYPES.COMPLETED && !showCompleted) {
      filtered = filtered.filter(t => !t.completed);
    }
    
    // Filter out tasks from archived projects (except when viewing a specific project)
    if (currentView.type !== VIEW_TYPES.PROJECT) {
      const archivedProjectIds = new Set(
        archivedProjects.map(p => p.id)
      );
      filtered = filtered.filter(task => !archivedProjectIds.has(task.projectId));
    }

    // Apply user filter (only if there are users to filter by)
    if (selectedUsers.length > 0 && selectedUsers.length < availableUsers.length) {
      filtered = filtered.filter(task => {
        // Show unassigned tasks only if no users are selected
        if (!task.assignedUser) return selectedUsers.length === 0;
        return selectedUsers.includes(task.assignedUser.name);
      });
    }

    // Apply tag filter (only if there are tags to filter by)
    if (selectedTags.length > 0 && selectedTags.length < availableTags.length) {
      filtered = filtered.filter(task => {
        // Show tasks without tags only if no tags are selected
        if (!task.tags || task.tags.length === 0) return selectedTags.length === 0;
        // Show task if it has at least one selected tag
        return task.tags.some(tag => selectedTags.includes(tag));
      });
    }

    // Apply search text filter
    if (searchText && searchText.trim().length > 0) {
      const searchLower = searchText.toLowerCase().trim();
      filtered = filtered.filter(task => {
        const nameMatch = task.name?.toLowerCase().includes(searchLower);
        const descMatch = task.description?.toLowerCase().includes(searchLower);
        return nameMatch || descMatch;
      });
    }

    // Sort tasks
    return filtered.sort((a, b) => {
      // First, separate by completion status
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // Completed tasks go to bottom
      }
      
      // For completed tasks, sort by completion time (most recent first)
      if (a.completed && b.completed) {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime; // Newer completions first
      }
      
      // For pending tasks, always use order field (manual sorting)
      const aOrder = a.order ?? new Date(a.createdAt).getTime();
      const bOrder = b.order ?? new Date(b.createdAt).getTime();
      return aOrder - bOrder;
    });
  }, [tasks, currentView, showCompleted, archivedProjects, selectedUsers, selectedTags, availableUsers.length, availableTags.length, searchText]);

  // Count tasks by user
  const tasksByUser = React.useMemo(() => {
    const userMap = {};
    const archivedProjectIds = new Set(archivedProjects.map(p => p.id));
    
    tasks.forEach(task => {
      // Exclude tasks from archived projects
      if (archivedProjectIds.has(task.projectId)) return;
      
      if (task.assignedUser) {
        const userId = task.assignedUser.id;
        if (!userMap[userId]) {
          userMap[userId] = {
            user: task.assignedUser,
            tasks: []
          };
        }
        userMap[userId].tasks.push(task);
      }
    });
    
    return userMap;
  }, [tasks, archivedProjects]);

  const completedTasksCount = tasks.filter(t => t.completed).length;

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        backgroundColor: '#f5f5f5',
        height: '100vh',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: '100%',
        display: 'flex',
        gap: '20px',
        overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <Sidebar
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        onResizeStart={handleResizeStart}
        currentView={currentView}
        onViewChange={setCurrentView}
        upcomingDays={DEFAULTS.UPCOMING_DAYS}
        totalTasks={tasks.length}
        completedTasks={tasks.filter(t => t.completed).length}
        unprocessedIdeasCount={unprocessedTaskIdeas.length}
        activeProjects={activeProjects}
        archivedProjects={archivedProjects}
        tasksByProject={tasksByProject}
        onAddProject={handleAddProject}
        editingProjectId={editingProjectId}
        editingProjectName={editingProjectName}
        onEditProjectName={setEditingProjectName}
        onStartEditProject={handleEditProject}
        onSaveProjectName={handleSaveProject}
        onDeleteProject={handleArchiveProjectClick}
        onUnarchiveProject={unarchiveProject}
        tasksByUser={tasksByUser}
        unassignedTasks={tasks.filter(t => !t.assignedUser).length}
        sidebarExpanded={sidebarExpanded}
        onToggleAccordion={handleToggleSidebar}
      />

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px'
          }}
        >
          <Toolbar
            currentView={currentView}
            projects={projects}
            tasksByUser={tasksByUser}
            showCompleted={showCompleted}
            onToggleCompleted={() => setShowCompleted(!showCompleted)}
            showSortDropdown={showSortDropdown}
            onToggleSortDropdown={() => setShowSortDropdown(!showSortDropdown)}
            onSort={handleSort}
            currentSort={currentSort}
            sortDirection={sortDirection}
            onToggleSortDirection={handleToggleSortDirection}
            sortActive={sortActive}
            showFilterDropdown={showFilterDropdown}
            onToggleFilterDropdown={() => setShowFilterDropdown(!showFilterDropdown)}
            availableUsers={availableUsers}
            availableTags={availableTags}
            selectedUsers={selectedUsers}
            selectedTags={selectedTags}
            onToggleUser={handleToggleUser}
            onToggleTag={handleToggleTag}
            onAddTask={handleAddTask}
            onClearCompleted={handleClearCompletedClick}
            hasCompletedTasks={completedTasksCount > 0}
            taskCount={displayedTasks.length}
            completedCount={completedTasksCount}
          />

          {/* Show Task Ideas List or Task List based on view */}
          {currentView.type === 'task-ideas' ? (
            <TaskIdeasList
              unprocessedIdeas={unprocessedTaskIdeas}
              processingIdeaId={processingIdeaId}
              onProcessIdea={handleProcessTaskIdea}
            />
          ) : (
            <TaskList
              tasks={displayedTasks}
              projects={projects}
              users={canvasUsers}
              currentUser={currentUser}
              currentView={currentView}
              draggedTask={draggedTask}
              dragOverTask={dragOverTask}
              expandedComments={expandedTaskComments}
              onToggleComments={toggleComments}
              getTaskComments={getTaskComments}
              editingCommentId={editingCommentId}
              newCommentText={newCommentText}
              setNewCommentText={setNewCommentText}
              editCommentText={editCommentText}
              setEditCommentText={setEditCommentText}
              onToggleComplete={handleToggleTaskCompletion}
              onEdit={handleEditTask}
              onDelete={handleDeleteTaskClick}
              onClearCompleted={clearSingleCompletedTask}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={handleDropWithBreakSort}
              onAddComment={addComment}
              onUpdateComment={updateComment}
              onDeleteComment={deleteComment}
              onStartEditComment={startEditingComment}
            />
          )}
        </div>

        {/* Search Bar at bottom */}
        <SearchBar
          searchText={searchText}
          onSearchChange={setSearchText}
        />
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={handleSaveTask}
        projects={projects}
        users={canvasUsers}
        editMode={!!editingTask}
      />

      <DeleteTaskModal
        isOpen={showDeleteTaskModal}
        onClose={() => {
          setShowDeleteTaskModal(false);
          setTaskToDelete(null);
        }}
        onConfirm={handleConfirmDeleteTask}
        taskTitle={taskToDelete?.name || ''}
      />

      <DeleteProjectModal
        isOpen={showDeleteProjectModal}
        onClose={() => {
          setShowDeleteProjectModal(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleConfirmArchiveProject}
        projectName={projectToDelete?.name || ''}
        taskCount={projectToDelete ? (tasksByProject[projectToDelete.id] || []).length : 0}
      />

      <ClearCompletedModal
        isOpen={showClearCompletedModal}
        onClose={() => setShowClearCompletedModal(false)}
        onConfirm={handleConfirmClearCompleted}
        taskCount={completedTasksCount}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      </div>
    </div>
  );
}

export default TaskManagerRefactored;
