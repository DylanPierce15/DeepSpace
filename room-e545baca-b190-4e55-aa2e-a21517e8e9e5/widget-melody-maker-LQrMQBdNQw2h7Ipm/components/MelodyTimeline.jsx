import React from 'react';

const NOTES = [
  { note: 60, name: 'C4' }, { note: 61, name: 'C#4' }, { note: 62, name: 'D4' },
  { note: 63, name: 'D#4' }, { note: 64, name: 'E4' }, { note: 65, name: 'F4' },
  { note: 66, name: 'F#4' }, { note: 67, name: 'G4' }, { note: 68, name: 'G#4' },
  { note: 69, name: 'A4' }, { note: 70, name: 'A#4' }, { note: 71, name: 'B4' },
  { note: 72, name: 'C5' }, { note: 73, name: 'C#5' }, { note: 74, name: 'D5' },
  { note: 75, name: 'D#5' }, { note: 76, name: 'E5' }, { note: 77, name: 'F5' },
  { note: 78, name: 'F#5' }, { note: 79, name: 'G5' }, { note: 80, name: 'G#5' },
  { note: 81, name: 'A5' }, { note: 82, name: 'A#5' }, { note: 83, name: 'B5' }
];

export default function MelodyTimeline({ 
  userSequence, 
  aiMelody, 
  aiDrums,
  activeNotes,
  activeDrums,
  playFromIndex,
  onNoteClick,
  onNoteDoubleClick,
  onAiNoteDoubleClick,
  colors 
}) {
  const allMelody = [...userSequence, ...aiMelody];

  return (
    <div className="mb-4 p-6" style={{
      background: colors.cardBg,
      borderRadius: '32px 8px 32px 32px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      <h2 className="text-xs mb-4 tracking-wide uppercase" style={{ 
        color: colors.text.secondary,
        letterSpacing: '0.08em',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '500'
      }}>
        Melody Timeline
      </h2>
      
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
                    onClick={() => onNoteClick(idx)}
                    title="Click to play from here, double-click to delete"
                  >
                    {item.notes?.map((note, noteIdx) => (
                      <div
                        key={noteIdx}
                        className="px-3 py-2 flex items-center justify-center text-xs"
                        style={{
                          backgroundColor: colors.sage,
                          color: colors.white,
                          borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 12px 4px 12px' : (idx + noteIdx) % 3 === 1 ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                          boxShadow: activeNotes.has(note) ? `0 4px 16px ${colors.sage}80` : `0 2px 6px ${colors.shadow}`,
                          transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          minWidth: '46px',
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          fontWeight: '500',
                          opacity: playFromIndex === idx ? 0.7 : 1
                        }}
                      >
                        {NOTES.find(n => n.note === note)?.name}
                      </div>
                    ))}
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
                      onClick={() => onNoteClick(actualIndex)}
                      title="Click to play from here, double-click to delete"
                    >
                      {item.notes?.map((note, noteIdx) => (
                        <div
                          key={noteIdx}
                          className="px-3 py-2 flex items-center justify-center text-xs"
                          style={{
                            backgroundColor: colors.warmBrown,
                            color: colors.white,
                            borderRadius: (idx + noteIdx) % 3 === 0 ? '12px 4px 12px 12px' : (idx + noteIdx) % 3 === 1 ? '4px 12px 12px 12px' : '12px 12px 4px 12px',
                            boxShadow: activeNotes.has(note) ? `0 4px 16px ${colors.warmBrown}80` : `0 2px 6px ${colors.shadow}`,
                            transform: activeNotes.has(note) ? 'scale(1.08)' : 'scale(1)',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: '46px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            fontWeight: '500',
                            opacity: playFromIndex === actualIndex ? 0.7 : 1
                          }}
                        >
                          {NOTES.find(n => n.note === note)?.name}
                        </div>
                      ))}
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
