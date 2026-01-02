import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * PageEditor - Split view HTML editor with live preview
 */
export default function PageEditor({ content, onChange }) {
  const [localContent, setLocalContent] = useState(content);
  const debounceRef = useRef(null);
  const previewRef = useRef(null);

  // Sync with external content changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setLocalContent(value);
    
    // Debounce save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(value);
    }, 500);
  }, [onChange]);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* HTML Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #404040' }}>
        <div style={{ padding: '8px 12px', background: '#2d2d2d', borderBottom: '1px solid #404040', fontSize: '12px', color: '#888' }}>
          HTML Source
        </div>
        <textarea
          value={localContent}
          onChange={handleChange}
          spellCheck={false}
          style={{
            flex: 1,
            padding: '16px',
            background: '#1e1e1e',
            border: 'none',
            color: '#d4d4d4',
            fontFamily: '"JetBrains Mono", "Fira Code", Monaco, monospace',
            fontSize: '13px',
            lineHeight: 1.6,
            resize: 'none',
            outline: 'none',
            tabSize: 2
          }}
        />
      </div>
      
      {/* Live Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#333' }}>
        <div style={{ padding: '8px 12px', background: '#2d2d2d', borderBottom: '1px solid #404040', fontSize: '12px', color: '#888' }}>
          Preview (8.5" × 11")
        </div>
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          display: 'flex', 
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div
            ref={previewRef}
            style={{
              width: '408px', // 50% scale
              height: '528px',
              background: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '816px', height: '1056px' }}>
              <div dangerouslySetInnerHTML={{ __html: localContent }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

