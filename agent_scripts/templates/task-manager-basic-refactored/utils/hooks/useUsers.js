/**
 * Hook for managing user data and loading
 */

import { useState, useEffect } from 'react';

export function useUsers() {
  const [currentUser, setCurrentUser] = useState(null);
  const [canvasUsers, setCanvasUsers] = useState([]);

  // Load current user information
  const loadCurrentUser = async () => {
    try {
      const response = await miyagiAPI.post('get-current-user', {});
      if (response.success) {
        setCurrentUser(response.user);
        console.log(`Task Manager loaded for user: ${response.user.name}`);
      }
    } catch (error) {
      console.warn('Failed to load current user for task manager:', error);
    }
  };

  // Load canvas users for task assignment
  const loadCanvasUsers = async () => {
    try {
      const response = await miyagiAPI.post('get-canvas-users', {});
      if (response.success && response.users) {
        setCanvasUsers(response.users);
      }
    } catch (error) {
      console.warn('Failed to load canvas users:', error);
    }
  };

  // Load users on mount
  useEffect(() => {
    loadCurrentUser();
    loadCanvasUsers();
  }, []);

  return {
    currentUser,
    canvasUsers,
    loadCurrentUser,
    loadCanvasUsers
  };
}
