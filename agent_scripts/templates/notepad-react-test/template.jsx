import React, { useRef } from 'react';

function NotepadWidget() {
  // Use our injected storage hook - this will automatically re-render when storage changes
  const [content, setContent] = useStorage('notepad-content', '');
  const textareaRef = useRef(null);
  
  // Handle content changes
  const handleContentChange = (e) => {
    setContent(e.target.value);
  };
  
  // Clear notes
  const clearNotes = () => {
    if (confirm('Clear all notes?')) {
      setContent('');
      textareaRef.current?.focus();
    }
  };
  
  // Auto-focus on mount
  React.useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);
  
  return (
    <div style={{
      margin: 0,
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#fffef7',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#374151'
        }}>
          📝 Quick Notes
        </div>
        <button
          onClick={clearNotes}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            border: 'none',
            borderRadius: '4px',
            background: '#f3f4f6',
            color: '#6b7280',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
        placeholder="Start typing your notes here..."
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#374151',
          minHeight: '200px'
        }}
      />
    </div>
  );
}

// Export the widget component - the injection script will handle rendering
export default NotepadWidget;
