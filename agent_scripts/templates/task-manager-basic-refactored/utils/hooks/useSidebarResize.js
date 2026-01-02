/**
 * Hook for sidebar resize functionality
 */

import { useState, useEffect } from 'react';
import { 
  DEFAULT_SIDEBAR_WIDTH, 
  MIN_SIDEBAR_WIDTH, 
  MAX_SIDEBAR_WIDTH 
} from '../constants/defaults.js';

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useStorage('sidebar-width', DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Handle resize mouse movement
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = e.clientX - 20; // Account for container padding
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return {
    sidebarWidth,
    isResizing,
    handleResizeStart
  };
}
