import React, { useEffect, useRef, useState } from 'react';
import { formatDate, extractNoteTitle } from '../utils/noteUtils';
import AIDropdown from './AIToolbar';

export default function RichTextEditor({ note, onUpdate, onOpenAIChat }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const toolbarRef = useRef(null);

  // Update editor content when note content changes
  useEffect(() => {
    if (editorRef.current && note) {
      const currentContent = editorRef.current.getHTML();
      const newContent = note.content || '<p></p>';
      
      // Only update if content is actually different
      if (currentContent !== newContent) {
        editorRef.current.commands.setContent(newContent, false);
      }
    }
  }, [note?.content]);

  // Initialize editor
  useEffect(() => {
    if (!note || !containerRef.current) return;

    // If editor already exists, don't recreate it
    if (editorRef.current) return;

    // Load TipTap and create editor
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { Editor } from 'https://esm.sh/@tiptap/core@2.8.0';
      import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.8.0';
      
      const container = document.querySelector('[data-editor-id="${note.id}"]');
      if (container) {
        const editor = new Editor({
          element: container,
          extensions: [StarterKit],
          content: ${JSON.stringify(note.content || '<p></p>')},
          editorProps: {
            attributes: {
              class: 'tiptap',
            },
          },
          onUpdate: ({ editor }) => {
            window.dispatchEvent(new CustomEvent('tiptap-update', {
              detail: { noteId: '${note.id}', content: editor.getHTML() }
            }));
          },
          onSelectionUpdate: () => {
            window.dispatchEvent(new CustomEvent('tiptap-selection'));
          }
        });

        window.__tiptapEditor_${note.id.replace(/[^a-zA-Z0-9]/g, '_')} = editor;
      }
    `;

    document.head.appendChild(script);

    // Listen for updates
    const handleUpdate = (e) => {
      if (e.detail.noteId === note.id && onUpdate) {
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(() => {
          onUpdate({ ...note, content: e.detail.content, updatedAt: Date.now() });
        }, 300);
      }
    };

    const handleSelection = () => {
      updateToolbarState();
    };

    window.addEventListener('tiptap-update', handleUpdate);
    window.addEventListener('tiptap-selection', handleSelection);

    // Wait for editor to be available
    const checkEditor = setInterval(() => {
      const editorKey = `__tiptapEditor_${note.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (window[editorKey]) {
        editorRef.current = window[editorKey];
        updateToolbarState();
        clearInterval(checkEditor);
      }
    }, 50);

    return () => {
      window.removeEventListener('tiptap-update', handleUpdate);
      window.removeEventListener('tiptap-selection', handleSelection);
      clearInterval(checkEditor);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      if (editorRef.current) {
        editorRef.current.destroy();
        const editorKey = `__tiptapEditor_${note.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        window[editorKey] = null;
        editorRef.current = null;
      }
      script.remove();
    };
  }, [note?.id]);

  // Update toolbar button states
  const updateToolbarState = () => {
    if (!editorRef.current || !toolbarRef.current) return;
    
    const buttons = toolbarRef.current.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      const action = btn.getAttribute('data-action');
      let isActive = false;
      
      if (action === 'heading-1') isActive = editorRef.current.isActive('heading', { level: 1 });
      else if (action === 'heading-2') isActive = editorRef.current.isActive('heading', { level: 2 });
      else if (action === 'heading-3') isActive = editorRef.current.isActive('heading', { level: 3 });
      else isActive = editorRef.current.isActive(action);
      
      btn.style.background = isActive ? '#3b82f6' : 'white';
      btn.style.color = isActive ? 'white' : '#374151';
      btn.style.borderColor = isActive ? '#3b82f6' : '#d1d5db';
    });
  };

  // Toolbar button handler
  const handleToolbarClick = (action) => {
    if (!editorRef.current) return;
    
    const commands = {
      'bold': () => editorRef.current.chain().focus().toggleBold().run(),
      'italic': () => editorRef.current.chain().focus().toggleItalic().run(),
      'strike': () => editorRef.current.chain().focus().toggleStrike().run(),
      'code': () => editorRef.current.chain().focus().toggleCode().run(),
      'heading-1': () => editorRef.current.chain().focus().toggleHeading({ level: 1 }).run(),
      'heading-2': () => editorRef.current.chain().focus().toggleHeading({ level: 2 }).run(),
      'heading-3': () => editorRef.current.chain().focus().toggleHeading({ level: 3 }).run(),
      'paragraph': () => editorRef.current.chain().focus().setParagraph().run(),
      'bulletList': () => editorRef.current.chain().focus().toggleBulletList().run(),
      'orderedList': () => editorRef.current.chain().focus().toggleOrderedList().run(),
      'codeBlock': () => editorRef.current.chain().focus().toggleCodeBlock().run(),
      'blockquote': () => editorRef.current.chain().focus().toggleBlockquote().run(),
    };
    
    if (commands[action]) {
      commands[action]();
      setTimeout(updateToolbarState, 10);
    }
  };

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

  const ToolbarButton = ({ action, children, title }) => (
    <button
      data-action={action}
      onClick={() => handleToolbarClick(action)}
      title={title}
      style={{
        padding: '6px 10px',
        background: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '32px',
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: '#ffffff'
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
        <div style={{ 
          fontSize: '15px', 
          fontWeight: 600, 
          color: '#111827',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginRight: '12px'
        }}>
          {extractNoteTitle(note.content)}
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
          {formatDate(note.updatedAt || note.createdAt)}
        </div>
      </div>

      {/* Toolbar */}
      <div ref={toolbarRef} style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <ToolbarButton action="bold" title="Bold (Cmd+B)"><strong>B</strong></ToolbarButton>
        <ToolbarButton action="italic" title="Italic (Cmd+I)"><em>I</em></ToolbarButton>
        <ToolbarButton action="strike" title="Strikethrough"><s>S</s></ToolbarButton>
        <ToolbarButton action="code" title="Code">{'<>'}</ToolbarButton>
        
        <div style={{ width: '1px', height: '20px', background: '#d1d5db', margin: '0 4px' }} />
        
        <ToolbarButton action="heading-1" title="Heading 1">H1</ToolbarButton>
        <ToolbarButton action="heading-2" title="Heading 2">H2</ToolbarButton>
        <ToolbarButton action="heading-3" title="Heading 3">H3</ToolbarButton>
        <ToolbarButton action="paragraph" title="Paragraph">P</ToolbarButton>
        
        <div style={{ width: '1px', height: '20px', background: '#d1d5db', margin: '0 4px' }} />
        
        <ToolbarButton action="bulletList" title="Bullet List">• List</ToolbarButton>
        <ToolbarButton action="orderedList" title="Ordered List">1. List</ToolbarButton>
        <ToolbarButton action="codeBlock" title="Code Block">{'</>'}</ToolbarButton>
        <ToolbarButton action="blockquote" title="Blockquote">" Quote</ToolbarButton>
        
        <div style={{ width: '1px', height: '20px', background: '#d1d5db', margin: '0 4px' }} />
        
        {/* AI Dropdown */}
        <AIDropdown note={note} onUpdate={onUpdate} onOpenChat={onOpenAIChat} />
      </div>

      {/* Editor Container */}
      <div 
        ref={containerRef}
        data-editor-id={note.id}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
      />

      <style>{`
        .tiptap {
          padding: 24px 32px;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          min-height: 100%;
          color: #111827;
        }
        
        .tiptap p {
          margin: 0.75em 0;
        }
        
        .tiptap p:first-child {
          margin-top: 0;
        }
        
        .tiptap h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 0.67em 0;
          line-height: 1.2;
          color: #111827;
        }
        
        .tiptap h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.75em 0;
          line-height: 1.3;
          color: #111827;
        }
        
        .tiptap h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.83em 0;
          line-height: 1.4;
          color: #111827;
        }
        
        .tiptap ul,
        .tiptap ol {
          margin: 0.75em 0;
          padding-left: 2em;
        }
        
        .tiptap li {
          margin: 0.3em 0;
        }
        
        .tiptap strong {
          font-weight: 600;
        }
        
        .tiptap em {
          font-style: italic;
        }
        
        .tiptap code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 4px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
          color: #db2777;
        }
        
        .tiptap pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1.25em;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1.5em 0;
          font-family: 'Monaco', 'Courier New', monospace;
        }
        
        .tiptap pre code {
          background: none;
          color: inherit;
          padding: 0;
          font-size: 0.875em;
        }
        
        .tiptap blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1.25em;
          margin: 1.5em 0;
          color: #6b7280;
          font-style: italic;
        }
        
        .tiptap hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 2.5em 0;
        }
        
        .tiptap a {
          color: #3b82f6;
          text-decoration: underline;
        }

        /* Placeholder */
        .tiptap p.is-editor-empty:first-child::before {
          content: 'Start typing your note...';
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          float: left;
        }
      `}</style>
    </div>
  );
}
