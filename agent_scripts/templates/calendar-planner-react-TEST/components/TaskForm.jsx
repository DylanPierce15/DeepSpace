import React, { useState, useEffect } from 'react'

export default function TaskForm({
  groups,
  initial,
  onCancel,
  onSave,
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [groupId, setGroupId] = useState(initial?.groupId || (groups[0]?.id || 'general'))
  const [start, setStart] = useState(initial?.start || '')
  const [end, setEnd] = useState(initial?.end || '')
  const [allDay, setAllDay] = useState(!!initial?.allDay)

  // Update form when initial prop changes
  useEffect(() => {
    if (initial) {
      setName(initial.name || '')
      setDescription(initial.description || '')
      setNotes(initial.notes || '')
      setGroupId(initial.groupId || (groups[0]?.id || 'general'))
      setStart(initial.start || '')
      setEnd(initial.end || '')
      setAllDay(!!initial.allDay)
    }
  }, [initial, groups])

  useEffect(() => {
    if (allDay && start) {
      const d = new Date(start)
      const e = new Date(d)
      e.setHours(23, 59)
      setEnd(e.toISOString().slice(0, 16))
    }
  }, [allDay, start])

  const disabled = !name || !groupId || !start || (!allDay && !end)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Task name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g., Focus block"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Start</label>
          <input
            type="datetime-local"
            value={start}
            onChange={e => setStart(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>End</label>
          <input
            type="datetime-local"
            value={end}
            disabled={allDay}
            onChange={e => setEnd(e.target.value)}
            style={{ ...inputStyle, opacity: allDay ? 0.6 : 1 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Group</label>
        <select value={groupId} onChange={e => setGroupId(e.target.value)} style={selectStyle}>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        <label style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>All day</label>
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button
          disabled={disabled}
          onClick={() => onSave({ name, description, notes, groupId, start, end: allDay ? null : end, allDay })}
          style={{ ...btnPrimary, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          Save
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

const selectStyle = {
  padding: '8px 10px',
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
}

const btnSecondary = {
  padding: '8px 14px',
  borderRadius: 8,
  background: '#1f2937',
  border: '1px solid #334155',
  color: '#e2e8f0',
  fontSize: 13,
}

