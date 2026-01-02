import React, { useState, useRef } from 'react';
import { getNotePreview, formatDate } from '../utils/noteUtils';
import { confirmAction } from './Toast';

export default function NoteItem({ note, isSelected, onSelect, onDelete, onDropNote }) {
  const { title, preview } = getNotePreview(note.content);
  const dateStr = formatDate(note.updatedAt || note.createdAt);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragImageRef = useRef(null);
  
  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'note', id: note.id }));
    
    // Create custom drag preview
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
      position: absolute; top: -1000px; width: 32px; height: 32px;
      background: white; border: 1px solid #d1d5db; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); pointer-events: none;
    `;
    dragImage.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 3h10v14H5V3z" stroke="#6b7280" stroke-width="1.5" fill="none"/>
        <path d="M7 7h6M7 10h4" stroke="#9ca3af" stroke-width="1" stroke-linecap="round"/>
      </svg>
    `;
    document.body.appendChild(dragImage);
    dragImageRef.current = dragImage;
    e.dataTransfer.setDragImage(dragImage, 16, 16);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    setDragOver(false);
    e.target.style.opacity = '1';
    if (dragImageRef.current?.parentNode) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (!onDropNote) return;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type === 'note' && data.id !== note.id) {
        onDropNote(data.id, note.folderId || null);
      }
    } catch (err) {
      // Ignore parse errors
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={(e) => { e.stopPropagation(); onSelect(note.id); }}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        backgroundColor: dragOver ? '#e0e7ff' : isSelected ? '#f3f4f6' : 'transparent',
        borderLeft: dragOver || isSelected ? '3px solid #3b82f6' : 'none',
        transition: 'background-color 0.15s',
        borderBottom: '1px solid #f3f4f6'
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !dragOver && !isDragging) {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }
        const btn = e.currentTarget.querySelector('.delete-btn');
        if (btn) btn.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !dragOver && !isDragging) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
        const btn = e.currentTarget.querySelector('.delete-btn');
        if (btn) btn.style.opacity = '0';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, marginRight: '8px', minWidth: 0 }}>
          {/* Title (first line) */}
          <div style={{
            fontSize: '14px',
            fontWeight: isSelected ? 600 : 500,
            color: '#111827',
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '2px'
          }}>
            {title}
          </div>
          
          {/* Preview text (rest of content) */}
          {preview && (
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.4',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              marginBottom: '4px'
            }}>
              {preview}
            </div>
          )}
          
          {/* Date */}
          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
            {dateStr}
          </div>
        </div>
        
        <button
          className="delete-btn"
          onClick={async (e) => {
            e.stopPropagation();
            const confirmed = await confirmAction('Delete this note?');
            if (confirmed) onDelete(note.id);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0,
            transition: 'opacity 0.15s',
            display: 'flex',
            borderRadius: '4px',
            flexShrink: 0
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#fee2e2'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 3.5l7 7m0-7l-7 7"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
