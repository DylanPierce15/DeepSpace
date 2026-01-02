import React, { useState, useMemo, useCallback } from 'react';
import { generateFolderId, getNotesInFolder } from '../utils/folderUtils';
import { confirmAction } from './Toast';

export default function FolderSidebar({ 
  folders, 
  notes,
  selectedFolderId, 
  onSelectFolder, 
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onDropFolder,
  onDropNote
}) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  // Count notes in folder and descendants
  const countNotesInFolder = useCallback((folderId) => {
    if (!notes || !folders) return 0;
    
    const directNotes = getNotesInFolder(notes, folderId).length;
    
    const getDescendantIds = (parentId) => {
      const children = folders.filter(f => f.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    
    const descendantNotes = getDescendantIds(folderId)
      .reduce((count, id) => count + getNotesInFolder(notes, id).length, 0);
    
    return directNotes + descendantNotes;
  }, [notes, folders]);

  // Build folder hierarchy
  const folderHierarchy = useMemo(() => {
    if (!folders) return [];
    
    const rootFolders = folders.filter(f => !f.parentId);
    const childFolders = folders.filter(f => f.parentId);
    
    const sortFolders = (folderList) => [...folderList].sort((a, b) => {
      const orderA = a.order ?? Infinity;
      const orderB = b.order ?? Infinity;
      return orderA !== orderB ? orderA - orderB : (a.name || '').localeCompare(b.name || '');
    });
    
    const getChildren = (parentId) => {
      return sortFolders(childFolders.filter(f => f.parentId === parentId))
        .map(f => ({
          ...f,
          noteCount: countNotesInFolder(f.id),
          children: getChildren(f.id)
        }));
    };
    
    return sortFolders(rootFolders).map(folder => ({
      ...folder,
      noteCount: countNotesInFolder(folder.id),
      children: getChildren(folder.id)
    }));
  }, [folders, countNotesInFolder]);

  const isDescendant = useCallback((folderId, ancestorId) => {
    if (!folders) return false;
    let current = folders.find(f => f.id === folderId);
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      current = folders.find(f => f.id === current.parentId);
    }
    return false;
  }, [folders]);

  const handleDragOver = (e, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'folder' && (data.id === targetFolderId || isDescendant(targetFolderId, data.id))) {
        e.dataTransfer.dropEffect = 'none';
        setDragOverFolderId(null);
        return;
      }
    } catch (err) {
      // Ignore
    }
    
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(targetFolderId);
  };

  const handleDrop = (e, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'note' && onDropNote) {
        onDropNote(data.id, targetFolderId);
      } else if (data.type === 'folder' && data.id !== targetFolderId && onDropFolder) {
        if (!isDescendant(targetFolderId, data.id)) {
          onDropFolder(data.id, targetFolderId);
        }
      }
    } catch (err) {
      // Ignore
    }
  };

  const renderFolder = (folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = folder.id === selectedFolderId;
    const isRenaming = renamingId === folder.id;
    const isDragOver = dragOverFolderId === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', id: folder.id }));
          }}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => handleDrop(e, folder.id)}
          onClick={(e) => { e?.stopPropagation(); onSelectFolder(folder.id); }}
          onDoubleClick={(e) => {
            e?.stopPropagation();
            setRenamingId(folder.id);
            setRenameValue(folder.name || '');
          }}
          style={{
            paddingLeft: `${8 + level * 16}px`,
            paddingRight: '8px',
            paddingTop: '6px',
            paddingBottom: '6px',
            cursor: 'pointer',
            backgroundColor: isDragOver ? '#dbeafe' : isSelected ? '#e0e7ff' : 'transparent',
            borderLeft: isDragOver ? '3px solid #3b82f6' : 'none',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => {
            if (!isSelected && !isDragOver) e.currentTarget.style.backgroundColor = '#f3f4f6';
            const btn = e.currentTarget.querySelector('.folder-delete-btn');
            if (btn) btn.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            if (!isSelected && !isDragOver) e.currentTarget.style.backgroundColor = 'transparent';
            const btn = e.currentTarget.querySelector('.folder-delete-btn');
            if (btn) btn.style.opacity = '0';
          }}
        >
          {/* Expand/collapse arrow - only show if folder has children */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedFolders(prev => {
                  const next = new Set(prev);
                  next.has(folder.id) ? next.delete(folder.id) : next.add(folder.id);
                  return next;
                });
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 4px',
                cursor: 'pointer',
                display: 'flex',
                fontSize: '10px',
                color: '#6b7280',
                marginRight: '4px',
                width: '20px'
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <div style={{ width: '20px' }} />
          )}

          {/* Folder icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: '6px', flexShrink: 0 }}>
            <path d="M2.5 2.5h9v9h-9v-9z" stroke={isSelected ? '#3b82f6' : '#6b7280'} strokeWidth="1.5" fill={isSelected ? '#e0e7ff' : 'none'} />
            <path d="M2.5 5.5h9" stroke={isSelected ? '#3b82f6' : '#6b7280'} strokeWidth="1" />
          </svg>

          {/* Folder name or rename input */}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue.trim()) onRenameFolder(renamingId, renameValue.trim());
                setRenamingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameValue.trim()) onRenameFolder(renamingId, renameValue.trim());
                  setRenamingId(null);
                } else if (e.key === 'Escape') {
                  setRenamingId(null);
                }
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '2px 4px',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none',
                backgroundColor: 'white'
              }}
            />
          ) : (
            <span style={{
              flex: 1,
              fontSize: '13px',
              color: isSelected ? '#1e40af' : '#374151',
              fontWeight: isSelected ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{folder.name || 'Untitled Folder'}</span>
              {typeof folder.noteCount === 'number' && folder.noteCount > 0 && (
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>
                  {folder.noteCount}
                </span>
              )}
            </span>
          )}

          {/* Delete button */}
          <button
            className="folder-delete-btn"
            onClick={async (e) => {
              e.stopPropagation();
              const confirmed = await confirmAction(`Delete folder "${folder.name || 'Untitled Folder'}"?`);
              if (confirmed) {
                onDeleteFolder(folder.id);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              opacity: 0,
              transition: 'opacity 0.15s',
              display: 'flex',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fee2e2'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6m0-6l-6 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        
        {/* Children */}
        {isExpanded && folder.children?.length > 0 && (
          <div>{folder.children.map(child => renderFolder(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '200px',
      borderRight: '1px solid #e5e7eb',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        height: '48px',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          Folders
        </div>
        <button
          onClick={() => {
            const newFolder = {
              id: generateFolderId(),
              name: 'New Folder',
              order: folders?.length ?? 0,
              createdAt: Date.now()
            };
            onCreateFolder(newFolder);
            setRenamingId(newFolder.id);
            setRenameValue(newFolder.name);
          }}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            lineHeight: 1,
            fontWeight: 300,
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          title="New Folder"
        >
          +
        </button>
      </div>

      {/* All Notes */}
      <div
        onClick={() => onSelectFolder(null)}
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          backgroundColor: selectedFolderId === null ? '#e0e7ff' : 'transparent',
          borderLeft: selectedFolderId === null ? '3px solid #3b82f6' : 'none',
          display: 'flex',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: selectedFolderId === null ? 600 : 400,
          color: selectedFolderId === null ? '#1e40af' : '#374151'
        }}
        onMouseEnter={(e) => {
          if (selectedFolderId !== null) e.currentTarget.style.backgroundColor = '#f3f4f6';
        }}
        onMouseLeave={(e) => {
          if (selectedFolderId !== null) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        All Notes
      </div>

      {/* Folders list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '4px' }}>
        {folderHierarchy.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
}
