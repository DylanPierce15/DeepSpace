import React, { useState, useEffect, useCallback } from 'react';

function UselessSitesWidget() {
  // Global storage for current site index (syncs across users)
  const [currentSiteIndex, setCurrentSiteIndex] = useGlobalStorage('useless-sites-current', 0);
  
  // Local UI state
  const [isLoading, setIsLoading] = useState(true);
  
  const uselessSites = [
    {
      name: "Pointer Pointer",
      url: "https://pointerpointer.com",
      description: "Shows photos of people pointing at your mouse pointer"
    },
    {
      name: "Falling Falling",
      url: "https://fallingfalling.com",
      description: "Endless cascade of colors and sounds"
    },
    {
      name: "Koalas to the Max",
      url: "https://koalastothemax.com",
      description: "Drag your mouse to split circles until an image is revealed"
    },
    {
      name: "Zoom Quilt",
      url: "https://zoomquilt.org",
      description: "An endlessly zooming surreal painting"
    },
    {
      name: "Ffffidget",
      url: "https://ffffidget.com",
      description: "On-screen fidget toy that spins, clicks, and flips"
    },
    {
      name: "Cat Bounce",
      url: "https://cat-bounce.com",
      description: "Bouncing cats everywhere, plus a make it rain cats button"
    }
  ];

  // Provide stub TCF API to prevent some cross-origin errors
  useEffect(() => {
    // Create TCF API locator iframe stub
    if (!window.frames['__tcfapiLocator']) {
      const frame = document.createElement('iframe');
      frame.name = '__tcfapiLocator';
      frame.style.cssText = 'display:none';
      document.body.appendChild(frame);
    }
    
    // Provide stub __tcfapi function
    if (!window.__tcfapi) {
      window.__tcfapi = function() {
        // Stub implementation - do nothing
      };
    }
    
    return () => {
      // Cleanup on unmount
      const frame = window.frames['__tcfapiLocator'];
      if (frame && frame.frameElement) {
        frame.frameElement.remove();
      }
    };
  }, []);

  // Validate current site index
  useEffect(() => {
    if (currentSiteIndex < 0 || currentSiteIndex >= uselessSites.length) {
      setCurrentSiteIndex(0);
    }
  }, [currentSiteIndex, uselessSites.length, setCurrentSiteIndex]);

  const currentSite = uselessSites[Math.max(0, Math.min(currentSiteIndex, uselessSites.length - 1))];

  // Navigate to previous site
  const previousSite = useCallback(() => {
    if (currentSiteIndex > 0) {
      setCurrentSiteIndex(currentSiteIndex - 1);
      setIsLoading(true);
    }
  }, [currentSiteIndex, setCurrentSiteIndex]);

  // Navigate to next site
  const nextSite = useCallback(() => {
    if (currentSiteIndex < uselessSites.length - 1) {
      setCurrentSiteIndex(currentSiteIndex + 1);
      setIsLoading(true);
    }
  }, [currentSiteIndex, uselessSites.length, setCurrentSiteIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        previousSite();
      } else if (e.key === 'ArrowRight') {
        nextSite();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previousSite, nextSite]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#1a1a1a',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: '#2d2d2d',
        color: 'white',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '2px solid #444',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flex: 1
        }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            {currentSite.name}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#aaa'
          }}>
            {currentSite.url}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <button
            onClick={previousSite}
            disabled={currentSiteIndex === 0}
            style={{
              background: currentSiteIndex === 0 ? '#2a2a2a' : '#4a4a4a',
              border: 'none',
              color: currentSiteIndex === 0 ? '#666' : 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: currentSiteIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (currentSiteIndex !== 0) {
                e.target.style.background = '#5a5a5a';
              }
            }}
            onMouseLeave={(e) => {
              if (currentSiteIndex !== 0) {
                e.target.style.background = '#4a4a4a';
              }
            }}
          >
            ← Prev
          </button>
          
          <div style={{
            fontSize: '12px',
            color: '#ccc',
            minWidth: '80px',
            textAlign: 'center'
          }}>
            {currentSiteIndex + 1} / {uselessSites.length}
          </div>
          
          <button
            onClick={nextSite}
            disabled={currentSiteIndex === uselessSites.length - 1}
            style={{
              background: currentSiteIndex === uselessSites.length - 1 ? '#2a2a2a' : '#4a4a4a',
              border: 'none',
              color: currentSiteIndex === uselessSites.length - 1 ? '#666' : 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: currentSiteIndex === uselessSites.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              if (currentSiteIndex !== uselessSites.length - 1) {
                e.target.style.background = '#5a5a5a';
              }
            }}
            onMouseLeave={(e) => {
              if (currentSiteIndex !== uselessSites.length - 1) {
                e.target.style.background = '#4a4a4a';
              }
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Iframe Container */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '18px'
          }}>
            Loading site...
          </div>
        )}
        
        <iframe
          key={currentSiteIndex}
          src={currentSite.url}
          title={currentSite.name}
          onLoad={handleIframeLoad}
          allow="camera; microphone; fullscreen"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
}

export default UselessSitesWidget;

