import React from 'react';

const NOTES = [
  { note: 60, name: 'C4', isBlack: false, key: 'a' },
  { note: 61, name: 'C#4', isBlack: true, key: 'w' },
  { note: 62, name: 'D4', isBlack: false, key: 's' },
  { note: 63, name: 'D#4', isBlack: true, key: 'e' },
  { note: 64, name: 'E4', isBlack: false, key: 'd' },
  { note: 65, name: 'F4', isBlack: false, key: 'f' },
  { note: 66, name: 'F#4', isBlack: true, key: 't' },
  { note: 67, name: 'G4', isBlack: false, key: 'g' },
  { note: 68, name: 'G#4', isBlack: true, key: 'y' },
  { note: 69, name: 'A4', isBlack: false, key: 'h' },
  { note: 70, name: 'A#4', isBlack: true, key: 'u' },
  { note: 71, name: 'B4', isBlack: false, key: 'j' },
  { note: 72, name: 'C5', isBlack: false, key: 'k' },
  { note: 73, name: 'C#5', isBlack: true, key: 'o' },
  { note: 74, name: 'D5', isBlack: false, key: 'l' },
  { note: 75, name: 'D#5', isBlack: true, key: 'p' },
  { note: 76, name: 'E5', isBlack: false, key: ';' },
  { note: 77, name: 'F5', isBlack: false, key: '\'' },
  { note: 78, name: 'F#5', isBlack: true, key: ']' },
  { note: 79, name: 'G5', isBlack: false, key: 'z' },
  { note: 80, name: 'G#5', isBlack: true, key: 'x' },
  { note: 81, name: 'A5', isBlack: false, key: 'c' },
  { note: 82, name: 'A#5', isBlack: true, key: 'v' },
  { note: 83, name: 'B5', isBlack: false, key: 'b' }
];

const lerp = (a, b, t) => a + (b - a) * t;

//Simple function to darken color as values increase, used for coloring pressed keys
const darkenColor = (hex, amount) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
};

export default function Piano({ 
  pressedKeys, 
  activeNotes, 
  isPlaying,
  onKeyDown, 
  onKeyUp,
  colors 
}) {
  return (
    <div className="p-6" style={{
      background: colors.cardBg,
      borderRadius: '32px 32px 8px 8px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 className="text-xs tracking-wide uppercase" style={{ 
          color: colors.text.secondary,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500'
        }}>
          Piano Keyboard
        </h2>
        <div className="text-xs" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          Hold multiple keys for chords - hold time matters!
        </div>
      </div>
      
      <div className="relative flex justify-center mb-4 overflow-x-auto pb-2">
        <div className="relative inline-flex">
          {/* White keys */}
          <div className="flex">
            {NOTES.filter(n => !n.isBlack).map((noteData, whiteIdx) => {
              const isPressed = pressedKeys.has(noteData.note) || activeNotes.has(noteData.note);
              const totalWhiteKeys = NOTES.filter(n => !n.isBlack).length;
              const darkness = whiteIdx / (totalWhiteKeys - 1); 
              return (
                <button
                  key={noteData.note}
                  onMouseDown={() => onKeyDown(noteData.note)}
                  onMouseUp={() => onKeyUp(noteData.note)}
                  onMouseLeave={() => onKeyUp(noteData.note)}
                  onTouchStart={(e) => { e.preventDefault(); onKeyDown(noteData.note); }}
                  onTouchEnd={(e) => { e.preventDefault(); onKeyUp(noteData.note); }}
                  disabled={isPlaying}
                  className="relative transition-all disabled:cursor-not-allowed"
                  style={{
                    width: '52px',
                    height: '200px',
                    backgroundColor: isPressed
                      ? darkenColor(colors.sageLight, darkness * 0.35)
                      : colors.cream,
                    transform: isPressed ? 'translateY(2px)' : 'none',
                    boxShadow: isPressed ? `inset 0 3px 8px ${colors.shadow}` : `0 3px 8px ${colors.shadow}`,
                    border: `2px solid ${colors.creamDark}`,
                    borderBottom: isPressed ? `2px solid ${colors.creamDark}` : `4px solid ${colors.creamDark}`,
                    borderRadius: whiteIdx % 3 === 0 ? '8px 8px 8px 8px' : whiteIdx % 3 === 1 ? '8px 8px 4px 8px' : '8px 8px 8px 4px'
                  }}
                >
                  <div className="absolute top-3 left-0 right-0 text-center">
                    <div className="text-xs mb-1" style={{ 
                      color: isPressed ? colors.white : colors.warmBrown,
                      textTransform: 'uppercase',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: '600'
                    }}>
                      {noteData.key}
                    </div>
                  </div>
                  <span className="absolute bottom-3 left-0 right-0 text-center text-xs" style={{
                    color: colors.warmBrown,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500'
                  }}>
                    {noteData.name}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Black keys */}
          <div className="absolute top-0 left-0 right-0 flex pointer-events-none">
            {NOTES.map((noteData, idx) => {
              if (!noteData.isBlack) return null;
              
              const whiteKeysBefore = NOTES.slice(0, idx).filter(n => !n.isBlack).length;
              const totalWhiteKeys = NOTES.filter(n => !n.isBlack).length;
              const darkness = whiteKeysBefore / (totalWhiteKeys - 1);
              const leftPos = whiteKeysBefore * 52 - 18;
              const isPressed = pressedKeys.has(noteData.note) || activeNotes.has(noteData.note);
              
              return (
                <button
                  key={noteData.note}
                  onMouseDown={() => onKeyDown(noteData.note)}
                  onMouseUp={() => onKeyUp(noteData.note)}
                  onMouseLeave={() => onKeyUp(noteData.note)}
                  onTouchStart={(e) => { e.preventDefault(); onKeyDown(noteData.note); }}
                  onTouchEnd={(e) => { e.preventDefault(); onKeyUp(noteData.note); }}
                  disabled={isPlaying}
                  className="absolute pointer-events-auto border-none transition-all disabled:cursor-not-allowed"
                  style={{
                    width: '36px',
                    height: '130px',
                    backgroundColor: isPressed
                      ? darkenColor(colors.warmBrownLight, darkness * 0.35)
                      : darkenColor('#1a1612', darkness * 0.2),
                    left: `${leftPos}px`,
                    transform: isPressed ? 'translateY(2px)' : 'none',
                    boxShadow: isPressed ? `inset 0 3px 8px rgba(0,0,0,0.4)` : `0 4px 12px ${colors.shadow}, 0 2px 4px rgba(0,0,0,0.3)`,
                    zIndex: 10,
                    borderRadius: whiteKeysBefore % 3 === 0 ? '4px 4px 8px 4px' : whiteKeysBefore % 3 === 1 ? '4px 4px 4px 8px' : '8px 4px 4px 4px',
                    border: `2px solid #0d0a08`
                  }}
                >
                  <div className="absolute top-2 left-0 right-0 text-center">
                    <div className="text-xs mb-1" style={{ 
                      color: isPressed ? colors.cream : 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: '600'
                    }}>
                      {noteData.key}
                    </div>
                  </div>
                  <span className="absolute bottom-2 left-0 right-0 text-center text-xs" style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500'
                  }}>
                    {noteData.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Keyboard mapping hint */}
      <div className="text-center text-xs mt-5" style={{ 
        color: colors.text.tertiary,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        Use your keyboard: A-B keys map to piano keys • Hold multiple for chords • Hold time = note duration • Release to record
      </div>
    </div>
  );
}
