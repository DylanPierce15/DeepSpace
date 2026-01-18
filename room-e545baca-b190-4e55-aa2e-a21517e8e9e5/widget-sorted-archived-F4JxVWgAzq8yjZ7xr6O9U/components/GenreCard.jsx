import React from 'react';

export default function GenreCard({ discovery, genre, isActive, index, total, onVisit }) {
  return (
    <div 
      className="h-screen w-full snap-start flex items-center justify-center px-8 relative"
      style={{
        transition: 'opacity 0.5s ease',
        opacity: isActive ? 1 : 0.3,
      }}
    >
      {/* Beveled module card */}
      <div 
        className="max-w-2xl w-full relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
          border: '4px solid',
          borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
          boxShadow: isActive 
            ? `inset 3px 3px 0 #4a4a6a, inset -3px -3px 0 #08080f, 0 0 40px ${genre.color}30`
            : 'inset 3px 3px 0 #4a4a6a, inset -3px -3px 0 #08080f',
          transform: isActive ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.5s ease, box-shadow 0.5s ease',
          padding: '40px',
        }}
      >
        {/* Top neon accent bar */}
        <div 
          className="absolute top-0 left-0 right-0 h-2"
          style={{ 
            backgroundColor: genre.color,
            boxShadow: `0 0 15px ${genre.color}, 0 3px 20px ${genre.color}60`,
          }}
        />

        {/* LED indicators row */}
        <div className="absolute top-4 right-4 flex gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#39FF14',
              boxShadow: '0 0 6px #39FF14',
              animation: 'blink 2s infinite',
            }}
          />
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#FFD400',
              boxShadow: '0 0 6px #FFD400',
              animation: 'blink 2.5s infinite 0.5s',
            }}
          />
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: genre.color,
              boxShadow: `0 0 6px ${genre.color}`,
              animation: 'blink 1.5s infinite 1s',
            }}
          />
        </div>

        {/* Genre emoji with glow */}
        <div 
          className="text-6xl mb-6 text-center"
          style={{
            filter: `drop-shadow(0 0 10px ${genre.color})`,
          }}
        >
          {genre.emoji}
        </div>

        {/* Large iframe preview of actual website */}
        <div 
          className="mb-6"
          style={{
            border: `4px solid ${genre.color}`,
            boxShadow: `inset 0 0 30px ${genre.color}20, 0 0 40px ${genre.color}60, 0 0 60px ${genre.color}30`,
            background: '#000',
            borderRadius: '4px',
          }}
        >
          <iframe
            src={discovery.url}
            data-original-src={discovery.url}
            className="w-full"
            style={{
              height: '400px',
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin allow-scripts allow-forms"
            loading="lazy"
          />
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <h2 
            className="text-4xl mb-4"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '20px',
              color: genre.color,
              textShadow: `0 0 15px ${genre.color}, 0 0 30px ${genre.color}40`,
              letterSpacing: '3px',
            }}
          >
            {discovery.title}
          </h2>
          {discovery.description && (
            <p 
              className="text-lg leading-relaxed px-4"
              style={{
                fontFamily: 'VT323, monospace',
                fontSize: '22px',
                color: '#aaa',
                textShadow: '0 0 2px rgba(255,255,255,0.1)',
              }}
            >
              {discovery.description}
            </p>
          )}
        </div>

        {/* Visit button for real links */}
        {discovery.url ? (
          <div className="mt-12 pt-8 border-t border-gray-800 flex justify-center">
            <button
              onClick={onVisit}
              className="inline-flex items-center gap-3 px-8 py-4 cursor-pointer transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
                border: '2px solid',
                borderColor: '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
                boxShadow: `inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #18182f, 0 0 10px ${genre.color}40`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #18182f, 0 0 20px ${genre.color}60`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `inset 1px 1px 0 #5a5a7a, inset -1px -1px 0 #18182f, 0 0 10px ${genre.color}40`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke={genre.color}
                viewBox="0 0 24 24"
                style={{
                  filter: `drop-shadow(0 0 4px ${genre.color})`,
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span 
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '20px',
                  color: genre.color,
                  textShadow: `0 0 8px ${genre.color}`,
                  letterSpacing: '2px',
                }}
              >
                [VISIT SITE]
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-12 pt-8 border-t border-gray-800 flex justify-center">
            <div 
              className="inline-flex items-center gap-3 px-6 py-3"
              style={{
                background: 'linear-gradient(180deg, #1e1e35 0%, #12121f 100%)',
                border: '2px solid',
                borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
                boxShadow: 'inset 1px 1px 0 #4a4a6a, inset -1px -1px 0 #08080f',
              }}
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke={genre.color}
                viewBox="0 0 24 24"
                style={{
                  filter: `drop-shadow(0 0 4px ${genre.color})`,
                  animation: 'blink 1s infinite',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span 
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '18px',
                  color: genre.color,
                  textShadow: `0 0 8px ${genre.color}`,
                  letterSpacing: '2px',
                }}
              >
                UNDER CONSTRUCTION
              </span>
            </div>
          </div>
        )}

        {/* Progress indicator - pixel dots */}
        <div className="absolute bottom-6 right-6 flex gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 transition-all duration-300"
              style={{
                backgroundColor: i === index ? genre.color : '#2a2a4a',
                boxShadow: i === index ? `0 0 8px ${genre.color}` : 'none',
                border: '1px solid',
                borderColor: i === index ? genre.color : '#3a3a5a',
              }}
            />
          ))}
        </div>

        {/* Card number indicator */}
        <div 
          className="absolute bottom-6 left-6"
          style={{
            fontFamily: 'VT323, monospace',
            fontSize: '16px',
            color: '#555',
          }}
        >
          [{String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}]
        </div>
      </div>

      {/* Scroll hint (only on first card) */}
      {index === 0 && (
        <div 
          className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ animation: 'bounce 2s infinite' }}
        >
          <span 
            style={{
              fontFamily: 'VT323, monospace',
              fontSize: '18px',
              color: '#666',
              letterSpacing: '2px',
            }}
          >
            SCROLL TO EXPLORE
          </span>
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke={genre.color}
            viewBox="0 0 24 24"
            style={{
              filter: `drop-shadow(0 0 4px ${genre.color})`,
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
