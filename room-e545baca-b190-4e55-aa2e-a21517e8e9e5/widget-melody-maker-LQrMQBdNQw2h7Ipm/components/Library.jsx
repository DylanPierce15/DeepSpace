import React from 'react';

export default function Library({ 
  savedMelodies, 
  searchQuery,
  setSearchQuery,
  showFavoritesOnly,
  setShowFavoritesOnly,
  favoritesCount,
  onLoad, 
  onDelete,
  onToggleFavorite,
  onFocusSearch,
  onBlurSearch,
  colors 
}) {
  return (
    <div className="p-6" style={{
      background: colors.cardBg,
      borderRadius: '32px 32px 8px 8px',
      boxShadow: `0 6px 24px ${colors.shadow}`
    }}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xs tracking-wide uppercase" style={{ 
          color: colors.text.secondary,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500'
        }}>
          Saved Melodies ({savedMelodies.length})
        </h2>
        
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="px-4 py-2 text-xs"
          style={{
            background: showFavoritesOnly ? colors.terracotta : colors.bgLight,
            color: showFavoritesOnly ? colors.white : colors.text.secondary,
            borderRadius: '12px 12px 4px 12px',
            border: showFavoritesOnly ? 'none' : `2px solid ${colors.bg}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            boxShadow: `0 2px 6px ${colors.shadow}`
          }}
        >
          {showFavoritesOnly ? `Favorites (${favoritesCount})` : `Show Favorites (${favoritesCount})`}
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={onFocusSearch}
          onBlur={onBlurSearch}
          placeholder="Search melodies..."
          className="w-full px-4 py-3"
          style={{
            background: colors.bgLight,
            color: colors.text.primary,
            border: `2px solid ${colors.bg}`,
            borderRadius: '16px 16px 4px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            outline: 'none',
            fontSize: '0.95rem'
          }}
        />
      </div>
      
      {savedMelodies.length === 0 ? (
        <div className="text-center py-16" style={{ 
          color: colors.text.tertiary,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {showFavoritesOnly ? 'No favorite melodies yet. Star some melodies!' : searchQuery ? 'No melodies match your search.' : 'No saved melodies yet. Create and save your first melody!'}
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
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(melody.id);
                    }}
                    className="p-1 transition-all"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.3rem',
                      lineHeight: '1',
                      color: melody.favorite ? colors.terracotta : colors.text.tertiary,
                      filter: melody.favorite ? 'drop-shadow(0 0 4px rgba(176, 90, 60, 0.6))' : 'none'
                    }}
                    title={melody.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {melody.favorite ? '\u{2605}' : '\u{2606}'}
                  </button>
                  <div className="text-sm" style={{
                    color: colors.text.primary,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500'
                  }}>
                    {melody.name}
                  </div>
                </div>
                <div className="text-xs" style={{
                  color: colors.text.tertiary,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {melody.noteCount || 0} notes • {melody.drumCount || 0} drums
                  {melody.createdAt && ` • ${new Date(melody.createdAt).toLocaleDateString()}`}
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
