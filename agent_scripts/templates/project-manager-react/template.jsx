import React, { useState, useEffect, useMemo } from 'react';

function ProjectManagerWidget() {
  // Global storage for projects (canvas-wide, shared with other widgets)
  const [projectsData, setProjectsData] = useGlobalStorage('projects', { projects: [] });
  
  // Read task data to calculate project progress
  const [taskData, setTaskData] = useGlobalStorage('tasks', { groups: [], tasks: [] });
  
  // Current user for ownership
  const [currentUser, setCurrentUser] = useState(null);
  
  // UI state
  const [currentView, setCurrentView] = useState('list'); // 'list', 'detail', or 'milestone'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active', 'completed', 'archived'
  
  // Modal states
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [canvasUsers, setCanvasUsers] = useState([]);
  
  // Project form state
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    priority: 'medium',
    ownerId: '',
    startDate: '',
    targetEndDate: ''
  });

  // Objective form state
  const [objectiveForm, setObjectiveForm] = useState({
    description: '',
    metric: '',
    targetValue: '',
    currentValue: '',
    unit: ''
  });

  // Milestone form state
  const [milestoneForm, setMilestoneForm] = useState({
    name: '',
    description: '',
    targetDate: ''
  });

  // Task form state
  const [taskForm, setTaskForm] = useState({
    name: '',
    description: '',
    groupId: '',
    assignedUserId: '',
    dueDate: '',
    dependsOn: []
  });

  // Load current user on mount
  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const response = await miyagiAPI.post('get-current-user', {});
      if (response.success) {
        setCurrentUser(response.data.user);
      }
    } catch (error) {
      console.warn('Failed to load current user:', error);
    }
  };

  // Filter projects by status
  const filteredProjects = useMemo(() => {
    if (filterStatus === 'all') {
      return projectsData.projects;
    }
    return projectsData.projects.filter(p => p.status === filterStatus);
  }, [projectsData.projects, filterStatus]);

  // Calculate project progress from tasks
  const getProjectProgress = (project) => {
    const projectTasks = taskData.tasks.filter(t => t.projectId === project.id);
    if (projectTasks.length === 0) return 0;
    
    const completedTasks = projectTasks.filter(t => t.completed).length;
    return Math.round((completedTasks / projectTasks.length) * 100);
  };

  // Get task counts for a project
  const getProjectTaskCounts = (project) => {
    const projectTasks = taskData.tasks.filter(t => t.projectId === project.id);
    const completed = projectTasks.filter(t => t.completed).length;
    return { completed, total: projectTasks.length };
  };

  // Open create project modal
  const openCreateProjectModal = () => {
    setProjectForm({
      name: '',
      description: '',
      priority: 'medium',
      ownerId: currentUser?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      targetEndDate: ''
    });
    setEditingProject(null);
    setShowCreateProjectModal(true);
  };

  // Open edit project modal
  const openEditProjectModal = (project) => {
    setProjectForm({
      name: project.name,
      description: project.description,
      priority: project.priority,
      ownerId: project.ownerId,
      startDate: project.dates.startDate,
      targetEndDate: project.dates.targetEndDate
    });
    setEditingProject(project);
    setShowCreateProjectModal(true);
  };

  // Create or update project
  const saveProject = () => {
    if (!projectForm.name.trim()) return;

    const userName = currentUser?.name || 'Unknown User';

    if (editingProject) {
      // Update existing project
      const updatedProject = {
        ...editingProject,
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
        priority: projectForm.priority,
        ownerId: projectForm.ownerId,
        ownerName: currentUser?.name || editingProject.ownerName,
        dates: {
          ...editingProject.dates,
          startDate: projectForm.startDate,
          targetEndDate: projectForm.targetEndDate
        },
        updatedAt: Date.now()
      };

      setProjectsData({
        projects: projectsData.projects.map(p => 
          p.id === editingProject.id ? updatedProject : p
        )
      });

      miyagiWidgetLog.addEvent('project-updated', `${userName} updated project "${updatedProject.name}"`, {
        projectId: updatedProject.id,
        projectName: updatedProject.name,
        updatedBy: userName
      });
    } else {
      // Create new project
      const newProject = {
        id: `proj-${Date.now()}`,
        name: projectForm.name.trim(),
        description: projectForm.description.trim(),
        status: 'planning',
        priority: projectForm.priority,
        ownerId: projectForm.ownerId,
        ownerName: currentUser?.name || 'Unknown',
        dates: {
          startDate: projectForm.startDate,
          targetEndDate: projectForm.targetEndDate,
          actualEndDate: null
        },
        objectives: [],
        milestones: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setProjectsData({
        projects: [...projectsData.projects, newProject]
      });

      miyagiWidgetLog.addEvent('project-created', `${userName} created project "${newProject.name}"`, {
        projectId: newProject.id,
        projectName: newProject.name,
        createdBy: userName
      });
    }

    setShowCreateProjectModal(false);
    setProjectForm({
      name: '',
      description: '',
      priority: 'medium',
      ownerId: '',
      startDate: '',
      targetEndDate: ''
    });
  };

  // Delete project
  const deleteProject = (projectId) => {
    const project = projectsData.projects.find(p => p.id === projectId);
    if (!confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    const userName = currentUser?.name || 'Unknown User';
    
    setProjectsData({
      projects: projectsData.projects.filter(p => p.id !== projectId)
    });

    miyagiWidgetLog.addEvent('project-deleted', `${userName} deleted project "${project.name}"`, {
      projectId: project.id,
      projectName: project.name,
      deletedBy: userName
    });
  };

  // Change project status
  const changeProjectStatus = (projectId, newStatus) => {
    const userName = currentUser?.name || 'Unknown User';
    const project = projectsData.projects.find(p => p.id === projectId);
    
    const updatedProject = {
      ...project,
      status: newStatus,
      dates: {
        ...project.dates,
        actualEndDate: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : project.dates.actualEndDate
      },
      updatedAt: Date.now()
    };

    setProjectsData({
      projects: projectsData.projects.map(p => 
        p.id === projectId ? updatedProject : p
      )
    });

    miyagiWidgetLog.addEvent('project-status-changed', `${userName} changed "${project.name}" status to ${newStatus}`, {
      projectId: project.id,
      projectName: project.name,
      oldStatus: project.status,
      newStatus: newStatus,
      changedBy: userName
    });
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#DC3545';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#999';
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'planning': return '#9E9E9E';
      case 'active': return '#2196F3';
      case 'completed': return '#4CAF50';
      case 'archived': return '#757575';
      default: return '#999';
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get selected project
  const selectedProject = useMemo(() => {
    return projectsData.projects.find(p => p.id === selectedProjectId);
  }, [projectsData.projects, selectedProjectId]);

  // Open objective modal
  const openObjectiveModal = (objective = null) => {
    if (objective) {
      setObjectiveForm({
        description: objective.description,
        metric: objective.metric,
        targetValue: objective.targetValue.toString(),
        currentValue: objective.currentValue.toString(),
        unit: objective.unit
      });
      setEditingObjective(objective);
    } else {
      setObjectiveForm({
        description: '',
        metric: '',
        targetValue: '',
        currentValue: '0',
        unit: ''
      });
      setEditingObjective(null);
    }
    setShowObjectiveModal(true);
  };

  // Save objective
  const saveObjective = () => {
    if (!objectiveForm.description.trim() || !selectedProject) return;

    const userName = currentUser?.name || 'Unknown User';

    if (editingObjective) {
      // Update existing objective
      const updatedObjectives = selectedProject.objectives.map(obj =>
        obj.id === editingObjective.id
          ? {
              ...obj,
              description: objectiveForm.description.trim(),
              metric: objectiveForm.metric.trim(),
              targetValue: parseFloat(objectiveForm.targetValue) || 0,
              currentValue: parseFloat(objectiveForm.currentValue) || 0,
              unit: objectiveForm.unit.trim()
            }
          : obj
      );

      updateProject(selectedProject.id, { objectives: updatedObjectives });

      miyagiWidgetLog.addEvent('objective-updated', `${userName} updated objective in "${selectedProject.name}"`, {
        projectId: selectedProject.id,
        objectiveId: editingObjective.id,
        updatedBy: userName
      });
    } else {
      // Create new objective
      const newObjective = {
        id: `obj-${Date.now()}`,
        description: objectiveForm.description.trim(),
        metric: objectiveForm.metric.trim(),
        targetValue: parseFloat(objectiveForm.targetValue) || 0,
        currentValue: parseFloat(objectiveForm.currentValue) || 0,
        unit: objectiveForm.unit.trim()
      };

      const updatedObjectives = [...selectedProject.objectives, newObjective];
      updateProject(selectedProject.id, { objectives: updatedObjectives });

      miyagiWidgetLog.addEvent('objective-created', `${userName} added objective to "${selectedProject.name}"`, {
        projectId: selectedProject.id,
        objectiveId: newObjective.id,
        createdBy: userName
      });
    }

    setShowObjectiveModal(false);
  };

  // Delete objective
  const deleteObjective = (objectiveId) => {
    if (!selectedProject) return;
    if (!confirm('Are you sure you want to delete this objective?')) return;

    const userName = currentUser?.name || 'Unknown User';
    const updatedObjectives = selectedProject.objectives.filter(obj => obj.id !== objectiveId);
    updateProject(selectedProject.id, { objectives: updatedObjectives });

    miyagiWidgetLog.addEvent('objective-deleted', `${userName} deleted objective from "${selectedProject.name}"`, {
      projectId: selectedProject.id,
      objectiveId: objectiveId,
      deletedBy: userName
    });
  };

  // Update objective current value
  const updateObjectiveValue = (objectiveId, newValue) => {
    if (!selectedProject) return;

    const updatedObjectives = selectedProject.objectives.map(obj =>
      obj.id === objectiveId
        ? { ...obj, currentValue: parseFloat(newValue) || 0 }
        : obj
    );

    updateProject(selectedProject.id, { objectives: updatedObjectives });
  };

  // Helper to update project
  const updateProject = (projectId, updates) => {
    setProjectsData({
      projects: projectsData.projects.map(p =>
        p.id === projectId
          ? { ...p, ...updates, updatedAt: Date.now() }
          : p
      )
    });
  };

  // Get selected milestone
  const selectedMilestone = useMemo(() => {
    if (!selectedProject) return null;
    return selectedProject.milestones.find(m => m.id === selectedMilestoneId);
  }, [selectedProject, selectedMilestoneId]);

  // Open milestone modal
  const openMilestoneModal = (milestone = null) => {
    if (milestone) {
      setMilestoneForm({
        name: milestone.name,
        description: milestone.description || '',
        targetDate: milestone.targetDate || ''
      });
      setEditingMilestone(milestone);
    } else {
      setMilestoneForm({
        name: '',
        description: '',
        targetDate: ''
      });
      setEditingMilestone(null);
    }
    setShowMilestoneModal(true);
  };

  // Save milestone
  const saveMilestone = () => {
    if (!milestoneForm.name.trim() || !selectedProject) return;

    const userName = currentUser?.name || 'Unknown User';

    if (editingMilestone) {
      // Update existing milestone
      const updatedMilestones = selectedProject.milestones.map(m =>
        m.id === editingMilestone.id
          ? {
              ...m,
              name: milestoneForm.name.trim(),
              description: milestoneForm.description.trim(),
              targetDate: milestoneForm.targetDate
            }
          : m
      );

      updateProject(selectedProject.id, { milestones: updatedMilestones });

      miyagiWidgetLog.addEvent('milestone-updated', `${userName} updated milestone "${milestoneForm.name}" in "${selectedProject.name}"`, {
        projectId: selectedProject.id,
        milestoneId: editingMilestone.id,
        updatedBy: userName
      });
    } else {
      // Create new milestone
      const newMilestone = {
        id: `mile-${Date.now()}`,
        name: milestoneForm.name.trim(),
        description: milestoneForm.description.trim(),
        targetDate: milestoneForm.targetDate,
        completed: false,
        completedDate: null,
        order: selectedProject.milestones.length
      };

      const updatedMilestones = [...selectedProject.milestones, newMilestone];
      updateProject(selectedProject.id, { milestones: updatedMilestones });

      miyagiWidgetLog.addEvent('milestone-created', `${userName} added milestone "${newMilestone.name}" to "${selectedProject.name}"`, {
        projectId: selectedProject.id,
        milestoneId: newMilestone.id,
        createdBy: userName
      });
    }

    setShowMilestoneModal(false);
  };

  // Delete milestone
  const deleteMilestone = (milestoneId) => {
    if (!selectedProject) return;
    
    const milestone = selectedProject.milestones.find(m => m.id === milestoneId);
    const milestoneTasks = taskData.tasks.filter(t => t.milestoneId === milestoneId);
    
    if (milestoneTasks.length > 0) {
      if (!confirm(`This milestone has ${milestoneTasks.length} tasks. Are you sure you want to delete it? The tasks will remain but lose their milestone assignment.`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete "${milestone.name}"?`)) {
        return;
      }
    }

    const userName = currentUser?.name || 'Unknown User';
    
    // Remove milestone from project
    const updatedMilestones = selectedProject.milestones.filter(m => m.id !== milestoneId);
    updateProject(selectedProject.id, { milestones: updatedMilestones });

    // Update tasks to remove milestone reference
    if (milestoneTasks.length > 0) {
      setTaskData({
        ...taskData,
        tasks: taskData.tasks.map(t => 
          t.milestoneId === milestoneId 
            ? { ...t, milestoneId: null }
            : t
        )
      });
    }

    miyagiWidgetLog.addEvent('milestone-deleted', `${userName} deleted milestone "${milestone.name}" from "${selectedProject.name}"`, {
      projectId: selectedProject.id,
      milestoneId: milestoneId,
      deletedBy: userName
    });
  };

  // Check if milestone is complete (all tasks done)
  const isMilestoneComplete = (milestoneId) => {
    const milestoneTasks = taskData.tasks.filter(t => t.milestoneId === milestoneId);
    if (milestoneTasks.length === 0) return false;
    return milestoneTasks.every(t => t.completed);
  };

  // Auto-complete milestone when all tasks are done
  useEffect(() => {
    if (!selectedProject) return;

    selectedProject.milestones.forEach(milestone => {
      const isComplete = isMilestoneComplete(milestone.id);
      
      // Auto-complete if all tasks done
      if (isComplete && !milestone.completed) {
        const updatedMilestones = selectedProject.milestones.map(m =>
          m.id === milestone.id
            ? { ...m, completed: true, completedDate: new Date().toISOString().split('T')[0] }
            : m
        );
        updateProject(selectedProject.id, { milestones: updatedMilestones });

        const userName = currentUser?.name || 'Unknown User';
        miyagiWidgetLog.addEvent('milestone-completed', `Milestone "${milestone.name}" completed in "${selectedProject.name}"`, {
          projectId: selectedProject.id,
          milestoneId: milestone.id,
          completedBy: userName
        });
      }
      
      // Uncomplete if tasks are no longer all done
      if (!isComplete && milestone.completed) {
        const updatedMilestones = selectedProject.milestones.map(m =>
          m.id === milestone.id
            ? { ...m, completed: false, completedDate: null }
            : m
        );
        updateProject(selectedProject.id, { milestones: updatedMilestones });
      }
    });
  }, [taskData.tasks, selectedProject]);

  // Get milestone task counts and progress
  const getMilestoneProgress = (milestoneId) => {
    const milestoneTasks = taskData.tasks.filter(t => t.milestoneId === milestoneId);
    if (milestoneTasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    const completed = milestoneTasks.filter(t => t.completed).length;
    return {
      completed,
      total: milestoneTasks.length,
      percentage: Math.round((completed / milestoneTasks.length) * 100)
    };
  };

  // Open task modal for milestone
  const openTaskModal = (task = null) => {
    if (task) {
      setTaskForm({
        name: task.name,
        description: task.description || '',
        groupId: task.groupId || '',
        assignedUserId: task.assignedUser?.id || '',
        dueDate: task.dueDate || '',
        dependsOn: task.dependsOn || []
      });
      setEditingTask(task);
    } else {
      setTaskForm({
        name: '',
        description: '',
        groupId: '',
        assignedUserId: '',
        dueDate: '',
        dependsOn: []
      });
      setEditingTask(null);
    }
    setShowTaskModal(true);
    
    // Load canvas users if not loaded
    if (canvasUsers.length === 0) {
      loadCanvasUsers();
    }
  };

  // Load canvas users for task assignment
  const loadCanvasUsers = async () => {
    try {
      const response = await miyagiAPI.post('get-canvas-users', {});
      setCanvasUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load canvas users:', error);
    }
  };

  // Save task
  const saveTask = () => {
    if (!taskForm.name.trim() || !selectedMilestoneId || !selectedProject) return;

    const userName = currentUser?.name || 'Unknown User';
    const assignedUser = taskForm.assignedUserId 
      ? canvasUsers.find(u => u.id === taskForm.assignedUserId)
      : null;

    if (editingTask) {
      // Update existing task
      const updatedTask = {
        ...editingTask,
        name: taskForm.name.trim(),
        description: taskForm.description.trim(),
        groupId: taskForm.groupId || null,
        assignedUser: assignedUser || null,
        dueDate: taskForm.dueDate || null,
        dependsOn: taskForm.dependsOn
      };

      setTaskData({
        ...taskData,
        tasks: taskData.tasks.map(t => 
          t.id === editingTask.id ? updatedTask : t
        )
      });

      miyagiWidgetLog.addEvent('task-updated', `${userName} updated task "${updatedTask.name}"`, {
        taskId: updatedTask.id,
        projectId: selectedProject.id,
        milestoneId: selectedMilestoneId,
        updatedBy: userName
      });
    } else {
      // Create new task
      const newTask = {
        id: `task-${Date.now()}`,
        name: taskForm.name.trim(),
        description: taskForm.description.trim(),
        groupId: taskForm.groupId || null,
        completed: false,
        createdAt: Date.now(),
        dueDate: taskForm.dueDate || null,
        assignedUser: assignedUser || null,
        projectId: selectedProject.id,
        milestoneId: selectedMilestoneId,
        dependsOn: taskForm.dependsOn
      };

      setTaskData({
        ...taskData,
        tasks: [...taskData.tasks, newTask]
      });

      miyagiWidgetLog.addEvent('task-created', `${userName} created task "${newTask.name}" in milestone "${selectedMilestone.name}"`, {
        taskId: newTask.id,
        projectId: selectedProject.id,
        milestoneId: selectedMilestoneId,
        createdBy: userName
      });
    }

    setShowTaskModal(false);
  };

  // Delete task
  const deleteTask = (taskId) => {
    const task = taskData.tasks.find(t => t.id === taskId);
    if (!confirm(`Are you sure you want to delete "${task.name}"?`)) return;

    const userName = currentUser?.name || 'Unknown User';
    
    setTaskData({
      ...taskData,
      tasks: taskData.tasks.filter(t => t.id !== taskId)
    });

    miyagiWidgetLog.addEvent('task-deleted', `${userName} deleted task "${task.name}"`, {
      taskId: taskId,
      projectId: selectedProject?.id,
      milestoneId: selectedMilestoneId,
      deletedBy: userName
    });
  };

  // Toggle task completion
  const toggleTask = (taskId) => {
    const task = taskData.tasks.find(t => t.id === taskId);
    const newStatus = !task.completed;

    setTaskData({
      ...taskData,
      tasks: taskData.tasks.map(t =>
        t.id === taskId ? { ...t, completed: newStatus } : t
      )
    });

    const userName = currentUser?.name || 'Unknown User';
    miyagiWidgetLog.addEvent('task-status-changed', `${userName} marked task "${task.name}" as ${newStatus ? 'completed' : 'incomplete'}`, {
      taskId: taskId,
      completed: newStatus,
      changedBy: userName
    });
  };

  // Get available tasks for dependency selection (in same project, excluding current task)
  const getAvailableDependencyTasks = () => {
    if (!selectedProject) return [];
    return taskData.tasks.filter(t => 
      t.projectId === selectedProject.id && 
      (!editingTask || t.id !== editingTask.id)
    );
  };

  // Check if task is blocked by dependencies
  const isTaskBlocked = (task) => {
    if (!task.dependsOn || task.dependsOn.length === 0) return false;
    return task.dependsOn.some(depId => {
      const depTask = taskData.tasks.find(t => t.id === depId);
      return depTask && !depTask.completed;
    });
  };

  // Back to list view
  const backToList = () => {
    setCurrentView('list');
    setSelectedProjectId(null);
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'white',
      color: '#333',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        height: '100%'
      }}>
        {currentView === 'list' ? (
          /* ========== PROJECTS LIST VIEW ========== */
          <>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '16px'
            }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '600' }}>
                  Project Manager
                </h2>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                  {filteredProjects.length} {filterStatus === 'all' ? '' : filterStatus} projects
                </div>
              </div>
              <button
                onClick={openCreateProjectModal}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#2196F3',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                + New Project
              </button>
            </div>

            {/* Filter Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '20px',
              borderBottom: '2px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '0'
            }}>
              {['all', 'active', 'planning', 'completed', 'archived'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderBottom: filterStatus === status ? '3px solid #2196F3' : '3px solid transparent',
                    background: 'transparent',
                    color: filterStatus === status ? '#2196F3' : '#666',
                    cursor: 'pointer',
                    fontWeight: filterStatus === status ? '600' : '500',
                    fontSize: '14px',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Projects Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              maxHeight: 'calc(100vh - 280px)',
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {filteredProjects.length === 0 ? (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px 20px',
                  opacity: 0.6
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    No {filterStatus === 'all' ? '' : filterStatus} projects
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    Click "New Project" to get started
                  </div>
                </div>
              ) : (
                filteredProjects.map(project => {
                  const progress = getProjectProgress(project);
                  const taskCounts = getProjectTaskCounts(project);
                  
                  return (
                    <div
                      key={project.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setCurrentView('detail');
                      }}
                    >
                      {/* Project Header */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', flex: 1 }}>
                            {project.name}
                          </h3>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditProjectModal(project);
                              }}
                              style={{
                                padding: '4px 8px',
                                border: 'none',
                                borderRadius: '4px',
                                background: '#F5F5F5',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                              }}
                              style={{
                                padding: '4px 8px',
                                border: 'none',
                                borderRadius: '4px',
                                background: '#DC3545',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        
                        {/* Status and Priority Badges */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: getStatusColor(project.status),
                            color: 'white'
                          }}>
                            {project.status}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: getPriorityColor(project.priority),
                            color: 'white'
                          }}>
                            {project.priority} priority
                          </span>
                        </div>

                        {project.description && (
                          <div style={{
                            fontSize: '13px',
                            opacity: 0.7,
                            marginBottom: '8px',
                            lineHeight: '1.4'
                          }}>
                            {project.description}
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          marginBottom: '4px',
                          color: '#666'
                        }}>
                          <span>{progress}% complete</span>
                          <span>{taskCounts.completed}/{taskCounts.total} tasks</span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#E0E0E0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: progress === 100 ? '#4CAF50' : '#2196F3',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>

                      {/* Dates and Owner */}
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <div style={{ marginBottom: '4px' }}>
                          📅 Due: {formatDate(project.dates.targetEndDate)}
                        </div>
                        <div>
                          👤 Owner: {project.ownerName}
                        </div>
                      </div>

                      {/* Quick Status Change */}
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
                        <select
                          value={project.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            changeProjectStatus(project.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '12px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="planning">Planning</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : currentView === 'detail' ? (
          /* ========== PROJECT DETAIL VIEW ========== */
          selectedProject && (
            <>
              {/* Header with Back Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
              }}>
                <button
                  onClick={backToList}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ← Back
                </button>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '600' }}>
                    {selectedProject.name}
                  </h2>
                  <div style={{ fontSize: '14px', opacity: 0.7 }}>
                    {selectedProject.ownerName} • {formatDate(selectedProject.dates.startDate)} - {formatDate(selectedProject.dates.targetEndDate)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={selectedProject.status}
                    onChange={(e) => changeProjectStatus(selectedProject.id, e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    onClick={() => openEditProjectModal(selectedProject)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      background: 'white',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div style={{
                maxHeight: 'calc(100vh - 200px)',
                overflowY: 'auto',
                paddingRight: '8px'
              }}>
                {/* Objectives Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      📊 Objectives & Success Metrics
                    </h3>
                    <button
                      onClick={() => openObjectiveModal()}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#2196F3',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      + Add Objective
                    </button>
                  </div>

                  {selectedProject.objectives.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      No objectives defined yet. Click "Add Objective" to get started.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedProject.objectives.map(objective => {
                        const progress = objective.targetValue > 0
                          ? Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100))
                          : 0;

                        return (
                          <div
                            key={objective.id}
                            style={{
                              padding: '16px',
                              background: 'rgba(255, 255, 255, 0.8)',
                              borderRadius: '8px',
                              border: '1px solid rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '8px'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                                  {objective.description}
                                </div>
                                {objective.metric && (
                                  <div style={{ fontSize: '13px', color: '#666' }}>
                                    {objective.metric}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => openObjectiveModal(objective)}
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    background: '#F5F5F5',
                                    color: '#666',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteObjective(objective.id)}
                                  style={{
                                    padding: '4px 8px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    background: '#DC3545',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Progress Section */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '12px',
                                  marginBottom: '4px',
                                  color: '#666'
                                }}>
                                  <span>Current: {objective.currentValue}{objective.unit}</span>
                                  <span>Target: {objective.targetValue}{objective.unit}</span>
                                </div>
                                <div style={{
                                  width: '100%',
                                  height: '6px',
                                  background: '#E0E0E0',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: progress >= 100 ? '#4CAF50' : progress >= 50 ? '#2196F3' : '#FF9800',
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                              </div>
                              <input
                                type="number"
                                value={objective.currentValue}
                                onChange={(e) => updateObjectiveValue(objective.id, e.target.value)}
                                style={{
                                  width: '80px',
                                  padding: '4px 8px',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  textAlign: 'right'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Milestones Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px' 
                  }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                      🎯 Milestones
                    </h3>
                    <button
                      onClick={() => openMilestoneModal()}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#9C27B0',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      + Add Milestone
                    </button>
                  </div>

                  {selectedProject.milestones.length === 0 ? (
                    <div style={{
                      padding: '20px',
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      No milestones yet. Add one to track project progress.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedProject.milestones
                        .sort((a, b) => a.order - b.order)
                        .map((milestone) => {
                          const progress = getMilestoneProgress(milestone.id);
                          const isOverdue = milestone.targetDate && 
                            new Date(milestone.targetDate) < new Date() && 
                            !milestone.completed;

                          return (
                            <div
                              key={milestone.id}
                              style={{
                                padding: '16px',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px',
                                background: milestone.completed ? '#F1F8F4' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}
                              onClick={() => {
                                setSelectedMilestoneId(milestone.id);
                                setCurrentView('milestone');
                              }}
                            >
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'flex-start',
                                marginBottom: '8px'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    marginBottom: '4px'
                                  }}>
                                    <span style={{ 
                                      fontSize: '16px', 
                                      fontWeight: '500',
                                      color: milestone.completed ? '#4CAF50' : '#333'
                                    }}>
                                      {milestone.completed ? '✓' : '○'} {milestone.name}
                                    </span>
                                    {isOverdue && (
                                      <span style={{
                                        padding: '2px 6px',
                                        background: '#DC3545',
                                        color: 'white',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        fontWeight: '500'
                                      }}>
                                        OVERDUE
                                      </span>
                                    )}
                                  </div>
                                  {milestone.description && (
                                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                                      {milestone.description}
                                    </div>
                                  )}
                                  <div style={{ 
                                    fontSize: '12px', 
                                    color: '#666',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                  }}>
                                    {milestone.targetDate && (
                                      <span>
                                        📅 {new Date(milestone.targetDate).toLocaleDateString()}
                                      </span>
                                    )}
                                    <span>
                                      {progress.completed}/{progress.total} tasks
                                    </span>
                                    {milestone.completed && milestone.completedDate && (
                                      <span style={{ color: '#4CAF50' }}>
                                        ✓ Completed {new Date(milestone.completedDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '4px',
                                  marginLeft: '12px'
                                }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMilestoneModal(milestone);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#F5F5F5',
                                      color: '#666',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteMilestone(milestone.id);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      background: '#DC3545',
                                      color: 'white',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {/* Milestone Progress Bar */}
                              {progress.total > 0 && (
                                <div style={{
                                  width: '100%',
                                  height: '6px',
                                  background: '#E0E0E0',
                                  borderRadius: '3px',
                                  overflow: 'hidden',
                                  marginTop: '8px'
                                }}>
                                  <div style={{
                                    width: `${progress.percentage}%`,
                                    height: '100%',
                                    background: milestone.completed ? '#4CAF50' : '#9C27B0',
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        ) : currentView === 'milestone' ? (
          /* ========== MILESTONE DETAIL VIEW ========== */
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              paddingBottom: '16px'
            }}>
              <button
                onClick={() => {
                  setCurrentView('detail');
                  setSelectedMilestoneId(null);
                }}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#F5F5F5',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ← Back
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '4px' }}>
                  {selectedProject?.name}
                </div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                  {selectedMilestone?.name}
                </h2>
                {selectedMilestone?.description && (
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                    {selectedMilestone.description}
                  </div>
                )}
              </div>
              {selectedMilestone?.completed ? (
                <div style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#4CAF50',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  ✓ Completed
                </div>
              ) : (
                <button
                  onClick={() => openTaskModal()}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#9C27B0',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  + Add Task
                </button>
              )}
            </div>

            {/* Milestone Info */}
            {selectedMilestone && (
              <div style={{ 
                padding: '16px',
                background: 'rgba(156, 39, 176, 0.05)',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                gap: '24px',
                alignItems: 'center'
              }}>
                {selectedMilestone.targetDate && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                      Target Date
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>
                      📅 {new Date(selectedMilestone.targetDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {(() => {
                  const progress = getMilestoneProgress(selectedMilestone.id);
                  return (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        Progress
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '100%',
                          height: '8px',
                          background: '#E0E0E0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${progress.percentage}%`,
                            height: '100%',
                            background: '#9C27B0',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '500', minWidth: '60px' }}>
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tasks List */}
            <div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>
                Tasks
              </h3>
              {(() => {
                const milestoneTasks = taskData.tasks.filter(t => t.milestoneId === selectedMilestoneId);
                
                if (milestoneTasks.length === 0) {
                  return (
                    <div style={{
                      padding: '40px 20px',
                      background: 'rgba(0, 0, 0, 0.02)',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      No tasks yet. Add tasks to track milestone progress.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {milestoneTasks.map((task) => {
                      const blocked = isTaskBlocked(task);
                      
                      return (
                        <div
                          key={task.id}
                          style={{
                            padding: '12px',
                            border: '1px solid rgba(0, 0, 0, 0.1)',
                            borderRadius: '8px',
                            background: task.completed ? '#F1F8F4' : blocked ? '#FFF3E0' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task.id)}
                            disabled={blocked}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: blocked ? 'not-allowed' : 'pointer',
                              opacity: blocked ? 0.5 : 1
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              color: task.completed ? '#666' : '#333',
                              marginBottom: '4px'
                            }}>
                              {task.name}
                              {blocked && (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  background: '#FF9800',
                                  color: 'white',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  fontWeight: '500'
                                }}>
                                  BLOCKED
                                </span>
                              )}
                            </div>
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#666',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {task.assignedUser && (
                                  <span>👤 {task.assignedUser.name}</span>
                                )}
                                {task.dueDate && (
                                  <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                                )}
                              </div>
                              {task.dependsOn && task.dependsOn.length > 0 && (
                                <div style={{ 
                                  padding: '8px',
                                  background: 'rgba(255, 152, 0, 0.1)',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255, 152, 0, 0.2)'
                                }}>
                                  <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
                                    🔗 Depends on:
                                  </div>
                                  {task.dependsOn.map(depId => {
                                    const depTask = taskData.tasks.find(t => t.id === depId);
                                    if (!depTask) return null;
                                    return (
                                      <div key={depId} style={{ 
                                        fontSize: '12px',
                                        marginTop: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}>
                                        <span style={{ 
                                          color: depTask.completed ? '#4CAF50' : '#FF9800',
                                          fontWeight: '500'
                                        }}>
                                          {depTask.completed ? '✓' : '○'}
                                        </span>
                                        <span style={{ 
                                          textDecoration: depTask.completed ? 'line-through' : 'none',
                                          color: depTask.completed ? '#666' : '#333'
                                        }}>
                                          {depTask.name}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => openTaskModal(task)}
                              style={{
                                padding: '4px 8px',
                                border: 'none',
                                borderRadius: '4px',
                                background: '#F5F5F5',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              style={{
                                padding: '4px 8px',
                                border: 'none',
                                borderRadius: '4px',
                                background: '#DC3545',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </>
        ) : null}

        {/* Create/Edit Project Modal */}
        {showCreateProjectModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    placeholder="e.g., Q4 Marketing Campaign"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    placeholder="Describe the project goals and scope..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Priority
                    </label>
                    <select
                      value={projectForm.priority}
                      onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: 'white',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={projectForm.startDate}
                      onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Target End Date
                  </label>
                  <input
                    type="date"
                    value={projectForm.targetEndDate}
                    onChange={(e) => setProjectForm({ ...projectForm, targetEndDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreateProjectModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveProject}
                  disabled={!projectForm.name.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    background: projectForm.name.trim() ? '#2196F3' : '#ccc',
                    color: 'white',
                    cursor: projectForm.name.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Objective Modal */}
        {showObjectiveModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
                {editingObjective ? 'Edit Objective' : 'Add Objective'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Objective Description *
                  </label>
                  <textarea
                    value={objectiveForm.description}
                    onChange={(e) => setObjectiveForm({ ...objectiveForm, description: e.target.value })}
                    placeholder="e.g., Increase brand awareness by 30%"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Metric Name
                  </label>
                  <input
                    type="text"
                    value={objectiveForm.metric}
                    onChange={(e) => setObjectiveForm({ ...objectiveForm, metric: e.target.value })}
                    placeholder="e.g., Survey score, Revenue, Users"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Target Value
                    </label>
                    <input
                      type="number"
                      value={objectiveForm.targetValue}
                      onChange={(e) => setObjectiveForm({ ...objectiveForm, targetValue: e.target.value })}
                      placeholder="100"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Current Value
                    </label>
                    <input
                      type="number"
                      value={objectiveForm.currentValue}
                      onChange={(e) => setObjectiveForm({ ...objectiveForm, currentValue: e.target.value })}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                      Unit
                    </label>
                    <input
                      type="text"
                      value={objectiveForm.unit}
                      onChange={(e) => setObjectiveForm({ ...objectiveForm, unit: e.target.value })}
                      placeholder="%"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowObjectiveModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveObjective}
                  disabled={!objectiveForm.description.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    background: objectiveForm.description.trim() ? '#2196F3' : '#ccc',
                    color: 'white',
                    cursor: objectiveForm.description.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {editingObjective ? 'Save Changes' : 'Add Objective'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Milestone Modal */}
        {showMilestoneModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
                {editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Milestone Name *
                  </label>
                  <input
                    type="text"
                    value={milestoneForm.name}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
                    placeholder="e.g., Complete MVP Development"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                    placeholder="Brief description of this milestone"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={milestoneForm.targetDate}
                    onChange={(e) => setMilestoneForm({ ...milestoneForm, targetDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowMilestoneModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveMilestone}
                  disabled={!milestoneForm.name.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    background: milestoneForm.name.trim() ? '#9C27B0' : '#ccc',
                    color: 'white',
                    cursor: milestoneForm.name.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {editingMilestone ? 'Save Changes' : 'Add Milestone'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Task Modal */}
        {showTaskModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Task Name *
                  </label>
                  <input
                    type="text"
                    value={taskForm.name}
                    onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                    placeholder="e.g., Implement user authentication"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Task details..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Assign To
                  </label>
                  <select
                    value={taskForm.assignedUserId}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedUserId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">Unassigned</option>
                    {canvasUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                    Task Dependencies
                  </label>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    Select tasks that must be completed before this one
                  </div>
                  <div style={{
                    maxHeight: '150px',
                    overflow: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '8px'
                  }}>
                    {getAvailableDependencyTasks().length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#999', textAlign: 'center', padding: '12px' }}>
                        No other tasks in this project
                      </div>
                    ) : (
                      getAvailableDependencyTasks().map(task => (
                        <label
                          key={task.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={taskForm.dependsOn.includes(task.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTaskForm({
                                  ...taskForm,
                                  dependsOn: [...taskForm.dependsOn, task.id]
                                });
                              } else {
                                setTaskForm({
                                  ...taskForm,
                                  dependsOn: taskForm.dependsOn.filter(id => id !== task.id)
                                });
                              }
                            }}
                            style={{ marginRight: '8px' }}
                          />
                          <span style={{ fontSize: '13px' }}>{task.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowTaskModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveTask}
                  disabled={!taskForm.name.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    background: taskForm.name.trim() ? '#9C27B0' : '#ccc',
                    color: 'white',
                    cursor: taskForm.name.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectManagerWidget;
