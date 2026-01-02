import React, { useState, useMemo, useCallback } from 'react';

/**
 * FolderSidebar - Hierarchical folder navigation with drag-drop support
 */
export default function FolderSidebar({
  files,
  currentPath,
  selectedNote,
  expandedFolders,
  onNavigate,
  onSelectNote,
  onToggleFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onMoveNote
}) {
  const [dragOverPath, setDragOverPath] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'before' | 'inside' | 'after'
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggingPath, setDraggingPath] = useState(null);

  // Build folder tree recursively
  const folderTree = useMemo(() => {
    if (!files.ready) return [];

    const buildTree = (path) => {
      const items = files.list(path);
      const folders = [];
      let noteCount = 0;

      items.forEach(item => {
        if (item === 'config.json' || item === '.folder') return;
        
        if (item.endsWith('/')) {
          const fullPath = path + item;
          const children = buildTree(fullPath);
          folders.push({
            name: item.slice(0, -1),
            path: fullPath,
            children: children.folders,
            noteCount: children.noteCount
          });
          noteCount += children.noteCount;
        } else if (item.endsWith('.md')) {
          noteCount++;
        }
      });

      return { folders, noteCount };
    };

    return buildTree('').folders;
  }, [files]);

  // Handle drag over with position detection
  const handleDragOver = useCallback((e, path, element) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = element.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position = 'inside';
    if (y < height * 0.25) position = 'before';
    else if (y > height * 0.75) position = 'after';
    
    setDragOverPath(path);
    setDropPosition(position);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e, targetPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    setDropPosition(null);
    setDraggingPath(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'note' && onMoveNote) {
        onMoveNote(data.path, targetPath);
      }
    } catch (err) {
      // Ignore
    }
  }, [onMoveNote]);

  // Start rename
  const startRename = useCallback((path, name) => {
    setRenamingPath(path);
    setRenameValue(name);
  }, []);

  // Complete rename
  const completeRename = useCallback(() => {
    if (renamingPath && renameValue.trim()) {
      onRenameFolder(renamingPath, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue('');
  }, [renamingPath, renameValue, onRenameFolder]);

  // Folder icon component
  const FolderIcon = ({ active, size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path 
        d="M2 4.5A1.5 1.5 0 013.5 3h2.879a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" 
        fill={active ? '#3b82f6' : '#fbbf24'}
        stroke={active ? '#2563eb' : '#f59e0b'}
        strokeWidth="0.5"
      />
    </svg>
  );

  // Render folder item
  const renderFolder = (folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.path);
    const isActive = currentPath === folder.path;
    const isDragOver = dragOverPath === folder.path;
    const isRenaming = renamingPath === folder.path;
    const hasChildren = folder.children && folder.children.length > 0;
    const isDragging = draggingPath === folder.path;

    return (
      <div key={folder.path} style={{ opacity: isDragging ? 0.5 : 1 }}>
        {/* Drop indicator - before */}
        {isDragOver && dropPosition === 'before' && (
          <div style={{
            height: '2px',
            backgroundColor: '#3b82f6',
            marginLeft: `${12 + level * 16}px`,
            marginRight: '8px',
            borderRadius: '1px'
          }} />
        )}
        
        <div
          draggable={!isRenaming}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'folder', path: folder.path }));
            setDraggingPath(folder.path);
          }}
          onDragEnd={() => { setDraggingPath(null); setDragOverPath(null); setDropPosition(null); }}
          onDragOver={(e) => handleDragOver(e, folder.path, e.currentTarget)}
          onDragLeave={() => { setDragOverPath(null); setDropPosition(null); }}
          onDrop={(e) => handleDrop(e, folder.path)}
          onClick={() => onNavigate(folder.path)}
          onDoubleClick={() => startRename(folder.path, folder.name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '7px 10px',
            paddingLeft: `${12 + level * 16}px`,
            cursor: 'pointer',
            backgroundColor: isDragOver && dropPosition === 'inside' ? '#dbeafe' : isActive ? '#f3f4f6' : 'transparent',
            borderRadius: isActive ? '8px' : '0',
            margin: isActive ? '0 6px' : '0',
            transition: 'background-color 0.1s',
            userSelect: 'none'
          }}
          onMouseEnter={(e) => {
            if (!isActive && !(isDragOver && dropPosition === 'inside')) {
              e.currentTarget.style.backgroundColor = '#f9fafb';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive && !(isDragOver && dropPosition === 'inside')) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {/* Expand arrow */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFolder(folder.path); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                display: 'flex',
                color: '#9ca3af',
                marginRight: '6px'
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <div style={{ width: '18px' }} />
          )}

          {/* Folder icon */}
          <FolderIcon active={isActive} />
          <div style={{ width: '8px' }} />

          {/* Name */}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={completeRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') completeRename();
                if (e.key === 'Escape') { setRenamingPath(null); setRenameValue(''); }
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                padding: '2px 6px',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          ) : (
            <span style={{
              flex: 1,
              fontSize: '13px',
              color: isActive ? '#111827' : '#374151',
              fontWeight: isActive ? 500 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {folder.name}
            </span>
          )}

          {/* Note count */}
          {folder.noteCount > 0 && !isRenaming && (
            <span style={{ 
              fontSize: '11px', 
              color: '#9ca3af', 
              marginLeft: '6px',
              backgroundColor: '#f3f4f6',
              padding: '1px 6px',
              borderRadius: '10px'
            }}>
              {folder.noteCount}
            </span>
          )}
        </div>

        {/* Drop indicator - after */}
        {isDragOver && dropPosition === 'after' && (
          <div style={{
            height: '2px',
            backgroundColor: '#3b82f6',
            marginLeft: `${12 + level * 16}px`,
            marginRight: '8px',
            borderRadius: '1px'
          }} />
        )}

        {/* Children */}
        {isExpanded && folder.children.map(child => renderFolder(child, level + 1))}
      </div>
    );
  };

  // All notes icon
  const AllNotesIcon = ({ active }) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2.5" y="2" width="11" height="12" rx="1.5" 
        stroke={active ? '#3b82f6' : '#9ca3af'} 
        strokeWidth="1.2" 
        fill="none" 
      />
      <path d="M5 5.5h6M5 8h6M5 10.5h4" 
        stroke={active ? '#3b82f6' : '#9ca3af'} 
        strokeWidth="1" 
        strokeLinecap="round" 
      />
    </svg>
  );

  return (
    <div style={{
      width: '200px',
      borderRight: '1px solid #e5e7eb',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Folders
        </span>
        <button
          onClick={onCreateFolder}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          title="New Folder"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* All Notes */}
      <div
        onClick={() => onNavigate('')}
        onDragOver={(e) => { e.preventDefault(); setDragOverPath(''); setDropPosition('inside'); }}
        onDragLeave={() => { setDragOverPath(null); setDropPosition(null); }}
        onDrop={(e) => handleDrop(e, '')}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          backgroundColor: currentPath === '' ? '#f3f4f6' : dragOverPath === '' ? '#dbeafe' : 'transparent',
          borderRadius: currentPath === '' ? '8px' : '0',
          margin: currentPath === '' ? '0 6px' : '0',
          fontSize: '13px',
          fontWeight: currentPath === '' ? 500 : 400,
          color: currentPath === '' ? '#111827' : '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background-color 0.1s'
        }}
        onMouseEnter={(e) => {
          if (currentPath !== '' && dragOverPath !== '') e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
        onMouseLeave={(e) => {
          if (currentPath !== '' && dragOverPath !== '') e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <AllNotesIcon active={currentPath === ''} />
        All Notes
      </div>

      {/* Folder tree */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
        {folderTree.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
}
