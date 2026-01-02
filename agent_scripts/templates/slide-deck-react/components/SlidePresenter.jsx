import React, { useEffect, useState, useCallback } from 'react';

/**
 * SlidePresenter - Fullscreen presentation mode
 * 
 * Features:
 * - Always-visible exit button (ESC is captured by widget framework)
 * - Keyboard navigation (arrows, space, numbers)
 * - Click to advance
 * - 16:9 aspect ratio maintained
 */
export default function SlidePresenter({
  slides,
  initialSlideIndex,
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(initialSlideIndex || 0);
  const [showControls, setShowControls] = useState(true);
  const [mouseTimer, setMouseTimer] = useState(null);

  const currentSlide = slides[currentIndex];
  const totalSlides = slides.length;

  const goToSlide = useCallback((direction) => {
    if (direction === 'next' && currentIndex < totalSlides - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, totalSlides]);

  const jumpToSlide = useCallback((index) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentIndex(index);
    }
  }, [totalSlides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          goToSlide('next');
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goToSlide('prev');
          break;
        case 'Home':
          e.preventDefault();
          jumpToSlide(0);
          break;
        case 'End':
          e.preventDefault();
          jumpToSlide(totalSlides - 1);
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const num = parseInt(e.key, 10);
            if (num <= totalSlides) jumpToSlide(num - 1);
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToSlide, jumpToSlide, totalSlides]);

  // Auto-hide controls (but exit button stays visible)
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (mouseTimer) clearTimeout(mouseTimer);
      const timer = setTimeout(() => setShowControls(false), 3000);
      setMouseTimer(timer);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseTimer) clearTimeout(mouseTimer);
    };
  }, [mouseTimer]);

  const handleClick = (e) => {
    if (e.target.closest('[data-control]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goToSlide('prev');
    else goToSlide('next');
  };

  if (!currentSlide) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={handleClick}
    >
      {/* EXIT BUTTON - Always visible, top-right corner */}
      <button
        data-control
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          padding: '10px 20px',
          backgroundColor: '#dc2626',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
      >
        <span style={{ fontSize: '16px' }}>✕</span>
        Exit Presentation
      </button>

      {/* Slide content - FULLSCREEN, no borders */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <div style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#fff',
          overflow: 'hidden'
        }}>
          <div
            style={{ width: '100%', height: '100%', overflow: 'hidden' }}
            dangerouslySetInnerHTML={{ __html: currentSlide.content || '' }}
          />
        </div>
      </div>

      {/* Bottom controls - auto-hide */}
      <div
        data-control
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 32px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: showControls ? 'auto' : 'none'
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); goToSlide('prev'); }}
          disabled={currentIndex === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '6px',
            color: currentIndex === 0 ? '#555' : '#fff',
            fontSize: '14px',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ← Previous
        </button>

        {/* Slide indicators */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); jumpToSlide(i); }}
              style={{
                width: i === currentIndex ? '28px' : '10px',
                height: '10px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            />
          ))}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); goToSlide('next'); }}
          disabled={currentIndex === totalSlides - 1}
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '6px',
            color: currentIndex === totalSlides - 1 ? '#555' : '#fff',
            fontSize: '14px',
            cursor: currentIndex === totalSlides - 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Next →
        </button>

        <div style={{ color: '#888', fontSize: '14px', marginLeft: '16px' }}>
          {currentIndex + 1} / {totalSlides}
        </div>
      </div>

      {/* Navigation hint - top left */}
      <div
        data-control
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          padding: '10px 14px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: '6px',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s'
        }}
      >
        <div style={{ color: '#888', fontSize: '11px' }}>Navigate</div>
        <div style={{ color: '#ccc', fontSize: '12px' }}>← → arrows • Space • Click</div>
      </div>
    </div>
  );
}
