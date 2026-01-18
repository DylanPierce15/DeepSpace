import React, { useState } from 'react';

export default function ShuffleButton({ onShuffle }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    setIsSpinning(true);
    onShuffle();
    setTimeout(() => setIsSpinning(false), 600);
  };

  return (
    <div
      className="fixed cursor-pointer z-20"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, calc(-50% + 85px))',
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Beveled button */}
      <div 
        className="w-14 h-14 flex items-center justify-center transition-all duration-200"
        style={{
          background: isHovered 
            ? 'linear-gradient(180deg, #2a2a45 0%, #1a1a30 100%)'
            : 'linear-gradient(180deg, #1e1e35 0%, #12121f 100%)',
          border: '3px solid',
          borderColor: isHovered 
            ? '#5a5a7a #1a1a2a #1a1a2a #5a5a7a'
            : '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
          boxShadow: isHovered
            ? 'inset 2px 2px 0 #6a6a8a, inset -2px -2px 0 #08080f, 0 0 20px #00FFFF40'
            : 'inset 2px 2px 0 #4a4a6a, inset -2px -2px 0 #08080f',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        <svg 
          className="w-7 h-7 transition-transform duration-500"
          fill="none"
          stroke="#00FFFF"
          viewBox="0 0 24 24"
          style={{
            transform: isSpinning ? 'rotate(360deg)' : 'rotate(0deg)',
            filter: isHovered ? 'drop-shadow(0 0 6px #00FFFF)' : 'drop-shadow(0 0 2px #00FFFF)',
          }}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
          />
        </svg>
      </div>
      
      {/* Label */}
      <div 
        className="absolute top-full mt-3 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
        style={{
          fontFamily: 'VT323, monospace',
          fontSize: '16px',
          color: isHovered ? '#00FFFF' : '#666',
          textShadow: isHovered ? '0 0 8px #00FFFF' : 'none',
          letterSpacing: '2px',
        }}
      >
        [SHUFFLE]
      </div>
    </div>
  );
}
