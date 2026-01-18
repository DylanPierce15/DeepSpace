import React, { useState } from 'react';

export default function BackButton({ onBack, genre }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed top-8 left-8 z-50 flex items-center gap-4">
      {/* Beveled back button - MORE VISIBLE */}
      <button
        onClick={onBack}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-3 px-5 py-3 transition-all duration-200"
        style={{
          fontFamily: 'VT323, monospace',
          background: isHovered 
            ? 'linear-gradient(180deg, #3a3a55 0%, #2a2a40 100%)'
            : 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
          border: '3px solid',
          borderColor: isHovered 
            ? '#6a6a8a #2a2a3a #2a2a3a #6a6a8a'
            : '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
          boxShadow: isHovered
            ? `inset 2px 2px 0 #7a7a9a, inset -2px -2px 0 #18182f, 0 0 20px ${genre.color}60`
            : `inset 2px 2px 0 #5a5a7a, inset -2px -2px 0 #18182f, 0 0 8px ${genre.color}20`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <svg 
          className="w-5 h-5 transition-transform duration-200"
          style={{
            transform: isHovered ? 'translateX(-3px)' : 'translateX(0)',
            color: genre.color,
            filter: `drop-shadow(0 0 6px ${genre.color})`,
          }}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10 19l-7-7m0 0l7-7m-7 7h18" 
          />
        </svg>
        <span 
          style={{ 
            fontSize: '18px',
            color: isHovered ? genre.color : '#aaa',
            textShadow: isHovered ? `0 0 10px ${genre.color}` : `0 0 4px ${genre.color}40`,
            letterSpacing: '1px',
          }}
        >
          [BACK TO HUB]
        </span>
      </button>

      {/* Genre indicator badge - MORE VISIBLE */}
      <div 
        className="px-4 py-2 flex items-center gap-2"
        style={{
          background: 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
          border: '2px solid',
          borderColor: '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
          boxShadow: `inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #18182f, 0 0 8px ${genre.color}20`,
        }}
      >
        {/* LED indicator */}
        <div 
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: genre.color,
            boxShadow: `0 0 8px ${genre.color}, 0 0 12px ${genre.color}`,
            animation: 'blink 1.5s infinite',
          }}
        />
        <span 
          className="text-lg"
          style={{
            filter: `drop-shadow(0 0 6px ${genre.color})`,
          }}
        >
          {genre.emoji}
        </span>
        <span 
          style={{
            fontFamily: 'VT323, monospace',
            fontSize: '16px',
            color: genre.color,
            textShadow: `0 0 8px ${genre.color}`,
            letterSpacing: '1px',
          }}
        >
          {genre.name}
        </span>
      </div>

      {/* CSS for blink animation */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
