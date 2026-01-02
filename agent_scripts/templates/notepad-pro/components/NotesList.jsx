import React, { useState, useCallback } from 'react';

/**
 * NotesList - Display and manage notes in current folder
 */
export default function NotesList({
  items,
  searchResults,
  selectedNote,
  searchQuery,
  currentPath,
  breadcrumbs,
  onSelectNote,
  onDeleteNote,
  onRenameNote,
  onCreateNote,
  onSearchChange,
  onNavigate
}) {
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  // Get display items (search results or folder contents)
  const displayItems = searchQuery ? searchResults : items.filter(i => !i.isFolder);

  // Start rename
  const startRename = useCallback((path, name) => {
    setRenamingPath(path);
    setRenameValue(name);
    setContextMenu(null);
  }, []);

  // Complete rename
  const completeRename = useCallback(() => {
    if (renamingPath && renameValue.trim()) {
      onRenameNote(renamingPath, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue('');
  }, [renamingPath, renameValue, onRenameNote]);

  // Context menu
  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  }, []);

  // Extract preview text from HTML content
  const getPreview = (content) => {
    if (!content) return '';
    // Strip HTML tags and get plain text
    const temp = document.createElement('div');
    temp.innerHTML = content;
    const text = temp.textContent || temp.innerText || '';
    return text.substring(0, 80).trim() + (text.length > 80 ? '...' : '');
  };

  // Icons
  const NoteIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="#9ca3af" strokeWidth="1.2" fill="none" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );

  const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: '#9ca3af' }}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );

  const HomeIcon = () => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: '#9ca3af' }}>
      <path d="M3 6.5L8 3l5 3.5v6.5a1 1 0 01-1 1H4a1 1 0 01-1-1V6.5z" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );

  return (
    <div style={{
      width: '280px',
      borderRight: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
        {/* Breadcrumbs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginBottom: '12px',
          fontSize: '12px',
          color: '#9ca3af'
        }}>
          <button
            onClick={() => onNavigate('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              color: '#9ca3af'
            }}
          >
            <HomeIcon />
          </button>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              <span style={{ color: '#d1d5db' }}>/</span>
              <button
                onClick={() => onNavigate(crumb.path)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#6b7280',
                  fontSize: '12px',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
              backgroundColor: '#f3f4f6',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                padding: '2px',
                display: 'flex'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* New Note button */}
        <button
          onClick={onCreateNote}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Note
        </button>
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayItems.length === 0 ? (
          <div style={{
            padding: '32px 20px',
            textAlign: 'center',
            color: '#9ca3af'
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: '12px', opacity: 0.4 }}>
              <rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M14 14h12M14 20h10M14 26h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </div>
            <div style={{ fontSize: '12px' }}>
              {searchQuery ? 'Try a different search' : 'Create your first note'}
            </div>
          </div>
        ) : (
          displayItems.map(item => {
            const path = item.fullPath || item.path;
            const name = item.name;
            const isSelected = selectedNote === path;
            const isRenaming = renamingPath === path;

            return (
              <div
                key={path}
                draggable={!isRenaming}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'note', path }));
                }}
                onClick={() => onSelectNote(path)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                onDoubleClick={() => startRename(path, name)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
                  borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
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
                      width: '100%',
                      padding: '4px 8px',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <NoteIcon />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: isSelected ? 500 : 400,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {name}
                      </span>
                    </div>
                    {item.content && (
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingLeft: '22px'
                      }}>
                        {getPreview(item.content)}
                      </div>
                    )}
                    {searchQuery && item.path && (
                      <div style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        marginTop: '4px',
                        paddingLeft: '22px'
                      }}>
                        in /{item.path || ''}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: '140px',
              overflow: 'hidden',
              padding: '4px 0'
            }}
          >
            <button
              onClick={() => startRename(contextMenu.item.fullPath, contextMenu.item.name)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
                color: '#374151'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Rename
            </button>
            <button
              onClick={() => {
                onDeleteNote(contextMenu.item.fullPath);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
                color: '#ef4444'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #f3f4f6',
        fontSize: '11px',
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        {displayItems.length} note{displayItems.length !== 1 ? 's' : ''}
        {searchQuery && ' found'}
      </div>
    </div>
  );
}
