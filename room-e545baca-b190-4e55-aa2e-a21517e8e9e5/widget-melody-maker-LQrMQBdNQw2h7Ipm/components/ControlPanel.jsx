import React from 'react';

export default function ControlPanel({
  pianoVolume,
  drumVolume,
  setPianoVolume,
  setDrumVolume,
  isPlaying,
  isGenerating,
  isGeneratingDrums,
  isPolishing,
  canPlay,
  canGenerate,
  canGenerateDrums,
  canPolish,
  playFromIndex,
  prePolishBackup,
  aiMelody,
  aiDrums,
  userNoteCount,
  aiNoteCount,
  userSequence,
  musicRNNRef,
  drumRNNRef,
  selectedNotes,
  onPlay,
  onStopPlayback,
  onGenerateMelody,
  onGenerateDrums,
  onPolishMelody,
  onUndoPolish,
  onRegenerateMelody,
  onClearDrums,
  onClearAll,
  onShiftUp,
  onShiftDown,
  onDuplicateSelected,
  onClearSelection,
  colors
}) {
  return (
    <div className="mb-4 p-6" style={{
      background: colors.cardBg,
      borderRadius: '8px 32px 32px 32px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      {/* Volume Controls */}
      <div className="mb-5 flex gap-6 items-center flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div className="text-xs uppercase" style={{ 
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            minWidth: '60px'
          }}>
            Piano
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={pianoVolume}
            onChange={(e) => setPianoVolume(parseFloat(e.target.value))}
            className="flex-1"
            style={{
              accentColor: colors.sage
            }}
          />
          <div className="text-xs" style={{ 
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            minWidth: '30px',
            textAlign: 'right'
          }}>
            {Math.round(pianoVolume * 100)}%
          </div>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div className="text-xs uppercase" style={{ 
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            minWidth: '60px'
          }}>
            Drums
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={drumVolume}
            onChange={(e) => setDrumVolume(parseFloat(e.target.value))}
            className="flex-1"
            style={{
              accentColor: colors.terracotta
            }}
          />
          <div className="text-xs" style={{ 
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            minWidth: '30px',
            textAlign: 'right'
          }}>
            {Math.round(drumVolume * 100)}%
          </div>
        </div>
      </div>

      {/* Transpose and Selection Controls */}
      {(userSequence.length > 0 || aiMelody.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <div className="text-xs uppercase mr-2" style={{ 
            color: colors.text.tertiary,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}>
            Transpose:
          </div>
          <button
            onClick={onShiftUp}
            className="px-4 py-2 transition-all"
            style={{
              background: colors.bgLight,
              color: colors.text.secondary,
              borderRadius: '12px 12px 4px 12px',
              border: `2px solid ${colors.bg}`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
            title={selectedNotes.size > 0 ? "Shift selected notes up" : "Shift entire melody up"}
          >
            ↑ Up
          </button>
          <button
            onClick={onShiftDown}
            className="px-4 py-2 transition-all"
            style={{
              background: colors.bgLight,
              color: colors.text.secondary,
              borderRadius: '12px 4px 12px 12px',
              border: `2px solid ${colors.bg}`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
            title={selectedNotes.size > 0 ? "Shift selected notes down" : "Shift entire melody down"}
          >
            ↓ Down
          </button>
          
          {selectedNotes.size > 0 && (
            <>
              <div className="w-px h-6 mx-2" style={{ background: colors.creamDark }}></div>
              <div className="text-xs" style={{ 
                color: colors.text.tertiary,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {selectedNotes.size} selected
              </div>
              <button
                onClick={onDuplicateSelected}
                className="px-4 py-2 transition-all"
                style={{
                  background: colors.sage,
                  color: colors.white,
                  borderRadius: '12px 12px 4px 12px',
                  border: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  fontSize: '0.85rem',
                  boxShadow: `0 2px 6px ${colors.shadow}`
                }}
              >
                Duplicate
              </button>
              <button
                onClick={onClearSelection}
                className="px-4 py-2 transition-all"
                style={{
                  background: colors.bgLight,
                  color: colors.text.secondary,
                  borderRadius: '12px 4px 12px 12px',
                  border: `2px solid ${colors.bg}`,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  fontSize: '0.85rem'
                }}
              >
                Clear Selection
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-5">
        <button
          onClick={isPlaying ? onStopPlayback : onPlay}
          disabled={!canPlay && !isPlaying}
          className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isPlaying ? colors.terracotta : colors.sage,
            color: colors.white,
            borderRadius: '20px 20px 4px 20px',
            boxShadow: `0 4px 12px ${colors.shadow}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            fontSize: '0.95rem',
            border: 'none'
          }}
        >
          {isPlaying ? 'Stop' : playFromIndex !== null ? 'Play from Note' : 'Play'}
        </button>
        
        <button
          onClick={onGenerateMelody}
          disabled={!canGenerate}
          className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.warmBrown,
            color: colors.white,
            borderRadius: '20px 4px 20px 20px',
            boxShadow: `0 4px 12px ${colors.shadow}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            fontSize: '0.95rem',
            border: 'none'
          }}
        >
          {isGenerating ? 'Generating...' : 'Complete Melody'}
        </button>
        
        <button
          onClick={onGenerateDrums}
          disabled={!canGenerateDrums}
          className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.terracotta,
            color: colors.white,
            borderRadius: '4px 20px 20px 20px',
            boxShadow: `0 4px 12px ${colors.shadow}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            fontSize: '0.95rem',
            border: 'none'
          }}
        >
          {isGeneratingDrums ? 'Generating...' : aiDrums.length > 0 ? 'Regenerate Drums' : 'Add Drums'}
        </button>
        
        <button
          onClick={onPolishMelody}
          disabled={!canPolish}
          className="px-7 py-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.sageLight,
            color: colors.white,
            borderRadius: '20px 20px 20px 4px',
            boxShadow: `0 4px 12px ${colors.shadow}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            fontSize: '0.95rem',
            border: 'none'
          }}
        >
          {isPolishing ? 'Polishing...' : 'Polish with AI'}
        </button>
        
        {prePolishBackup && (
          <button
            onClick={onUndoPolish}
            className="px-6 py-3 transition-all"
            style={{
              background: colors.bgLight,
              color: colors.text.secondary,
              borderRadius: '16px 16px 16px 4px',
              border: `2px solid ${colors.bg}`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              fontSize: '0.9rem'
            }}
          >
            Undo Polish
          </button>
        )}
        
        {aiMelody.length > 0 && (
          <button
            onClick={onRegenerateMelody}
            disabled={isGenerating}
            className="px-6 py-3 transition-all"
            style={{
              background: colors.bgLight,
              color: colors.text.secondary,
              borderRadius: '16px 16px 4px 16px',
              border: `2px solid ${colors.bg}`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              fontSize: '0.9rem'
            }}
          >
            Regenerate
          </button>
        )}
        
        {aiDrums.length > 0 && (
          <button
            onClick={onClearDrums}
            className="px-6 py-3 transition-all"
            style={{
              background: colors.bgLight,
              color: colors.text.secondary,
              borderRadius: '16px 4px 16px 16px',
              border: `2px solid ${colors.bg}`,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '500',
              fontSize: '0.9rem'
            }}
          >
            Clear Drums
          </button>
        )}
        
        <button
          onClick={onClearAll}
          className="px-6 py-3 transition-all"
          style={{
            background: colors.bgLight,
            color: colors.text.secondary,
            borderRadius: '4px 16px 16px 16px',
            border: `2px solid ${colors.bg}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            fontSize: '0.9rem'
          }}
        >
          Clear All
        </button>
      </div>

      {/* Status */}
      <div className="text-sm" style={{ 
        color: colors.text.secondary,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {userSequence.length === 0 && 'Start by pressing piano keys or using your keyboard (A-B keys)'}
        {userSequence.length > 0 && userSequence.length < 4 && `${userSequence.length} notes/chords recorded - need ${4 - userSequence.length} more for AI completion`}
        {userSequence.length >= 4 && aiMelody.length === 0 && 'Ready for AI melody completion!'}
        {aiMelody.length > 0 && !prePolishBackup && !aiDrums.length && 'Melody complete! Try "Polish with AI" for smoother flow, or "Add Drums" for accompaniment'}
        {aiMelody.length > 0 && prePolishBackup && 'Polished version active - click "Undo Polish" to restore original '}
        {aiMelody.length > 0 && aiDrums.length > 0 && `Complete composition: ${userNoteCount} user notes + ${aiNoteCount} AI notes + ${aiDrums.length} drum hits`}
      </div>
      
      {musicRNNRef.current && (
        <div className="mt-3 text-xs" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {'\u{2713}'} Using Magenta MusicRNN{drumRNNRef.current ? ' and DrumRNN' : ''} for generation
        </div>
      )}
    </div>
  );
}
