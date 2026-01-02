import React, { useState } from 'react'
import ColorPicker from './ColorPicker'

export default function GroupForm({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || '')
  const [color, setColor] = useState(initial?.color || '#3b82f6')

  const disabled = !name.trim()

  const handleSave = () => {
    if (!disabled) {
      onSave({ name: name.trim(), color })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>
          Group name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Work, Personal, Projects"
          style={inputStyle}
          autoFocus
        />
      </div>

      <ColorPicker
        selectedColor={color}
        onColorSelect={setColor}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSecondary}>
          Cancel
        </button>
        <button
          disabled={disabled}
          onClick={handleSave}
          style={{ 
            ...btnPrimary, 
            opacity: disabled ? 0.6 : 1, 
            cursor: disabled ? 'not-allowed' : 'pointer' 
          }}
        >
          {initial ? 'Update' : 'Create'} Group
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#0b1220',
  color: '#e2e8f0',
  fontSize: 14,
}

const btnPrimary = {
  padding: '8px 14px',
  borderRadius: 8,
  background: '#2563eb',
  border: 'none',
  color: 'white',
  fontSize: 13,
  cursor: 'pointer',
}

const btnSecondary = {
  padding: '8px 14px',
  borderRadius: 8,
  background: '#1f2937',
  border: '1px solid #334155',
  color: '#e2e8f0',
  fontSize: 13,
  cursor: 'pointer',
}