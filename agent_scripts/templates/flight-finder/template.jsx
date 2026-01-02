import React, { useEffect, useMemo } from 'react'

function FlightsProvider() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [itemsOut, setItemsOut] = useGlobalStorage('flights.items.outbound', [])
  const [itemsRet, setItemsRet] = useGlobalStorage('flights.items.return', [])
  const [status, setStatus] = useGlobalStorage('providers.flights.status', 'idle')
  const [error, setError] = useGlobalStorage('providers.flights.error', null)
  const [systemStatus, setSystemStatus] = useGlobalStorage('system.status', { loading: null, error: null })
  const [tab, setTab] = useStorage('flights.tab', 'departure')
  const [sortingStatus, setSortingStatus] = useGlobalStorage('flights.sorting.status', 'idle')
  const [aiResponse, setAiResponse] = useStorage('flights.aiResponse', '')
  const [sortBy, setSortBy] = useStorage('flights.sortBy', 'ai') // ai | price-asc | price-desc | duration-asc | duration-desc | stops-asc

  const origin = query?.origin
  const dest = query?.city
  const outbound = useMemo(() => query?.fromISO || null, [query])

  const itemsArrayOut = Array.isArray(itemsOut) ? itemsOut : []
  const itemsArrayRet = Array.isArray(itemsRet) ? itemsRet : []

  async function sortFlightsWithAI(flights, description, type) {
    if (!description || !Array.isArray(flights) || flights.length === 0) {
      return flights
    }

    try {
      setSortingStatus('running')
      // Build minimal flight objects and expect only IDs back
      const minimal = flights.slice(0, 15).map((f) => {
        const legs = Array.isArray(f?.segments?.[type === 'outbound' ? 'outbound' : 'return']) ? f.segments[type === 'outbound' ? 'outbound' : 'return'] : []
        const first = legs[0] || null
        const last = legs.length > 0 ? legs[legs.length - 1] : null
        return {
          id: f?.id,
          airline: first?.airline || f.airline || 'Flight',
          flightNumber: first?.flightNumber || f.flightNumber || '',
          depart: { time: first?.depart?.time || f?.depart?.time || '', airport: first?.depart?.airport || f?.depart?.airport || '?' },
          arrive: { time: last?.arrive?.time || f?.arrive?.time || '', airport: last?.arrive?.airport || f?.arrive?.airport || '?' },
          duration: f?.duration || null,
          stops: typeof f?.stops === 'number' ? f.stops : null,
          price: f?.price || null,
        }
      })
      const prompt = `You are a travel expert helping to personalize flight recommendations. 

Given this list of flights and the user's trip preferences, sort and filter the flights to show the most relevant ones first.

User's trip preferences: "${description}"

${type} flights (minimal) data: ${JSON.stringify(minimal, null, 2)}

Important: Return ONLY a JSON array of flight IDs in sorted order (most relevant first). Example: ["id1","id2", ...]. Do not include any other fields or text.

Focus on:
- Price preferences (budget vs premium)
- Time preferences (early morning, late night, convenient times)
- Comfort preferences (direct flights vs stops, preferred airlines)
- Travel style (business vs leisure, family vs solo)
- Any specific constraints mentioned (e.g., "relaxing", "quick", "comfortable")

Return the flights in order of best match to worst match.`

      const result = await miyagiAPI.post('generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0.3,
        system_prompt: 'Return only valid JSON array, no other text.'
      })
      
      if (!result.success || !result.text) {
        throw new Error(result.error || 'AI sorting failed')
      }
      const sortedText = result.text
      setAiResponse(sortedText)
      
      // Parse the JSON response as an array of IDs
      let sortedIds
      try {
        sortedIds = JSON.parse(sortedText)
      } catch {
        // Fallback: try to extract JSON from the response
        const jsonMatch = sortedText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          sortedIds = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Could not parse AI response')
        }
      }

      if (!Array.isArray(sortedIds)) {
        throw new Error('AI did not return valid array of ids')
      }

      const byId = new Map(flights.map((f) => [f?.id, f]))
      const reordered = sortedIds.map((id) => byId.get(id)).filter(Boolean)
      const remaining = flights.filter((f) => !sortedIds.includes(f?.id))
      const finalList = [...reordered, ...remaining]

      setSortingStatus('ok')
      return finalList
    } catch (e) {
      console.warn(`AI sorting failed for ${type} flights, using original order:`, e)
      setSortingStatus('error')
      return flights
    }
  }

  const departureList = useMemo(() => {
    const base = itemsArrayOut
      .map((f) => {
        const legs = Array.isArray(f?.segments?.outbound) ? f.segments.outbound : []
        const has = legs.length > 0
        const first = has ? legs[0] : null
        const last = has ? legs[legs.length - 1] : null
        return has ? {
          id: `${f.id}-out`,
          airline: first?.airline || f.airline || 'Flight',
          flightNumber: first?.flightNumber || f.flightNumber || '',
          departAirport: first?.depart?.airport || f?.depart?.airport || '?',
          departTime: first?.depart?.time || f?.depart?.time || '',
          arriveAirport: last?.arrive?.airport || f?.arrive?.airport || '?',
          arriveTime: last?.arrive?.time || f?.arrive?.time || '',
          duration: f?.duration || '',
          stops: typeof f?.stops === 'number' ? f.stops : null,
          url: f?.url,
          price: f?.price,
        } : null
      })
      .filter(Boolean)
    if (!Array.isArray(base)) return []
    const copy = [...base]
    const toNum = (v, fallback) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    switch (sortBy) {
      case 'price-asc':
        copy.sort((a, b) => toNum(a.price, Number.POSITIVE_INFINITY) - toNum(b.price, Number.POSITIVE_INFINITY))
        break
      case 'price-desc':
        copy.sort((a, b) => toNum(b.price, Number.NEGATIVE_INFINITY) - toNum(a.price, Number.NEGATIVE_INFINITY))
        break
      case 'duration-asc':
        copy.sort((a, b) => toNum(a.duration, Number.POSITIVE_INFINITY) - toNum(b.duration, Number.POSITIVE_INFINITY))
        break
      case 'duration-desc':
        copy.sort((a, b) => toNum(b.duration, Number.NEGATIVE_INFINITY) - toNum(a.duration, Number.NEGATIVE_INFINITY))
        break
      case 'stops-asc':
        copy.sort((a, b) => toNum(a.stops, Number.POSITIVE_INFINITY) - toNum(b.stops, Number.POSITIVE_INFINITY))
        break
      default:
        // 'ai' -> preserve AI order
        break
    }
    return copy
  }, [itemsArrayOut, sortBy])

  const returnList = useMemo(() => {
    const base = itemsArrayRet.map((f) => {
      const segs = Array.isArray(f?.segments?.return) ? f.segments.return : []
      const first = segs[0] || null
      const last = segs.length > 0 ? segs[segs.length - 1] : null
      const departAirport = first?.depart?.airport || f?.depart?.airport || '?'
      const departTime = first?.depart?.time || f?.depart?.time || ''
      const arriveAirport = last?.arrive?.airport || f?.arrive?.airport || '?'
      const arriveTime = last?.arrive?.time || f?.arrive?.time || ''
      return {
        id: `${f.id}-ret`,
        airline: first?.airline || f.airline || 'Flight',
        flightNumber: first?.flightNumber || f.flightNumber || '',
        departAirport,
        departTime,
        arriveAirport,
        arriveTime,
        duration: f?.duration || '',
        stops: typeof f?.stops === 'number' ? f.stops : null,
        url: f?.url,
        price: f?.price,
      }
    })
    if (!Array.isArray(base)) return []
    const copy = [...base]
    const toNum = (v, fallback) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    switch (sortBy) {
      case 'price-asc':
        copy.sort((a, b) => toNum(a.price, Number.POSITIVE_INFINITY) - toNum(b.price, Number.POSITIVE_INFINITY))
        break
      case 'price-desc':
        copy.sort((a, b) => toNum(b.price, Number.NEGATIVE_INFINITY) - toNum(a.price, Number.NEGATIVE_INFINITY))
        break
      case 'duration-asc':
        copy.sort((a, b) => toNum(a.duration, Number.POSITIVE_INFINITY) - toNum(b.duration, Number.POSITIVE_INFINITY))
        break
      case 'duration-desc':
        copy.sort((a, b) => toNum(b.duration, Number.NEGATIVE_INFINITY) - toNum(a.duration, Number.NEGATIVE_INFINITY))
        break
      case 'stops-asc':
        copy.sort((a, b) => toNum(a.stops, Number.POSITIVE_INFINITY) - toNum(b.stops, Number.POSITIVE_INFINITY))
        break
      default:
        break
    }
    return copy
  }, [itemsArrayRet, sortBy])

  function removeFlight(idWithSuffix) {
    try {
      if (typeof idWithSuffix !== 'string') return
      if (idWithSuffix.endsWith('-out')) {
        const origId = idWithSuffix.slice(0, -4)
        const base = Array.isArray(itemsArrayOut) ? itemsArrayOut : []
        const next = base.filter((f) => f?.id !== origId)
        setItemsOut(next)
      } else if (idWithSuffix.endsWith('-ret')) {
        const origId = idWithSuffix.slice(0, -4)
        const base = Array.isArray(itemsArrayRet) ? itemsArrayRet : []
        const next = base.filter((f) => f?.id !== origId)
        setItemsRet(next)
      }
    } catch {}
  }

  async function fetchOutbound() {
    if (!origin || !dest || !outbound) return
    try {
      setStatus('running')
      setError(null)
      const adults = Math.max(1, Math.min(9, Number(query?.adults || 1)))
      const result = await miyagiAPI.get('flights', { from: origin, to: dest, date: outbound, adults })
      if (!result.success) throw new Error(result.error || 'Failed to fetch flights')
      const next = Array.isArray(result.data?.items) ? result.data.items : []
      
      // Sort with AI if trip description is provided
      const sortedItems = await sortFlightsWithAI(next, tripDescription, 'outbound')
      
      setItemsOut(sortedItems)
      setStatus('ok')
      setSystemStatus(s => ({ ...(s||{}), error: null }))
    } catch (e) {
      setStatus('error')
      setError('Failed to load flights')
    }
  }

  async function fetchReturn() {
    const returnDate = query?.toISO
    if (!origin || !dest || !returnDate) return
    try {
      setStatus('running')
      setError(null)
      const adults = Math.max(1, Math.min(9, Number(query?.adults || 1)))
      const result = await miyagiAPI.get('flights', { from: dest, to: origin, date: returnDate, adults })
      if (!result.success) throw new Error(result.error || 'Failed to fetch flights')
      const next = Array.isArray(result.data?.items) ? result.data.items : []
      
      // Sort with AI if trip description is provided
      const sortedItems = await sortFlightsWithAI(next, tripDescription, 'return')
      
      setItemsRet(sortedItems)
      setStatus('ok')
      setSystemStatus(s => ({ ...(s||{}), error: null }))
    } catch (e) {
      setStatus('error')
      setError('Failed to load flights')
    }
  }

  // Run when Travel Planner triggers activities search OR when query data changes
  useEffect(() => {
    if (systemStatus?.loading === 'activities') {
      fetchOutbound(); if (query?.toISO) fetchReturn()
    }
  }, [systemStatus?.loading, query?.origin, query?.city, query?.fromISO, query?.toISO])

  // Guard: wait for itinerary query to be strings to avoid rendering raw objects
  if (typeof origin !== 'string' || typeof dest !== 'string' || typeof outbound !== 'string') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
          Waiting for itinerary (origin, destination, dates)...
        </div>
      </div>
    )
  }

  const safeStatus = typeof status === 'string' ? status : (status == null ? '' : '[status]')
  const safeError = typeof error === 'string' ? error : (error == null ? '' : 'An error occurred')

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Flight Finder</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tab === 'departure' ? (
            <>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{origin || '—'}</span>
              <span>→</span>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{dest || '—'}</span>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{outbound || '—'}</span>
            </>
          ) : (
            <>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{dest || '—'}</span>
              <span>→</span>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{origin || '—'}</span>
              <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{query?.toISO || '—'}</span>
            </>
          )}
        </div>
        {sortingStatus === 'running' ? (
          <div style={{ marginTop: 4, color: '#93c5fd', fontSize: 12 }}>🤖 AI sorting flights based on your preferences...</div>
        ) : sortingStatus === 'ok' ? (
          <div style={{ marginTop: 4, color: '#86efac', fontSize: 12 }}>✅ Flights sorted by AI based on your preferences</div>
        ) : sortingStatus === 'error' ? (
          <div style={{ marginTop: 4, color: '#fbbf24', fontSize: 12 }}>⚠️ AI sorting failed, showing original results</div>
        ) : null}
        {safeError ? <div style={{ marginTop: 8, color: '#fda4af' }}>{safeError}</div> : null}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => (tab === 'departure' ? fetchOutbound() : fetchReturn())} disabled={!origin || !dest || (tab === 'departure' ? !outbound : !query?.toISO) || status === 'running'} style={{ padding: '8px 12px', borderRadius: 8, background: status === 'running' ? '#6b7280' : '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: status === 'running' ? 'not-allowed' : 'pointer' }}>Refresh</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setTab('departure')} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #1f2937', background: tab === 'departure' ? '#1e293b' : '#0b1220', color: '#e2e8f0', cursor: 'pointer' }}>Departure</button>
            <button onClick={() => setTab('return')} style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid #1f2937', background: tab === 'return' ? '#1e293b' : '#0b1220', color: '#e2e8f0', cursor: 'pointer' }}>Return</button>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937' }}>
              <option value="ai">AI order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="duration-asc">Duration: Shortest</option>
              <option value="duration-desc">Duration: Longest</option>
              <option value="stops-asc">Fewest stops</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12, maxHeight: '50vh', overflowY: 'auto' }}>
          {(tab === 'departure' ? departureList : returnList).map((f) => (
            <div key={f.id} style={{ borderTop: '1px solid #1f2937', padding: '8px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{f.airline} {f.flightNumber || ''}</div>
                <div style={{ color: '#94a3b8' }}>{f.departAirport} {f.departTime || ''} → {f.arriveAirport} {f.arriveTime || ''}</div>
                <div style={{ color: '#94a3b8' }}>{f.duration || ''} • {typeof f.stops === 'number' ? (f.stops === 0 ? 'nonstop' : `${f.stops} stops`) : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd' }}>View</a> : null}
                <div style={{ fontWeight: 700, marginTop: 4 }}>{typeof f.price === 'string' ? f.price : (typeof f.price === 'number' ? `$${f.price}` : '')}</div>
                {safeStatus === 'ok' ? (
                  <button onClick={() => removeFlight(f.id)} style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: '#111827', border: '1px solid #374151', color: '#e2e8f0', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FlightsProvider

