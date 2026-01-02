import React, { useState, useEffect, useMemo } from 'react'

function SoccerFieldSearchWidget() {
  const [currentSport] = useGlobalStorage('sports.current', 'soccer')
  const key = (suffix) => `${currentSport}.fieldSearch.${suffix}`
  const sportLabel = useMemo(() => {
    const map = { soccer: 'Soccer', football: 'Football', tennis: 'Tennis', baseball: 'Baseball', basketball: 'Basketball' }
    return map[currentSport] || 'Sport'
  }, [currentSport])
  const theme = useMemo(() => {
    const bySport = {
      soccer: { icon: '🏟️', accent: ['#10b981', '#059669'], facilityNoun: 'Field' },
      football: { icon: '🏈', accent: ['#10b981', '#059669'], facilityNoun: 'Field' },
      tennis: { icon: '🎾', accent: ['#22c55e', '#16a34a'], facilityNoun: 'Court' },
      baseball: { icon: '⚾', accent: ['#ef4444', '#b91c1c'], facilityNoun: 'Field' },
      basketball: { icon: '🏀', accent: ['#f59e0b', '#d97706'], facilityNoun: 'Court' }
    }
    return bySport[currentSport] || bySport.soccer
  }, [currentSport])

  // Read defaults from scheduler widget if present
  const [schedulerDate] = useStorage(`${currentSport}.scheduler.selectedDate`, null)
  const [schedulerTime] = useStorage(`${currentSport}.scheduler.selectedTime`, null)
  const [schedulerLocation] = useStorage(`${currentSport}.scheduler.location`, '')
  const [schedulerMinPlayers] = useStorage(`${currentSport}.scheduler.minPlayers`, 0)
  // Read from both local and global to be safe
  const [schedulerIsConfirmed] = useGlobalStorage(`${currentSport}.scheduler.isConfirmed`, false)
  const [schedulerLockedOptionId] = useGlobalStorage(`${currentSport}.scheduler.lockedOptionId`, null)
  const [lockedPayloadGlobal] = useGlobalStorage(`${currentSport}.scheduler.lockedPayload`, null)

  const [searchLocation, setSearchLocation] = useStorage(key('location'), schedulerLocation || '')
  const [searchDate, setSearchDate] = useStorage(key('date'), schedulerDate)
  const [searchTime, setSearchTime] = useStorage(key('time'), schedulerTime || '')
  const [players, setPlayers] = useStorage(key('players'), schedulerMinPlayers || 0)
  const [fieldTypeFilter, setFieldTypeFilter] = useStorage(key('fieldType'), 'all')
  const [priceFilter, setPriceFilter] = useStorage(key('priceRange'), 'all')
  const [distanceFilter, setDistanceFilter] = useStorage(key('distance'), 'all')
  const [selectedField, setSelectedField] = useStorage(key('selectedField'), null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [lastExecutedKey, setLastExecutedKey] = useStorage(key('lastExecutedKey'), '')

  // Initialize default date/time
  useEffect(() => {
    if (!searchDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSearchDate(tomorrow.toISOString().split('T')[0])
    }
    if (!searchTime) {
      setSearchTime('18:00')
    }
  }, [searchDate, searchTime, setSearchDate, setSearchTime])

  // Sync with scheduler when it changes
  useEffect(() => {
    if (schedulerDate) setSearchDate(schedulerDate)
    if (schedulerTime) setSearchTime(schedulerTime)
    if (schedulerLocation) setSearchLocation(schedulerLocation)
    if (Number(schedulerMinPlayers) > 0) setPlayers(Number(schedulerMinPlayers))
    if (lockedPayloadGlobal?.location) {
      setSearchLocation(lockedPayloadGlobal.location)
      if (lockedPayloadGlobal.dateISO) setSearchDate(lockedPayloadGlobal.dateISO)
      if (lockedPayloadGlobal.time) setSearchTime(lockedPayloadGlobal.time)
      if (Number(lockedPayloadGlobal.minPlayers) > 0) setPlayers(Number(lockedPayloadGlobal.minPlayers))
    }
  }, [schedulerDate, schedulerTime, schedulerLocation, schedulerMinPlayers, lockedPayloadGlobal])

  const runSearch = async (loc, date, time, ppl) => {
    if (!loc || !loc.trim()) {
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const sportQueryNoun = (() => {
        switch ((currentSport || 'soccer')) {
          case 'basketball':
            return 'basketball courts to rent';
          case 'tennis':
            return 'tennis courts to rent';
          case 'football':
            return 'football fields to rent';
          case 'baseball':
            return 'baseball fields to rent';
          default:
            return 'soccer fields to rent';
        }
      })()
      const queryParts = [
        `${sportQueryNoun} near ${loc}`,
        date ? `on ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}` : '',
        time ? `around ${time}` : '',
        ppl ? `for ${ppl} players` : ''
      ].filter(Boolean)
      const query = queryParts.join(' ')

      // Use server web-search (SerpAPI integrated on server)
      const resp = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count: 8 })
      })
      if (!resp.ok) throw new Error('search_failed')
      const data = await resp.json()
      const parsed = (data.results || []).map((r, idx) => ({
        id: r.url || idx,
        name: r.title || 'Soccer Field',
        address: r.url || '',
        type: 'unknown',
        surface: 'unknown',
        price: '—',
        distance: '—',
        amenities: [],
        availability: [],
        rating: null,
        reviews: null,
        url: r.url,
        snippet: r.description
      }))
      setResults(parsed)
    } catch (e) {
      setError('Search failed. Try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    const key = `${searchLocation}|${searchDate}|${searchTime}|${players}|manual`
    if (key === lastExecutedKey) return
    setLastExecutedKey(key)
    await runSearch(searchLocation, searchDate, searchTime, players)
  }

  const hasLock = useMemo(() => {
    return Boolean(lockedPayloadGlobal && lockedPayloadGlobal.location)
  }, [lockedPayloadGlobal])

  // SINGLE TRIGGER: Run search exactly once when scheduler locks
  useEffect(() => {
    // Debug: log what we're getting
    console.log('Field finder: lockedPayloadGlobal =', lockedPayloadGlobal)
    
    if (!lockedPayloadGlobal) return
    
    const lockLoc = (lockedPayloadGlobal.location || '').trim()
    const lockDate = lockedPayloadGlobal.dateISO || ''
    const lockTime = lockedPayloadGlobal.time || ''
    const lockPlayers = Number(lockedPayloadGlobal.minPlayers || 0)
    
    console.log('Field finder: search params =', { lockLoc, lockDate, lockTime, lockPlayers })
    
    if (!lockLoc) {
      console.log('Field finder: no location, skipping search')
      return
    }
    
    const execKey = `${lockLoc}|${lockDate}|${lockTime}|${lockPlayers}|${currentSport}`
    console.log('Field finder: search key =', execKey, 'lastExecutedKey =', lastExecutedKey)
    
    if (execKey === lastExecutedKey) {
      console.log('Field finder: key already executed, skipping')
      return
    }
    
    console.log('Field finder: triggering search')
    setLastExecutedKey(execKey)
    runSearch(lockLoc, lockDate, lockTime, lockPlayers)
  }, [lockedPayloadGlobal, lastExecutedKey])

  const handleFieldSelect = (fieldId) => {
    setSelectedField(fieldId)
  }

  const handleBookField = (fieldId) => {
    alert(`Booking field ${fieldId} for ${searchDate}. This would normally redirect to the booking system.`)
  }

  return (
    <div key={currentSport} style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'center', 
      background: '#0b1020', 
      overflowY: 'auto' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 600, 
        background: '#ffffff', 
        color: '#37352f', 
        border: '1px solid #e9e9e7', 
        borderRadius: 12, 
        padding: 0, 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        fontSize: 16 
      }}>
        
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e9e9e7', 
          background: `linear-gradient(135deg, ${theme.accent[0]} 0%, ${theme.accent[1]} 100%)`, 
          color: 'white'
        }}>
          <div style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            margin: '0 0 4px 0', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8 
          }}>
              <span>{theme.icon}</span>
              <span>{sportLabel} {theme.facilityNoun} Finder</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
            Find the perfect field for your game
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {/* Query Summary (read-only, auto-runs) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ padding: 12, border: '1px solid #e5e7eb', background: '#fafafa', borderRadius: 8 }}>
              {hasLock ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Searching for fields</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {(searchLocation || schedulerLocation || '—')} • {(searchDate || schedulerDate || '—')} {(searchTime || schedulerTime || '')} {players ? `• ${players} players` : ''}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>No time locked yet</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>Lock your time in the Scheduler to automatically search nearby fields.</div>
                </>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 16 
            }}>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: '#37352f', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6 
              }}>
                <span>📍</span>
                <span>Available {theme.facilityNoun}s</span>
              </div>
              <div style={{ 
                fontSize: 12, 
                color: '#787774', 
                background: '#f7f6f3', 
                padding: '2px 8px', 
                borderRadius: 3 
              }}>
                {(results.length || 0)} field{(results.length || 0) !== 1 ? 's' : ''} found
              </div>
            </div>

            {/* Manual search section */}
            {!hasLock && (
              <div style={{ 
                padding: '20px', 
                border: '1px dashed #e5e7eb',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
                  Manual Search
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input 
                    type="text" 
                    value={searchLocation} 
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="Location (e.g., San Francisco)"
                    style={{ 
                      flex: 1,
                      padding: '8px 12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 4, 
                      fontSize: 14
                    }}
                  />
                  <input 
                    type="date" 
                    value={searchDate} 
                    onChange={(e) => setSearchDate(e.target.value)}
                    style={{ 
                      padding: '8px 12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 4, 
                      fontSize: 14
                    }}
                  />
                  <input 
                    type="time" 
                    value={searchTime} 
                    onChange={(e) => setSearchTime(e.target.value)}
                    style={{ 
                      padding: '8px 12px', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 4, 
                      fontSize: 14
                    }}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchLocation || isLoading}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: 4,
                    background: searchLocation && !isLoading ? '#10b981' : '#9ca3af',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: searchLocation && !isLoading ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isLoading ? 'Searching...' : 'Search Fields'}
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 14px', marginBottom: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 6 }}>{error}</div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px', 
                color: '#787774' 
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
                <div>Searching for fields...</div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && (results.length === 0) && hasLock && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px', 
                color: '#787774' 
              }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🏟️</div>
                <div>No fields found. Try adjusting your search criteria.</div>
              </div>
            )}

            {/* Field Cards */}
            {!isLoading && results.length > 0 && (
              <div>
                {results.map(field => (
                  <div
                    key={field.id}
                    onClick={() => handleFieldSelect(field.id)}
                    style={{
                      border: `1px solid ${selectedField === field.id ? '#10b981' : '#e9e9e7'}`,
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      background: selectedField === field.id ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      justifyContent: 'space-between', 
                      marginBottom: 12 
                    }}>
                      <div>
                        <div style={{ 
                          fontSize: 16, 
                          fontWeight: 600, 
                          color: selectedField === field.id ? '#10b981' : '#37352f', 
                          margin: '0 0 4px 0' 
                        }}>
                          {field.name}
                        </div>
                        {field.snippet && (
                          <div style={{ fontSize: 12, color: '#787774', margin: 0 }}>
                            {field.snippet}
                          </div>
                        )}
                        {field.address && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                            {field.address}
                          </div>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: '#10b981', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        padding: '4px 8px', 
                        borderRadius: 4 
                      }}>
                        {field.price ? `$${field.price}/hour` : 'View'}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFieldSelect(field.id)
                        }}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: '#ffffff',
                          color: '#374151',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {selectedField === field.id ? 'Selected' : 'Select'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (field.url) {
                            window.open(field.url, '_blank')
                          } else {
                            handleBookField(field.id)
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: 4,
                          background: '#10b981',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Book Field
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoccerFieldSearchWidget