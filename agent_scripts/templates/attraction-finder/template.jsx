import React, { useEffect, useMemo } from 'react'

function ExploreWidget() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [attractions, setAttractions] = useGlobalStorage('explore.attractions', [])
  const [status, setStatus] = useGlobalStorage('explore.status', 'idle')
  const [error, setError] = useGlobalStorage('explore.error', null)
  const [systemStatus] = useGlobalStorage('system.status', { loading: null, error: null })
  const [, setTripAttractions] = useGlobalStorage('trip.attractions', [])
  const [sortingStatus, setSortingStatus] = useGlobalStorage('explore.sorting.status', 'idle')
  const [aiResponse, setAiResponse] = useStorage('explore.aiResponse', '')

  const city = query?.city
  const fromISO = useMemo(() => query?.fromISO || null, [query])
  const toISO = useMemo(() => query?.toISO || null, [query])

  async function sortItemsWithAI(items, description, type) {
    if (!description || !Array.isArray(items) || items.length === 0) {
      return items
    }

    try {
      setSortingStatus('running')
      // Send minimal fields and expect only IDs back
      const minimal = items.slice(0, 10).map((it) => ({
        id: it?.id,
        title: it?.title,
        rating: it?.rating || it?.venue?.rating,
        reviews: it?.reviews || it?.venue?.reviews,
        priceLevel: it?.priceLevel ?? null,
        address: it?.address || it?.venue?.address || null,
        category: it?.category || null,
      }))
      const prompt = `You are a travel expert helping to personalize ${type} recommendations. 

Given this list of ${type} and the user's trip preferences, sort and filter the ${type} to show the most relevant ones first.

User's trip preferences: "${description}"

${type} (minimal) data: ${JSON.stringify(minimal, null, 2)}

Important: Return ONLY a JSON array of IDs of the ${type} in sorted order (most relevant first). Example: ["id1","id2", ...]. Do not include any other fields or text.

Focus on:
- Activity types that match their interests (e.g., cultural, outdoor, historical, entertainment)
- Atmosphere and experience level (e.g., relaxing, adventurous, educational, social)
- Price range preferences
- Location convenience
- Any specific experiences they mentioned (beaches, museums, nightlife, etc.)

Return the ${type} in order of best match to worst match.`

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

      const byId = new Map(items.map((r) => [r?.id, r]))
      const reordered = sortedIds.map((id) => byId.get(id)).filter(Boolean)
      const remaining = items.filter((r) => !sortedIds.includes(r?.id))
      const finalList = [...reordered, ...remaining]

      setSortingStatus('ok')
      return finalList
    } catch (e) {
      console.warn(`AI sorting failed for ${type}, using original order:`, e)
      setSortingStatus('error')
      return items
    }
  }

  async function fetchAttractions() {
    if (!city) return
    try {
      setStatus('running')
      setError(null)
      // Use SerpAPI Google Local for attractions with ratings
      const result = await miyagiAPI.get('serp-places', { city, q: `attractions in ${city}`, size: 20 })
      if (!result.success) throw new Error(result.error || 'Failed to fetch attractions')
      const nextItems = Array.isArray(result.data?.items) ? result.data.items : []
      
      // Sort with AI if trip description is provided
      const sortedItems = await sortItemsWithAI(nextItems, tripDescription, 'attractions')
      // Preload thumbnails up to 5s before rendering (after sorting only)
      try {
        const urls = Array.from(new Set(sortedItems.map((i) => i?.thumbnail).filter(Boolean)))
        if (urls.length > 0) {
          await new Promise((resolve) => {
            let completed = 0
            const finish = () => { completed++; if (completed >= urls.length) { clearTimeout(timer); resolve(null) } }
            const timer = setTimeout(() => resolve(null), 5000)
            urls.forEach((src) => {
              try { const img = new Image(); img.onload = finish; img.onerror = finish; img.src = src } catch { finish() }
            })
          })
        }
      } catch {}

      setAttractions(sortedItems)
      setTripAttractions(sortedItems)
      setStatus('ok')
    } catch (e) {
      setStatus('error')
      setError('Failed to load attractions')
    }
  }

  // Note: Reviews button removed per requirements; keep rating and review counts only

  const resolvePlaceUrl = (it) => {
    try {
      const url = it?.venue?.link || it?.url || ''
      const placeId = it?.place_id || it?.placeId || it?.id
      const isSerp = typeof url === 'string' && url.includes('serpapi.com')
      if ((isSerp || !url) && placeId) {
        return `https://www.google.com/maps/place/?q=place_id:${placeId}`
      }
      return url || undefined
    } catch {
      return it?.url
    }
  }

  function removeAttraction(id) {
    try {
      const list = Array.isArray(attractions) ? attractions : []
      const next = list.filter((a) => a?.id !== id)
      setAttractions(next)
      setTripAttractions(next)
    } catch {}
  }

  useEffect(() => {
    if (systemStatus?.loading === 'activities') {
      fetchAttractions()
    }
  }, [systemStatus?.loading, query?.city, query?.fromISO, query?.toISO])

  // Also auto-refresh when Travel Planner sets global loading to 'activities'
  // note: Travel Planner triggers via system.status; no duplicate watcher needed here

  if (typeof city !== 'string' || typeof fromISO !== 'string' || typeof toISO !== 'string') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
          Waiting for itinerary (city and dates)...
        </div>
      </div>
    )
  }

  const list = Array.isArray(attractions) ? attractions : []
  const safeStatus = typeof status === 'string' ? status : (status == null ? '' : '[status]')
  const safeError = typeof error === 'string' ? error : (error == null ? '' : 'An error occurred')

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Attraction Finder</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{city}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{fromISO}</span>
          <span>→</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{toISO}</span>
        </div>
        {sortingStatus === 'running' ? (
          <div style={{ marginTop: 4, color: '#93c5fd', fontSize: 12 }}>🤖 AI sorting attractions based on your preferences...</div>
        ) : sortingStatus === 'ok' ? (
          <div style={{ marginTop: 4, color: '#86efac', fontSize: 12 }}>✅ Attractions sorted by AI based on your preferences</div>
        ) : sortingStatus === 'error' ? (
          <div style={{ marginTop: 4, color: '#fbbf24', fontSize: 12 }}>⚠️ AI sorting failed, showing original results</div>
        ) : null}
        {safeError ? <div style={{ marginTop: 8, color: '#fda4af' }}>{safeError}</div> : null}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => fetchAttractions()} disabled={status === 'running'} style={{ padding: '8px 12px', borderRadius: 8, background: status === 'running' ? '#6b7280' : '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: status === 'running' ? 'not-allowed' : 'pointer' }}>Refresh</button>
        </div>
        <div style={{ marginTop: 12, maxHeight: '50vh', overflowY: 'auto' }}>
          {list.map((it) => (
            <div key={it.id} style={{ borderTop: '1px solid #1f2937', padding: '10px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 10, alignItems: 'center' }}>
                <div>
                  {it.thumbnail ? (
                    <img src={it.thumbnail} alt="thumb" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #1f2937' }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: '#0b1220', border: '1px solid #1f2937' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.title}</div>
                  {it.when ? <div style={{ color: '#94a3b8' }}>{it.when}</div> : null}
                  {it.venue?.name || it.address ? (
                    <div style={{ color: '#94a3b8' }}>
                      {it.venue?.name ? it.venue.name : it.address}
                    </div>
                  ) : null}
                  {(it.venue?.rating || it.rating) ? (
                    <div style={{ marginTop: 2, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0' }}>
                        {(it.venue?.rating || it.rating)?.toFixed ? (it.venue?.rating || it.rating).toFixed(1) : (it.venue?.rating || it.rating)} ★ ({it.venue?.reviews ?? it.reviews ?? 0})
                      </span>
                      {/* Reviews button intentionally removed */}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {Array.isArray(it.tickets) && it.tickets.length > 0 ? (
                    <a href={it.tickets[0]?.link} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', display: 'block' }}>Tickets</a>
                  ) : (() => { const href = resolvePlaceUrl(it); return href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', display: 'block' }}>View</a>
                  ) : null })()}
                  {typeof it.price === 'number' ? <div style={{ fontWeight: 700, marginTop: 4 }}>${it.price}</div> : null}
                  {safeStatus === 'ok' ? (
                    <button onClick={() => removeAttraction(it.id)} style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: '#111827', border: '1px solid #374151', color: '#e5e7eb', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ExploreWidget


