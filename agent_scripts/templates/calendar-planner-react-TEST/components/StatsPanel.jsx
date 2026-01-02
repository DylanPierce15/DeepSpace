import React, { useMemo, useState } from 'react'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, minutesBetween } from '../utils/dateUtils.js'

export default function StatsPanel({ tasks, groups }) {
  const [range, setRange] = useState('week') // 'day' | 'week' | 'month'
  const now = new Date()

  const rangeStart = range === 'day' ? startOfDay(now) : range === 'week' ? startOfWeek(now) : startOfMonth(now)
  const rangeEnd = range === 'day' ? endOfDay(now) : range === 'week' ? endOfWeek(now) : endOfMonth(now)

  const perGroup = useMemo(() => {
    const acc = {}
    for (const g of groups) acc[g.id] = { minutes: 0, name: g.name, color: g.color }
    for (const t of tasks) {
      if (!t.start || !t.end) continue
      const st = new Date(t.start)
      const en = new Date(t.end)
      if (en < rangeStart || st > rangeEnd) continue
      const mins = minutesBetween(st, en)
      if (!acc[t.groupId]) acc[t.groupId] = { minutes: 0, name: 'Other', color: '#64748b' }
      acc[t.groupId].minutes += mins
    }
    return acc
  }, [tasks, groups, range])

  const total = Object.values(perGroup).reduce((s, v) => s + v.minutes, 0)
  const fmtH = (m) => `${Math.floor(m / 60)}h ${m % 60}m`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['day', 'week', 'month'].map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #334155',
            background: range === r ? '#334155' : '#111827',
            color: '#e2e8f0',
            cursor: 'pointer',
          }}>{r.toUpperCase()}</button>
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

