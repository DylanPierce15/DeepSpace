import React, { useMemo } from 'react'

function SportsMasterWidget() {
  const [currentSport, setCurrentSport] = useGlobalStorage('sports.current', 'soccer')

  const sports = useMemo(() => (
    [
      { id: 'soccer', label: 'Soccer' },
      { id: 'football', label: 'Football' },
      { id: 'tennis', label: 'Tennis' },
      { id: 'baseball', label: 'Baseball' },
      { id: 'basketball', label: 'Basketball' },
    ]
  ), [])

  const selectSport = (sportId) => {
    setCurrentSport(sportId)
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sports-current-changed', { detail: { sport: sportId } }))
      }
    } catch {}
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: '#0b1020' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 520, 
        background: '#ffffff', 
        color: '#111827', 
        border: '1px solid #e5e7eb', 
        borderRadius: 12, 
        padding: 24, 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🎮</span>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Pick Your Sport</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Current: {currentSport}</div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: 12 
        }}>
          {sports.map(s => {
            const active = currentSport === s.id
            return (
              <button
                key={s.id}
                onClick={() => selectSport(s.id)}
                style={{
                  padding: '14px 12px',
                  border: `1px solid ${active ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 10,
                  background: active ? '#3b82f6' : '#ffffff',
                  color: active ? '#ffffff' : '#111827',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
          Your other widgets will adapt to the selected sport automatically.
        </div>
      </div>
    </div>
  )
}

export default SportsMasterWidget


