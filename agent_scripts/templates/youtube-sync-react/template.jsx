import React, { useState, useEffect, useRef, useCallback } from 'react';

function YouTubeSyncWidget() {
  // Global storage for synchronized playback state (syncs across users)
  const [videoId, setVideoId] = useGlobalStorage('youtube-video-id', '');
  const [syncState, setSyncState] = useGlobalStorage('youtube-sync-state', {
    playing: false,
    currentTime: 0,
    lastUpdate: Date.now(),
    lastUpdatedBy: null
  });
  
  // Local state
  const [inputVideoId, setInputVideoId] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [inputError, setInputError] = useState('');
  
  // Refs
  const playerRef = useRef(null);
  const syncingRef = useRef(false);
  const lastLocalActionRef = useRef(0);
  
  // Generate unique user ID
  const userId = useRef(`user_${Math.random().toString(36).substr(2, 9)}`).current;
  
  // Track if YouTube API is ready
  const [apiReady, setApiReady] = useState(false);
  
  // Load YouTube IFrame API
  useEffect(() => {
    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }
    
    // Create script tag
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    // Set up the callback
    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true);
    };
    
    return () => {
      // Cleanup
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);
  
  // Initialize player when video ID changes or API loads
  useEffect(() => {
    if (!videoId || !apiReady || !window.YT || !window.YT.Player) return;
    
    if (!playerRef.current) {
      // First time loading - initialize player
      initializePlayer();
    } else if (isReady) {
      // Player exists - just load new video
      const currentVideoId = playerRef.current.getVideoData().video_id;
      if (currentVideoId !== videoId) {
        playerRef.current.loadVideoById(videoId);
      }
    }
  }, [videoId, apiReady, isReady]);
  
  // Initialize YouTube player
  const initializePlayer = () => {
    if (!window.YT || !window.YT.Player || !videoId) return;
    
    playerRef.current = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        showinfo: 0
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange
      }
    });
  };
  
  // Player ready handler
  const onPlayerReady = (event) => {
    setIsReady(true);
    
    // Apply initial sync state
    if (syncState.currentTime > 0) {
      event.target.seekTo(syncState.currentTime, true);
    }
    if (syncState.playing) {
      event.target.playVideo();
    }
  };
  
  // Player state change handler
  const onPlayerStateChange = (event) => {
    // Ignore if we're currently syncing from remote
    if (syncingRef.current) return;
    
    const player = event.target;
    const currentTime = player.getCurrentTime();
    const now = Date.now();
    
    // Mark this as a local action
    lastLocalActionRef.current = now;
    
    // Check if this is a seek (time difference > 2 seconds from last known)
    const isSeek = Math.abs(currentTime - lastKnownTimeRef.current) > 2;
    
    // Update sync state based on player state
    if (event.data === window.YT.PlayerState.PLAYING) {
      // If it's a seek or regular play, sync the time
      setSyncState({
        playing: true,
        currentTime: currentTime,
        lastUpdate: now,
        lastUpdatedBy: userId
      });
      lastKnownTimeRef.current = currentTime;
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setSyncState({
        playing: false,
        currentTime: currentTime,
        lastUpdate: now,
        lastUpdatedBy: userId
      });
      lastKnownTimeRef.current = currentTime;
    } else if (event.data === window.YT.PlayerState.BUFFERING && isSeek) {
      // Buffering often happens during seeks
      setSyncState({
        playing: false,
        currentTime: currentTime,
        lastUpdate: now,
        lastUpdatedBy: userId
      });
      lastKnownTimeRef.current = currentTime;
    }
  };
  
  // Sync from remote state changes
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    // Ignore our own updates (within 500ms)
    if (syncState.lastUpdatedBy === userId && 
        Date.now() - lastLocalActionRef.current < 500) {
      return;
    }
    
    // Mark that we're syncing
    syncingRef.current = true;
    
    // Apply remote state
    const player = playerRef.current;
    const playerState = player.getPlayerState();
    const playerTime = player.getCurrentTime();
    
    // Sync time if significantly different (more than 2 seconds)
    if (Math.abs(playerTime - syncState.currentTime) > 2) {
      player.seekTo(syncState.currentTime, true);
    }
    
    // Sync play/pause state
    if (syncState.playing && playerState !== window.YT.PlayerState.PLAYING) {
      player.playVideo();
    } else if (!syncState.playing && playerState === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
    }
    
    // Reset syncing flag after a delay
    setTimeout(() => {
      syncingRef.current = false;
    }, 500);
  }, [syncState, userId, isReady]);
  
  // Track last known time to detect seeks
  const lastKnownTimeRef = useRef(0);
  
  // Update last known time whenever we sync
  useEffect(() => {
    lastKnownTimeRef.current = syncState.currentTime;
  }, [syncState.currentTime]);
  
  // Load video
  const handleLoadVideo = () => {
    const input = inputVideoId.trim();
    if (!input) return;
    
    // Try to extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/,
      /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
    ];
    
    let newVideoId = null;
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        newVideoId = match[1];
        break;
      }
    }
    
    // Validate the video ID format (should be 11 characters)
    if (newVideoId && /^[a-zA-Z0-9_-]{11}$/.test(newVideoId)) {
      // Mark as local action to prevent sync loop
      const now = Date.now();
      lastLocalActionRef.current = now;
      
      // Update video ID and reset sync state
      setVideoId(newVideoId);
      setSyncState({
        playing: false,
        currentTime: 0,
        lastUpdate: now,
        lastUpdatedBy: userId
      });
      
      // Clear input and error after successful load
      setInputVideoId('');
      setInputError('');
    } else {
      // Invalid URL - show error message
      setInputError('Please enter a valid YouTube URL or video ID');
    }
  };
  
  // Extract video ID from current video for display
  const getVideoUrl = () => {
    return `https://www.youtube.com/watch?v=${videoId}`;
  };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0f0f0f',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        padding: '16px',
        color: '#fff'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 5L14 10L8 15V5Z" fill="#ff0000" stroke="#ff0000" strokeWidth="1.5" strokeLinejoin="round"/>
            <rect x="2" y="2" width="16" height="16" rx="3" stroke="#ff0000" strokeWidth="1.5"/>
          </svg>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>YouTube Sync Player</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
              Watch videos together in real-time
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type="text"
            value={inputVideoId}
            onChange={(e) => {
              setInputVideoId(e.target.value);
              setInputError(''); // Clear error when typing
            }}
            placeholder="Paste YouTube URL or Video ID here..."
            style={{
              flex: 1,
              padding: '10px 14px',
              background: '#2a2a2a',
              border: `1px solid ${inputError ? '#ef4444' : '#444'}`,
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleLoadVideo();
              }
            }}
            onFocus={(e) => {
              e.target.style.borderColor = inputError ? '#ef4444' : '#666';
              e.target.style.background = '#333';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = inputError ? '#ef4444' : '#444';
              e.target.style.background = '#2a2a2a';
            }}
          />
          <button
            onClick={handleLoadVideo}
            disabled={!inputVideoId.trim()}
            style={{
              padding: '10px 20px',
              background: inputVideoId.trim() ? '#ff0000' : '#444',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: inputVideoId.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              if (inputVideoId.trim()) {
                e.target.style.background = '#dc2626';
              }
            }}
            onMouseLeave={(e) => {
              if (inputVideoId.trim()) {
                e.target.style.background = '#ff0000';
              }
            }}
          >
            Load Video
          </button>
        </div>
        
        {/* Error Message */}
        {inputError && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 3.5V6.5M6 8.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {inputError}
          </div>
        )}
        
        {/* Sync Status (only show when video is loaded) */}
        {videoId && (
          <div style={{
            marginTop: '12px',
            fontSize: '12px',
            color: '#999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: syncState.playing ? '#4ade80' : '#facc15',
              animation: syncState.playing ? 'pulse 2s infinite' : 'none'
            }} />
            <span>
              {syncState.playing ? 'Playing' : 'Paused'} • 
              {syncState.lastUpdatedBy === userId ? 'You control playback' : 'Synced with others'}
            </span>
          </div>
        )}
      </div>
      
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {videoId ? (
          // Player Container
          <div 
            id="youtube-player" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
        ) : (
          // Empty State
          <div style={{
            textAlign: 'center',
            color: '#666',
            padding: '40px'
          }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: '16px' }}>
              <rect x="8" y="16" width="48" height="32" rx="4" stroke="#444" strokeWidth="2"/>
              <path d="M26 28L38 32L26 36V28Z" fill="#444" stroke="#444" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px', color: '#999' }}>
              No video loaded
            </div>
            <div style={{ fontSize: '14px' }}>
              Paste a YouTube URL above to start watching together
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div style={{
        background: '#1a1a1a',
        borderTop: '1px solid #333',
        padding: '10px 16px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center'
      }}>
        {videoId ? 
          'All viewers see synchronized playback in real-time' : 
          'Ready to sync • All viewers will see the same video'
        }
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}} />
    </div>
  );
}

export default YouTubeSyncWidget;
