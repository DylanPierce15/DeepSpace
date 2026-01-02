import React, { useState } from 'react';

/**
 * HeaderBar - Simple header with title and deck management
 */
export default function HeaderBar({
  presentationTitle,
  onTitleChange,
  onExport,
  onExportPDF,
  deckCount,
  onToggleDeckSidebar
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(presentationTitle);

  const handleTitleClick = () => {
    setEditValue(presentationTitle);
    setIsEditing(true);
  };

  const handleTitleSave = () => {
    if (editValue.trim()) {
      onTitleChange(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleTitleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      backgroundColor: '#0a0a0a',
      borderBottom: '1px solid #262626'
    }}>
      {/* Left: Deck switcher + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onToggleDeckSidebar}
          style={{
            padding: '6px 10px',
            backgroundColor: 'transparent',
            border: '1px solid #262626',
            borderRadius: '6px',
            color: '#a3a3a3',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span style={{ fontSize: '14px' }}>☰</span>
          {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleKeyDown}
            autoFocus
            style={{
              padding: '4px 8px',
              backgroundColor: '#171717',
              border: '1px solid #404040',
              borderRadius: '4px',
              color: '#fafafa',
              fontSize: '14px',
              fontWeight: 500,
              outline: 'none',
              minWidth: '200px'
            }}
          />
        ) : (
          <h1
            onClick={handleTitleClick}
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: '#fafafa',
              cursor: 'text',
              padding: '4px 0'
            }}
            title="Click to rename"
          >
            {presentationTitle}
          </h1>
        )}
      </div>

      {/* Right: Export dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #262626',
            borderRadius: '6px',
            color: '#a3a3a3',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>↓</span> Export <span style={{ fontSize: '10px' }}>▾</span>
        </button>
        
        {showExportMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setShowExportMenu(false)}
            />
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: '#171717',
              border: '1px solid #262626',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 100,
              minWidth: '140px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => { onExport(); setShowExportMenu(false); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#d4d4d4',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Export as HTML
              </button>
              <button
                onClick={() => { onExportPDF(); setShowExportMenu(false); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#d4d4d4',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Export as PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
