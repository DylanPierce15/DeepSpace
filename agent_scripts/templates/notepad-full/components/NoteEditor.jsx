import React, { useRef, useEffect, useCallback, useState } from 'react';
import { formatDate } from '../utils/noteUtils';

export default function NoteEditor({ note, onUpdate }) {
  const textareaRef = useRef(null);
  const timeoutRef = useRef(null);
  const [localContent, setLocalContent] = useState(note?.content || '');

  // Sync local content when note changes
  useEffect(() => {
    setLocalContent(note?.content || '');
  }, [note?.id]);

  // Auto-focus when note changes
  useEffect(() => {
    if (note && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
        const length = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(length, length);
      }, 50);
    }
  }, [note?.id]);

  // Debounced auto-save
  const handleContentChange = useCallback((e) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (note && onUpdate) {
        onUpdate({
          ...note,
          content: newContent,
          updatedAt: Date.now()
        });
      }
    }, 500);
  }, [note, onUpdate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!note) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        fontSize: '15px'
      }}>
        Select a note to start editing
      </div>
    );
  }

  const dateStr = formatDate(note.updatedAt || note.createdAt);
  const lineCount = localContent.split('\n').length;

  return (
    <div style={{
      flex: 1,
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
          Note
        </div>
        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px'
        }}>
          <div>{dateStr}</div>
          <div>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</div>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={localContent}
        onChange={handleContentChange}
        placeholder="Start typing..."
        style={{
          flex: 1,
          padding: '20px',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '15px',
          lineHeight: '1.6',
          color: '#111827',
          backgroundColor: 'transparent',
          width: '100%',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}
      />
    </div>
  );
}
