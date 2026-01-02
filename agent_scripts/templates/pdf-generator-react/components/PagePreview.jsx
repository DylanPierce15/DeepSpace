import React, { useRef, useState, useCallback } from 'react';

/**
 * PagePreview - Display pages at proper 8.5x11 dimensions with drag-and-drop reorder
 */
export default function PagePreview({
  pages,
  currentIndex,
  onSelectPage,
  onDeletePage,
  onReorderPages,
  onAddPage
}) {
  const containerRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // { index, position: 'before' | 'after' }

  const handleDragStart = useCallback((e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex === null || index === dragIndex) {
      setDropPosition(null);
      return;
    }
    
    // Determine if dropping before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    setDropPosition({ index, position });
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(fromIndex) || !dropPosition || !onReorderPages) {
      setDragIndex(null);
      setDropPosition(null);
      return;
    }
    
    let toIndex = dropPosition.index;
    if (dropPosition.position === 'after') {
      toIndex += 1;
    }
    // Adjust if moving from before the target
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    
    if (fromIndex !== toIndex) {
      onReorderPages(fromIndex, toIndex);
    }
    
    setDragIndex(null);
    setDropPosition(null);
  }, [dropPosition, onReorderPages]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropPosition(null);
  }, []);

  // Scrollbar styles
  const scrollbarStyles = `
    .thumbnail-scroll::-webkit-scrollbar { width: 6px; }
    .thumbnail-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
    .thumbnail-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
    .thumbnail-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
  `;

  if (!pages.length) {
    return (
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <style>{scrollbarStyles}</style>
        <div style={{
          width: '140px',
          background: '#1a1a1a',
          borderRight: '1px solid #333',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <button
            onClick={onAddPage}
            style={{
              width: '116px',
              height: '60px',
              background: '#252525',
              border: '2px dashed #444',
              borderRadius: '6px',
              color: '#666',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            +
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#333' }}>
          No pages in this document
        </div>
      </div>
    );
  }

  const currentPage = pages[currentIndex];

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <style>{scrollbarStyles}</style>
      
      {/* Page thumbnails */}
      <div 
        className="thumbnail-scroll"
        style={{
          width: '140px',
          minWidth: '140px',
          background: '#1a1a1a',
          borderRight: '1px solid #333',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px'
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {pages.map((page, index) => (
          <div key={page.id} style={{ position: 'relative' }}>
            {/* Drop indicator line - before */}
            {dropPosition && dropPosition.index === index && dropPosition.position === 'before' && (
              <div style={{
                position: 'absolute',
                top: '-6px',
                left: '0',
                right: '0',
                height: '3px',
                background: '#2563eb',
                borderRadius: '2px',
                zIndex: 10
              }} />
            )}
            
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectPage(index)}
              style={{
                position: 'relative',
                marginBottom: '12px',
                cursor: 'grab',
                border: index === currentIndex ? '2px solid #2563eb' : '2px solid transparent',
                borderRadius: '4px',
                overflow: 'hidden',
                width: '116px',
                height: '150px',
                opacity: dragIndex === index ? 0.4 : 1,
                transition: 'opacity 0.15s',
                background: '#fff'
              }}
            >
              <div style={{
                transform: 'scale(0.142)',
                transformOrigin: 'top left',
                width: '816px',
                height: '1056px',
                pointerEvents: 'none'
              }}>
                <div dangerouslySetInnerHTML={{ __html: page.content }} />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '4px',
                left: '0',
                right: '0',
                textAlign: 'center',
                fontSize: '11px',
                color: '#888',
                background: 'rgba(0,0,0,0.5)',
                padding: '2px 0'
              }}>
                {index + 1}
              </div>
              {pages.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePage(index); }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '50%',
                    color: '#fff',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.9
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Drop indicator line - after (only for last item) */}
            {dropPosition && dropPosition.index === index && dropPosition.position === 'after' && (
              <div style={{
                position: 'absolute',
                bottom: '6px',
                left: '0',
                right: '0',
                height: '3px',
                background: '#2563eb',
                borderRadius: '2px',
                zIndex: 10
              }} />
            )}
          </div>
        ))}
        
        {/* Add page button */}
        <button
          onClick={onAddPage}
          style={{
            width: '116px',
            height: '50px',
            background: '#252525',
            border: '2px dashed #444',
            borderRadius: '6px',
            color: '#666',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '4px'
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.color = '#2563eb'; }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#444'; e.target.style.color = '#666'; }}
        >
          +
        </button>
      </div>
      
      {/* Main preview */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '40px',
          background: '#333'
        }}
      >
        <div
          id="pdf-page-preview"
          style={{
            width: '816px',
            minHeight: '1056px',
            background: '#fff',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            flexShrink: 0
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: currentPage?.content || '' }} />
        </div>
      </div>
    </div>
  );
}
