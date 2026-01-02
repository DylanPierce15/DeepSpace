import React, { useState } from 'react';

/**
 * SlideThumbnails - Sidebar with slide thumbnails
 * 
 * Features:
 * - Drag and drop reordering
 * - Context menu for duplicate/delete
 * - Visual preview of each slide
 */
export default function SlideThumbnails({
  slides,
  currentSlideIndex,
  onSelectSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onReorderSlides,
  onAddSlide
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      onReorderSlides(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  return (
    <div
      style={{
        width: '200px',
        backgroundColor: '#0a0a0a',
        borderRight: '1px solid #262626',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #262626',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#737373',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Slides
        </span>
        <button
          onClick={onAddSlide}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: '1px solid #404040',
            backgroundColor: 'transparent',
            color: '#a3a3a3',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Add slide"
        >
          +
        </button>
      </div>

      {/* Slides list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px'
      }}>
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectSlide(index)}
            onContextMenu={(e) => handleContextMenu(e, index)}
            style={{
              marginBottom: '8px',
              opacity: draggedIndex === index ? 0.4 : 1,
              transform: dragOverIndex === index ? 'translateY(2px)' : 'none',
              transition: 'all 0.1s'
            }}
          >
            {/* Drop indicator */}
            {dragOverIndex === index && (
              <div style={{
                height: '2px',
                backgroundColor: '#fafafa',
                borderRadius: '1px',
                marginBottom: '4px'
              }} />
            )}

            {/* Thumbnail card */}
            <div style={{
              position: 'relative',
              aspectRatio: '16 / 9',
              backgroundColor: '#171717',
              borderRadius: '6px',
              border: currentSlideIndex === index ? '2px solid #fafafa' : '1px solid #262626',
              overflow: 'hidden',
              cursor: 'pointer'
            }}>
              {/* Slide number */}
              <div style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                padding: '2px 6px',
                backgroundColor: currentSlideIndex === index ? '#fafafa' : 'rgba(0,0,0,0.7)',
                color: currentSlideIndex === index ? '#0a0a0a' : '#a3a3a3',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                zIndex: 1
              }}>
                {index + 1}
              </div>

              {/* Mini preview */}
              <div
                style={{
                  transform: 'scale(0.12)',
                  transformOrigin: 'top left',
                  width: '833%',
                  height: '833%',
                  pointerEvents: 'none',
                  backgroundColor: '#fff'
                }}
                dangerouslySetInnerHTML={{ __html: slide.content || '' }}
              />
            </div>
          </div>
        ))}

        {slides.length === 0 && (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#525252',
            fontSize: '12px'
          }}>
            No slides yet
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
            backgroundColor: '#171717',
            border: '1px solid #262626',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            minWidth: '120px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => { onDuplicateSlide(contextMenu.index); setContextMenu(null); }}
              style={{
                width: '100%',
                padding: '8px 12px',
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
              Duplicate
            </button>
            {slides.length > 1 && (
              <button
                onClick={() => { onDeleteSlide(contextMenu.index); setContextMenu(null); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#ef4444',
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
