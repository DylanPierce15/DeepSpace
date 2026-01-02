import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * NoteEditor - Rich text editor with TipTap
 */
export default function NoteEditor({
  content,
  noteName,
  notePath,
  onUpdate,
  onDelete,
  onRename
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editorReady, setEditorReady] = useState(false);
  const lastNotePathRef = useRef(null);

  // Update editor content when note changes
  useEffect(() => {
    if (editorRef.current && notePath) {
      // Only update if switching notes, not from user typing
      if (lastNotePathRef.current !== notePath) {
        editorRef.current.commands.setContent(content || '<p></p>', false);
        lastNotePathRef.current = notePath;
      }
    }
  }, [content, notePath]);

  // Initialize TipTap editor
  useEffect(() => {
    if (!notePath || !containerRef.current) return;
    
    // Destroy existing editor if note changed
    const editorId = notePath.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (editorRef.current && lastNotePathRef.current !== notePath) {
      editorRef.current.destroy();
      const oldId = lastNotePathRef.current?.replace(/[^a-zA-Z0-9]/g, '_');
      if (oldId) window[`__tiptapEditor_${oldId}`] = null;
      editorRef.current = null;
      setEditorReady(false);
    }
    
    if (editorRef.current) return;
    lastNotePathRef.current = notePath;

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { Editor } from 'https://esm.sh/@tiptap/core@2.8.0';
      import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.8.0';
      
      const container = document.querySelector('[data-editor-id="${editorId}"]');
      if (container && !window.__tiptapEditor_${editorId}) {
        const editor = new Editor({
          element: container,
          extensions: [StarterKit],
          content: ${JSON.stringify(content || '<p></p>')},
          editorProps: {
            attributes: {
              class: 'tiptap-editor',
            },
          },
          onUpdate: ({ editor }) => {
            window.dispatchEvent(new CustomEvent('tiptap-update', {
              detail: { editorId: '${editorId}', content: editor.getHTML() }
            }));
          },
          onSelectionUpdate: () => {
            window.dispatchEvent(new CustomEvent('tiptap-selection', {
              detail: { editorId: '${editorId}' }
            }));
          }
        });

        window.__tiptapEditor_${editorId} = editor;
        window.dispatchEvent(new CustomEvent('tiptap-ready', { detail: { editorId: '${editorId}' } }));
      }
    `;

    document.head.appendChild(script);

    // Handle updates
    const handleUpdate = (e) => {
      if (e.detail.editorId === editorId && onUpdate) {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(() => {
          onUpdate(e.detail.content);
          updateTimeoutRef.current = null;
        }, 300);
      }
    };

    const handleSelection = (e) => {
      if (e.detail.editorId === editorId) {
        updateToolbarState();
      }
    };

    const handleReady = (e) => {
      if (e.detail.editorId === editorId) {
        editorRef.current = window[`__tiptapEditor_${editorId}`];
        setEditorReady(true);
        updateToolbarState();
      }
    };

    window.addEventListener('tiptap-update', handleUpdate);
    window.addEventListener('tiptap-selection', handleSelection);
    window.addEventListener('tiptap-ready', handleReady);

    // Check if editor already exists
    const checkEditor = setInterval(() => {
      if (window[`__tiptapEditor_${editorId}`]) {
        editorRef.current = window[`__tiptapEditor_${editorId}`];
        setEditorReady(true);
        updateToolbarState();
        clearInterval(checkEditor);
      }
    }, 50);

    return () => {
      window.removeEventListener('tiptap-update', handleUpdate);
      window.removeEventListener('tiptap-selection', handleSelection);
      window.removeEventListener('tiptap-ready', handleReady);
      clearInterval(checkEditor);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      script.remove();
    };
  }, [notePath]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        const editorId = lastNotePathRef.current?.replace(/[^a-zA-Z0-9]/g, '_');
        if (editorId) window[`__tiptapEditor_${editorId}`] = null;
        editorRef.current = null;
      }
    };
  }, []);

  // Update toolbar button states
  const updateToolbarState = useCallback(() => {
    if (!editorRef.current || !toolbarRef.current) return;
    
    const buttons = toolbarRef.current.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      const action = btn.getAttribute('data-action');
      let isActive = false;
      
      if (action === 'heading-1') isActive = editorRef.current.isActive('heading', { level: 1 });
      else if (action === 'heading-2') isActive = editorRef.current.isActive('heading', { level: 2 });
      else if (action === 'heading-3') isActive = editorRef.current.isActive('heading', { level: 3 });
      else isActive = editorRef.current.isActive(action);
      
      btn.style.background = isActive ? '#f3f4f6' : 'transparent';
      btn.style.color = isActive ? '#111827' : '#6b7280';
    });
  }, []);

  // Toolbar action handler
  const handleToolbarClick = useCallback((action) => {
    if (!editorRef.current) return;
    
    const commands = {
      'bold': () => editorRef.current.chain().focus().toggleBold().run(),
      'italic': () => editorRef.current.chain().focus().toggleItalic().run(),
      'strike': () => editorRef.current.chain().focus().toggleStrike().run(),
      'code': () => editorRef.current.chain().focus().toggleCode().run(),
      'heading-1': () => editorRef.current.chain().focus().toggleHeading({ level: 1 }).run(),
      'heading-2': () => editorRef.current.chain().focus().toggleHeading({ level: 2 }).run(),
      'heading-3': () => editorRef.current.chain().focus().toggleHeading({ level: 3 }).run(),
      'bulletList': () => editorRef.current.chain().focus().toggleBulletList().run(),
      'orderedList': () => editorRef.current.chain().focus().toggleOrderedList().run(),
      'codeBlock': () => editorRef.current.chain().focus().toggleCodeBlock().run(),
      'blockquote': () => editorRef.current.chain().focus().toggleBlockquote().run(),
    };
    
    if (commands[action]) {
      commands[action]();
      setTimeout(updateToolbarState, 10);
    }
  }, [updateToolbarState]);

  // Empty state
  if (!notePath) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af',
        backgroundColor: '#fafafa'
      }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: '16px', opacity: 0.3 }}>
          <rect x="10" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M16 16h16M16 24h12M16 32h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: '15px', color: '#6b7280' }}>Select a note</div>
        <div style={{ fontSize: '13px', marginTop: '4px' }}>or create a new one</div>
      </div>
    );
  }

  const editorId = notePath.replace(/[^a-zA-Z0-9]/g, '_');

  // Toolbar button component
  const ToolbarButton = ({ action, children, title }) => (
    <button
      data-action={action}
      onClick={() => handleToolbarClick(action)}
      title={title}
      style={{
        padding: '6px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        color: '#6b7280',
        transition: 'all 0.1s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px'
      }}
      onMouseEnter={(e) => { if (e.currentTarget.style.background === 'transparent') e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={(e) => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div style={{ width: '1px', height: '16px', backgroundColor: '#e5e7eb', margin: '0 4px' }} />
  );

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#fff'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue.trim()) onRename(renameValue.trim());
                setIsRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameValue.trim()) onRename(renameValue.trim());
                  setIsRenaming(false);
                }
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 600,
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          ) : (
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#111827',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
              onClick={() => { setRenameValue(noteName); setIsRenaming(true); }}
              title="Click to rename"
            >
              {noteName}
            </h2>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          style={{
            padding: '6px',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
          title="Delete note"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 5h8M6 5V4a1 1 0 011-1h2a1 1 0 011 1v1M5 5v7a1 1 0 001 1h4a1 1 0 001-1V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div ref={toolbarRef} style={{
        display: 'flex',
        gap: '2px',
        padding: '8px 16px',
        borderBottom: '1px solid #f3f4f6',
        alignItems: 'center',
        backgroundColor: '#fafafa'
      }}>
        <ToolbarButton action="bold" title="Bold"><strong>B</strong></ToolbarButton>
        <ToolbarButton action="italic" title="Italic"><em>I</em></ToolbarButton>
        <ToolbarButton action="strike" title="Strikethrough"><s>S</s></ToolbarButton>
        
        <Divider />
        
        <ToolbarButton action="heading-1" title="Heading 1">H1</ToolbarButton>
        <ToolbarButton action="heading-2" title="Heading 2">H2</ToolbarButton>
        <ToolbarButton action="heading-3" title="Heading 3">H3</ToolbarButton>
        
        <Divider />
        
        <ToolbarButton action="bulletList" title="Bullet List">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="4" r="1" fill="currentColor" />
            <circle cx="3" cy="7" r="1" fill="currentColor" />
            <circle cx="3" cy="10" r="1" fill="currentColor" />
            <path d="M6 4h5M6 7h5M6 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton action="orderedList" title="Numbered List">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <text x="2" y="5" fontSize="5" fill="currentColor">1</text>
            <text x="2" y="8" fontSize="5" fill="currentColor">2</text>
            <text x="2" y="11" fontSize="5" fill="currentColor">3</text>
            <path d="M6 4h5M6 7h5M6 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton action="blockquote" title="Quote">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 4v6M6 5h4M6 7h3M6 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton action="codeBlock" title="Code Block">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4L1 7l3 3M10 4l3 3-3 3M8 3L6 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        ref={containerRef}
        data-editor-id={editorId}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
      />

      {/* TipTap Styles */}
      <style>{`
        .tiptap-editor {
          padding: 24px 28px;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
          font-size: 15px;
          line-height: 1.65;
          min-height: 100%;
          color: #1f2937;
        }
        
        .tiptap-editor p { margin: 0.5em 0; }
        .tiptap-editor p:first-child { margin-top: 0; }
        
        .tiptap-editor h1 {
          font-size: 1.75em;
          font-weight: 700;
          margin: 1em 0 0.5em;
          line-height: 1.2;
          color: #111827;
        }
        
        .tiptap-editor h2 {
          font-size: 1.375em;
          font-weight: 600;
          margin: 0.9em 0 0.4em;
          line-height: 1.3;
          color: #111827;
        }
        
        .tiptap-editor h3 {
          font-size: 1.125em;
          font-weight: 600;
          margin: 0.8em 0 0.3em;
          line-height: 1.4;
          color: #111827;
        }
        
        .tiptap-editor ul, .tiptap-editor ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        
        .tiptap-editor li { margin: 0.2em 0; }
        
        .tiptap-editor strong { font-weight: 600; }
        .tiptap-editor em { font-style: italic; }
        
        .tiptap-editor code {
          background-color: #f3f4f6;
          padding: 0.15em 0.35em;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.875em;
          color: #db2777;
        }
        
        .tiptap-editor pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1em 0;
          font-family: 'SF Mono', Monaco, monospace;
        }
        
        .tiptap-editor pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: 0.85em;
        }
        
        .tiptap-editor blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          color: #6b7280;
        }
        
        .tiptap-editor p.is-editor-empty:first-child::before {
          content: 'Start writing...';
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          float: left;
        }
      `}</style>
    </div>
  );
}
