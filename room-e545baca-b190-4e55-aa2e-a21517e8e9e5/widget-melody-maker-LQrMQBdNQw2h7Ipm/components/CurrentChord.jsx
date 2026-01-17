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

export default function CurrentChord({ currentChord, colors }) {
  return (
    <div className="mb-4 p-5" style={{
      background: colors.cardBg,
      borderRadius: '24px 24px 8px 24px',
      boxShadow: `0 4px 16px ${colors.shadow}`,
      minHeight: '100px'
    }}>
      {currentChord.length > 0 ? (
        <>
          <div className="text-xs mb-3 uppercase" style={{ 
            color: colors.text.secondary,
            letterSpacing: '0.08em',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}>
            Current Chord (Release keys to record)
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentChord.map((note, idx) => (
              <div
                key={idx}
                className="px-4 py-2 text-sm"
                style={{ 
                  backgroundColor: colors.sage,
                  color: colors.white,
                  borderRadius: idx % 2 === 0 ? '16px 16px 4px 16px' : '16px 4px 16px 16px',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  boxShadow: `0 2px 8px ${colors.shadow}`
                }}
              >
                {NOTES.find(n => n.note === note)?.name}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-xs uppercase flex items-center justify-center h-full" style={{ 
          color: colors.text.tertiary,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500'
        }}>
          Press keys to play notes
        </div>
      )}
    </div>
  );
}
