import React, { useState, useEffect } from 'react';

export default function DiscoveryBox({ 
  position, 
  isHovered, 
  onHover, 
  onGenreClick, 
  onRandomClick,
  randomBoxIndex,
  discoveryLink,
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [radarAngle, setRadarAngle] = useState(0);

  // Random pulse effect for some boxes
  useEffect(() => {
    if (position.type === 'random') {
      const randomDelay = Math.random() * 10000 + 5000;
      const interval = setInterval(() => {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 2000);
      }, randomDelay);
      return () => clearInterval(interval);
    }
  }, [position.type]);

  // Radar sweep animation for center
  useEffect(() => {
    if (position.type === 'center') {
      const interval = setInterval(() => {
        setRadarAngle(prev => (prev + 2) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [position.type]);

  const handleClick = () => {
    if (position.type === 'genre') {
      onGenreClick(position.id);
    } else if (position.type === 'random' && randomBoxIndex !== null) {
      onRandomClick(randomBoxIndex);
    }
  };

  // Beveled panel style
  const beveledPanelStyle = {
    background: 'linear-gradient(180deg, #1e1e30 0%, #12121f 100%)',
    border: '3px solid',
    borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
    boxShadow: 'inset 2px 2px 0 #4a4a6a, inset -2px -2px 0 #08080f',
  };

  // Center "Explore" hub - RADAR STYLE
  if (position.type === 'center') {
    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          zIndex: 10,
        }}
      >
        {/* Outer ring */}
        <div 
          className="w-40 h-40 rounded-full flex items-center justify-center relative"
          style={{
            background: 'linear-gradient(180deg, #0a2020 0%, #051515 100%)',
            border: '4px solid',
            borderColor: '#2a4a4a #0a1a1a #0a1a1a #2a4a4a',
            boxShadow: 'inset 3px 3px 0 #3a5a5a, inset -3px -3px 0 #030808, 0 0 30px rgba(0,255,255,0.2)',
          }}
        >
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            {/* Horizontal lines */}
            <line x1="10" y1="50" x2="90" y2="50" stroke="#00FFFF" strokeWidth="0.3" opacity="0.4" />
            <line x1="50" y1="10" x2="50" y2="90" stroke="#00FFFF" strokeWidth="0.3" opacity="0.4" />
            {/* Circles */}
            <circle cx="50" cy="50" r="15" fill="none" stroke="#00FFFF" strokeWidth="0.3" opacity="0.3" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#00FFFF" strokeWidth="0.3" opacity="0.3" />
            {/* Radar sweep */}
            <line 
              x1="50" 
              y1="50" 
              x2={50 + 35 * Math.cos((radarAngle - 90) * Math.PI / 180)} 
              y2={50 + 35 * Math.sin((radarAngle - 90) * Math.PI / 180)} 
              stroke="#00FFFF" 
              strokeWidth="1.5" 
              opacity="0.8"
              style={{
                filter: 'drop-shadow(0 0 3px #00FFFF)',
              }}
            />
            {/* Sweep trail */}
            <defs>
              <linearGradient id="sweepGradient" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M 50 50 L ${50 + 35 * Math.cos((radarAngle - 90) * Math.PI / 180)} ${50 + 35 * Math.sin((radarAngle - 90) * Math.PI / 180)} A 35 35 0 0 0 ${50 + 35 * Math.cos((radarAngle - 120) * Math.PI / 180)} ${50 + 35 * Math.sin((radarAngle - 120) * Math.PI / 180)} Z`}
              fill="url(#sweepGradient)"
            />
            {/* Blinking dots */}
            <circle cx="35" cy="40" r="2" fill="#39FF14" opacity={Math.sin(radarAngle * 0.1) > 0 ? 0.8 : 0.2}>
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="60" cy="35" r="1.5" fill="#FF2DFF" opacity="0.6">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="65" cy="60" r="1.5" fill="#FFD400" opacity="0.7">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Center label */}
          <div 
            className="relative z-10 text-center"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '10px',
              color: '#FF3300',
              textShadow: '0 0 10px #FF3300, 0 0 20px #FF330060',
              letterSpacing: '1px',
            }}
          >
            EXPLORE
          </div>
        </div>
      </div>
    );
  }

  // Genre gateway boxes - BEVELED MODULES
  if (position.type === 'genre') {
    return (
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          zIndex: 5,
        }}
        onMouseEnter={() => onHover(position.id)}
        onMouseLeave={() => onHover(null)}
        onClick={handleClick}
      >
        <div 
          className="w-28 h-28 flex flex-col items-center justify-center relative"
          style={{
            ...beveledPanelStyle,
            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
            boxShadow: isHovered 
              ? `inset 2px 2px 0 #4a4a6a, inset -2px -2px 0 #08080f, 0 0 20px ${position.color}60`
              : 'inset 2px 2px 0 #4a4a6a, inset -2px -2px 0 #08080f',
          }}
        >
          {/* Top neon bar */}
          <div 
            className="absolute top-0 left-0 right-0 h-1"
            style={{ 
              backgroundColor: position.color,
              boxShadow: `0 0 10px ${position.color}, 0 2px 15px ${position.color}60`,
            }}
          />

          {/* LED indicator */}
          <div 
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{
              backgroundColor: position.color,
              boxShadow: `0 0 6px ${position.color}, 0 0 12px ${position.color}`,
              animation: isHovered ? 'blink 0.5s infinite' : 'none',
            }}
          />

          {/* Label */}
          <span 
            className="text-base tracking-wider"
            style={{ 
              fontFamily: 'VT323, monospace',
              fontSize: '22px',
              color: isHovered ? position.color : '#c0c0c0',
              textShadow: isHovered ? `0 0 10px ${position.color}` : 'none',
              letterSpacing: '2px',
            }}
          >
            {position.label}
          </span>

          {/* Subtitle */}
          <span 
            className="text-xs mt-1"
            style={{ 
              fontFamily: 'VT323, monospace',
              color: '#666',
              fontSize: '14px',
            }}
          >
            [ENTER]
          </span>

          {/* NEW badge on Music */}
          {position.id === 'music' && (
            <div 
              className="absolute -top-2 -right-2 px-1 py-0.5"
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '6px',
                backgroundColor: '#FF3300',
                color: '#fff',
                border: '1px solid #FF6600',
                boxShadow: '0 0 8px #FF3300',
                animation: 'blink 1s infinite',
              }}
            >
              NEW!
            </div>
          )}
        </div>
      </div>
    );
  }

  // Random discovery boxes - LARGER BEVELED MODULES FOR PREVIEWS
  const randomColors = ['#39FF14', '#00A2FF', '#FF2DFF', '#FFD400', '#FF3300', '#00FFFF'];
  const boxColor = randomColors[parseInt(position.id.split('-')[1]) % randomColors.length];

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        zIndex: 3,
      }}
      onMouseEnter={() => onHover(position.id)}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
    >
      <div 
        className="w-24 h-24 relative flex items-center justify-center"
        style={{
          background: isHovered 
            ? 'linear-gradient(180deg, #252540 0%, #181828 100%)'
            : 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
          border: '2px solid',
          borderColor: isHovered ? '#4a4a6a #1a1a2a #1a1a2a #4a4a6a' : '#2a2a4a #0a0a15 #0a0a15 #2a2a4a',
          boxShadow: isHovered 
            ? `inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #08080f, 0 0 15px ${boxColor}40`
            : isAnimating
            ? `inset 1px 1px 0 #3a3a5a, inset -1px -1px 0 #08080f, 0 0 20px ${boxColor}50`
            : 'inset 1px 1px 0 #3a3a5a, inset -1px -1px 0 #08080f',
          transform: isHovered ? 'scale(1.15)' : isAnimating ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {/* Corner LED */}
        <div 
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: isHovered || isAnimating ? boxColor : '#333',
            boxShadow: isHovered || isAnimating ? `0 0 4px ${boxColor}` : 'none',
          }}
        />

        {/* Preview on hover - Show actual website in iframe */}
        {isHovered && discoveryLink && (
          <div 
            className="absolute inset-0 flex flex-col"
            style={{
              background: '#000',
              border: `2px solid ${boxColor}`,
              boxShadow: `inset 0 0 20px ${boxColor}40, 0 0 20px ${boxColor}`,
              overflow: 'hidden',
            }}
          >
            {/* Mini iframe preview */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={discoveryLink.url}
                className="w-full h-full"
                style={{
                  border: 'none',
                  transform: 'scale(0.4)',
                  transformOrigin: 'top left',
                  width: '250%',
                  height: '250%',
                  pointerEvents: 'none',
                }}
                sandbox="allow-same-origin"
              />
            </div>
            
            {/* Title overlay at bottom */}
            <div 
              className="absolute bottom-0 left-0 right-0 text-center py-1 px-1"
              style={{
                background: 'rgba(0,0,0,0.9)',
                borderTop: `1px solid ${boxColor}`,
              }}
            >
              <div 
                className="text-xs leading-tight"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '10px',
                  color: boxColor,
                  textShadow: `0 0 4px ${boxColor}`,
                }}
              >
                {discoveryLink.title}
              </div>
            </div>
          </div>
        )}

        {/* Fallback for boxes without discovery link */}
        {isHovered && !discoveryLink && (
          <svg 
            className="w-8 h-8"
            fill="none"
            stroke={boxColor}
            viewBox="0 0 24 24"
            style={{
              filter: `drop-shadow(0 0 4px ${boxColor})`,
            }}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        )}

        {/* Pulse effect */}
        {isAnimating && !isHovered && (
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: boxColor,
              boxShadow: `0 0 10px ${boxColor}, 0 0 20px ${boxColor}`,
              animation: 'pulse 1s ease-in-out',
            }}
          />
        )}
      </div>
    </div>
  );
}
