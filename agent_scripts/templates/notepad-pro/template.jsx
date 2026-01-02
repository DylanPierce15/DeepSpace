import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FolderSidebar from './components/FolderSidebar';
import NotesList from './components/NotesList';
import NoteEditor from './components/NoteEditor';
import { initializeDefaults } from './utils/defaults';

/**
 * Notepad Pro - Professional Note-Taking with File-Based Storage
 * 
 * Uses useFiles hook for real-time synchronized file storage.
 * Notes are stored as markdown files, enabling direct editing in the repository.
 * 
 * File Structure:
 * files/notes/
 * ├── config.json           # { currentNote, currentFolder, expandedFolders }
 * └── {folders and .md files hierarchically}
 */

function NotepadProWidget() {
  const files = useFiles('notes/');
  const initRef = useRef(false);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Apply background
  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.body.style.margin = '0';
    return () => {
      document.body.style.background = '';
      document.body.style.margin = '';
    };
  }, []);

  // Read config
  const config = useMemo(() => {
    if (!files.ready) return {};
    const raw = files.read('config.json');
    if (!raw) return {};
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  }, [files]);

  const writeConfig = useCallback((updates) => {
    const newConfig = { ...config, ...updates };
    files.write('config.json', JSON.stringify(newConfig, null, 2));
  }, [files, config]);

  // Initialize if empty
  useEffect(() => {
    if (!files.ready || initRef.current) return;
    
    // Check if any notes exist (excluding config.json and .folder files)
    const items = files.list('');
    const hasContent = items.some(item => 
      item.endsWith('.md') || (item.endsWith('/') && item !== 'config.json')
    );
    
    if (!hasContent) {
      initRef.current = true;
      initializeDefaults(files);
    } else {
      initRef.current = true;
      // Restore state from config
      if (config.currentNote && files.exists(config.currentNote)) {
        setSelectedNote(config.currentNote);
      }
      if (config.currentFolder) {
        setCurrentPath(config.currentFolder);
      }
      if (config.expandedFolders) {
        setExpandedFolders(new Set(config.expandedFolders));
      }
    }
  }, [files.ready, files, config]);

  // Get folder structure at current path
  const items = useMemo(() => {
    if (!files.ready) return [];
    
    const rawItems = files.list(currentPath);
    return rawItems
      .filter(name => name !== 'config.json' && name !== '.folder')
      .map(name => ({
        name: name.endsWith('/') ? name.slice(0, -1) : name.replace('.md', ''),
        isFolder: name.endsWith('/'),
        fullPath: currentPath + name,
        rawName: name
      }))
      .sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [files, currentPath]);

  // Get all notes for search
  const allNotes = useMemo(() => {
    if (!files.ready || !searchQuery) return [];
    
    const results = [];
    const searchRecursive = (path) => {
      const items = files.list(path);
      items.forEach(item => {
        if (item.endsWith('.md')) {
          const fullPath = path + item;
          const content = files.read(fullPath) || '';
          if (content.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push({
              name: item.replace('.md', ''),
              fullPath,
              content,
              path
            });
          }
        } else if (item.endsWith('/')) {
          searchRecursive(path + item);
        }
      });
    };
    searchRecursive('');
    return results;
  }, [files, searchQuery]);

  // Navigation
  const navigateToFolder = useCallback((path) => {
    setCurrentPath(path);
    setSearchQuery('');
    writeConfig({ currentFolder: path });
  }, [writeConfig]);

  const selectNote = useCallback((path) => {
    setSelectedNote(path);
    setSearchQuery('');
    writeConfig({ currentNote: path });
  }, [writeConfig]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(Boolean);
    return parts.map((part, i) => ({
      name: part,
      path: parts.slice(0, i + 1).join('/') + '/'
    }));
  }, [currentPath]);

  // Create note
  const handleCreateNote = useCallback(() => {
    const timestamp = Date.now();
    const name = `note-${timestamp}.md`;
    const fullPath = currentPath + name;
    const content = `# New Note\n\nStart writing here...`;
    files.write(fullPath, content);
    setSelectedNote(fullPath);
    writeConfig({ currentNote: fullPath });
  }, [files, currentPath, writeConfig]);

  // Create folder
  const handleCreateFolder = useCallback(() => {
    const timestamp = Date.now();
    const name = `folder-${timestamp}`;
    const fullPath = currentPath + name + '/';
    files.write(fullPath + '.folder', ''); // Placeholder to create folder
  }, [files, currentPath]);

  // Delete note
  const handleDeleteNote = useCallback((path) => {
    if (!path) return;
    files.delete(path);
    if (selectedNote === path) {
      setSelectedNote(null);
      writeConfig({ currentNote: null });
    }
  }, [files, selectedNote, writeConfig]);

  // Delete folder
  const handleDeleteFolder = useCallback((path) => {
    if (!path) return;
    // Delete all contents recursively by deleting the folder path
    files.delete(path);
    if (currentPath.startsWith(path)) {
      setCurrentPath('');
      writeConfig({ currentFolder: '' });
    }
  }, [files, currentPath, writeConfig]);

  // Rename note
  const handleRenameNote = useCallback((oldPath, newName) => {
    if (!oldPath || !newName) return;
    const content = files.read(oldPath) || '';
    const pathParts = oldPath.split('/');
    pathParts.pop();
    const newPath = pathParts.join('/') + (pathParts.length ? '/' : '') + newName + '.md';
    files.write(newPath, content);
    files.delete(oldPath);
    if (selectedNote === oldPath) {
      setSelectedNote(newPath);
      writeConfig({ currentNote: newPath });
    }
  }, [files, selectedNote, writeConfig]);

  // Rename folder
  const handleRenameFolder = useCallback((oldPath, newName) => {
    if (!oldPath || !newName) return;
    // For folders, we need to move all contents
    const pathParts = oldPath.split('/').filter(Boolean);
    pathParts.pop();
    const newPath = (pathParts.length ? pathParts.join('/') + '/' : '') + newName + '/';
    
    // Move all files from old to new
    const moveRecursive = (fromPath, toPath) => {
      const items = files.list(fromPath);
      items.forEach(item => {
        if (item.endsWith('/')) {
          moveRecursive(fromPath + item, toPath + item);
        } else {
          const content = files.read(fromPath + item) || '';
          files.write(toPath + item, content);
        }
      });
    };
    
    moveRecursive(oldPath, newPath);
    files.delete(oldPath);
    
    if (currentPath.startsWith(oldPath)) {
      const newCurrentPath = currentPath.replace(oldPath, newPath);
      setCurrentPath(newCurrentPath);
      writeConfig({ currentFolder: newCurrentPath });
    }
  }, [files, currentPath, writeConfig]);

  // Update note content
  const handleUpdateNote = useCallback((content) => {
    if (!selectedNote) return;
    files.write(selectedNote, content);
  }, [files, selectedNote]);

  // Move note to folder
  const handleMoveNote = useCallback((notePath, targetFolder) => {
    if (!notePath) return;
    const content = files.read(notePath) || '';
    const fileName = notePath.split('/').pop();
    const newPath = targetFolder + fileName;
    files.write(newPath, content);
    files.delete(notePath);
    if (selectedNote === notePath) {
      setSelectedNote(newPath);
      writeConfig({ currentNote: newPath });
    }
  }, [files, selectedNote, writeConfig]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      writeConfig({ expandedFolders: Array.from(next) });
      return next;
    });
  }, [writeConfig]);

  // Loading state
  if (!files.ready) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    );
  }

  // Read current note content
  const noteContent = selectedNote ? (files.read(selectedNote) || '') : '';
  const noteName = selectedNote ? selectedNote.split('/').pop().replace('.md', '') : '';

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      background: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Folder Sidebar */}
      <FolderSidebar
        files={files}
        currentPath={currentPath}
        selectedNote={selectedNote}
        expandedFolders={expandedFolders}
        onNavigate={navigateToFolder}
        onSelectNote={selectNote}
        onToggleFolder={toggleFolder}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onMoveNote={handleMoveNote}
      />
      
      {/* Notes List */}
      <NotesList
        items={items}
        searchResults={searchQuery ? allNotes : []}
        selectedNote={selectedNote}
        searchQuery={searchQuery}
        currentPath={currentPath}
        breadcrumbs={breadcrumbs}
        onSelectNote={selectNote}
        onDeleteNote={handleDeleteNote}
        onRenameNote={handleRenameNote}
        onCreateNote={handleCreateNote}
        onSearchChange={setSearchQuery}
        onNavigate={navigateToFolder}
        onMoveNote={handleMoveNote}
      />
      
      {/* Note Editor */}
      <NoteEditor
        content={noteContent}
        noteName={noteName}
        notePath={selectedNote}
        onUpdate={handleUpdateNote}
        onDelete={() => handleDeleteNote(selectedNote)}
        onRename={(newName) => handleRenameNote(selectedNote, newName)}
      />
    </div>
  );
}

export default NotepadProWidget;

