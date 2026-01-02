# Task Manager Widget

A comprehensive task management widget for Canvas with support for projects, comments, drag-and-drop reordering, and AI-powered task idea processing.

## 📁 Project Structure

```
task-manager-basic-refactored/
├── utils/
│   ├── constants/
│   │   ├── priorities.js       # Priority levels, colors, labels
│   │   ├── viewTypes.js        # View type constants (ALL, PROJECT, etc.)
│   │   └── defaults.js         # Default state values
│   ├── hooks/
│   │   ├── useUsers.js         # Load current user & canvas users
│   │   ├── useSidebarResize.js # Sidebar drag/resize logic
│   │   ├── useDragDrop.js      # Task drag & drop reordering
│   │   ├── useTaskData.js      # Task CRUD operations
│   │   ├── useProjects.js      # Project management
│   │   ├── useComments.js      # Comment operations
│   │   ├── useTaskIdeas.js     # Task ideas LLM processing
│   │   └── index.js            # Barrel export
│   ├── dateUtils.js            # Date formatting and comparisons
│   ├── priorityUtils.js        # Priority color utilities
│   ├── taskFilters.js          # Sort and filter functions
│   ├── viewUtils.js            # View title generation
│   └── logging.js              # miyagiWidgetLog helpers
├── components/
│   ├── UI/
│   │   ├── Button.jsx          # Reusable button component
│   │   ├── UserAvatar.jsx      # User initial circle
│   │   └── PriorityBadge.jsx   # Priority color indicator
│   ├── TaskList/
│   │   ├── EmptyState.jsx      # "No tasks" placeholder
│   │   ├── TaskItem.jsx        # Individual task card
│   │   └── TaskList.jsx        # Task list container
│   ├── TaskIdeas/
│   │   ├── TaskIdeaItem.jsx    # Individual task idea card
│   │   └── TaskIdeasList.jsx   # Task ideas list container
│   ├── TaskComments/
│   │   ├── Comment.jsx         # Individual comment
│   │   ├── CommentForm.jsx     # Add comment form
│   │   └── CommentSection.jsx  # Comments container
│   ├── Sidebar/
│   │   ├── ResizeHandle.jsx    # Draggable resize handle
│   │   ├── SidebarNav.jsx      # Main navigation items
│   │   ├── ProjectList.jsx     # Active/archived projects
│   │   ├── UserList.jsx        # User assignments
│   │   ├── TaskIdeasNav.jsx    # Task ideas navigation item
│   │   ├── CompletedTasksNav.jsx # Completed tasks navigation
│   │   └── Sidebar.jsx         # Main sidebar container
│   ├── Toolbar/
│   │   ├── ViewHeader.jsx      # Current view title
│   │   ├── SortDropdown.jsx    # Sort menu
│   │   ├── FilterToggle.jsx    # Show completed toggle
│   │   └── Toolbar.jsx         # Main toolbar container
│   └── Modals/
│       ├── TaskModal.jsx           # Add/Edit task modal
│       ├── DeleteTaskModal.jsx     # Delete confirmation
│       ├── DeleteProjectModal.jsx  # Archive confirmation
│       └── ClearCompletedModal.jsx # Clear completed confirmation
├── template.jsx        # Main orchestrator component
└── properties.json     # Widget metadata
```

## 🏗️ Architecture

### Custom Hooks (`utils/hooks/`)
Business logic is encapsulated in custom hooks for separation of concerns:

- **useUsers.js** - Loads current user and canvas users from MiyagiStorageService
- **useSidebarResize.js** - Manages sidebar width with drag-to-resize functionality
- **useDragDrop.js** - Handles task reordering via drag and drop
- **useTaskData.js** - Task CRUD operations with global storage persistence
- **useProjects.js** - Project management and task-project relationships
- **useComments.js** - Comment operations with soft-delete support
- **useTaskIdeas.js** - Processes AI-generated task ideas from other widgets

### Components (`components/`)
Presentational components organized by feature area:

**UI/** - Reusable base components
- `Button.jsx` - Multi-variant button (primary, secondary, danger)
- `UserAvatar.jsx` - User initial circle with color coding
- `PriorityBadge.jsx` - Visual priority indicator

**TaskList/** - Task display and management
- `EmptyState.jsx` - Empty state placeholder
- `TaskItem.jsx` - Individual task card with all task actions
- `TaskList.jsx` - Task list container with filtering

**TaskIdeas/** - AI task idea processing
- `TaskIdeaItem.jsx` - Individual task idea card with process button
- `TaskIdeasList.jsx` - Task ideas list container with empty state

**TaskComments/** - Comment system
- `Comment.jsx` - Individual comment with edit/delete
- `CommentForm.jsx` - New comment input form
- `CommentSection.jsx` - Comments container for a task

**Sidebar/** - Navigation and filtering
- `ResizeHandle.jsx` - Draggable resize handle
- `SidebarNav.jsx` - Main navigation items (All, Upcoming)
- `ProjectList.jsx` - Project list with add/edit/archive
- `UserList.jsx` - User filter list
- `TaskIdeasNav.jsx` - Task ideas navigation with notification badge
- `CompletedTasksNav.jsx` - Completed tasks navigation with counter
- `Sidebar.jsx` - Main sidebar container

**Toolbar/** - Actions and view management
- `ViewHeader.jsx` - Current view title display
- `SortDropdown.jsx` - Sort options dropdown
- `FilterToggle.jsx` - Toggle completed tasks visibility
- `Toolbar.jsx` - Main toolbar container

**Modals/** - Dialog boxes
- `TaskModal.jsx` - Add/edit task form modal
- `DeleteTaskModal.jsx` - Delete task confirmation
- `DeleteProjectModal.jsx` - Archive project confirmation
- `ClearCompletedModal.jsx` - Clear all completed tasks confirmation

### Utilities (`utils/`)
Pure helper functions for common operations:

- **dateUtils.js** - Date formatting and comparison functions
- **priorityUtils.js** - Priority color and label utilities
- **taskFilters.js** - Task sorting and filtering functions
- **viewUtils.js** - View title generation
- **logging.js** - miyagiWidgetLog event helpers

### Constants (`utils/constants/`)
Centralized configuration values:

- **priorities.js** - Priority levels, colors, and labels
- **viewTypes.js** - View type constants (ALL, PROJECT, UPCOMING, USER, COMPLETED)
- **defaults.js** - Default state values for the widget

## ✨ Features

- **Task Management**: Create, edit, delete, and complete tasks
- **Projects**: Organize tasks into projects with archival support
- **Comments**: Add threaded comments to tasks for collaboration
- **Task Ideas Integration**: 
  - Process AI-generated task ideas from other widgets
  - Dedicated sidebar section with notification badge
  - LLM-powered conversion of plain text ideas to structured tasks
- **Drag & Drop**: Reorder tasks with intuitive drag-and-drop
- **Resizable Sidebar**: Adjust sidebar width (180-400px) with drag handle
- **Multiple Views**: 
  - All Tasks - View all active tasks
  - Project View - Filter by specific project
  - Upcoming - Tasks due within 7 days
  - User View - Filter by assigned user
  - Task Ideas - View and process AI-generated task ideas
  - Completed - View completed tasks
- **Filtering & Sorting**: 
  - Toggle completed tasks visibility
  - Sort by priority or due date
- **User Assignment**: Assign tasks to canvas users
- **Priority Levels**: Low, Medium, High with visual indicators
- **Due Dates**: Set and track due dates with overdue warnings
- **Activity Logging**: All user actions logged via miyagiWidgetLog

## � Data Storage

The widget uses MiyagiStorageService for data persistence:

### Global Storage (Canvas-wide)
- **`tasks`** - Shared task data structure:
  ```javascript
  {
    projects: [],  // Array of project objects
    tasks: [],     // Array of task objects
    comments: []   // Array of comment objects
  }
  ```
- **`task-ideas`** - AI-generated task ideas from other widgets
- **`task-ideas-tracking`** - Tracks which task ideas have been processed (global to persist across widget instances)

### Widget Storage (Widget-specific)
- **`sidebar-width`** - User's preferred sidebar width (180-400px)

## 🔧 Adding New Features

### Adding a New Hook
1. Create file in `utils/hooks/` directory
2. Use `useGlobalStorage` or `useStorage` for persistence
3. Export hook functions and data
4. Add to `utils/hooks/index.js` barrel export
5. Import in `template.jsx`

### Adding a New Component
1. Create file in appropriate `components/` subdirectory
2. Keep component purely presentational (data via props)
3. Use existing UI components (Button, UserAvatar, etc.) where possible
4. Import in parent component or `template.jsx`

### Adding a New View Type
1. Add constant to `utils/constants/viewTypes.js`
2. Add navigation item in appropriate sidebar component (e.g., `TaskIdeasNav.jsx`, `CompletedTasksNav.jsx`)
3. Add filtering logic in `template.jsx` `displayedTasks` useMemo or conditional rendering
4. Add title case in `utils/viewUtils.js`

### Adding a New Utility Function
1. Create or update file in `utils/` directory
2. Keep function pure (no side effects)
3. Export function
4. Import where needed

## 🎨 Styling Guidelines

- Use inline styles (no CSS files)
- Follow existing color palette:
  - Primary: `#2196F3` (blue)
  - Danger: `#f44336` (red)
  - Success: `#4caf50` (green)
  - Gray: `#666`, `#999`, `rgba(0, 0, 0, 0.1)`
- Border radius: `4px` (small), `8px` (medium), `12px` (large)
- Shadows: `0 2px 4px rgba(0, 0, 0, 0.1)` (light), `0 4px 6px rgba(0, 0, 0, 0.1)` (medium)
- Font sizes: `12px` (small), `14px` (body), `16px` (heading), `18px+` (large)

## 🐛 Common Debugging Tips

### Tasks Not Appearing
- Check `useGlobalStorage('tasks')` in browser console
- Verify task data structure matches expected format
- Check filtering logic in `template.jsx` `displayedTasks`

### Comments Not Saving
- Verify `currentUser` is loaded (check `useUsers` hook)
- Check global storage `tasks.comments` array
- Look for deleted comments (they're soft-deleted with `deleted: true`)

### Drag-Drop Not Working
- Ensure `onDragStart`, `onDragEnd`, `onDrop` handlers are wired
- Check that tasks have unique IDs
- Verify `reorderTasks` is updating storage correctly

### Sidebar Resize Issues
- Check `sidebar-width` in widget storage
- Verify resize handle has proper mouse event handlers
- Ensure width constraints (180-400px) are enforced

### Task Ideas Not Processing
- Verify `task-ideas` global storage contains unprocessed ideas
- Check `task-ideas-tracking` global storage for processed IDs (now global, not widget-specific)
- Ensure miyagiAPI `generate-text` endpoint is accessible
- Look for errors in console during LLM processing
- Check the Task Ideas view in sidebar to see unprocessed ideas
- Verify notification badge appears on Task Ideas sidebar item when ideas exist
