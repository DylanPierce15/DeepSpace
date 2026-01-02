import React, { useState, useEffect, useMemo } from 'react'

function SoccerSchedulerWidget() {
  const [currentSport] = useGlobalStorage('sports.current', 'soccer')
  const key = (suffix) => `${currentSport}.scheduler.${suffix}`
  const sportLabel = useMemo(() => {
    const map = { soccer: 'Soccer', football: 'Football', tennis: 'Tennis', baseball: 'Baseball', basketball: 'Basketball' }
    return map[currentSport] || 'Sport'
  }, [currentSport])
  const theme = useMemo(() => {
    const bySport = {
      soccer: { icon: '📅', accent: ['#10b981', '#059669'], defaultDuration: 90 },
      football: { icon: '🏈', accent: ['#10b981', '#059669'], defaultDuration: 90 },
      tennis: { icon: '🎾', accent: ['#22c55e', '#16a34a'], defaultDuration: 60 },
      baseball: { icon: '⚾', accent: ['#ef4444', '#b91c1c'], defaultDuration: 120 },
      basketball: { icon: '🏀', accent: ['#f59e0b', '#d97706'], defaultDuration: 60 }
    }
    return bySport[currentSport] || bySport.soccer
  }, [currentSport])

  // One-time migration: if we switched from 'soccer.' to something else, copy locked payload for compatibility
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('soccer.scheduler.lockedPayload')
      const cur = localStorage.getItem(`${currentSport}.scheduler.lockedPayload`)
      if (legacy && !cur && currentSport !== 'soccer') {
        localStorage.setItem(`${currentSport}.scheduler.lockedPayload`, legacy)
      }
    } catch {}
  }, [currentSport])

  // Scheduler period and minimum players (standalone)
  const [fromDate, setFromDate] = useStorage(key('fromDate'), null)
  const [toDate, setToDate] = useStorage(key('toDate'), null)
  const [minPlayers, setMinPlayers] = useStorage(key('minPlayers'), 8)

  // Local scheduler selections (still supported for single-confirm flow)
  const [selectedDate, setSelectedDate] = useStorage(key('selectedDate'), null)
  const [selectedTime, setSelectedTime] = useStorage(key('selectedTime'), null)
  const [selectedDuration, setSelectedDuration] = useStorage(key('selectedDuration'), theme.defaultDuration)
  const [isConfirmed, setIsConfirmed] = useStorage(key('isConfirmed'), false)
  const [location, setLocation] = useStorage(key('location'), '')

  // Time poll state
  const [pollOptions, setPollOptions] = useStorage(key('poll.options'), []) // Array<{id, dateISO, time, label}>
  const [pollVotes, setPollVotes] = useStorage(key('poll.votes'), {}) // Record<optionId, number>
  const [userVote, setUserVote] = useStorage(key('poll.userVote'), null) // optionId
  const [lockedOptionId, setLockedOptionId] = useStorage(key('poll.lockedOptionId'), null)
  const [userExtraVotes, setUserExtraVotes] = useStorage(key('poll.userExtraVotes'), 0) // number of friend votes
  const [userName, setUserName] = useStorage(key('userName'), '')
  const [systemStatus, setSystemStatus] = useGlobalStorage('system.status', { loading: null, error: null })
  const [lockedPayloadGlobal, setLockedPayloadGlobal] = useGlobalStorage(`${currentSport}.scheduler.lockedPayload`, null)
  const [isConfirmedGlobal, setIsConfirmedGlobal] = useGlobalStorage(`${currentSport}.scheduler.isConfirmed`, false)
  const [lockedOptionIdGlobal, setLockedOptionIdGlobal] = useGlobalStorage(`${currentSport}.scheduler.lockedOptionId`, null)

  // Initialize defaults
  useEffect(() => {
    // Default range to next 7 days
    if (!fromDate || !toDate) {
      const today = new Date()
      const nextWeek = new Date()
      nextWeek.setDate(today.getDate() + 7)
      setFromDate(today.toISOString().split('T')[0])
      setToDate(nextWeek.toISOString().split('T')[0])
    }
    if (!selectedDate) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setSelectedDate(tomorrow.toISOString().split('T')[0])
    }
    if (!selectedTime) {
      setSelectedTime('18:00')
    }
  }, [fromDate, toDate, selectedDate, selectedTime, setFromDate, setToDate, setSelectedDate, setSelectedTime])

  // Total voters equals sum of poll votes (one vote per user)
  const totalVoters = useMemo(() => {
    return Object.values(pollVotes).reduce((s, v) => s + (v || 0), 0)
  }, [pollVotes])

  const thresholdReached = useMemo(() => {
    return totalVoters >= (minPlayers || 0)
  }, [totalVoters, minPlayers])

  const timeSlots = useMemo(() => {
    const slots = []
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`)
      }
    }
    return slots
  }, [])

  const durationOptions = [
    { value: 60, label: '1 Hour' },
    { value: 90, label: '1.5 Hours' },
    { value: 120, label: '2 Hours' }
  ]

  // Poll helpers
  const addPollOption = (dateISO, time) => {
    if (!dateISO || !time) return
    // Enforce period bounds if set
    if (fromDate && dateISO < fromDate) return
    if (toDate && dateISO > toDate) return
    const id = `${dateISO}_${time}`
    // Skip duplicates
    if (pollOptions.some(o => o.id === id)) return
    const dt = new Date(`${dateISO}T${time}:00`)
    const label = `${dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    const nextOptions = [...pollOptions, { id, dateISO, time, label }]
    setPollOptions(nextOptions)
    setPollVotes({ ...pollVotes, [id]: 0 })
  }

  const removePollOption = (optionId) => {
    const nextOptions = pollOptions.filter(o => o.id !== optionId)
    const { [optionId]: _, ...restVotes } = pollVotes
    // Clear vote if user voted this option
    const nextUserVote = userVote === optionId ? null : userVote
    setPollOptions(nextOptions)
    setPollVotes(restVotes)
    setUserVote(nextUserVote)
  }

  const castVote = (optionId) => {
    if (userVote === optionId) return
    const contribution = 1 + (userExtraVotes || 0)
    const nextVotes = { ...pollVotes }
    // Remove previous contribution
    if (userVote && nextVotes[userVote] > 0) {
      nextVotes[userVote] = Math.max(0, (nextVotes[userVote] || 0) - contribution)
    }
    // Add new contribution
    nextVotes[optionId] = (nextVotes[optionId] || 0) + contribution
    setPollVotes(nextVotes)
    setUserVote(optionId)
  }

  const adjustExtraVotes = (delta) => {
    const newVal = Math.max(0, (userExtraVotes || 0) + delta)
    if (newVal === userExtraVotes) return
    setUserExtraVotes(newVal)
    // If the user has a vote already, adjust that option's count by delta
    if (userVote) {
      const nextVotes = { ...pollVotes }
      nextVotes[userVote] = Math.max(0, (nextVotes[userVote] || 0) + delta)
      setPollVotes(nextVotes)
    }
  }

  const winningOption = useMemo(() => {
    if (!pollOptions.length) return null
    let best = null
    let bestVotes = -1
    for (const opt of pollOptions) {
      const v = pollVotes[opt.id] || 0
      if (v > bestVotes) {
        bestVotes = v
        best = opt
      }
    }
    return best
  }, [pollOptions, pollVotes])

  const handleTimeSlotSelect = (time) => {
    setSelectedTime(time)
  }

  const handleDurationSelect = (duration) => {
    setSelectedDuration(duration)
  }

  const calculateEndTime = () => {
    if (!selectedTime) return null
    const [hours, minutes] = selectedTime.split(':')
    const startTime = new Date()
    startTime.setHours(parseInt(hours), parseInt(minutes))
    const endTime = new Date(startTime.getTime() + (selectedDuration * 60000))
    return endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatSelectedDate = () => {
    if (!selectedDate) return '-'
    const dateObj = new Date(selectedDate)
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatSelectedTime = () => {
    if (!selectedTime) return '-'
    const [hours, minutes] = selectedTime.split(':')
    const timeObj = new Date()
    timeObj.setHours(parseInt(hours), parseInt(minutes))
    return timeObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = () => {
    const durationHours = selectedDuration / 60
    return durationHours === 1 ? '1 Hour' : durationHours === 1.5 ? '1.5 Hours' : `${durationHours} Hours`
  }

  const clearSchedule = () => {
    setSelectedDate(null)
    setSelectedTime(null)
    setSelectedDuration(90)
    setIsConfirmed(false)
    setLockedOptionId(null)
    setIsConfirmedGlobal(false)
    setLockedOptionIdGlobal(null)
  }

  const confirmSchedule = () => {
    // Allow confirm only if threshold reached and a winning option exists
    if (!thresholdReached) {
      return
    }
    const choice = winningOption
    if (!choice) {
      return
    }
    setLockedOptionId(choice.id)
    setIsConfirmed(true)
    setLockedOptionIdGlobal(choice.id)
    setIsConfirmedGlobal(true)
    setSelectedDate(choice.dateISO)
    setSelectedTime(choice.time)
    try {
      const payload = {
        location: location || '',
        dateISO: choice.dateISO,
        time: choice.time,
        minPlayers: minPlayers || 0,
        optionId: choice.id,
        lockedAt: Date.now(),
        userName: userName || '',
        userExtraVotes: userExtraVotes || 0
      }
      localStorage.setItem(`${currentSport}.scheduler.lockedPayload`, JSON.stringify(payload))
      localStorage.setItem(`${currentSport}.scheduler.lockedAt`, String(payload.lockedAt))
      setLockedPayloadGlobal(payload)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scheduler-locked', { detail: { ...payload, sport: currentSport } }))
      }
      // Notify via global system.status like itinerary→flights pattern
      setSystemStatus((s)=>({ ...(s||{}), loading: 'fields' }))
    } catch {}
  }

  // Convenience: add quick options across date range
  const addQuickOptionsForRange = (time) => {
    if (!time) return
    if (!fromDate || !toDate) {
      addPollOption(selectedDate, time)
      return
    }
    const from = new Date(fromDate + 'T00:00:00')
    const to = new Date(toDate + 'T00:00:00')
    const days = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000))
    const toAppend = []
    const nextVotes = { ...pollVotes }
    for (let i = 0; i <= days; i++) {
      const d = new Date(from.getTime() + i * 86400000)
      const dateISO = d.toISOString().split('T')[0]
      const id = `${dateISO}_${time}`
      if (!pollOptions.some(o => o.id === id)) {
        const dt = new Date(`${dateISO}T${time}:00`)
        const label = `${dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
        toAppend.push({ id, dateISO, time, label })
        if (nextVotes[id] == null) nextVotes[id] = 0
      }
    }
    if (toAppend.length > 0) {
      setPollOptions([...pollOptions, ...toAppend])
      setPollVotes(nextVotes)
    }
  }

  const resetAll = () => {
    setFromDate(null)
    setToDate(null)
    setMinPlayers(8)
    setSelectedDate(null)
    setSelectedTime(null)
    setSelectedDuration(90)
    setIsConfirmed(false)
    setPollOptions([])
    setPollVotes({})
    setUserVote(null)
    setLockedOptionId(null)
    setUserExtraVotes(0)
  }

  const hasValidSelection = selectedDate && selectedTime

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
        maxWidth: 500, 
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{theme.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{sportLabel} Game Scheduler</div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>Pick the perfect time for your pickup game</div>
              </div>
            </div>
            <button
              onClick={resetAll}
              style={{
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: 6,
                background: 'transparent',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          
          {/* Top Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Scheduler Controls</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={resetAll}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Period & Minimum Players */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              fontSize: 14, fontWeight: 600, color: '#37352f', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span>📆</span>
              <span>Game Period & Minimum Players</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#787774', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>From Date</label>
                <input type="date" value={fromDate || ''} onChange={(e) => setFromDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9e9e7', borderRadius: 6, fontSize: 14, background: '#ffffff', color: '#37352f' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#787774', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>To Date</label>
                <input type="date" value={toDate || ''} onChange={(e) => setToDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9e9e7', borderRadius: 6, fontSize: 14, background: '#ffffff', color: '#37352f' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#787774', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Min Players</label>
                <input type="number" min="2" max="40" value={minPlayers}
                  onChange={(e) => setMinPlayers(parseInt(e.target.value || '0'))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e9e9e7', borderRadius: 6, fontSize: 14, background: '#ffffff', color: '#37352f' }} />
              </div>
            </div>
          </div>

          {/* Threshold banner */}
          <div style={{
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            border: `1px solid ${thresholdReached ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            background: thresholdReached ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            color: thresholdReached ? '#16a34a' : '#dc2626',
            textAlign: 'center'
          }}>
            {thresholdReached
              ? `✅ Players ready: ${totalVoters}/${minPlayers} — scheduling is active`
              : `❌ Not enough players: ${totalVoters}/${minPlayers} — collecting interest`}
          </div>

          {/* Date & Time Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <span>📅</span>
              <span>Date & Time</span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 12, 
              marginBottom: 20 
            }}>
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Date
                </label>
                <input 
                  type="date" 
                  value={selectedDate || ''} 
                  min={fromDate || undefined}
                  max={toDate || undefined}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '10px 12px', 
                    border: '1px solid #e9e9e7', 
                    borderRadius: 6, 
                    fontSize: 14, 
                    fontFamily: 'inherit', 
                    background: '#ffffff', 
                    color: '#37352f'
                  }}
                />
              </div>
              
              <div>
                <label style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#787774', 
                  marginBottom: 6, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em',
                  display: 'block'
                }}>
                  Time
                </label>
                <input 
                  type="time" 
                  value={selectedTime || ''} 
                  onChange={(e) => setSelectedTime(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '10px 12px', 
                    border: '1px solid #e9e9e7', 
                    borderRadius: 6, 
                    fontSize: 14, 
                    fontFamily: 'inherit', 
                    background: '#ffffff', 
                    color: '#37352f'
                  }}
                />
              </div>
            </div>

            {/* Location */}
            <div style={{ marginTop: 8 }}>
              <label style={{ 
                fontSize: 12, 
                fontWeight: 500, 
                color: '#787774', 
                marginBottom: 6, 
                textTransform: 'uppercase', 
                letterSpacing: '0.04em',
                display: 'block'
              }}>
                Location
              </label>
              <input 
                type="text" 
                placeholder="e.g., Bucharest, Romania"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ 
                  width: '100%',
                  padding: '10px 12px', 
                  border: '1px solid #e9e9e7', 
                  borderRadius: 6, 
                  fontSize: 14, 
                  background: '#ffffff', 
                  color: '#37352f'
                }}
              />
            </div>

            {/* Quick Time Slots */}
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <span>⏰</span>
              <span>Quick Time Slots</span>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', 
              gap: 8 
            }}>
              {timeSlots.map(time => (
                <div
                  key={time}
                  onClick={() => handleTimeSlotSelect(time)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${selectedTime === time ? '#3b82f6' : '#e9e9e7'}`,
                    borderRadius: 6,
                    background: selectedTime === time ? '#3b82f6' : '#ffffff',
                    color: selectedTime === time ? 'white' : '#37352f',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {time}
                </div>
              ))}
            </div>

            {/* Add selected as poll option(s) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => addPollOption(selectedDate, selectedTime)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#ffffff',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Add This Time To Poll
              </button>
              <button
                onClick={() => addQuickOptionsForRange(selectedTime || '18:00')}
                style={{
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Add Same Time For All Dates
              </button>
            </div>
          </div>

          {/* Duration Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <span>⏱️</span>
              <span>Game Duration</span>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              {durationOptions.map(({ value, label }) => (
                <div
                  key={value}
                  onClick={() => handleDurationSelect(value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: `1px solid ${selectedDuration === value ? '#3b82f6' : '#e9e9e7'}`,
                    borderRadius: 6,
                    background: selectedDuration === value ? '#3b82f6' : '#ffffff',
                    color: selectedDuration === value ? 'white' : '#37352f',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Game Details */}
          {hasValidSelection && (
            <div style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: 16, 
              marginBottom: 20 
            }}>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: '#37352f', 
                margin: '0 0 12px 0', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6 
              }}>
                <span>⚽</span>
                <span>Game Details</span>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: 12, 
                marginBottom: 16 
              }}>
                <div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#787774', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    marginBottom: 4 
                  }}>
                    Location
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>
                    {location || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#787774', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    marginBottom: 4 
                  }}>
                    Date
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>
                    {formatSelectedDate()}
                  </div>
                </div>
                
                <div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#787774', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    marginBottom: 4 
                  }}>
                    Time
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>
                    {formatSelectedTime()}
                  </div>
                </div>
                
                <div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#787774', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    marginBottom: 4 
                  }}>
                    Duration
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>
                    {formatDuration()}
                  </div>
                </div>
                
                <div>
                  <div style={{ 
                    fontSize: 11, 
                    color: '#787774', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.04em', 
                    marginBottom: 4 
                  }}>
                    End Time
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>
                    {calculateEndTime()}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={clearSchedule}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#374151',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={confirmSchedule}
                  disabled={isConfirmed || !thresholdReached}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: 6,
                    background: isConfirmed ? '#22c55e' : (thresholdReached ? '#3b82f6' : '#e5e7eb'),
                    color: isConfirmed || thresholdReached ? 'white' : '#9ca3af',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: isConfirmed ? 'default' : (thresholdReached ? 'pointer' : 'not-allowed'),
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isConfirmed ? 'Schedule Locked!' : 'Lock Winning Time'}
                </button>
              </div>
            </div>
          )}

          {/* Time Poll Section */}
          <div style={{ marginTop: 8 }}>
            <div style={{ 
              fontSize: 14, 
              fontWeight: 600, 
              color: '#37352f', 
              margin: '0 0 12px 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <span>🗳️</span>
              <span>Vote On Times</span>
            </div>

            {/* Your name and friends */}
            <div style={{ marginBottom: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Your details</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>Name:</div>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name (e.g., Mihai)"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    fontSize: 12,
                    background: '#ffffff'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>Friends:</div>
                <button onClick={() => adjustExtraVotes(-1)} disabled={userExtraVotes <= 0}
                  style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, background: '#ffffff', cursor: userExtraVotes <= 0 ? 'not-allowed' : 'pointer', opacity: userExtraVotes <= 0 ? 0.5 : 1 }}>-</button>
                <div style={{ minWidth: 32, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{userExtraVotes}</div>
                <button onClick={() => adjustExtraVotes(1)}
                  style={{ width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 4, background: '#ffffff', cursor: 'pointer' }}>+</button>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Total players: {1 + (userExtraVotes || 0)}</div>
              </div>
            </div>

            {pollOptions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#787774', padding: '16px', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                No options yet. Add times above to start a poll.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pollOptions.map(opt => {
                  const votes = pollVotes[opt.id] || 0
                  const totalVotes = Object.values(pollVotes).reduce((s, v) => s + (v || 0), 0)
                  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                  const isUserChoice = userVote === opt.id
                  const isLocked = lockedOptionId === opt.id
                  return (
                    <div key={opt.id} style={{ border: '1px solid #e9e9e7', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#ffffff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>🕒</span>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#37352f' }}>{opt.label}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#787774' }}>{votes} vote{votes !== 1 ? 's' : ''} • {pct}%</div>
                          {!isConfirmed && (
                            <button
                              onClick={() => castVote(opt.id)}
                              style={{
                                padding: '6px 10px',
                                border: '1px solid ' + (isUserChoice ? '#3b82f6' : '#d1d5db'),
                                borderRadius: 6,
                                background: isUserChoice ? '#3b82f6' : '#ffffff',
                                color: isUserChoice ? 'white' : '#374151',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              {isUserChoice ? 'Voted' : 'Vote'}
                            </button>
                          )}
                          {!isConfirmed && (
                            <button
                              onClick={() => removePollOption(opt.id)}
                              style={{
                                padding: '6px 10px',
                                border: 'none',
                                borderRadius: 6,
                                background: '#ef4444',
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          )}
                          {isLocked && (
                            <div style={{ fontSize: 12, color: '#16a34a', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '2px 8px', borderRadius: 6 }}>
                              Locked
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ height: 6, background: '#e9e9e7' }}>
                        <div style={{ height: '100%', width: pct + '%', background: '#3b82f6', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SoccerSchedulerWidget
