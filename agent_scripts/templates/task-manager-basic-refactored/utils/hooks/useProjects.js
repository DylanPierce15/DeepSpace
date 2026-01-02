/**
 * Hook for project management operations
 */

import { useState, useMemo } from 'react';
import { 
  logProjectCreated, 
  logProjectRenamed, 
  logProjectDeleted,
  logProjectUnarchived
} from '../logging.js';
import { DEFAULT_TASK_DATA } from '../constants/defaults.js';

export function useProjects(currentUser = null) {
  const [taskData, setTaskData] = useGlobalStorage('tasks', DEFAULT_TASK_DATA);
  
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // Filter active and archived projects
  const activeProjects = useMemo(() => 
    (taskData?.projects || []).filter(p => !p.archived),
    [taskData?.projects]
  );

  const archivedProjects = useMemo(() => 
    (taskData?.projects || []).filter(p => p.archived),
    [taskData?.projects]
  );

  // Group tasks by projectId
  const tasksByProject = useMemo(() => {
    const grouped = {};
    if (taskData?.projects) {
      taskData.projects.forEach(project => {
        grouped[project.id] = (taskData.tasks || []).filter(task => task.projectId === project.id);
      });
    }
    return grouped;
  }, [taskData]);

  // Add new project
  const addProject = () => {
    const projectName = prompt('Enter project name:');
    if (!projectName || !projectName.trim()) return;

    const newProject = {
      id: `project-${Date.now()}`,
      name: projectName.trim(),
      archived: false
    };

    setTaskData({
      ...taskData,
      projects: [...(taskData?.projects || []), newProject]
    });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logProjectCreated(projectName.trim(), userName, userId, newProject.id);
  };

  // Start editing project name
  const startEditingProject = (projectId) => {
    const project = taskData?.projects?.find(p => p.id === projectId);
    if (project) {
      setEditingProjectId(projectId);
      setEditingProjectName(project.name);
    }
  };

  // Save project name
  const saveProjectName = (projectId) => {
    if (!editingProjectName.trim()) return;

    const updatedProjects = (taskData?.projects || []).map(project =>
      project.id === projectId
        ? { ...project, name: editingProjectName.trim() }
        : project
    );

    setTaskData({ ...taskData, projects: updatedProjects });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logProjectRenamed(projectId, editingProjectName.trim(), userName, userId);

    setEditingProjectId(null);
    setEditingProjectName('');
  };

  // Open delete project modal
  const openDeleteProjectModal = (projectId) => {
    const project = taskData?.projects?.find(p => p.id === projectId);
    if (project) {
      setProjectToDelete(project);
      setShowDeleteProjectModal(true);
    }
  };

  // Confirm delete project (archive it and clear tasks' projectId)
  const confirmDeleteProject = () => {
    if (!projectToDelete) return;

    const updatedProjects = (taskData?.projects || []).map(project =>
      project.id === projectToDelete.id
        ? { ...project, archived: true }
        : project
    );

    const updatedTasks = (taskData?.tasks || []).map(task =>
      task.projectId === projectToDelete.id
        ? { ...task, projectId: '' }
        : task
    );

    setTaskData({
      ...taskData,
      projects: updatedProjects,
      tasks: updatedTasks
    });

    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    logProjectDeleted(projectToDelete.name, userName, userId, projectToDelete.id);

    setShowDeleteProjectModal(false);
    setProjectToDelete(null);
  };

  // Unarchive project
  const unarchiveProject = (projectId) => {
    const updatedProjects = (taskData?.projects || []).map(project =>
      project.id === projectId
        ? { ...project, archived: false }
        : project
    );

    setTaskData({ ...taskData, projects: updatedProjects });

    const project = taskData?.projects?.find(p => p.id === projectId);
    const userName = currentUser?.name || 'Unknown User';
    const userId = currentUser?.id || null;
    
    if (project) {
      logProjectUnarchived(project.name, userName, userId, projectId);
    }
  };

  return {
    projects: taskData?.projects || [],
    activeProjects,
    archivedProjects,
    tasksByProject,
    addProject,
    updateProject: (projectId, updates) => {
      const updatedProjects = (taskData?.projects || []).map(project =>
        project.id === projectId ? { ...project, ...updates } : project
      );
      setTaskData({ ...taskData, projects: updatedProjects });
      
      if (updates.name) {
        const userName = currentUser?.name || 'Unknown User';
        const userId = currentUser?.id || null;
        logProjectRenamed(updates.name, userName, userId, projectId);
      }
    },
    archiveProject: (projectId) => {
      const updatedProjects = (taskData?.projects || []).map(project =>
        project.id === projectId
          ? { ...project, archived: true }
          : project
      );
      setTaskData({ ...taskData, projects: updatedProjects });
      
      const project = taskData?.projects?.find(p => p.id === projectId);
      const userName = currentUser?.name || 'Unknown User';
      const userId = currentUser?.id || null;
      
      if (project) {
        logProjectDeleted(project.name, userName, userId, projectId);
      }
    },
    // Legacy exports for backward compatibility
    showDeleteProjectModal,
    setShowDeleteProjectModal,
    projectToDelete,
    editingProjectId,
    editingProjectName,
    setEditingProjectName,
    selectedProjectId,
    setSelectedProjectId,
    startEditingProject,
    saveProjectName,
    openDeleteProjectModal,
    confirmDeleteProject,
    unarchiveProject
  };
}
