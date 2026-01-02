import React, { useEffect, useMemo, useState, useRef } from 'react'

function ActivitySelector() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [tripFlightsOut] = useGlobalStorage('flights.items.outbound', [])
  const [tripFlightsRet] = useGlobalStorage('flights.items.return', [])
  // Fallback legacy sources when trip.* not yet populated
  const [legacyEvents] = useGlobalStorage('explore.events', [])
  const [legacyAttractions] = useGlobalStorage('explore.attractions', [])
  const [legacyRestaurants] = useGlobalStorage('restaurants.items', [])
  const [legacyHousing] = useGlobalStorage('housing.items', [])
  const [plans, setPlans] = useGlobalStorage('trip.plans', [])
  const [chosenPlan, setChosenPlan] = useGlobalStorage('chosen.plan', null)
  const [planGenStatus, setPlanGenStatus] = useState('idle')
  const [planGenError, setPlanGenError] = useGlobalStorage('trip.plans.error', null)
  const [, setPlansRaw] = useGlobalStorage('trip.plans.raw', null)
  const [expanded, setExpanded] = useStorage('finder.plan.expanded', {})
  const [pricing, setPricing] = useGlobalStorage('trip.plan.pricing', {})
  const [expandedId, setExpandedId] = useStorage('finder.plan.expandedId', null)
  const [showCatalog, setShowCatalog] = useStorage('finder.showCatalog', true)
  const [catalogQuery, setCatalogQuery] = useStorage('finder.catalogQuery', '')
  const [catalogTab, setCatalogTab] = useStorage('finder.catalogTab', 'all')
  const [chatInput, setChatInput] = useStorage('finder.chatInput', '')
  const [chatStatus, setChatStatus] = useStorage('finder.chatStatus', 'idle')
  const [chatRaw, setChatRaw] = useStorage('finder.chatRaw', '')
  
  // Streaming state for professional loading experience (local state only)
  const [streamingStatus, setStreamingStatus] = useState('')
  const [streamingProgress, setStreamingProgress] = useState(0)
  const streamingRef = useRef(true)
  
  // Reset streaming state when component mounts to prevent stuck states
  useEffect(() => {
    setStreamingStatus('')
    setStreamingProgress(0)
    setPlanGenStatus('idle')
    
    // Cleanup function to reset state when component unmounts
    return () => {
      streamingRef.current = false
      setStreamingStatus('')
      setStreamingProgress(0)
      setPlanGenStatus('idle')
    }
  }, [])
  
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState(null)
  const [dragOverItem, setDragOverItem] = useState(null)

  // Authentication helper
  const getAuthToken = () => {
    if (typeof window === 'undefined') return null
    if (window.__clerk_token) return window.__clerk_token
    
    try {
      const localStorageToken = localStorage.getItem('__session')
      if (localStorageToken) return localStorageToken
    } catch {}
    
    try {
      const cookies = document.cookie.split(';')
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=')
        if (name === '__session') return value
      }
    } catch {}
    
    return null
  }

  // Function to write selected plan to task-ideas
  async function handleSelectPlan(plan, key) {
    // First, set the chosen plan
    setChosenPlan(plan)
    
    // Auto-expand the selected plan
    if (key) {
      setExpandedId(key)
    }
    
    // NOTE: Removed auto-creation of task ideas from plan activities
    // Tasks are now generated via "Update Tasks" button in travel-task-checklist widget
    // This prevents duplicate tasks when clicking between plans
  }

  function updatePlanAt(index, updater) {
    const next = Array.isArray(plans) ? [...plans] : []
    const current = next[index]
    if (!current) return
    const updated = updater(current)
    // Add lastModified timestamp to track when plan was edited
    const updatedWithTimestamp = { ...updated, lastModified: Date.now() }
    next[index] = updatedWithTimestamp
    try { setPlans(next) } catch {}
    // If this plan was selected, keep chosenPlan in sync
    try { if (chosenPlan && (chosenPlan.id || String(index)) === (updated.id || String(index))) setChosenPlan(updatedWithTimestamp) } catch {}
    // Invalidate pricing for this plan
    try {
      const key = updated.id || String(index)
      const nextPricing = { ...(pricing || {}) }
      if (nextPricing[key]) { delete nextPricing[key] }
      setPricing(nextPricing)
    } catch {}
  }

  function handleRemoveItem(dayIndex, itemIndex) {
    if (!Array.isArray(plans)) return
    const idx = plans.findIndex((p, i) => (p.id || String(i)) === expandedId)
    if (idx < 0) return
    updatePlanAt(idx, (plan) => {
      const days = Array.isArray(plan.days) ? plan.days.map((d) => ({ ...d })) : []
      if (!days[dayIndex]) return plan
      const items = Array.isArray(days[dayIndex].items) ? [...days[dayIndex].items] : []
      items.splice(itemIndex, 1)
      const nextDay = { ...days[dayIndex], items }
      const nextDays = [...days]
      nextDays[dayIndex] = nextDay
      return { ...plan, days: nextDays }
    })
  }

  function handleAddItem(candidate, dayIndex) {
    if (!candidate) return
    if (!Array.isArray(plans)) return
    const idx = plans.findIndex((p, i) => (p.id || String(i)) === expandedId)
    if (idx < 0) return
    updatePlanAt(idx, (plan) => {
      const days = Array.isArray(plan.days) ? plan.days.map((d) => ({ ...d })) : []
      const safeDayIndex = Math.max(0, Math.min(dayIndex || 0, Math.max(0, days.length - 1)))
      const targetDay = days[safeDayIndex] || { date: 'Day', items: [] }
      const items = Array.isArray(targetDay.items) ? [...targetDay.items] : []
      const toAdd = { id: candidate.id, title: candidate.title || candidate.name || candidate.airline || 'Item' }
      items.push(toAdd)
      const nextDay = { ...targetDay, items }
      const nextDays = [...days]
      nextDays[safeDayIndex] = nextDay
      return { ...plan, days: nextDays }
    })
  }

  function handleDragStart(e, dayIndex, itemIndex) {
    setDraggedItem({ dayIndex, itemIndex })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
  }

  function handleDragOver(e, dayIndex, itemIndex) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverItem({ dayIndex, itemIndex })
  }

  function handleDragLeave(e) {
    setDragOverItem(null)
  }

  function handleDrop(e, targetDayIndex, targetItemIndex) {
    e.preventDefault()
    
    if (!draggedItem || !Array.isArray(plans)) return
    
    const { dayIndex: sourceDayIndex, itemIndex: sourceItemIndex } = draggedItem
    
    // Don't do anything if dropping on the same position
    if (sourceDayIndex === targetDayIndex && sourceItemIndex === targetItemIndex) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }
    
    const idx = plans.findIndex((p, i) => (p.id || String(i)) === expandedId)
    if (idx < 0) return
    
    updatePlanAt(idx, (plan) => {
      const days = Array.isArray(plan.days) ? plan.days.map((d) => ({ ...d })) : []
      
      // Get the source item
      const sourceDay = days[sourceDayIndex]
      if (!sourceDay || !Array.isArray(sourceDay.items)) return plan
      
      const sourceItem = sourceDay.items[sourceItemIndex]
      if (!sourceItem) return plan
      
      // Remove from source
      const newSourceItems = [...sourceDay.items]
      newSourceItems.splice(sourceItemIndex, 1)
      
      // Add to target
      const targetDay = days[targetDayIndex]
      if (!targetDay) return plan
      
      const newTargetItems = Array.isArray(targetDay.items) ? [...targetDay.items] : []
      
      // If moving within the same day, adjust target index if needed
      let adjustedTargetIndex = targetItemIndex
      if (sourceDayIndex === targetDayIndex && sourceItemIndex < targetItemIndex) {
        adjustedTargetIndex = targetItemIndex - 1
      }
      
      newTargetItems.splice(adjustedTargetIndex, 0, sourceItem)
      
      // Update days
      const newDays = [...days]
      newDays[sourceDayIndex] = { ...sourceDay, items: newSourceItems }
      newDays[targetDayIndex] = { ...targetDay, items: newTargetItems }
      
      return { ...plan, days: newDays }
    })
    
    setDraggedItem(null)
    setDragOverItem(null)
  }

  async function refinePlanWithChat() {
    if (!Array.isArray(plans) || !expandedId || !chatInput?.trim()) return
    const idx = plans.findIndex((p, i) => (p.id || String(i)) === expandedId)
    if (idx < 0) return
    const plan = plans[idx]
    setChatStatus('running')
    try {
      // limit to first 20 each, only titles
      const top = (arr) => (Array.isArray(arr) ? arr.slice(0, 20) : [])
      const toTitles = (arr) => top(arr).map(i => ({ id: i.id, title: i.title || i.name || i.airline || 'Item' }))
      const cFlightsOut = toTitles(tripFlightsOut)
      const cFlightsRet = toTitles(tripFlightsRet)
      const cRestaurants = toTitles(legacyRestaurants)
      const cHousing = toTitles(legacyHousing)
      const cEvents = toTitles(legacyEvents)
      const cAttractions = toTitles(legacyAttractions)
      const prompt = `You are refining a travel plan based on a user request.\n\nUSER PROMPT:\n${chatInput.trim().slice(0, 2000)}\n\nCURRENT PLAN (JSON):\n${JSON.stringify(plan).slice(0, 9000)}\n\nAVAILABLE CANDIDATES (titles only, choose from these where relevant):\nOutbound Flights: ${cFlightsOut.map(i=>i.title).join(', ').slice(0, 2000)}\nReturn Flights: ${cFlightsRet.map(i=>i.title).join(', ').slice(0, 2000)}\nRestaurants: ${cRestaurants.map(i=>i.title).join(', ').slice(0, 2000)}\nHousing: ${cHousing.map(i=>i.title).join(', ').slice(0, 2000)}\nEvents: ${cEvents.map(i=>i.title).join(', ').slice(0, 2000)}\nAttractions: ${cAttractions.map(i=>i.title).join(', ').slice(0, 2000)}\n\nTASK:\nReturn a SINGLE refined plan as STRICT JSON only: { plan: { id: string, title: string, summary: string, days: Array<{ date: string, items: Array<{ id: string, title?: string, price?: number }> }> } }\n- Use ONLY candidate items by id/title when adding/replacing items.\n- Maintain trip dates from the current plan unless the request explicitly changes them.\n- Reasonable pricing estimates in USD when not present.\n- Keep titles concise.`
      const payload = { provider: 'openai', model: 'gpt-4o-mini', max_tokens: 10000, temperature: 0.3, system_prompt: 'Return strict JSON only. No prose.', prompt }
      const resp = await miyagiAPI.post('generate-text', payload)
      if (!resp.success || !resp.text) {
        throw new Error(resp.error || 'AI generation failed')
      }
      const raw = resp.text
      try { setChatRaw(raw) } catch {}
      let parsed = null
      try { parsed = JSON.parse(raw) } catch {}
      if (!parsed) {
        const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
        if (first !== -1 && last > first) { try { parsed = JSON.parse(raw.slice(first, last+1)) } catch {} }
      }
      let newPlan = parsed && parsed.plan ? parsed.plan : null
      if (!newPlan && parsed && Array.isArray(parsed.plans) && parsed.plans.length > 0) { newPlan = parsed.plans[0] }
      if (!newPlan) throw new Error('no-plan')
      updatePlanAt(idx, () => newPlan)
      try { setChatInput('') } catch {}
      setChatStatus('ok')
      try { setTimeout(() => { try { setChatStatus('idle') } catch {} }, 2500) } catch {}
    } catch (e) {
      setChatStatus('error')
    }
  }

  // Streaming simulation for professional loading experience
  const simulateStreamingProcess = async () => {
    const steps = [
      { text: 'Analyzing flight options...', duration: 3500, progress: 8 },
      { text: 'Evaluating accommodation choices...', duration: 4200, progress: 16 },
      { text: 'Curating restaurant recommendations...', duration: 3800, progress: 24 },
      { text: 'Selecting top attractions...', duration: 3600, progress: 32 },
      { text: 'Checking local events...', duration: 3400, progress: 40 },
      { text: 'Optimizing itinerary schedules...', duration: 4200, progress: 48 },
      { text: 'Cross-referencing pricing data...', duration: 3800, progress: 56 },
      { text: 'Validating availability...', duration: 3600, progress: 64 },
      { text: 'Generating personalized recommendations...', duration: 4200, progress: 72 },
      { text: 'Balancing budget constraints...', duration: 3800, progress: 80 },
      { text: 'Optimizing travel routes...', duration: 3600, progress: 88 },
      { text: 'Finalizing travel plans...', duration: 4200, progress: 96 },
      { text: 'Preparing final recommendations...', duration: 1800, progress: 100 }
    ]

    for (const step of steps) {
      // Check if component is still mounted
      if (!streamingRef.current) break
      
      setStreamingStatus(step.text)
      setStreamingProgress(step.progress)
      await new Promise(resolve => setTimeout(resolve, step.duration))
    }
  }

  async function generatePlans() {
    if (!query?.city) return
    setPlanGenStatus('running')
    setPlanGenError(null)
    setStreamingStatus('')
    setStreamingProgress(0)
    
    try {
      // Start streaming simulation
      const streamingPromise = simulateStreamingProcess()
      const limitedFlightsOut = Array.isArray(tripFlightsOut) ? tripFlightsOut.slice(0, 3) : []
      const limitedFlightsRet = Array.isArray(tripFlightsRet) ? tripFlightsRet.slice(0, 3) : []
      const restaurantsSource = Array.isArray(legacyRestaurants) ? legacyRestaurants : []
      const housingSource = Array.isArray(legacyHousing) ? legacyHousing : []
      const attractionsSource = Array.isArray(legacyAttractions) ? legacyAttractions : []
      const eventsSource = Array.isArray(legacyEvents) ? legacyEvents : []
      const limitedRestaurants = Array.isArray(restaurantsSource) ? restaurantsSource.slice(0, 10) : []
      const limitedHousing = Array.isArray(housingSource) ? housingSource.slice(0, 10) : []
      const limitedAttractions = Array.isArray(attractionsSource) ? attractionsSource.slice(0, 10) : []
      const limitedEvents = Array.isArray(eventsSource) ? eventsSource.slice(0, 10) : []
      const candidates = {
        flightsOutbound: limitedFlightsOut.map(i => ({ id: i.id, title: i.title || i.airline || 'Flight', price: i.price ?? null })),
        flightsReturn: limitedFlightsRet.map(i => ({ id: i.id, title: i.title || i.airline || 'Flight', price: i.price ?? null })),
        restaurants: limitedRestaurants.map(i => ({ id: i.id, title: i.title || i.name || 'Restaurant' })),
        housing: limitedHousing.map(i => ({ id: i.id, title: i.title || 'Accommodation', price: i.price ?? null })),
        events: limitedEvents.map(i => ({ id: i.id, title: i.title || 'Event' })),
        attractions: limitedAttractions.map(i => ({ id: i.id, title: i.title || 'Attraction' })),
      }
      const payload = {
        prompt: `Plan a trip to ${query.city} from ${query.fromISO} to ${query.toISO}. Create EXACTLY 3 plans for different tastes.\n\nUSER NOTES / PREFERENCES:\n${(tripDescription || '(none)').slice(0, 2000)}\n\nRULES:\n- Use ONLY items from the candidate lists (match by id).\n- Do NOT invent new items or a different city.\n- Prefer placing an outbound flight on the first day and a return flight on the last day when present.\n- Choose ONE accommodation from the housing candidates for each plan; include it explicitly (e.g., add to Day 1 as "Check-in" and reference it in subsequent days as needed).\n- Include an estimated price per item:\n  * If the item is a flight and a price is provided, use that price as-is.\n  * Otherwise estimate a reasonable price in ${'USD'} for that city/date range.\n- Keep titles concise.\n\nCANDIDATES:\n${JSON.stringify(candidates).slice(0,7000)}\n\nReturn STRICT JSON ONLY with schema: {\n  "plans": Array<{\n    "id": string,\n    "title": string,\n    "summary": string,\n    "days": Array<{\n      "date": string,\n      "items": Array<{ "id": string, "title"?: string, "price"?: number }>\n    }>\n  }>{\n}`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 15000,
        temperature: 0.4,
        system_prompt: 'You are a strict JSON generator. Always return valid JSON only.'
      }
      try { } catch {}
      // Wait for both streaming simulation and AI call to complete
      const [streamingResult, apiResp] = await Promise.all([streamingPromise, miyagiAPI.post('generate-text', payload)])
      
      if (!apiResp.success || !apiResp.text) {
        throw new Error(apiResp.error || 'AI generation failed')
      }
      
      // If AI finished faster than streaming, auto-complete the progress bar
      if (streamingRef.current) {
        setStreamingStatus('Finalizing travel plans...')
        setStreamingProgress(100)
        // Give a brief moment to show the completion
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      const asString = apiResp.text
      try { console.log('[plans] raw-response', asString) } catch {}
      try { setPlansRaw(asString) } catch {}
      let parsed
      try { parsed = JSON.parse(asString) } catch { parsed = null }
      if (!parsed) {
        const fence = asString.match(/```json[\s\S]*?```/i) || asString.match(/```[\s\S]*?```/)
        if (fence) {
          const inner = fence[0].replace(/```json|```/g, '').trim()
          try { parsed = JSON.parse(inner) } catch {}
        }
      }
      if (!parsed) {
        const first = asString.indexOf('{'); const last = asString.lastIndexOf('}')
        if (first !== -1 && last > first) {
          const inner = asString.slice(first, last + 1)
          try { parsed = JSON.parse(inner) } catch {}
        }
      }
      const next = parsed && Array.isArray(parsed.plans) ? parsed.plans : []
      if (next.length === 0) { setPlanGenStatus('error'); setPlanGenError('LLM returned no plans. See raw.'); return }
      setPlans(next)
      // Clear chosen plan when generating new plans
      setChosenPlan(null)
      // Clear expanded/selected state
      setExpandedId(null)
      // Precompute pricing from per-item prices if provided
      try {
        const adults = Math.max(1, Math.min(9, Number(query?.adults || 1)))
        const nextPricing = { ...(pricing || {}) }
        next.forEach((p) => {
          const key = p.id || 'plan'
          const sum = (p.days || []).flatMap(d => d.items || []).reduce((acc, it) => {
            if (typeof it?.price !== 'number') return acc;
            
            // Check if it's a hotel item - if so, calculate total cost
            const isHotel = it?.title?.toLowerCase().includes('check-in') || it?.title?.toLowerCase().includes('hotel') || it?.title?.toLowerCase().includes('accommodation');
            if (isHotel && query?.fromISO && query?.toISO) {
              const nights = Math.ceil((new Date(query.toISO).getTime() - new Date(query.fromISO).getTime()) / (1000 * 60 * 60 * 24));
              return acc + (it.price * nights);
            } else {
              // For non-hotels, use the price as-is
              return acc + it.price;
            }
          }, 0)
          if (sum > 0) nextPricing[key] = { status: 'ok', currency: 'USD', total: sum, perPerson: Math.round((sum / adults) * 100) / 100 }
        })
        setPricing(nextPricing)
      } catch {}
      setPlanGenStatus('ok')
      } catch (e) {
      setPlanGenStatus('error')
      setPlanGenError('Failed to generate plans. See console for raw response.')
    } finally {
      setStreamingStatus('')
      setStreamingProgress(0)
    }
  }

  async function estimatePrice(plan) {
    if (!plan) return
    const key = plan.id || 'plan'
    setPricing({ ...(pricing || {}), [key]: { status: 'running' } })
    try {
      const limitedFlightsOut = Array.isArray(tripFlightsOut) ? tripFlightsOut.slice(0, 3) : []
      const limitedFlightsRet = Array.isArray(tripFlightsRet) ? tripFlightsRet.slice(0, 3) : []
      const limitedRestaurants = Array.isArray(tripRestaurants) ? tripRestaurants.slice(0, 10) : []
      const limitedHousing = Array.isArray(legacyHousing) ? legacyHousing.slice(0, 10) : []
      const limitedEvents = Array.isArray(tripEvents) ? tripEvents.slice(0, 10) : []
      const limitedAttractions = Array.isArray(tripAttractions) ? tripAttractions.slice(0, 10) : []
      const adults = Math.max(1, Math.min(9, Number(query?.adults || 1)))
      const payload = {
        prompt: `Estimate the total trip cost and per-person cost for the following plan in ${query?.city}. Prefer flight prices provided; estimate reasonable costs for events/attractions/restaurants/housing when missing. Return JSON only.\n\nPlan: ${JSON.stringify(plan).slice(0,5000)}\nFlights outbound (<=3): ${JSON.stringify(limitedFlightsOut).slice(0,4000)}\nFlights return (<=3): ${JSON.stringify(limitedFlightsRet).slice(0,4000)}\nRestaurants (<=10): ${JSON.stringify(limitedRestaurants).slice(0,4000)}\nAccommodations (<=10): ${JSON.stringify(limitedHousing).slice(0,4000)}\nEvents (<=10): ${JSON.stringify(limitedEvents).slice(0,4000)}\nAttractions (<=10): ${JSON.stringify(limitedAttractions).slice(0,4000)}\nAdults: ${adults}\nDates: ${query?.fromISO} to ${query?.toISO}\n\nSchema: { pricing: { currency: string, total: number, perPerson: number, breakdown?: Array<{ label: string, amount: number }> } }`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 1000000,
        temperature: 0.2,
        system_prompt: 'Return strict JSON only. No prose.'
      }
      const resp = await miyagiAPI.post('generate-text', payload)
      if (!resp.success || !resp.text) {
        throw new Error(resp.error || 'pricing-failed')
      }
      const raw = resp.text
      let parsed = null
      try { parsed = JSON.parse(raw) } catch {}
      if (!parsed) {
        const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
        if (first !== -1 && last > first) { try { parsed = JSON.parse(raw.slice(first, last+1)) } catch {} }
      }
      const pricingObj = parsed && parsed.pricing ? parsed.pricing : null
      if (!pricingObj) throw new Error('no-pricing')
      setPricing({ ...(pricing || {}), [key]: { status: 'ok', ...pricingObj } })
    } catch (e) {
      setPricing({ ...(pricing || {}), [key]: { status: 'error' } })
    }
  }

  // No activity list or filters; widget focuses only on AI plan generation

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', background: '#0b1020' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', maxWidth: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 16, boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 700 }}>AI Plans</div>
            <button onClick={generatePlans} disabled={planGenStatus === 'running'} style={{ padding: '6px 10px', borderRadius: 8, background: '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: 'pointer' }}>
              {planGenStatus === 'running' ? 'Generating…' : (plans && plans.length > 0 ? 'Regenerate' : 'Generate Plans')}
            </button>
          </div>
          {planGenError ? <div style={{ marginTop: 6, color: '#fda4af' }}>{planGenError}</div> : null}
          {planGenStatus === 'running' ? (
            <div style={{ marginTop: 12, padding: 16, background: '#0b1220', border: '1px solid #1f2937', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, border: '2px solid #1f2937', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div style={{ color: '#e2e8f0', fontSize: 14 }}>{streamingStatus || 'Generating travel plans...'}</div>
              </div>
              <div style={{ width: '100%', height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ 
                  width: `${streamingProgress}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', 
                  transition: 'width 0.3s ease',
                  borderRadius: 2
                }}></div>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>{streamingProgress}%</div>
            </div>
          ) : null}
          {Array.isArray(plans) && plans.length > 0 ? (
            <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
              <div style={{ width: 340, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plans.map((p, idx) => {
                  const isSelected = !!(chosenPlan && chosenPlan.id === p.id)
                  const key = p.id || String(idx)
                  const isExpanded = expandedId === key
                  const price = pricing && pricing[key]
                  return (
                    <div key={key} style={{ border: '1px solid #1f2937', borderRadius: 12, background: '#0b1220', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{p.title || `Plan ${idx+1}`}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleSelectPlan(p, key)} style={{ padding: '6px 10px', borderRadius: 8, background: isSelected ? '#1e293b' : '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: 'pointer' }}>{isSelected ? 'Selected' : 'Select'}</button>
                        </div>
                      </div>
                      {price?.status === 'ok' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#86efac' }}>{price.currency || 'USD'}</span>
                          <span style={{ color: '#e2e8f0' }}>Total: {typeof price.total === 'number' ? price.total.toLocaleString() : price.total}</span>
                        </div>
                      ) : (price?.status === 'error' ? <div style={{ color: '#fda4af' }}>Failed to estimate price</div> : null)}
                      {p.summary ? <div style={{ color: '#94a3b8', fontSize: 14 }}>{p.summary}</div> : null}
                      <div>
                        <button onClick={() => estimatePrice(p)} disabled={price?.status === 'running'} style={{ padding: '6px 10px', borderRadius: 8, background: '#0b4f20', border: '1px solid #14532d', color: '#d1fae5', cursor: 'pointer' }}>{price?.status === 'running' ? 'Estimating…' : (price?.status === 'ok' ? 'Recalculate' : 'Estimate Price')}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ flex: 1, minWidth: 0, border: '1px solid #1f2937', borderRadius: 12, background: '#0b1220', padding: 12 }}>
                {(() => {
                  const idx = Array.isArray(plans) ? plans.findIndex((p, i) => (p.id || String(i)) === expandedId) : -1
                  const plan = idx >= 0 ? plans[idx] : null
                  if (!plan) return <div style={{ color: '#94a3b8' }}>Select a plan on the left to view details</div>
                  const price = pricing && pricing[plan.id || String(idx)]
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{plan.title || 'Plan'}</div>
                        {price?.status === 'ok' ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#86efac' }}>{price.currency || 'USD'}</span>
                            <span style={{ color: '#e2e8f0' }}>Total: {typeof price.total === 'number' ? price.total.toLocaleString() : price.total}</span>
                            <span style={{ color: '#94a3b8' }}>Per Person: {typeof price.perPerson === 'number' ? price.perPerson.toLocaleString() : price.perPerson}</span>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => setShowCatalog(!showCatalog)} style={{ padding: '6px 10px', borderRadius: 8, background: '#111827', border: '1px solid #1f2937', color: '#e2e8f0', cursor: 'pointer' }}>{showCatalog ? 'Hide Catalog' : 'Show Catalog'}</button>
                      </div>
                      {plan.summary ? <div style={{ color: '#94a3b8', fontSize: 14 }}>{plan.summary}</div> : null}
                      <div style={{ borderTop: '1px solid #1f2937', paddingTop: 8, display: 'grid', gap: 8, maxHeight: 420, overflow: 'auto' }}>
                        {(plan.days || []).map((d, didx) => (
                          <div key={d.date || didx} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 10, background: '#0f172a' }}>
                            <div style={{ color: '#c0d5ff', marginBottom: 6 }}>{d.date}</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                              {(d.items || []).map((it, iidx) => {
                                const isDragged = draggedItem?.dayIndex === didx && draggedItem?.itemIndex === iidx
                                const isDragOver = dragOverItem?.dayIndex === didx && dragOverItem?.itemIndex === iidx
                                
                                return (
                                  <div 
                                    key={iidx} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, didx, iidx)}
                                    onDragOver={(e) => handleDragOver(e, didx, iidx)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, didx, iidx)}
                                    style={{ 
                                      border: isDragOver ? '2px solid #06b6d4' : '1px solid #1f2937', 
                                      borderRadius: 6, 
                                      padding: '6px 8px', 
                                      background: isDragged ? '#1e293b' : '#0b1220', 
                                      color: '#e2e8f0', 
                                      fontSize: 14, 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center', 
                                      gap: 8,
                                      cursor: 'grab',
                                      opacity: isDragged ? 0.5 : 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ 
                                        color: '#6b7280', 
                                        fontSize: 12, 
                                        cursor: 'grab',
                                        userSelect: 'none'
                                      }}>
                                        ⋮⋮
                                      </div>
                                      <span>{it?.title || it?.id || `Item ${iidx+1}`}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      {typeof it?.price === 'number' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                          {(() => {
                                            // Check if it's a hotel item
                                            const isHotel = it?.title?.toLowerCase().includes('check-in') || it?.title?.toLowerCase().includes('hotel') || it?.title?.toLowerCase().includes('accommodation')
                                            
                                            if (isHotel && query?.fromISO && query?.toISO) {
                                              // For hotels: show total cost as main price, per-night as secondary
                                              const nights = Math.ceil((new Date(query.toISO).getTime() - new Date(query.fromISO).getTime()) / (1000 * 60 * 60 * 24))
                                              const totalCost = it.price * nights
                                              return (
                                                <>
                                                  <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#fbbf24', fontSize: 12 }}>
                                                    ${totalCost.toLocaleString()}
                                                  </span>
                                                  {nights > 1 && (
                                                    <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#86efac', fontSize: 11 }}>
                                                      ${it.price.toLocaleString()}/night ({nights} nights)
                                                    </span>
                                                  )}
                                                </>
                                              )
                                            } else {
                                              // For non-hotels: show price without /night
                                              return (
                                                <span style={{ padding: '2px 6px', borderRadius: 999, background: '#0b1220', border: '1px solid #1f2937', color: '#86efac', fontSize: 12 }}>
                                                  ${it.price.toLocaleString()}
                                                </span>
                                              )
                                            }
                                          })()}
                                        </div>
                                      ) : null}
                                      <button onClick={() => handleRemoveItem(didx, iidx)} style={{ padding: '4px 8px', borderRadius: 6, background: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', cursor: 'pointer' }}>Remove</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {showCatalog ? (
                <div style={{ width: 320, minWidth: 280, border: '1px solid #1f2937', borderRadius: 12, background: '#0b1220', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#e2e8f0' }}>Catalog</div>
                    <input value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Search" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #1f2937', background: '#0f172a', color: '#e2e8f0' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['all','flightsOutbound','flightsReturn','restaurants','housing','attractions'].map(t => (
                      <button key={t} onClick={() => setCatalogTab(t)} style={{ padding: '4px 8px', borderRadius: 999, background: catalogTab === t ? '#1e293b' : '#111827', border: '1px solid #1f2937', color: '#e2e8f0', cursor: 'pointer' }}>{t}</button>
                    ))}
                  </div>
                  {(() => {
                    const sections = []
                    const filterByQuery = (arr) => (Array.isArray(arr) ? arr.filter((x) => {
                      const t = (x.title || x.name || x.airline || x.id || '').toLowerCase()
                      return !catalogQuery || t.includes(String(catalogQuery).toLowerCase())
                    }) : [])
                    const addSection = (label, key, arr) => {
                      if (catalogTab !== 'all' && catalogTab !== key) return
                      const items = filterByQuery(arr)
                      if (items.length === 0) return
                      sections.push([
                        label,
                        items.map((c, i) => (
                          <div key={`${key}-${c.id || i}`} style={{ border: '1px solid #1f2937', borderRadius: 8, padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#e2e8f0' }}>{c.title || c.name || c.airline || c.id}</span>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <select id={`day-${key}-${i}`} style={{ padding: '4px 6px', borderRadius: 6, background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }}>
                                {(() => {
                                  const idx = Array.isArray(plans) ? plans.findIndex((p, ii) => (p.id || String(ii)) === expandedId) : -1
                                  const plan = idx >= 0 ? plans[idx] : null
                                  const days = plan && Array.isArray(plan.days) ? plan.days : []
                                  return days.map((d, didx) => (
                                    <option key={d.date || didx} value={didx}>{d.date || `Day ${didx+1}`}</option>
                                  ))
                                })()}
                              </select>
                              <button onClick={() => {
                                const sel = document.getElementById(`day-${key}-${i}`)
                                const val = sel && Number((sel).value)
                                handleAddItem(c, isNaN(val) ? 0 : val)
                              }} style={{ padding: '4px 8px', borderRadius: 6, background: '#0b4f20', border: '1px solid #14532d', color: '#d1fae5', cursor: 'pointer' }}>Add</button>
                            </div>
                          </div>
                        ))
                      ])
                    }
                    addSection('Outbound Flights', 'flightsOutbound', tripFlightsOut)
                    addSection('Return Flights', 'flightsReturn', tripFlightsRet)
                    addSection('Restaurants', 'restaurants', legacyRestaurants)
                    addSection('Housing', 'housing', legacyHousing)
                    addSection('Attractions', 'attractions', legacyAttractions)
                    return (
                      <div style={{ display: 'grid', gap: 10, maxHeight: 460, overflow: 'auto' }}>
                        {sections.map(([label, content], i) => (
                          <div key={i}>
                            <div style={{ color: '#93c5fd', marginBottom: 6 }}>{label}</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                              {content}
                            </div>
                          </div>
                        ))}
                        {sections.length === 0 ? <div style={{ color: '#94a3b8' }}>No items match</div> : null}
                      </div>
                    )
                  })()}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 6, color: '#94a3b8' }}>Generate 3 plans based on flights, accommodations, events, attractions, and restaurants.</div>
          )}
          <div style={{ marginTop: 12, borderTop: '1px solid #1f2937', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Refine the selected plan... (e.g., add one more museum day, swap dinner to tapas near Gothic Quarter)" style={{ flex: 1, minHeight: 64, padding: 10, borderRadius: 8, background: '#0b1220', border: '1px solid #1f2937', color: '#e2e8f0', resize: 'vertical' }} />
              <button onClick={refinePlanWithChat} disabled={chatStatus === 'running' || !expandedId || !chatInput?.trim()} style={{ padding: '10px 14px', borderRadius: 8, background: '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: chatStatus === 'running' ? 'default' : 'pointer' }}>{chatStatus === 'running' ? 'Refining…' : 'Refine Plan'}</button>
            </div>
            {chatStatus !== 'idle' ? (
              <div style={{ marginTop: 6 }}>
                {chatStatus === 'running' ? (
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: '#111827', border: '1px solid #1f2937', color: '#93c5fd' }}>Working…</span>
                ) : chatStatus === 'ok' ? (
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: '#0b4f20', border: '1px solid #14532d', color: '#d1fae5' }}>Completed</span>
                ) : chatStatus === 'error' ? (
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca' }}>Failed to refine</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {/* Selected plan details intentionally not rendered */}
      </div>
    </div>
  )
}

export default ActivitySelector


