import React from 'react';

export default function Library({ savedMelodies, onLoad, onDelete, colors }) {
  return (
    <div className="p-6" style={{
      background: colors.cardBg,
      borderRadius: '32px 32px 8px 8px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      <h2 className="text-xs mb-5 tracking-wide uppercase" style={{ 
        color: colors.text.secondary,
        letterSpacing: '0.08em',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '500'
      }}>
        Saved Melodies ({savedMelodies.length})
      </h2>
      
      {savedMelodies.length === 0 ? (
        <div className="text-center py-16" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          No saved melodies yet. Create and save your first melody!
        </div>
      ) : (
        <div className="space-y-3">
          {savedMelodies.map((melody) => (
            <div
              key={melody.id}
              className="p-4 flex items-center justify-between gap-4"
              style={{
                background: colors.bgLight,
                borderRadius: '16px 16px 4px 16px',
                border: `2px solid ${colors.bg}`
              }}
            >
              <div className="flex-1">
                <div className="text-sm mb-1" style={{
                  color: colors.text.primary,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500'
                }}>
                  {melody.name}
                </div>
                <div className="text-xs" style={{
                  color: colors.text.tertiary,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {melody.noteCount} notes • {melody.drumCount} drums • {new Date(melody.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onLoad(melody.id)}
                  className="px-4 py-2"
                  style={{
                    background: colors.sage,
                    color: colors.white,
                    borderRadius: '10px 10px 2px 10px',
                    border: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500',
                    fontSize: '0.85rem',
                    boxShadow: `0 2px 6px ${colors.shadow}`
                  }}
                >
                  Load
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${melody.name}"?`)) {
                      onDelete(melody.id);
                    }
                  }}
                  className="px-4 py-2"
                  style={{
                    background: colors.terracotta,
                    color: colors.white,
                    borderRadius: '10px 2px 10px 10px',
                    border: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500',
                    fontSize: '0.85rem',
                    boxShadow: `0 2px 6px ${colors.shadow}`
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
