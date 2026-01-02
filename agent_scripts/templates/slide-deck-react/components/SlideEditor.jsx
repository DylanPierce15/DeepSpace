import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * SlideEditor - Clean HTML editor with live preview
 * 
 * Features:
 * - Split view: code editor + live preview
 * - Real-time preview updates (debounced)
 * - Keyboard shortcuts for navigation
 */
export default function SlideEditor({
  slide,
  slideIndex,
  totalSlides,
  onUpdateSlide,
  onNavigate,
  onPresent
}) {
  const [localContent, setLocalContent] = useState('');
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'split' | 'code'
  const debounceRef = useRef(null);
  const lastSlideIdRef = useRef(null);

  // Sync local content when slide changes
  useEffect(() => {
    if (slide && slide.id !== lastSlideIdRef.current) {
      setLocalContent(slide.content || '');
      lastSlideIdRef.current = slide.id;
    }
  }, [slide?.id, slide?.content]);

  // Debounced save
  const handleContentChange = useCallback((newContent) => {
    setLocalContent(newContent);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (onUpdateSlide && slide) {
        onUpdateSlide({ ...slide, content: newContent });
      }
    }, 300);
  }, [slide, onUpdateSlide]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        onNavigate('next');
      } else if (e.key === 'F5' || (e.key === 'p' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        onPresent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onPresent]);

  if (!slide) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#525252'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: '15px' }}>Select a slide to edit</div>
        </div>
      </div>
    );
  }

  const showCode = viewMode === 'split' || viewMode === 'code';
  const showPreview = viewMode === 'split' || viewMode === 'preview';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0a0a0a',
      overflow: 'hidden'
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#141414',
        borderBottom: '1px solid #262626'
      }}>
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['code', 'split', 'preview'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 12px',
                backgroundColor: viewMode === mode ? '#262626' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: viewMode === mode ? '#fafafa' : '#737373',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s'
              }}
            >
              {mode === 'code' ? '</> Code' : mode === 'split' ? '◧ Split' : '▣ Preview'}
            </button>
          ))}
        </div>

        {/* Slide info + Present */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#525252', fontSize: '13px' }}>
            Slide {slideIndex + 1} of {totalSlides}
          </span>
          <button
            onClick={onPresent}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fafafa',
              border: 'none',
              borderRadius: '6px',
              color: '#0a0a0a',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>▶</span> Present
          </button>
        </div>
      </div>

      {/* Editor + Preview */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Code Editor */}
        {showCode && (
          <div style={{
            flex: viewMode === 'split' ? '0 0 50%' : 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: viewMode === 'split' ? '1px solid #262626' : 'none',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#171717',
              borderBottom: '1px solid #262626',
              fontSize: '11px',
              color: '#525252',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              HTML
            </div>
            <textarea
              value={localContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="<div>Your slide content here...</div>"
              spellCheck={false}
              style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#0a0a0a',
                border: 'none',
                color: '#d4d4d4',
                fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                resize: 'none',
                outline: 'none',
                tabSize: 2
              }}
            />
          </div>
        )}

        {/* Live Preview */}
        {showPreview && (
          <div style={{
            flex: viewMode === 'split' ? '0 0 50%' : 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: '#171717'
          }}>
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#171717',
              borderBottom: '1px solid #262626',
              fontSize: '11px',
              color: '#525252',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Preview
            </div>
            <div style={{
              flex: 1,
              padding: '24px',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '100%',
                maxWidth: viewMode === 'preview' ? '1000px' : '100%',
                aspectRatio: '16 / 9',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                overflow: 'hidden'
              }}>
                <div
                  dangerouslySetInnerHTML={{ __html: localContent }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#141414',
        borderTop: '1px solid #262626'
      }}>
        <button
          onClick={() => onNavigate('prev')}
          disabled={slideIndex === 0}
          style={{
            padding: '6px 14px',
            backgroundColor: 'transparent',
            border: '1px solid #262626',
            borderRadius: '6px',
            color: slideIndex === 0 ? '#404040' : '#a3a3a3',
            fontSize: '13px',
            cursor: slideIndex === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ← Prev
        </button>
        <span style={{ color: '#525252', fontSize: '13px', minWidth: '80px', textAlign: 'center' }}>
          {slideIndex + 1} / {totalSlides}
        </span>
        <button
          onClick={() => onNavigate('next')}
          disabled={slideIndex === totalSlides - 1}
          style={{
            padding: '6px 14px',
            backgroundColor: 'transparent',
            border: '1px solid #262626',
            borderRadius: '6px',
            color: slideIndex === totalSlides - 1 ? '#404040' : '#a3a3a3',
            fontSize: '13px',
            cursor: slideIndex === totalSlides - 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
