import React from 'react';

const NOTES = [
  { note: 60, name: 'C4', isBlack: false }, { note: 61, name: 'C#4', isBlack: true }, { note: 62, name: 'D4', isBlack: false },
  { note: 63, name: 'D#4', isBlack: true }, { note: 64, name: 'E4', isBlack: false }, { note: 65, name: 'F4', isBlack: false },
  { note: 66, name: 'F#4', isBlack: true }, { note: 67, name: 'G4', isBlack: false }, { note: 68, name: 'G#4', isBlack: true },
  { note: 69, name: 'A4', isBlack: false }, { note: 70, name: 'A#4', isBlack: true }, { note: 71, name: 'B4', isBlack: false },
  { note: 72, name: 'C5', isBlack: false }, { note: 73, name: 'C#5', isBlack: true }, { note: 74, name: 'D5', isBlack: false },
  { note: 75, name: 'D#5', isBlack: true }, { note: 76, name: 'E5', isBlack: false }, { note: 77, name: 'F5', isBlack: false },
  { note: 78, name: 'F#5', isBlack: true }, { note: 79, name: 'G5', isBlack: false }, { note: 80, name: 'G#5', isBlack: true },
  { note: 81, name: 'A5', isBlack: false }, { note: 82, name: 'A#5', isBlack: true }, { note: 83, name: 'B5', isBlack: false }
];

// Helper to darken color based on note position (matches Piano.jsx)
const darkenColor = (hex, amount) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
};

// Get color for a note based on its position on the keyboard
// Matches the gradient used in Piano.jsx where colors get darker from left to right
const getNoteColor = (noteNumber, baseColorLight, colors) => {
  const noteData = NOTES.find(n => n.note === noteNumber);
  if (!noteData) return baseColorLight;
  
  // Calculate position from left to right (same as Piano.jsx)
  const whiteNotes = NOTES.filter(n => !n.isBlack);
  const isBlack = noteData.isBlack;
  
  if (isBlack) {
    // For black keys, find their position relative to white keys
    const whiteKeysBefore = NOTES.filter(n => n.note < noteNumber && !n.isBlack).length;
    const totalWhiteKeys = whiteNotes.length;
    const darkness = whiteKeysBefore / (totalWhiteKeys - 1);
    return darkenColor(baseColorLight, darkness * 0.35);
  } else {
    // For white keys, use their direct index
    const whiteIdx = whiteNotes.findIndex(n => n.note === noteNumber);
    const totalWhiteKeys = whiteNotes.length;
    const darkness = whiteIdx / (totalWhiteKeys - 1);
    return darkenColor(baseColorLight, darkness * 0.35);
  }
};

export default function MelodyTimeline({ 
  userSequence, 
  aiMelody, 
  aiDrums,
  activeNotes,
  activeDrums,
  playFromIndex,
  selectedNotes,
  onNoteClick,
  onNoteDoubleClick,
  onAiNoteDoubleClick,
  onToggleSelection,
  colors 
}) {
  const allMelody = [...userSequence, ...aiMelody];

  return (
    <div className="mb-4 p-6" style={{
      background: colors.cardBg,
      borderRadius: '32px 8px 32px 32px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs tracking-wide uppercase" style={{ 
          color: colors.text.secondary,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500'
        }}>
          Melody Timeline
        </h2>
        <div className="text-xs" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          Ctrl/Cmd+Click to select notes
        </div>
      </div>
      
      {allMelody.length === 0 ? (
        <div className="text-center py-12" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          Press piano keys below or use your keyboard (A-B keys) to start
        </div>
      ) : (
        <div>
          {/* Melody Timeline */}
          <div className="mb-4">
            <div className="text-xs mb-2 uppercase" style={{ 
              color: colors.text.tertiary,
              letterSpacing: '0.08em',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500'
            }}>
              Melody
            </div>
            <div className="flex items-start gap-2 flex-wrap">
              {userSequence.map((item, idx) => (
                <div
                  key={`user-${idx}`}
                  className="flex flex-col items-center gap-2 group relative"
                >
                  <div 
                    className="flex flex-col gap-1 relative cursor-pointer"
                    onDoubleClick={() => onNoteDoubleClick(idx)}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        onToggleSelection(idx, false);
                      } else {
                        onNoteClick(idx);
                      }
                    }}
                    title="Click to play from here, Ctrl/Cmd+Click to select, double-click to delete"
                  >
                    {item.notes?.map((note, noteIdx) => {
                      const noteColor = getNoteColor(note, colors.sageLight, colors);
                      const isSelected = selectedNotes && selectedNotes.has(`user-${idx}`);
                      return (
                        <div
                          key={noteIdx}
                          className="px-3 py-2 flex items-center justify-center text-xs"
                          style={{
                            backgroundColor: noteColor,
                            color: colors.white,
                            borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 12px 4px 12px' : (idx + noteIdx) % 3 === 1 ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                            boxShadow: activeNotes.has(note) ? `0 4px 16px ${noteColor}80` : `0 2px 6px ${colors.shadow}`,
                            transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: '46px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            fontWeight: '500',
                            opacity: playFromIndex === idx ? 0.7 : 1,
                            border: isSelected ? `3px solid ${colors.terracotta}` : 'none'
                          }}
                        >
                          {NOTES.find(n => n.note === note)?.name}
                        </div>
                      );
                    })}
                    {playFromIndex === idx && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{
                        backgroundColor: colors.terracotta,
                        boxShadow: `0 0 8px ${colors.terracotta}`
                      }} />
                    )}
                  </div>
                  <div className="text-xs" style={{ 
                    color: colors.text.tertiary,
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    {item.isChord ? 'Chord' : 'You'}
                  </div>
                </div>
              ))}
              
              {aiMelody.length > 0 && (
                <div className="w-px h-14 mx-2" style={{ 
                  background: `linear-gradient(to bottom, ${colors.creamDark}, transparent, ${colors.creamDark})`
                }}></div>
              )}
              
              {aiMelody.map((item, idx) => {
                const actualIndex = userSequence.length + idx;
                return (
                  <div
                    key={`ai-${idx}`}
                    className="flex flex-col items-center gap-2 group relative"
                  >
                    <div 
                      className="flex flex-col gap-1 relative cursor-pointer"
                      onDoubleClick={() => onAiNoteDoubleClick(idx)}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          onToggleSelection(idx, true);
                        } else {
                          onNoteClick(actualIndex);
                        }
                      }}
                      title="Click to play from here, Ctrl/Cmd+Click to select, double-click to delete"
                    >
                      {item.notes?.map((note, noteIdx) => {
                        const noteColor = getNoteColor(note, colors.warmBrownLight, colors);
                        const isSelected = selectedNotes && selectedNotes.has(`ai-${idx}`);
                        return (
                          <div
                            key={noteIdx}
                            className="px-3 py-2 flex items-center justify-center text-xs"
                            style={{
                              backgroundColor: noteColor,
                              color: colors.white,
                              borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 4px 12px 12px' : (idx + noteIdx) % 3 === 1 ? '4px 12px 12px 12px' : '12px 12px 4px 12px',
                              boxShadow: activeNotes.has(note) ? `0 4px 16px ${noteColor}80` : `0 2px 6px ${colors.shadow}`,
                              transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              minWidth: '46px',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              fontWeight: '500',
                              opacity: playFromIndex === actualIndex ? 0.7 : 1,
                              border: isSelected ? `3px solid ${colors.terracotta}` : 'none'
                            }}
                          >
                            {NOTES.find(n => n.note === note)?.name}
                          </div>
                        );
                      })}
                      {playFromIndex === actualIndex && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{
                          backgroundColor: colors.terracotta,
                          boxShadow: `0 0 8px ${colors.terracotta}`
                        }} />
                      )}
                    </div>
                    <div className="text-xs" style={{ 
                      color: colors.text.tertiary,
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}>
                      AI
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drum Timeline */}
          {aiDrums.length > 0 && (
            <div className="mt-5 pt-5" style={{ 
              borderTop: `2px solid ${colors.creamDark}`
            }}>
              <div className="text-xs mb-2 uppercase" style={{ 
                color: colors.text.tertiary,
                letterSpacing: '0.08em',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500'
              }}>
                Drums (AI Generated)
              </div>
              <div className="flex items-start gap-2 flex-wrap">
                {aiDrums.slice(0, 32).map((drum, idx) => (
                  <div
                    key={`drum-${idx}`}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className="px-3 py-2 flex items-center justify-center text-xs uppercase"
                      style={{
                        backgroundColor: colors.terracotta,
                        color: colors.white,
                        borderRadius: idx % 4 === 0 ? '12px 4px 12px 4px' : idx % 4 === 1 ? '4px 12px 4px 12px' : idx % 4 === 2 ? '12px 12px 4px 4px' : '4px 4px 12px 12px',
                        boxShadow: activeDrums.has(drum.drumType) ? `0 4px 16px ${colors.terracotta}80` : `0 2px 6px ${colors.shadow}`,
                        transform: activeDrums.has(drum.drumType) ? 'scale(1.08)' : 'scale(1)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        minWidth: '50px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        fontWeight: '600',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {drum.drumType === 'hihat' ? 'HH' : drum.drumType === 'openhat' ? 'OH' : drum.drumType[0].toUpperCase()}
                    </div>
                  </div>
                ))}
                {aiDrums.length > 32 && (
                  <div className="px-3 py-2 text-xs" style={{ 
                    color: colors.text.tertiary,
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    +{aiDrums.length - 32} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
