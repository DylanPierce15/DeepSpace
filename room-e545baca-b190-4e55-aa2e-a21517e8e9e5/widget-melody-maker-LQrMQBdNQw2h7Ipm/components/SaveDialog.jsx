import React from 'react';

export default function SaveDialog({ 
  saveName, 
  setSaveName, 
  onSave, 
  onCancel, 
  onSuggestName,
  onFocus,
  onBlur,
  colors 
}) {
  return (
    <div className="mb-4 p-5" style={{
      background: colors.cardBg,
      borderRadius: '24px 24px 8px 24px',
      boxShadow: `0 4px 16px ${colors.shadow}`
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm uppercase" style={{ 
          color: colors.text.secondary,
          letterSpacing: '0.08em',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '500'
        }}>
          Save Melody
        </div>
        <button
          onClick={onSuggestName}
          className="px-3 py-1 text-xs"
          style={{
            background: colors.bgLight,
            color: colors.text.tertiary,
            borderRadius: '8px 8px 2px 8px',
            border: `1px solid ${colors.bg}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}
        >
          Suggest Name
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          placeholder="Enter melody name..."
          className="flex-1 px-4 py-2"
          autoFocus
          style={{
            background: colors.bgLight,
            color: colors.text.primary,
            border: `2px solid ${colors.bg}`,
            borderRadius: '16px 16px 4px 16px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            outline: 'none'
          }}
        />
        <button
          onClick={onSave}
          className="px-5 py-2"
          style={{
            background: colors.sage,
            color: colors.white,
            borderRadius: '12px 4px 12px 12px',
            border: 'none',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500',
            boxShadow: `0 2px 8px ${colors.shadow}`
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2"
          style={{
            background: colors.bgLight,
            color: colors.text.secondary,
            borderRadius: '12px 12px 12px 4px',
            border: `2px solid ${colors.bg}`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '500'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
