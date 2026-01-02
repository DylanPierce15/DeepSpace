import React, { useMemo, useState, useEffect } from 'react'

function TravelPlanner() {
  const [query, setQuery] = useGlobalStorage('itinerary.query', { origin: '', city: '', fromISO: '', toISO: '', prefs: [], adults: 1 })
  const [tripDescription, setTripDescription] = useGlobalStorage('itinerary.description', '')
  const [systemStatus, setSystemStatus] = useGlobalStorage('system.status', { loading: null, error: null })
  const [form, setForm] = useStorage('generate.form', { origin: '', city: '', from: '', to: '', adults: 1, description: '' })
  const [, setActivities] = useGlobalStorage('activities.items', [])
  const [, setPlan] = useGlobalStorage('itinerary.plan', null)
  const [showPlanningMessage, setShowPlanningMessage] = useState(false)

  const isValid = useMemo(() => {
    if (!form.origin || !form.city || !form.from || !form.to || !form.adults) return false
    try { new Date(form.from).toISOString(); new Date(form.to).toISOString() } catch { return false }
    return new Date(form.from) <= new Date(form.to) && Number(form.adults) >= 1
  }, [form])

  const onSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    setQuery({ origin: form.origin.trim(), city: form.city.trim(), fromISO: form.from, toISO: form.to, prefs: [], adults: Math.max(1, Number(form.adults)||1) })
    setTripDescription(form.description?.trim() || '')
    setActivities([])
    setPlan(null)
    setSystemStatus({ loading: 'activities', error: null })
    
    // Show planning message for 2 seconds
    setShowPlanningMessage(true)
    setTimeout(() => {
      setShowPlanningMessage(false)
      // Clear the system status after other widgets have had time to respond
      setSystemStatus({ loading: null, error: null })
    }, 2000)
  }

  return (
    <form onSubmit={onSubmit} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 820, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Travel Planner</div>
        <div>
          <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>From (Origin)</label>
          <input placeholder="e.g., Bucharest" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} style={{ width: '100%', padding: '12px 14px', background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 8, fontSize: 16 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>Adults</label>
          <input inputMode="numeric" pattern="[0-9]*" placeholder="e.g., 2" value={String(form.adults ?? '')}
            onChange={(e) => {
              const raw = (e.target.value || '').replace(/[^0-9]/g, '')
              const num = raw === '' ? '' : Math.max(1, parseInt(raw, 10) || 1)
              setForm({ ...form, adults: num })
            }}
            style={{ width: '100%', padding: '12px 14px', background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 8, fontSize: 16 }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>City</label>
          <input placeholder="e.g., Barcelona" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%', padding: '12px 14px', background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 8, fontSize: 16 }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>From</label>
            <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} style={{ width: '100%', padding: '12px 14px', background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 8, fontSize: 16 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>To</label>
            <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} style={{ width: '100%', padding: '12px 14px', background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 8, fontSize: 16 }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 14, color: '#93c5fd', marginBottom: 6 }}>What do you want from this trip? (Optional)</label>
          <textarea 
            placeholder="e.g., I want to experience local culture, try authentic food, visit historical sites, and have some relaxing time at the beach..."
            value={form.description || ''} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            style={{ 
              width: '100%', 
              padding: '12px 14px', 
              background: '#0b1220', 
              color: '#e2e8f0', 
              border: '1px solid #1f2937', 
              borderRadius: 8, 
              fontSize: 16,
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }} 
          />
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            This will help personalize your restaurant, attraction, and flight recommendations.
          </div>
        </div>
        {systemStatus?.error ? (
          <div style={{ marginTop: 10, padding: 10, background: '#7f1d1d', color: '#fecaca', border: '1px solid #dc2626', borderRadius: 8 }}>{systemStatus.error}</div>
        ) : null}
        <button type="submit" disabled={!isValid || showPlanningMessage} style={{ width: '100%', marginTop: 16, padding: 14, borderRadius: 8, border: '1px solid #2563eb', background: '#1e40af', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 16 }}>
          {showPlanningMessage ? 'Planning started - check other widgets' : 'Start Planning'}
        </button>
        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>Submitting will reset activities and the current plan.</div>
      </div>
    </form>
  )
}

export default TravelPlanner


