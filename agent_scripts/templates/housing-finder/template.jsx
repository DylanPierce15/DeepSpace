import React, { useEffect, useMemo } from 'react'

function HousingWidget() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [items, setItems] = useGlobalStorage('housing.items', [])
  const [status, setStatus] = useGlobalStorage('housing.status', 'idle')
  const [error, setError] = useGlobalStorage('housing.error', null)
  const [, setTripHousing] = useGlobalStorage('trip.housing', [])
  const [sortingStatus, setSortingStatus] = useGlobalStorage('housing.sorting.status', 'idle')
  const [aiResponse, setAiResponse] = useStorage('housing.aiResponse', '')
  const [systemStatus] = useGlobalStorage('system.status', { loading: null, error: null })
  const [sortBy, setSortBy] = useStorage('housing.sortBy', 'ai')

  const city = query?.city
  const fromISO = useMemo(() => query?.fromISO || null, [query])
  const toISO = useMemo(() => query?.toISO || null, [query])
  const adults = useMemo(() => (typeof query?.adults === 'number' ? String(query.adults) : (query?.adults || '2')), [query])

  async function sortWithAI(accommodations, description) {
    if (!description || !Array.isArray(accommodations) || accommodations.length === 0) {
      return accommodations
    }

    try {
      setSortingStatus('running')
      // Minimal fields to send to AI for sorting
      const minimal = accommodations.slice(0, 10).map((h) => ({
        id: h?.id,
        title: h?.title,
        rating: h?.rating,
        reviews: h?.reviews,
        amenities: Array.isArray(h?.amenities) ? h.amenities : [],
        hotel_class: typeof h?.hotel_class === 'number' ? h.hotel_class : null,
        price_text: h?.price_text,
      }))

      const prompt = `You are a travel expert helping to personalize accommodation recommendations.

Given this list of accommodations (minimal fields) and the user's trip preferences, return ONLY the IDs in sorted order (most relevant first).

User's trip preferences: "${description}"

Accommodations (minimal) data: ${JSON.stringify(minimal, null, 2)}

Important rules:
- Output STRICT JSON array of IDs only, e.g. ["id1","id2",...].
- Consider amenities, hotel_class (stars), rating/reviews volume, and price_text as hints of price level.
- Do not invent new IDs.`

      const result = await miyagiAPI.post('generate-text', {
        prompt,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 800,
        temperature: 0.2,
        system_prompt: 'Return only a JSON array of IDs (strings). No extra text.'
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

      // Reorder original objects by id
      const byId = new Map(accommodations.map((h) => [h?.id, h]))
      const reordered = sortedIds.map((id) => byId.get(id)).filter(Boolean)
      const remaining = accommodations.filter((h) => !sortedIds.includes(h?.id))
      const finalList = [...reordered, ...remaining]

      setSortingStatus('ok')
      return finalList
    } catch (e) {
      console.warn('AI sorting failed, using original order:', e)
      setSortingStatus('error')
      return accommodations
    }
  }

  async function fetchHousing() {
    if (!city || !fromISO || !toISO) return
    try {
      setStatus('running')
      setError(null)
      // Use SerpAPI Google Hotels
      const result = await miyagiAPI.get('serp-hotels', { city, check_in_date: fromISO, check_out_date: toISO, adults: Number(adults), size: 20 })
      try { console.log('[housing] miyagiAPI.get serp-hotels', { city, check_in_date: fromISO, check_out_date: toISO }) } catch {}
      if (!result.success) throw new Error(result.error || 'Failed to fetch hotels')
      try { console.log('[housing] response meta', { count: Array.isArray(result.data?.items) ? result.data.items.length : 0, first: result.data?.items?.[0] }) } catch {}
      const nextItems = Array.isArray(result.data?.items) ? result.data.items : []

      const sortedItems = await sortWithAI(nextItems, tripDescription)
      // Preload thumbnails up to 5s before rendering
      try {
        const urls = Array.from(new Set(sortedItems.map((i) => i?.thumbnail).filter(Boolean)))
        if (urls.length > 0) {
          await new Promise((resolve) => {
            let completed = 0
            const finish = () => { completed++; if (completed >= urls.length) { clearTimeout(timer); resolve(null) } }
            const timer = setTimeout(() => resolve(null), 5000)
            urls.forEach((src) => {
              try {
                const img = new Image(); img.onload = finish; img.onerror = finish; img.src = src
              } catch { finish() }
            })
          })
        }
      } catch {}

      setItems(sortedItems)
      setTripHousing(sortedItems)
      setStatus('ok')
    } catch (e) {
      try { console.warn('[housing] error', e) } catch {}
      setStatus('error')
      setError('Failed to load accommodations')
    }
  }

  // Fetch when Travel Planner triggers activities search OR when query data changes
  useEffect(() => {
    if (systemStatus?.loading === 'activities') {
      fetchHousing()
    }
  }, [systemStatus?.loading, query?.city, query?.fromISO, query?.toISO, query?.adults])

  if (typeof city !== 'string' || typeof fromISO !== 'string' || typeof toISO !== 'string') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
        <div style={{ width: '100%', maxWidth: 520, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
          Waiting for itinerary (city and dates)...
        </div>
      </div>
    )
  }

  const getSortedList = (arr, mode) => {
    const base = Array.isArray(arr) ? [...arr] : []
    if (mode === 'ai') return base
    const toNum = (v, fallback) => {
      const x = Number(v)
      return Number.isFinite(x) ? x : fallback
    }
    if (mode === 'price-asc') base.sort((a, b) => toNum(a && a.price, Number.POSITIVE_INFINITY) - toNum(b && b.price, Number.POSITIVE_INFINITY))
    else if (mode === 'price-desc') base.sort((a, b) => toNum(b && b.price, Number.NEGATIVE_INFINITY) - toNum(a && a.price, Number.NEGATIVE_INFINITY))
    else if (mode === 'reviews-desc') base.sort((a, b) => toNum(b && b.reviews, 0) - toNum(a && a.reviews, 0))
    else if (mode === 'rating-desc') base.sort((a, b) => toNum(b && b.rating, 0) - toNum(a && a.rating, 0))
    return base
  }
  const list = getSortedList(items, sortBy)
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

  const renderStars = (n) => {
    try {
      const count = Math.max(0, Math.min(5, Math.round(Number(n) || 0)))
      if (count <= 0) return null
      return (
        <span style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0', fontSize: 12 }}>
          {'★'.repeat(count)}
        </span>
      )
    } catch {
      return null
    }
  }

  function removeHousing(id) {
    try {
      const current = Array.isArray(items) ? items : []
      const next = current.filter((h) => h?.id !== id)
      setItems(next)
      setTripHousing(next)
    } catch {}
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Housing Finder</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{city}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{fromISO}</span>
          <span>→</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{toISO}</span>
          <span style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid #1f2937', background: '#0b1220', color: '#94a3b8' }}>{adults} adults</span>
        </div>
        {sortingStatus === 'running' ? (
          <div style={{ marginTop: 4, color: '#93c5fd', fontSize: 12 }}>🤖 AI sorting accommodations based on your preferences...</div>
        ) : sortingStatus === 'ok' ? (
          <div style={{ marginTop: 4, color: '#86efac', fontSize: 12 }}>✅ Accommodations sorted by AI based on your preferences</div>
        ) : sortingStatus === 'error' ? (
          <div style={{ marginTop: 4, color: '#fbbf24', fontSize: 12 }}>⚠️ AI sorting failed, showing original results</div>
        ) : null}
        {safeError ? <div style={{ marginTop: 8, color: '#fda4af' }}>{safeError}</div> : null}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={fetchHousing} disabled={status === 'running'} style={{ padding: '8px 12px', borderRadius: 8, background: status === 'running' ? '#6b7280' : '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: status === 'running' ? 'not-allowed' : 'pointer' }}>Refresh</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#94a3b8' }}>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, background: '#0b1220', color: '#e2e8f0', border: '1px solid #1f2937' }}>
              <option value="ai">AI order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="reviews-desc">Reviews: Most</option>
              <option value="rating-desc">Rating: Highest</option>
            </select>
          </div>
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
                  <div style={{ marginTop: 2, display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(it.rating || it.reviews) ? (
                      <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0' }}>
                        {it.rating?.toFixed ? it.rating.toFixed(1) : it.rating} ★ ({it.reviews ?? 0})
                      </span>
                    ) : null}
                    {renderStars(it?.hotel_class)}
                    {typeof it?.price_text === 'string' && it.price_text ? (
                      <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#93c5fd', fontSize: 12 }}>
                        {it.price_text}
                      </span>
                    ) : null}
                  </div>
                  {Array.isArray(it?.amenities) && it.amenities.length > 0 ? (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {it.amenities.slice(0, 6).map((am, idx) => (
                        <span key={idx} style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#94a3b8', fontSize: 12 }}>
                          {String(am)}
                        </span>
                      ))}
                      {it.amenities.length > 6 ? (
                        <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#94a3b8', fontSize: 12 }}>
                          +{it.amenities.length - 6} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {(() => { const href = resolvePlaceUrl(it); return href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', display: 'block' }}>Open</a>
                  ) : null })()}
                {typeof it.price === 'number' ? (
                  <div style={{ fontWeight: 700, marginTop: 4, textAlign: 'right' }}>
                    <div style={{ color: '#86efac', fontSize: 14 }}>
                      {it.currency ? `${it.currency} ${it.price}` : `$${it.price}`}
                      <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 4 }}>/night</span>
                    </div>
                    {fromISO && toISO && (() => {
                      const nights = Math.ceil((new Date(toISO).getTime() - new Date(fromISO).getTime()) / (1000 * 60 * 60 * 24))
                      const totalCost = it.price * nights
                      return nights > 1 ? (
                        <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 2 }}>
                          ${totalCost.toLocaleString()} total ({nights} nights)
                        </div>
                      ) : null
                    })()}
                  </div>
                ) : (typeof it.price_text === 'string' && it.price_text ? (
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{it.price_text}</div>
                ) : null)}
                  {safeStatus === 'ok' ? (
                    <button onClick={() => removeHousing(it.id)} style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: '#111827', border: '1px solid #374151', color: '#e5e7eb', cursor: 'pointer', fontSize: 12 }}>Remove</button>
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

export default HousingWidget



