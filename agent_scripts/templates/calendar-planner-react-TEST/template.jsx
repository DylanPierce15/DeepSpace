import React, { useMemo, useState, useEffect } from 'react'
import GroupForm from './components/GroupForm'
import QuickStats from './components/QuickStats'

// Inline helpers to avoid import resolution issues in some canvases
const toISODate = (date) => {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const startOfMonth = (date) => { const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d }
const endOfMonth = (date) => { const d = new Date(date); d.setMonth(d.getMonth()+1); d.setDate(0); d.setHours(23,59,59,999); return d }
const startOfWeek = (date) => { const d = new Date(date); const day=d.getDay(); d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d }
const endOfWeek = (date) => { const s = startOfWeek(date); const d=new Date(s); d.setDate(d.getDate()+6); d.setHours(23,59,59,999); return d }
const startOfDay = (date) => { const d=new Date(date); d.setHours(0,0,0,0); return d }
const endOfDay = (date) => { const d=new Date(date); d.setHours(23,59,59,999); return d }
const minutesBetween = (start, end) => { const s=new Date(start).getTime(); const e=new Date(end).getTime(); if (isNaN(s)||isNaN(e)) return 0; return Math.max(0, Math.round((e-s)/60000)) }

// Google helpers via miyagiAPI
const ensureGoogleCalendarAuth = async () => {
  const result = await window.miyagiAPI.get('/api/integrations/status')
  const status = result.data || result
  if (status?.google?.calendar) return { ok: true }
  const authResult = await window.miyagiAPI.get('/api/integrations/google-auth-url?service=calendar')
  const auth = authResult.data || authResult
  return { ok: false, requiresOAuth: true, authUrl: auth?.authUrl }
}
const listGoogleEvents = async (params) => {
  const result = await window.miyagiAPI.get('google-calendar-events', params)
  const payload = result.data || result
  return payload.requiresOAuth ? payload : { events: payload.events }
}
const createGoogleEvents = async (payload) => {
  const result = await window.miyagiAPI.post('/api/integrations/google-calendar-create-events', payload)
  const data = result.data || result
  return data.requiresOAuth ? data : { created: data.created }
}
const deleteGoogleEvent = (eventId) => window.miyagiAPI.post('/api/integrations/google-calendar-delete-event', { eventId })

// Inline components
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function DayView({ selectedDate, tasks, groups, onAddTask, onEditTask, onDeleteTask, onToggleComplete, onClose }) {
  const date = new Date(selectedDate)
  const dayName = dayNames[date.getDay()]
  const monthName = date.toLocaleString(undefined, { month: 'long' })
  const dayNumber = date.getDate()
  
  // Generate hourly slots from 6 AM to 11 PM
  const hours = Array.from({ length: 18 }, (_, i) => i + 6)
  
  // Group tasks by hour
  const tasksByHour = {}
  tasks.forEach(task => {
    if (task.start) {
      const taskDate = new Date(task.start)
      const hour = taskDate.getHours()
      if (!tasksByHour[hour]) tasksByHour[hour] = []
      tasksByHour[hour].push(task)
    }
  })
  
  const formatTime = (hour) => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }
  
  const getTaskPosition = (task) => {
    if (!task.start) return { top: 0, height: 60 }
    const start = new Date(task.start)
    const end = task.end ? new Date(task.end) : new Date(start.getTime() + 60 * 60 * 1000) // Default 1 hour
    
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    
    const top = ((startMinutes - 360) / 60) * 60 // 6 AM = 360 minutes
    const height = Math.max(30, ((endMinutes - startMinutes) / 60) * 60)
    
    return { top: Math.max(0, top), height: Math.max(30, height) }
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a' }}>
      {/* Day Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #1f2937',
        background: '#111827'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={onClose} 
            style={{ 
              padding: '8px 12px', 
              background: '#1f2937', 
              border: '1px solid #334155', 
              borderRadius: 8, 
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            ← Back to Calendar
          </button>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>
              {dayName}, {monthName} {dayNumber}
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} scheduled
            </div>
          </div>
        </div>
      </div>
      
      {/* Time Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Time Labels */}
        <div style={{ 
          width: 80, 
          background: '#111827', 
          borderRight: '1px solid #1f2937',
          padding: '8px 0'
        }}>
          {hours.map(hour => (
            <div key={hour} style={{ 
              height: 60, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 12,
              color: '#94a3b8',
              borderBottom: '1px solid #1f2937'
            }}>
              {formatTime(hour)}
            </div>
          ))}
        </div>
        
        {/* Task Area */}
        <div style={{ flex: 1, position: 'relative', background: '#0f172a' }}>
          {/* Hour Lines */}
          {hours.map(hour => (
            <div key={hour} style={{
              position: 'absolute',
              top: (hour - 6) * 60,
              left: 0,
              right: 0,
              height: 1,
              background: hour % 2 === 0 ? '#1f2937' : '#0f172a',
              zIndex: 1
            }} />
          ))}
          
          {/* Current Time Indicator */}
          {(() => {
            const now = new Date()
            const isToday = now.toDateString() === new Date(selectedDate).toDateString()
            if (!isToday) return null
            
            const currentHour = now.getHours()
            const currentMinute = now.getMinutes()
            const currentPosition = ((currentHour - 6) * 60) + (currentMinute)
            
            if (currentPosition < 0 || currentPosition > 1080) return null // Outside 6 AM - 11 PM range
            
            return (
              <div style={{
                position: 'absolute',
                top: currentPosition,
                left: 0,
                right: 0,
                height: 2,
                background: '#ef4444',
                zIndex: 20,
                boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
              }}>
                <div style={{
                  position: 'absolute',
                  left: -8,
                  top: -6,
                  width: 8,
                  height: 8,
                  background: '#ef4444',
                  borderRadius: '50%',
                  boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
                }} />
              </div>
            )
          })()}
          
          {/* Tasks */}
          {tasks.map(task => {
            const group = groups.find(g => g.id === task.groupId)
            const position = getTaskPosition(task)
            const isAllDay = task.allDay
            
            if (isAllDay) {
              return (
                <div key={task.id} style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 40,
                  background: group?.color || '#3b82f6',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  zIndex: 10,
                  cursor: 'pointer'
                }}
                onClick={() => onEditTask(task)}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />
                  <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{task.name}</div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>All Day</div>
                </div>
              )
            }
            
            return (
              <div
                key={task.id}
                style={{
                  position: 'absolute',
                  top: position.top,
                  left: 8,
                  right: 8,
                  height: position.height,
                  background: group?.color || '#3b82f6',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  zIndex: 10,
                  cursor: 'pointer',
                  minHeight: 30
                }}
                onClick={() => onEditTask(task)}
              >
                <div style={{ 
                  color: 'white', 
                  fontSize: 12, 
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {task.name}
                </div>
                {task.start && (
                  <div style={{ 
                    color: 'rgba(255,255,255,0.8)', 
                    fontSize: 10,
                    marginTop: 2
                  }}>
                    {new Date(task.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {task.end && ` - ${new Date(task.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Click Areas for Adding Tasks */}
          {hours.map(hour => (
            <div
              key={`click-${hour}`}
              style={{
                position: 'absolute',
                top: (hour - 6) * 60,
                left: 0,
                right: 0,
                height: 60,
                cursor: 'pointer',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                transition: 'all 0.2s ease'
              }}
              onClick={() => onAddTask(selectedDate, hour)}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(59, 130, 246, 0.1)'
                e.target.style.borderLeft = '3px solid #3b82f6'
                const hint = e.target.querySelector('.add-task-hint')
                if (hint) hint.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent'
                e.target.style.borderLeft = '3px solid transparent'
                const hint = e.target.querySelector('.add-task-hint')
                if (hint) hint.style.opacity = '0'
              }}
            >
              <div style={{
                opacity: 0,
                fontSize: 12,
                color: '#94a3b8',
                transition: 'opacity 0.2s ease'
              }} className="add-task-hint">
                Click to add task at {formatTime(hour)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function CalendarGrid({ viewDate, eventsByDate, selectedDate, onSelectDate, onAddTask, onOpenDayView }) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const daysInMonth = last.getDate()
  const startOffset = first.getDay()
  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d)
    const key = toISODate(dateObj)
    cells.push({ day: d, key, events: eventsByDate[key] || [] })
  }
  const todayKey = toISODate(new Date())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {dayNames.map((n) => (
          <div key={n} style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>{n}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />
          const isToday = cell.key === todayKey
          const isSelected = selectedDate === cell.key
          return (
            <div 
              key={cell.key} 
              onClick={() => {
                onSelectDate(cell.key)
                if (onOpenDayView) {
                  onOpenDayView(cell.key)
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (onAddTask) {
                  onAddTask(cell.key)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (onAddTask) {
                  onAddTask(cell.key)
                }
              }}
              style={{
                minHeight: 72,
                background: isSelected ? '#1d4ed8' : '#0b1220',
                border: isToday ? '1px solid #334155' : '1px solid #0b1220',
                borderRadius: 8,
                padding: 8,
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 6,
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.background = '#1e293b'
                  e.target.style.borderColor = '#475569'
                  const hint = e.target.querySelector('.add-task-hint')
                  if (hint) hint.style.opacity = '1'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.background = isToday ? '#0b1220' : '#0b1220'
                  e.target.style.borderColor = isToday ? '#334155' : '#0b1220'
                  const hint = e.target.querySelector('.add-task-hint')
                  if (hint) hint.style.opacity = '0.7'
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>{cell.day}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isToday && <div style={{ fontSize: 10, color: '#93c5fd' }}>today</div>}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onAddTask) {
                        onAddTask(cell.key)
                      }
                    }}
                    style={{ 
                      fontSize: 10, 
                      color: '#64748b', 
                      opacity: 0.7,
                      transition: 'opacity 0.2s ease',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 4,
                      background: 'rgba(100, 116, 139, 0.1)',
                      border: 'none',
                      outline: 'none'
                    }}
                    className="add-task-hint"
                    title="Click to add task"
                  >
                    +
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cell.events.slice(0, 3).map((evt) => (
                  <div key={evt.id} title={evt.title} style={{ fontSize: 11, background: evt.color || 'rgba(59,130,246,0.25)', border: '1px solid rgba(59,130,246,0.35)', color: '#e2e8f0', padding: '2px 6px', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.title}</div>
                ))}
                {cell.events.length > 3 && <div style={{ fontSize: 10, color: '#94a3b8' }}>+{cell.events.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskForm({ groups, initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [groupId, setGroupId] = useState(initial?.groupId || (groups[0]?.id || 'general'))
  const [start, setStart] = useState(initial?.start || '')
  const [end, setEnd] = useState(initial?.end || '')
  const [allDay, setAllDay] = useState(!!initial?.allDay)
  useEffect(() => { if (allDay && start) { const d=new Date(start); const e=new Date(d); e.setHours(23,59); setEnd(e.toISOString().slice(0,16)) } }, [allDay, start])
  const disabled = !name || !groupId || !start || (!allDay && !end)
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', fontSize: 14 }
  const selectStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', fontSize: 14 }
  const btnPrimaryLocal = { padding: '8px 14px', borderRadius: 8, background: '#2563eb', border: 'none', color: 'white', fontSize: 13 }
  const btnSecondaryLocal = { padding: '8px 14px', borderRadius: 8, background: '#1f2937', border: '1px solid #334155', color: '#e2e8f0', fontSize: 13 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Task name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Focus block" style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Date</label>
          <input type="date" value={start ? start.split('T')[0] : ''} onChange={e => {
            const newDate = e.target.value
            if (newDate && start) {
              const timePart = start.split('T')[1] || '09:00'
              setStart(`${newDate}T${timePart}`)
            } else if (newDate) {
              setStart(`${newDate}T09:00`)
            } else {
              setStart('')
            }
          }} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Start Time</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <select value={start ? start.split('T')[1]?.split(':')[0] || '09' : '09'} onChange={e => {
              const hour = e.target.value
              const minute = start ? start.split('T')[1]?.split(':')[1] || '00' : '00'
              const date = start ? start.split('T')[0] : new Date().toISOString().split('T')[0]
              setStart(`${date}T${hour.padStart(2, '0')}:${minute}`)
            }} style={selectStyle}>
              {Array.from({length: 24}, (_, i) => (
                <option key={i} value={i.toString().padStart(2, '0')}>
                  {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`}
                </option>
              ))}
            </select>
            <select value={start ? start.split('T')[1]?.split(':')[1] || '00' : '00'} onChange={e => {
              const minute = e.target.value
              const hour = start ? start.split('T')[1]?.split(':')[0] || '09' : '09'
              const date = start ? start.split('T')[0] : new Date().toISOString().split('T')[0]
              setStart(`${date}T${hour}:${minute}`)
            }} style={selectStyle}>
              {Array.from({length: 12}, (_, i) => (
                <option key={i} value={(i * 5).toString().padStart(2, '0')}>
                  {(i * 5).toString().padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {!allDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>End Time</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={end ? end.split('T')[1]?.split(':')[0] || '10' : '10'} onChange={e => {
                const hour = e.target.value
                const minute = end ? end.split('T')[1]?.split(':')[1] || '00' : '00'
                const date = end ? end.split('T')[0] : (start ? start.split('T')[0] : new Date().toISOString().split('T')[0])
                setEnd(`${date}T${hour.padStart(2, '0')}:${minute}`)
              }} style={selectStyle}>
                {Array.from({length: 24}, (_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`}
                  </option>
                ))}
              </select>
              <select value={end ? end.split('T')[1]?.split(':')[1] || '00' : '00'} onChange={e => {
                const minute = e.target.value
                const hour = end ? end.split('T')[1]?.split(':')[0] || '10' : '10'
                const date = end ? end.split('T')[0] : (start ? start.split('T')[0] : new Date().toISOString().split('T')[0])
                setEnd(`${date}T${hour}:${minute}`)
              }} style={selectStyle}>
                {Array.from({length: 12}, (_, i) => (
                  <option key={i} value={(i * 5).toString().padStart(2, '0')}>
                    {(i * 5).toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Duration</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select onChange={e => {
                if (start) {
                  const duration = parseInt(e.target.value)
                  const startTime = new Date(start)
                  const endTime = new Date(startTime.getTime() + duration * 60000)
                  setEnd(endTime.toISOString().slice(0, 16))
                }
              }} style={selectStyle}>
                <option value="">Quick duration</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
              </select>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Group</label>
        <select value={groupId} onChange={e => setGroupId(e.target.value)} style={selectStyle}>
          {groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
        </select>
        <label style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>All day</label>
        <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSecondaryLocal}>Cancel</button>
        <button disabled={disabled} onClick={() => onSave({ name, description, notes, groupId, start, end: allDay ? null : end, allDay })} style={{ ...btnPrimaryLocal, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>Save</button>
      </div>
    </div>
  )
}

function StatsPanel({ tasks, groups }) {
  const [range, setRange] = useState('week')
  const now = new Date()
  const rangeStart = range === 'day' ? startOfDay(now) : range === 'week' ? startOfWeek(now) : startOfMonth(now)
  const rangeEnd = range === 'day' ? endOfDay(now) : range === 'week' ? endOfWeek(now) : endOfMonth(now)
  const perGroup = useMemo(() => {
    const acc = {}; for (const g of groups) acc[g.id] = { minutes: 0, name: g.name, color: g.color }
    for (const t of tasks) { if (!t.start || !t.end) continue; const st=new Date(t.start); const en=new Date(t.end); if (en < rangeStart || st > rangeEnd) continue; const mins=minutesBetween(st,en); if (!acc[t.groupId]) acc[t.groupId] = { minutes: 0, name: 'Other', color: '#64748b' }; acc[t.groupId].minutes += mins }
    return acc
  }, [tasks, groups, range])
  const total = Object.values(perGroup).reduce((s, v) => s + v.minutes, 0)
  const fmtH = (m) => `${Math.floor(m / 60)}h ${m % 60}m`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['day','week','month'].map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #334155', background: range === r ? '#334155' : '#111827', color: '#e2e8f0', cursor: 'pointer' }}>{r.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>Total time: {fmtH(total)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(perGroup).map(([id, v]) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: v.color }} />
            <div style={{ width: 120, fontSize: 13, color: '#e2e8f0' }}>{v.name}</div>
            <div style={{ flex: 1, height: 8, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6 }}>
              <div style={{ width: total ? `${Math.min(100, Math.round((v.minutes / total) * 100))}%` : '0%', height: '100%', background: v.color, borderRadius: 6 }} />
            </div>
            <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>{fmtH(v.minutes)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const DEFAULT_GROUPS = [
  { id: 'general', name: 'General', color: '#3b82f6' },
  { id: 'deep', name: 'Deep Work', color: '#8b5cf6' },
  { id: 'meet', name: 'Meetings', color: '#ef4444' },
]

function CalendarPlannerWidget() {
  const miyagiAPI = window.miyagiAPI
  const useGlobal = window.useGlobalStorage || (() => [null, () => {}])

  // Global storage (shared across canvas)
  const [taskData, setTaskData] = useGlobal('tasks', { groups: DEFAULT_GROUPS, tasks: [] })
  const [lastGoogleSync, setLastGoogleSync] = useGlobal('calendar.google.lastSync', null)

  // UI state
  const [activeTab, setActiveTab] = useState('calendar') // calendar | tasks | stats | integration
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [showDayView, setShowDayView] = useState(false)

  // Ensure groups array exists
  useEffect(() => {
    if (!Array.isArray(taskData.groups) || taskData.groups.length === 0) {
      setTaskData({ ...taskData, groups: DEFAULT_GROUPS })
    }
  }, [])

  const eventsByDate = useMemo(() => {
    const map = {}
    for (const t of taskData.tasks || []) {
      let key
      if (t.start) key = toISODate(t.start)
      else if (t.dueDate) key = toISODate(t.dueDate)
      else continue
      if (!map[key]) map[key] = []
      const grp = (taskData.groups || []).find(g => g.id === t.groupId)
      map[key].push({
        id: String(t.id),
        title: t.name,
        color: grp?.color || 'rgba(59,130,246,0.25)'
      })
    }
    return map
  }, [taskData])

  const tasksForSelectedDate = useMemo(() => {
    return (taskData.tasks || []).filter(t => {
      const k = t.start ? toISODate(t.start) : (t.dueDate ? toISODate(t.dueDate) : null)
      return k === selectedDate
    }).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
  }, [taskData, selectedDate])

  const addTask = (dateKey = null, hour = null) => {
    setEditingTask(null)
    setShowForm(true)
    if (dateKey) {
      setSelectedDate(dateKey)
    }
    // If hour is provided, pre-fill the start time
    if (hour !== null && dateKey) {
      const startTime = `${dateKey}T${hour.toString().padStart(2, '0')}:00`
      const endTime = `${dateKey}T${(hour + 1).toString().padStart(2, '0')}:00`
      // Set as initial data for new task, not as editingTask
      const preFilledData = {
        start: startTime,
        end: endTime,
        allDay: false,
        isNew: true // Flag to indicate this is a new task with pre-filled data
      }
      setEditingTask(preFilledData)
    }
  }

  const openDayView = (dateKey) => {
    setSelectedDate(dateKey)
    setShowDayView(true)
  }

  const closeDayView = () => {
    setShowDayView(false)
  }

  const saveTask = (payload) => {
    if (editingTask && editingTask.id && !editingTask.isNew) {
      // Editing existing task
      const updated = { ...editingTask, ...payload }
      setTaskData({
        ...taskData,
        tasks: (taskData.tasks || []).map(t => t.id === editingTask.id ? updated : t)
      })
    } else {
      // Creating new task (either from scratch or with pre-filled data)
      const newTask = {
        id: Date.now(),
        name: payload.name,
        description: payload.description || '',
        notes: payload.notes || '',
        groupId: payload.groupId,
        start: payload.start,
        end: payload.end,
        allDay: !!payload.allDay,
        completed: false,
        createdAt: new Date().toISOString(),
      }
      setTaskData({ ...taskData, tasks: [...(taskData.tasks || []), newTask] })
    }
    setShowForm(false)
    setEditingTask(null)
  }

  const deleteTask = (id) => {
    if (!confirm('Delete this task?')) return
    setTaskData({ ...taskData, tasks: (taskData.tasks || []).filter(t => t.id !== id) })
  }

  const toggleComplete = (id) => {
    setTaskData({
      ...taskData,
      tasks: (taskData.tasks || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    })
  }

  const addGroup = () => {
    setEditingGroup(null)
    setShowGroupForm(true)
  }

  const renameGroup = (id) => {
    const g = (taskData.groups || []).find(x => x.id === id)
    if (!g) return
    setEditingGroup(g)
    setShowGroupForm(true)
  }

  const saveGroup = (payload) => {
    if (editingGroup) {
      // Update existing group
      setTaskData({
        ...taskData,
        groups: (taskData.groups || []).map(x => 
          x.id === editingGroup.id ? { ...x, name: payload.name, color: payload.color } : x
        )
      })
    } else {
      // Create new group
      const g = { id: `g-${Date.now()}`, name: payload.name, color: payload.color }
      setTaskData({ ...taskData, groups: [...(taskData.groups || []), g] })
    }
    setShowGroupForm(false)
    setEditingGroup(null)
  }

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // Google: import month
  const importFromGoogle = async () => {
    setLoading(true)
    setStatusMsg('Checking Google integration...')
    try {
      const auth = await ensureGoogleCalendarAuth()
      if (auth.requiresOAuth) {
        setStatusMsg('Please connect Google Calendar in the Integrations tab.')
        alert('Google Calendar connection required. Open Integrations tab to connect.')
        return
      }

      const timeMin = startOfMonth(viewDate).toISOString()
      const timeMax = endOfMonth(viewDate).toISOString()
      setStatusMsg('Fetching events...')
      const resp = await listGoogleEvents({ timeMin, timeMax })

      if (resp?.requiresOAuth) {
        setStatusMsg('Google auth required')
        alert('Google Calendar connection required. Open Integrations tab to connect.')
        return
      }

      const events = (resp?.events || [])
      if (!events.length) {
        setStatusMsg('No events found in this range')
        return
      }

      // Merge into tasks under "Imported" group
      let importedGroup = (taskData.groups || []).find(g => g.id === 'imported')
      if (!importedGroup) {
        importedGroup = { id: 'imported', name: 'Imported', color: '#64748b' }
      }
      const groupList = [...(taskData.groups || []), ...(importedGroup ? (taskData.groups || []).some(g => g.id === 'imported') ? [] : [importedGroup] : [])]

      const mapped = events.map(ev => ({
        id: `gcal-${ev.id}-${Date.now()}`,
        name: ev.summary || 'Untitled event',
        description: ev.description || '',
        groupId: importedGroup.id,
        start: ev.start?.dateTime || ev.start?.date || null,
        end: ev.end?.dateTime || ev.end?.date || null,
        allDay: !!ev.start?.date,
        completed: false,
        googleEventId: ev.id,
        googleHtmlLink: ev.htmlLink || null,
        createdAt: new Date().toISOString(),
      }))

      const existing = taskData.tasks || []
      
      // Get all Google Event IDs from the imported events
      const importedGoogleIds = new Set(events.map(ev => ev.id))
      
      // Find tasks that were imported from Google but are no longer in Google Calendar
      const tasksToRemove = existing.filter(t => 
        t.googleEventId && !importedGoogleIds.has(t.googleEventId)
      )
      
      // Enhanced dedupe by multiple criteria
      const existingKeys = new Set()
      const existingGoogleIds = new Set()
      
      // Build sets of existing identifiers
      for (const t of existing) {
        if (t.start) {
          existingKeys.add(`${t.name}|${t.start}`)
        }
        if (t.googleEventId) {
          existingGoogleIds.add(t.googleEventId)
        }
      }
      
      // Filter out duplicates based on multiple criteria
      const toAdd = mapped.filter(t => {
        if (!t.start) return false
        
        // Check by Google Event ID first (most reliable)
        if (existingGoogleIds.has(t.googleEventId)) {
          return false
        }
        
        // Check by name + start time
        if (existingKeys.has(`${t.name}|${t.start}`)) {
          return false
        }
        
        // Additional fuzzy matching for similar events
        const startTime = new Date(t.start).getTime()
        const similarEvent = existing.find(existingTask => {
          if (!existingTask.start) return false
          const existingStartTime = new Date(existingTask.start).getTime()
          const timeDiff = Math.abs(startTime - existingStartTime)
          const isSimilarTime = timeDiff < 5 * 60 * 1000 // Within 5 minutes
          const isSimilarName = existingTask.name.toLowerCase().trim() === t.name.toLowerCase().trim()
          return isSimilarTime && isSimilarName
        })
        
        return !similarEvent
      })

      // Remove tasks that were deleted from Google Calendar
      const remainingTasks = existing.filter(t => !tasksToRemove.includes(t))
      
      setTaskData({ ...taskData, groups: groupList, tasks: [...remainingTasks, ...toAdd] })
      setLastGoogleSync(new Date().toISOString())
      const duplicateCount = mapped.length - toAdd.length
      const removedCount = tasksToRemove.length
      let statusMessage = `Imported ${toAdd.length} new events`
      if (duplicateCount > 0) statusMessage += ` (${duplicateCount} duplicates skipped)`
      if (removedCount > 0) statusMessage += `, removed ${removedCount} deleted events`
      setStatusMsg(statusMessage)
    } catch (e) {
      console.error(e)
      setStatusMsg(e?.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  // Google: export current month tasks with start/end
  const exportToGoogle = async () => {
    setLoading(true)
    setStatusMsg('Checking Google integration...')
    try {
      const auth = await ensureGoogleCalendarAuth()
      if (auth.requiresOAuth) {
        setStatusMsg('Please connect Google Calendar in the Integrations tab.')
        alert('Google Calendar connection required. Open Integrations tab to connect.')
        return
      }

      const start = startOfMonth(viewDate)
      const end = endOfMonth(viewDate)
      const monthTasks = (taskData.tasks || []).filter(t => t.start && t.end).filter(t => {
        const st = new Date(t.start)
        return st >= start && st <= end
      })
      if (monthTasks.length === 0) {
        setStatusMsg('No schedulable tasks this month')
        return
      }

      // Check for existing Google events to avoid duplicates and handle deletions
      setStatusMsg('Checking for existing events...')
      const existingEvents = await listGoogleEvents({ timeMin: start.toISOString(), timeMax: end.toISOString() })
      const existingEventMap = new Map()
      const existingGoogleIds = new Set()
      
      if (existingEvents?.events) {
        for (const event of existingEvents.events) {
          existingGoogleIds.add(event.id)
          // Create multiple keys for better matching
          const eventTitle = event.summary || 'Untitled event'
          const eventStart = event.start?.dateTime || event.start?.date
          if (eventStart) {
            // Key by title + start time
            const key1 = `${eventTitle}|${eventStart}`
            existingEventMap.set(key1, event)
            
            // Also key by normalized title + start time for fuzzy matching
            const normalizedTitle = eventTitle.toLowerCase().trim()
            const key2 = `${normalizedTitle}|${eventStart}`
            existingEventMap.set(key2, event)
          }
        }
      }

      // Find tasks that were exported to Google but are no longer in our calendar
      const tasksToDeleteFromGoogle = monthTasks.filter(t => 
        t.googleEventId && !existingGoogleIds.has(t.googleEventId)
      )

      // Delete events from Google Calendar that were removed from our calendar
      let deletedCount = 0
      if (tasksToDeleteFromGoogle.length > 0) {
        setStatusMsg(`Deleting ${tasksToDeleteFromGoogle.length} events from Google Calendar...`)
        for (const task of tasksToDeleteFromGoogle) {
          try {
            await deleteGoogleEvent(task.googleEventId)
            // Remove googleEventId from task
            task.googleEventId = null
            task.googleHtmlLink = null
            deletedCount++
          } catch (e) {
            console.error(`Failed to delete event ${task.googleEventId}:`, e)
          }
        }
      }

      // Filter out tasks that already exist in Google Calendar
      const tasksToExport = monthTasks.filter(t => {
        // Skip if already has googleEventId (already exported)
        if (t.googleEventId) {
          return false
        }
        
        const taskTitle = t.name
        const taskStart = t.start
        
        // Check exact match
        const exactKey = `${taskTitle}|${taskStart}`
        if (existingEventMap.has(exactKey)) {
          return false
        }
        
        // Check normalized match
        const normalizedTitle = taskTitle.toLowerCase().trim()
        const normalizedKey = `${normalizedTitle}|${taskStart}`
        if (existingEventMap.has(normalizedKey)) {
          return false
        }
        
        // Additional fuzzy matching for similar events
        const taskStartTime = new Date(taskStart).getTime()
        const hasSimilarEvent = Array.from(existingEventMap.values()).some(event => {
          const eventStart = event.start?.dateTime || event.start?.date
          if (!eventStart) return false
          
          const eventStartTime = new Date(eventStart).getTime()
          const timeDiff = Math.abs(taskStartTime - eventStartTime)
          const isSimilarTime = timeDiff < 5 * 60 * 1000 // Within 5 minutes
          const isSimilarName = (event.summary || '').toLowerCase().trim() === normalizedTitle
          return isSimilarTime && isSimilarName
        })
        
        return !hasSimilarEvent
      })

      if (tasksToExport.length === 0) {
        setStatusMsg('All tasks already exist in Google Calendar')
        return
      }

      setStatusMsg(`Creating ${tasksToExport.length} new Google events...`)
      const payload = {
        events: tasksToExport.map(t => ({
          title: t.name,
          description: t.description || '',
          start: t.start,
          end: t.end,
          allDay: !!t.allDay,
          groupId: t.groupId,
        }))
      }
      const resp = await createGoogleEvents(payload)
      if (resp?.requiresOAuth) {
        setStatusMsg('Google auth required')
        alert('Google Calendar connection required. Open Integrations tab to connect.')
        return
      }
      const created = resp?.created || []
      // Link back to tasks (best-effort by title+start)
      const taskMap = new Map((taskData.tasks || []).map(t => [`${t.name}|${t.start}`, t]))
      for (const c of created) {
        const key = `${c.summary || c.title}|${c.start}`
        const task = taskMap.get(key)
        if (task) {
          task.googleEventId = c.id
          task.googleHtmlLink = c.htmlLink || null
        }
      }
      setTaskData({ ...taskData, tasks: [...(taskData.tasks || [])] })
      setLastGoogleSync(new Date().toISOString())
      let statusMessage = `Exported ${created.length} new events`
      if (monthTasks.length - tasksToExport.length > 0) {
        statusMessage += ` (${monthTasks.length - tasksToExport.length} already existed)`
      }
      if (deletedCount > 0) {
        statusMessage += `, deleted ${deletedCount} events from Google Calendar`
      }
      setStatusMsg(statusMessage)
    } catch (e) {
      console.error(e)
      setStatusMsg(e?.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  // Render
  const monthName = viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })

  // Show day view if active
  if (showDayView) {
    return (
      <div style={container}>
        <DayView
          selectedDate={selectedDate}
          tasks={tasksForSelectedDate}
          groups={taskData.groups || []}
          onAddTask={addTask}
          onEditTask={(task) => { setEditingTask(task); setShowForm(true) }}
          onDeleteTask={deleteTask}
          onToggleComplete={toggleComplete}
          onClose={closeDayView}
        />
        
        {showForm && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{ 
              background: '#0f172a', 
              border: '1px solid #1f2937', 
              borderRadius: 12, 
              padding: 20, 
              maxWidth: 500, 
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
                  {editingTask ? 'Edit Task' : 'Add Task'}
                </div>
                <button 
                  onClick={() => { setShowForm(false); setEditingTask(null) }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#94a3b8', 
                    fontSize: 20, 
                    cursor: 'pointer' 
                  }}
                >
                  ×
                </button>
              </div>
              <TaskForm
                groups={taskData.groups || []}
                initial={editingTask || { 
                  start: `${selectedDate}T09:00`, 
                  end: `${selectedDate}T10:00`,
                  allDay: false
                }}
                onCancel={() => { setShowForm(false); setEditingTask(null) }}
                onSave={saveTask}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={container}>
      <div style={header}>
        <div>
          <div style={title}>📆 Calendar Planner</div>
          <div style={subtitle}>Plan, sync, and analyze your time</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabBtn(activeTab === 'calendar')} onClick={() => setActiveTab('calendar')}>Calendar</button>
          <button style={tabBtn(activeTab === 'tasks')} onClick={() => setActiveTab('tasks')}>Tasks</button>
          <button style={tabBtn(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>Stats</button>
          <button style={tabBtn(activeTab === 'integration')} onClick={() => setActiveTab('integration')}>Integrations</button>
        </div>
      </div>

      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={prevMonth} style={navBtn}>‹</button>
              <div style={{ fontSize: 16, color: '#e2e8f0' }}>{monthName}</div>
              <button onClick={nextMonth} style={navBtn}>›</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={importFromGoogle} disabled={loading} style={btnSecondary}>Import from Google</button>
              <button onClick={exportToGoogle} disabled={loading} style={btnPrimary}>Export to Google</button>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontStyle: 'italic' }}>
            💡 Click any day to open the detailed day view, or click the "+" button to quickly add a task
          </div>
          
          <CalendarGrid
            viewDate={viewDate}
            eventsByDate={eventsByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onAddTask={addTask}
            onOpenDayView={openDayView}
          />

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>Tasks on {selectedDate}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => addTask()} style={btnPrimary}>+ Add Task</button>
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
              {tasksForSelectedDate.length === 0 ? (
                <div style={{ fontSize: 13, color: '#64748b' }}>No tasks on this date</div>
              ) : tasksForSelectedDate.map(t => {
                const g = (taskData.groups || []).find(x => x.id === t.groupId)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px' }}>
                    <input type="checkbox" checked={!!t.completed} onChange={() => toggleComplete(t.id)} />
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: g?.color || '#64748b' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#e2e8f0', textDecoration: t.completed ? 'line-through' : 'none' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.start ? new Date(t.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time'}{t.end ? ` → ${new Date(t.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                      {t.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>📝 {t.notes}</div>}
                    </div>
                    {t.googleHtmlLink && (
                      <a href={t.googleHtmlLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#93c5fd' }}>Open</a>
                    )}
                    <button onClick={() => { setEditingTask(t); setShowForm(true) }} style={chipBtn}>Edit</button>
                    <button onClick={() => deleteTask(t.id)} style={chipDanger}>Delete</button>
                  </div>
                )
              })}
            </div>
          </div>

          {showForm && (
            <div style={{ marginTop: 8, padding: 12, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8 }}>
              <TaskForm
                groups={taskData.groups || []}
                initial={editingTask || { 
                  start: `${selectedDate}T09:00`, 
                  end: `${selectedDate}T10:00`,
                  allDay: false
                }}
                onCancel={() => { setShowForm(false); setEditingTask(null) }}
                onSave={saveTask}
              />
            </div>
          )}

          {statusMsg && <div style={{ fontSize: 12, color: '#94a3b8' }}>{loading ? '⏳ ' : ''}{statusMsg}</div>}
          
          <QuickStats tasks={taskData.tasks || []} groups={taskData.groups || []} />
        </div>
      )}

      {activeTab === 'tasks' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, color: '#94a3b8' }}>Groups</div>
              <button onClick={addGroup} style={btnPrimary}>+ Add Group</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(taskData.groups || []).map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: g.color }} />
                  <div style={{ fontSize: 14, color: '#e2e8f0' }}>{g.name}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => renameGroup(g.id)} style={chipBtn}>Edit</button>
                </div>
              ))}
            </div>
            
            {showGroupForm && (
              <div style={{ marginTop: 12, padding: 12, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8 }}>
                <GroupForm
                  initial={editingGroup}
                  onCancel={() => { setShowGroupForm(false); setEditingGroup(null) }}
                  onSave={saveGroup}
                />
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8 }}>All Tasks</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
              {(taskData.tasks || []).map(t => {
                const g = (taskData.groups || []).find(x => x.id === t.groupId)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: g?.color || '#64748b' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#e2e8f0' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.start ? new Date(t.start).toLocaleString() : 'No time'}</div>
                      {t.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>📝 {t.notes}</div>}
                    </div>
                    <button onClick={() => { setEditingTask(t); setShowForm(true); setActiveTab('calendar'); setSelectedDate(toISODate(t.start || new Date())) }} style={chipBtn}>Edit</button>
                    <button onClick={() => deleteTask(t.id)} style={chipDanger}>Delete</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div>
          <StatsPanel tasks={taskData.tasks || []} groups={taskData.groups || []} />
        </div>
      )}

      {activeTab === 'integration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 14, color: '#e2e8f0' }}>Google Calendar</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Import events into this calendar and export scheduled tasks to your Google Calendar. Your connection is used only from this canvas via server-side OAuth.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ConnectGoogleCalendar />
          </div>
          {lastGoogleSync && (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Last sync: {new Date(lastGoogleSync).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  )
}

function ConnectGoogleCalendar() {
  const [status, setStatus] = useState('checking')
  const [authUrl, setAuthUrl] = useState('')

  const check = async () => {
    setStatus('checking')
    try {
      const res = await ensureGoogleCalendarAuth()
      if (res.ok) setStatus('connected')
      else if (res.requiresOAuth) { setAuthUrl(res.authUrl || ''); setStatus('disconnected') }
      else setStatus('error')
    } catch { setStatus('error') }
  }

  useEffect(() => { check() }, [])

  if (status === 'checking') return <div style={{ fontSize: 13, color: '#94a3b8' }}>Checking status…</div>
  if (status === 'connected') return <div style={{ fontSize: 13, color: '#22c55e' }}>Connected ✅</div>
  if (status === 'disconnected') return (
    <a href={authUrl} target="_blank" rel="noreferrer" style={{ ...btnPrimary, textDecoration: 'none' }}>Connect Google Calendar</a>
  )
  return <div style={{ fontSize: 13, color: '#ef4444' }}>Error checking status</div>
}

const container = {
  width: '100%',
  height: '100%',
  background: '#0f172a',
  color: '#e2e8f0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  boxSizing: 'border-box',
}
const header = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: 8,
  borderBottom: '1px solid #1f2937',
}
const title = { fontSize: 18, fontWeight: 700 }
const subtitle = { fontSize: 12, color: '#94a3b8' }
const chipBtnBase = { padding: '4px 8px', background: '#111827', color: '#e2e8f0', borderRadius: 8, border: '1px solid #334155', cursor: 'pointer', fontSize: 12 }
const tabBtn = (active) => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: active ? '#334155' : '#111827',
  color: '#e2e8f0',
  cursor: 'pointer',
})
const navBtn = { ...chipBtnBase, width: 28, textAlign: 'center' }
const btnPrimary = { padding: '8px 12px', background: '#2563eb', color: 'white', borderRadius: 8, border: 'none', cursor: 'pointer' }
const btnSecondary = { padding: '8px 12px', background: '#1f2937', color: '#e2e8f0', borderRadius: 8, border: '1px solid #334155', cursor: 'pointer' }
const chipBtn = { ...chipBtnBase }
const chipDanger = { ...chipBtnBase, borderColor: '#7f1d1d', background: '#1f2937', color: '#fca5a5' }

export default CalendarPlannerWidget