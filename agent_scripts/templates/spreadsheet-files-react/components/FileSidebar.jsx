import React, { useState, useMemo } from 'react';

/**
 * FileSidebar - Browse sheets and scripts (Light theme)
 * Recursively lists files and folders
 */
export default function FileSidebar({
  files,
  currentFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile
}) {
  const [expandedFolders, setExpandedFolders] = useState({ '': true, 'scripts/': true });
  const [contextMenu, setContextMenu] = useState(null);

  // Build tree structure by recursively listing directories
  const fileTree = useMemo(() => {
    const buildTree = (path) => {
      const items = files.list(path);
      const node = { folders: {}, files: [] };
      
      items.forEach(item => {
        if (item.endsWith('/')) {
          // It's a folder
          const folderName = item.slice(0, -1);
          const fullPath = path + item;
          node.folders[folderName] = {
            path: fullPath,
            ...buildTree(fullPath)
          };
        } else {
          // It's a file
          node.files.push({
            name: item,
            path: path + item
          });
        }
      });
      
      return node;
    };
    
    return buildTree('');
  }, [files]);

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleContextMenu = (e, path, isFolder) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isFolder });
  };

  const renderFolder = (name, path, node, depth = 0) => {
    const isExpanded = expandedFolders[path];
    
    return (
      <div key={path}>
        <div
          onClick={() => toggleFolder(path)}
          onContextMenu={(e) => handleContextMenu(e, path, true)}
          style={{
            padding: '7px 12px',
            paddingLeft: `${14 + depth * 16}px`,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#475569',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '4px',
            margin: '2px 6px'
          }}
        >
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{ fontSize: '12px' }}>📁</span>
          <span>{name}</span>
        </div>
        {isExpanded && renderNode(node, path, depth + 1)}
      </div>
    );
  };

  const renderFile = (file, depth = 0) => {
    const isSelected = currentFile === file.path;
    const isScript = file.name.endsWith('.js');
    const isCSV = file.name.endsWith('.csv');

    return (
      <div
        key={file.path}
        onClick={() => onSelectFile(file.path)}
        onContextMenu={(e) => handleContextMenu(e, file.path, false)}
        style={{
          padding: '7px 12px',
          paddingLeft: `${14 + depth * 16}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
          color: isSelected ? '#0369a1' : '#475569',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: '4px',
          margin: '2px 6px',
          fontWeight: isSelected ? 600 : 400
        }}
      >
        <span style={{ fontSize: '12px' }}>
          {isScript ? '⚡' : isCSV ? '📊' : '📄'}
        </span>
        <span style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          flex: 1
        }}>
          {file.name}
        </span>
      </div>
    );
  };

  const renderNode = (node, parentPath = '', depth = 0) => {
    const elements = [];

    // Render folders first
    Object.keys(node.folders).sort().forEach(folderName => {
      const folder = node.folders[folderName];
      elements.push(renderFolder(folderName, folder.path, folder, depth));
    });

    // Then files
    node.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
      elements.push(renderFile(file, depth));
    });

    return elements;
  };

  const hasContent = fileTree.files.length > 0 || Object.keys(fileTree.folders).length > 0;

  return (
    <div
      style={{
        width: '200px',
        backgroundColor: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Files
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onCreateFile('csv')}
            title="New Sheet"
            style={buttonStyle}
          >
            📊
          </button>
          <button
            onClick={() => onCreateFile('js', 'scripts/')}
            title="New Script"
            style={buttonStyle}
          >
            ⚡
          </button>
        </div>
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {renderNode(fileTree)}
        
        {!hasContent && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
            No files yet
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setContextMenu(null)}
          />
          <div style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 100,
            minWidth: '140px',
            overflow: 'hidden'
          }}>
            {contextMenu.isFolder && (
              <>
                <button
                  onClick={() => { onCreateFile('csv', contextMenu.path); setContextMenu(null); }}
                  style={menuButtonStyle}
                >
                  📊 New Sheet
                </button>
                <button
                  onClick={() => { onCreateFile('js', contextMenu.path); setContextMenu(null); }}
                  style={menuButtonStyle}
                >
                  ⚡ New Script
                </button>
              </>
            )}
            <button
              onClick={() => { onDeleteFile(contextMenu.path); setContextMenu(null); }}
              style={{ ...menuButtonStyle, color: '#dc2626' }}
            >
              🗑️ Delete
            </button>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid #e2e8f0',
        fontSize: '10px',
        color: '#94a3b8',
        backgroundColor: '#f1f5f9'
      }}>
        📊 CSV = data • ⚡ JS = scripts
      </div>
    </div>
  );
}

const buttonStyle = {
  width: '26px',
  height: '26px',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const menuButtonStyle = {
  width: '100%',
  padding: '10px 14px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#374151',
  fontSize: '13px',
  textAlign: 'left',
  cursor: 'pointer'
};
