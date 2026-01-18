import React, { useState, useEffect, useRef } from 'react';
import GenreCard from './GenreCard';

export default function GenrePage({ selectedGenre, onBack, isActive, links }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);

  // Apply dark retro background
  useEffect(() => {
    if (!isActive) return;

    document.body.style.background = '#0a0a12';
    document.body.style.transition = 'background 0.5s ease';
    
    return () => {
      document.body.style.background = '#0a0a12';
    };
  }, [selectedGenre, isActive]);

  // Reset scroll position when genre changes
  useEffect(() => {
    if (isActive) {
      setCurrentIndex(0);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [selectedGenre, isActive]);

  // Use provided links or placeholder
  const discoveries = links && links.length > 0 ? links.map((link, i) => ({
    id: i + 1,
    title: link.title,
    url: link.url,
    description: link.description,
  })) : [
    { id: 1, title: 'COMING SOON', description: 'Exciting discoveries will appear here' },
    { id: 2, title: 'UNDER CONSTRUCTION', description: 'We\'re curating amazing content for you' },
    { id: 3, title: 'STAY TUNED', description: 'More discoveries on the way' },
  ];

  // Pause/resume iframes based on scroll position to stop music/video autoplay
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isActive) return;

    const handleScroll = () => {
      const iframes = container.querySelectorAll('iframe');
      const containerRect = container.getBoundingClientRect();
      
      iframes.forEach((iframe) => {
        const rect = iframe.getBoundingClientRect();
        const isVisible = rect.top < containerRect.bottom && rect.bottom > containerRect.top;
        
        // Reload iframe when it goes out of view to stop playback
        if (!isVisible && iframe.dataset.originalSrc) {
          if (iframe.src !== 'about:blank') {
            iframe.dataset.previousSrc = iframe.src;
            iframe.src = 'about:blank';
          }
        } else if (isVisible && iframe.dataset.previousSrc) {
          // Restore when coming back into view
          iframe.src = iframe.dataset.previousSrc;
          iframe.dataset.previousSrc = '';
        }
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isActive]);

  // Handle scroll with snap-to-grid
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isActive) return;

    let scrollTimeout;
    const handleScroll = () => {
      if (isScrollingRef.current) return;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const itemHeight = container.offsetHeight;
        const newIndex = Math.round(scrollTop / itemHeight);
        
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [currentIndex, isActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' && currentIndex < discoveries.length - 1) {
        scrollToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        scrollToIndex(currentIndex - 1);
      } else if (e.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isActive, discoveries.length, onBack]);

  const scrollToIndex = (index) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isScrollingRef.current = true;
    const itemHeight = container.offsetHeight;
    
    container.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth',
    });

    setCurrentIndex(index);
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 600);
  };

  if (!selectedGenre) return null;

  const genreInfo = {
    all: { name: 'ALL', emoji: '\u{1F310}', color: '#FF3300' },
    music: { name: 'MUSIC', emoji: '\u{1F3B5}', color: '#39FF14' },
    art: { name: 'ART', emoji: '\u{1F3A8}', color: '#FF2DFF' },
    learn: { name: 'LEARN', emoji: '\u{1F4DA}', color: '#FFD400' },
    games: { name: 'GAMES', emoji: '\u{1F3AE}', color: '#00A2FF' },
    science: { name: 'SCIENCE', emoji: '\u{1F52C}', color: '#00FFFF' },
    create: { name: 'CREATE', emoji: '\u{1F3A8}', color: '#FF6B00' },
  };

  const genre = genreInfo[selectedGenre] || { name: 'DISCOVERY', emoji: '\u{1F4AB}', color: '#00FFFF' };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden"
      style={{
        fontFamily: 'VT323, monospace',
      }}
    >
      {/* Starfield background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(1px 1px at 20px 30px, #fff, transparent),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 90px 40px, ${genre.color}, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 160px 120px, ${genre.color}, transparent),
            radial-gradient(1px 1px at 200px 50px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 20px 130px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 100px 180px, rgba(255,255,255,0.4), transparent),
            radial-gradient(1.5px 1.5px at 180px 20px, ${genre.color}, transparent)
          `,
          backgroundSize: '250px 220px',
          zIndex: 0,
        }}
      />

      {/* Scanlines - REMOVED */}

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 100%)',
          zIndex: 99,
        }}
      />

      {/* Snap-scroll container with padding for nav */}
      <div 
        ref={scrollContainerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        style={{
          scrollBehavior: 'smooth',
          zIndex: 10,
          position: 'relative',
          paddingTop: '80px', // Space for navigation bar
        }}
      >
        {discoveries.map((discovery, index) => (
          <GenreCard
            key={discovery.id}
            discovery={discovery}
            genre={genre}
            isActive={index === currentIndex}
            index={index}
            total={discoveries.length}
            onVisit={discovery.url ? () => window.open(discovery.url, '_blank') : null}
          />
        ))}
      </div>

      {/* Hide scrollbar with CSS */}
      <style>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
