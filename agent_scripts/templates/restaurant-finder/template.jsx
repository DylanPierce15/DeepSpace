import React, { useEffect, useMemo } from 'react'

function RestaurantsWidget() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [items, setItems] = useGlobalStorage('restaurants.items', [])
  const [status, setStatus] = useGlobalStorage('restaurants.status', 'idle')
  const [error, setError] = useGlobalStorage('restaurants.error', null)
  const [, setTripRestaurants] = useGlobalStorage('trip.restaurants', [])
  const [sortingStatus, setSortingStatus] = useGlobalStorage('restaurants.sorting.status', 'idle')
  const [aiResponse, setAiResponse] = useStorage('restaurants.aiResponse', '')
  const [systemStatus] = useGlobalStorage('system.status', { loading: null, error: null })

  const city = query?.city

  async function sortRestaurantsWithAI(restaurants, description) {
    if (!description || !Array.isArray(restaurants) || restaurants.length === 0) {
      return restaurants
    }

    try {
      setSortingStatus('running')
      // Send only minimal fields and ask AI to return only the IDs in sorted order
      const minimal = restaurants.slice(0, 10).map((r) => ({
        id: r?.id,
        title: r?.title,
        rating: r?.rating,
        reviews: r?.reviews,
        priceLevel: r?.priceLevel,
        category: r?.category,
      }))
      const prompt = `You are a travel expert helping to personalize restaurant recommendations. 

Given this list of restaurants and the user's trip preferences, sort and filter the restaurants to show the most relevant ones first.

User's trip preferences: "${description}"

Restaurants (minimal) data: ${JSON.stringify(minimal, null, 2)}

Important: Return ONLY a JSON array of restaurant IDs in sorted order (most relevant first). Example: ["id1","id2", ...]. Do not include any other fields or text.

Focus on:
- Cuisine types that match their interests (e.g., local/authentic food, specific dietary preferences)
- Restaurant atmosphere (e.g., casual vs fine dining, romantic vs family-friendly)
- Price range preferences
- Location convenience
- Any specific experiences they mentioned

Return the restaurants in order of best match to worst match (as IDs only).`

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

      // Build a map for quick lookup and reorder original objects by id
      const byId = new Map(restaurants.map((r) => [r?.id, r]))
      const reordered = sortedIds
        .map((id) => byId.get(id))
        .filter(Boolean)
      // If AI omitted some, append remaining in original order
      const remaining = restaurants.filter((r) => !sortedIds.includes(r?.id))
      const finalList = [...reordered, ...remaining]

      setSortingStatus('ok')
      return finalList
    } catch (e) {
      console.warn('AI sorting failed, using original order:', e)
      setSortingStatus('error')
      return restaurants
    }
  }

  async function fetchRestaurants() {
    if (!city) return
    try {
      setStatus('running')
      setError(null)
      const result = await miyagiAPI.get('serp-places', { city, q: `best restaurants in ${city}`, size: 20 })
      if (!result.success) throw new Error(result.error || 'Failed to fetch restaurants')
      const nextItems = Array.isArray(result.data?.items) ? result.data.items : []
      
      // Sort with AI if trip description is provided
      const sortedItems = await sortRestaurantsWithAI(nextItems, tripDescription)
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

      setItems(sortedItems)
      setTripRestaurants(sortedItems)
      setStatus('ok')
    } catch (e) {
      setStatus('error')
      setError('Failed to load restaurants')
    }
  }

  useEffect(() => {
    if (systemStatus?.loading === 'activities') {
      fetchRestaurants()
    }
  }, [systemStatus?.loading, query?.city, query?.fromISO, query?.toISO])

  if (typeof city !== 'string') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
          Waiting for itinerary (city)...
        </div>
      </div>
    )
  }

  const list = Array.isArray(items) ? items : []
  const safeStatus = typeof status === 'string' ? status : (status == null ? '' : '[status]')
  const safeError = typeof error === 'string' ? error : (error == null ? '' : 'An error occurred')

  // Note: Reviews button removed per requirements; keep rating and review counts only

  const resolvePlaceUrl = (it) => {
    try {
      const url = it?.url || ''
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

  function removeRestaurant(id) {
    try {
      const list = Array.isArray(items) ? items : []
      const next = list.filter((r) => r?.id !== id)
      setItems(next)
      setTripRestaurants(next)
    } catch {}
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Restaurant Finder</div>
        {sortingStatus === 'running' ? (
          <div style={{ marginTop: 4, color: '#93c5fd', fontSize: 12 }}>🤖 AI sorting restaurants based on your preferences...</div>
        ) : sortingStatus === 'ok' ? (
          <div style={{ marginTop: 4, color: '#86efac', fontSize: 12 }}>✅ Restaurants sorted by AI based on your preferences</div>
        ) : sortingStatus === 'error' ? (
          <div style={{ marginTop: 4, color: '#fbbf24', fontSize: 12 }}>⚠️ AI sorting failed, showing original results</div>
        ) : null}
        {safeError ? <div style={{ marginTop: 8, color: '#fda4af' }}>{safeError}</div> : null}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchRestaurants} disabled={status === 'running'} style={{ padding: '8px 12px', borderRadius: 8, background: status === 'running' ? '#6b7280' : '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: status === 'running' ? 'not-allowed' : 'pointer' }}>Refresh</button>
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
                  {it.address ? <div style={{ color: '#94a3b8' }}>{it.address}</div> : null}
                  {it.rating ? (
                    <div style={{ marginTop: 2, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0' }}>
                        {it.rating.toFixed ? it.rating.toFixed(1) : it.rating} ★ ({it.reviews ?? 0})
                      </span>
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {(() => { const href = resolvePlaceUrl(it); return href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', display: 'block' }}>Open</a>
                  ) : null })()}
                  {safeStatus === 'ok' ? (
                    <button onClick={() => removeRestaurant(it.id)} style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: '#111827', border: '1px solid #374151', color: '#e5e7eb', cursor: 'pointer', fontSize: 12 }}>Remove</button>
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

export default RestaurantsWidget


