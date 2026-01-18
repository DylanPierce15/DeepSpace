import React, { useState } from 'react';

export default function GenreNavigation({ currentGenre, onGenreChange }) {
  const [hoveredGenre, setHoveredGenre] = useState(null);

  const genres = [
    { id: 'all', name: 'ALL', emoji: '\u{1F310}', color: '#FF3300' },
    { id: 'music', name: 'MUSIC', emoji: '\u{1F3B5}', color: '#39FF14' },
    { id: 'art', name: 'ART', emoji: '\u{1F3A8}', color: '#FF2DFF' },
    { id: 'learn', name: 'LEARN', emoji: '\u{1F4DA}', color: '#FFD400' },
    { id: 'games', name: 'GAMES', emoji: '\u{1F3AE}', color: '#00A2FF' },
    { id: 'science', name: 'SCIENCE', emoji: '\u{1F52C}', color: '#00FFFF' },
    { id: 'create', name: 'CREATE', emoji: '\u{1F3A8}', color: '#FF6B00' },
    { id: 'suggest', name: 'SUGGEST', emoji: '\u{1F4A1}', color: '#FF10F0' },
  ];

  return (
    <div className="fixed top-8 left-8 right-8 z-50 flex items-center gap-3 flex-wrap">
      {/* Genre buttons */}
      {genres.map((genre) => (
        <button
          key={genre.id}
          onClick={() => onGenreChange(genre.id)}
          onMouseEnter={() => setHoveredGenre(genre.id)}
          onMouseLeave={() => setHoveredGenre(null)}
          className="flex items-center gap-2 px-4 py-2 transition-all duration-200"
          style={{
            fontFamily: 'VT323, monospace',
            background: currentGenre === genre.id
              ? 'linear-gradient(180deg, #3a3a55 0%, #2a2a40 100%)'
              : hoveredGenre === genre.id
              ? 'linear-gradient(180deg, #3a3a55 0%, #2a2a40 100%)'
              : 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
            border: '2px solid',
            borderColor: currentGenre === genre.id || hoveredGenre === genre.id
              ? '#6a6a8a #2a2a3a #2a2a3a #6a6a8a'
              : '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
            boxShadow: currentGenre === genre.id || hoveredGenre === genre.id
              ? `inset 1px 1px 0 #7a7a9a, inset -1px -1px 0 #18182f, 0 0 15px ${genre.color}60`
              : 'inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #18182f',
          }}
        >
          {/* LED indicator for current genre */}
          {currentGenre === genre.id && (
            <div 
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: genre.color,
                boxShadow: `0 0 8px ${genre.color}`,
                animation: 'blink 1.5s infinite',
              }}
            />
          )}
          <span className="text-sm">{genre.emoji}</span>
          <span 
            style={{ 
              fontSize: '16px',
              color: currentGenre === genre.id || hoveredGenre === genre.id ? genre.color : '#aaa',
              textShadow: currentGenre === genre.id || hoveredGenre === genre.id ? `0 0 8px ${genre.color}` : 'none',
              letterSpacing: '1px',
            }}
          >
            {genre.name}
          </span>
        </button>
      ))}

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
