import React from 'react'

const PREDEFINED_COLORS = [
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#a855f7', name: 'Violet' },
  { hex: '#e11d48', name: 'Rose' },
  { hex: '#0ea5e9', name: 'Sky' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f43f5e', name: 'Red-500' },
]

export default function ColorPicker({ selectedColor, onColorSelect, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>Choose a color:</div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 8,
        padding: 8,
        background: '#0b1220',
        border: '1px solid #1f2937',
        borderRadius: 8
      }}>
        {PREDEFINED_COLORS.map((color) => (
          <button
            key={color.hex}
            onClick={() => onColorSelect(color.hex)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 6px',
              borderRadius: 6,
              background: '#111827',
              border: selectedColor === color.hex ? '2px solid #e2e8f0' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: selectedColor === color.hex ? '0 0 0 1px #0f172a' : 'none'
            }}
            title={`${color.name} (${color.hex})`}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: color.hex,
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            />
            <div style={{ 
              fontSize: 10, 
              color: '#94a3b8',
              textAlign: 'center',
              lineHeight: 1.2
            }}>
              {color.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}