import React, { useMemo, useState } from 'react'

// HTML renderer component for structured content
function HTMLRenderer({ content }) {
  return (
    <div 
      style={{ 
        fontSize: 15, 
        lineHeight: 1.7, 
        color: '#0f172a',
        maxWidth: '100%',
        overflow: 'hidden'
      }}
      dangerouslySetInnerHTML={{ 
        __html: `
          <style>
            h1 { font-size: 24px; font-weight: 700; margin: 0 0 24px 0; color: #0f172a; border-bottom: 3px solid #0e7490; padding-bottom: 12px; }
            h2 { font-size: 20px; font-weight: 700; margin: 32px 0 16px 0; color: #0f172a; border-bottom: 2px solid #0e7490; padding-bottom: 8px; }
            h3 { font-size: 18px; font-weight: 600; margin: 24px 0 12px 0; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            p { margin: 0 0 16px 0; line-height: 1.6; color: #374151; font-size: 15px; }
            ul { margin: 0 0 20px 0; padding-left: 24px; line-height: 1.7; }
            li { margin: 0 0 12px 0; color: #374151; font-size: 15px; }
            strong { font-weight: 600; color: #0f172a; }
            a { color: #0e7490; text-decoration: none; border-bottom: 1px solid #0e7490; }
            a:hover { color: #0c5a6b; border-bottom-color: #0c5a6b; }
            * { box-sizing: border-box; }
          </style>
          ${content}
        `
      }}
    />
  )
}

function TravelActivitiesFinder() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [chosenPlan] = useGlobalStorage('chosen.plan', null)
  const [tripDescription] = useGlobalStorage('itinerary.description', '')
  const [activities, setActivities] = useGlobalStorage('travel.activities', null)
  const [status, setStatus] = useGlobalStorage('travel.activities.status', 'idle')
  const [showRaw, setShowRaw] = useStorage('activities.showRaw', false)
  const [rawResponse, setRawResponse] = useStorage('activities.rawResponse', '')
  const [searchPrompt, setSearchPrompt] = useStorage('activities.searchPrompt', '')
  const [systemStatus, setSystemStatus] = useGlobalStorage('system.status', { loading: null, error: null })

  // Force reset to idle on every mount to prevent stuck "running" state
  React.useEffect(() => {
    setStatus('idle')
  }, [])

  // Note: System status clearing is now handled by the Travel Planner widget
  // This allows other widgets to respond to the loading state properly

  const hasItinerary = useMemo(() => {
    return query?.city && chosenPlan && Array.isArray(chosenPlan.days)
  }, [query, chosenPlan])

  const cityLabel = useMemo(() => {
    if (!query?.city) return 'your destination'
    return query.city
  }, [query])

  const dateRange = useMemo(() => {
    if (!query?.fromISO || !query?.toISO) return ''
    return `${query.fromISO} to ${query.toISO}`
  }, [query])

  const buildSearchQuery = () => {
    if (!hasItinerary) return ''
    
    const city = query.city
    const dates = dateRange
    const description = tripDescription || 'a vacation'
    
    // Build a summary of planned activities
    const planSummary = chosenPlan.days.map(day => {
      const items = (day.items || []).map(it => it?.title || '').filter(Boolean).join(', ')
      return `${day.date}: ${items}`
    }).join('\n')

    const searchQuery = `I'm planning ${description} in ${city} from ${dates}. Here's my current itinerary:

${planSummary}

Please search the web for the coolest, most interesting, and best activities, experiences, and things to do in ${city} during this time period. Focus on:
1. Unique local experiences that match the vibe of my current plan
2. Hidden gems and local favorites (not just tourist traps)
3. Current events, festivals, or special happenings during ${dates}
4. Activities that complement what's already in my itinerary
5. Practical tips like best times to visit, reservations needed, etc.

Return a comprehensive list with specific recommendations, why they're great, and any practical details (hours, booking, prices if available).`

    return searchQuery
  }

  // Use miyagiAPI for proper authentication instead of manual fetch

  const searchActivities = async () => {
    if (!hasItinerary) return
    
    setStatus('running')
    setActivities(null)
    setRawResponse('')
    
    try {
      const searchQuery = buildSearchQuery()
      setSearchPrompt(searchQuery)
      
      // Use the new search-web-ai endpoint instead of generate-text
      const payload = { 
        searchPrompt: `cool activities and things to do in ${query.city} during ${dateRange} for ${tripDescription || 'a vacation'}`,
        queryHints: ['local experiences', 'hidden gems', 'current events', 'festivals'],
        count: 8,
        aiPrompt: `Based on the search results, create a comprehensive guide to the coolest activities and experiences in ${query.city} during ${dateRange}. 

Trip Context: ${tripDescription || 'a vacation'}

Focus on:
1. Unique local experiences that match the vibe of this trip: ${tripDescription || 'a vacation'}
2. Hidden gems and local favorites (not just tourist traps)
3. Current events, festivals, or special happenings during ${dateRange}
4. Activities that complement the planned itinerary
5. Practical tips like best times to visit, reservations needed, etc.

Return your response as clean, well-structured HTML with proper semantic tags. Use <h2> for main sections, <h3> for subsections, <ul> and <li> for lists, <p> for paragraphs, and <strong> for emphasis. Do not use markdown syntax, do not include \\n characters, and do not use line breaks. Format everything as proper HTML tags. Include specific details and practical information.`,
        provider: 'openai',
        model: 'gpt-4o-mini', 
        max_tokens: 16000, 
        temperature: 0.7
      }
      
      console.log('🔍 Debug: About to call miyagiAPI with search-web-ai payload:', payload)
      console.log('🔍 Debug: miyagiAPI function available:', typeof miyagiAPI)
      const result = await miyagiAPI.post('search-web-ai', payload)
      console.log('🔍 Debug: search-web-ai call successful, response:', result)
      
      // Extract AI response and sources from the result
      const aiResponse = result.aiResponse || ''
      const sources = result.sources || []
      
      // Clean the response - remove markdown code fences, quotes, and normalize spacing
      let cleanedText = aiResponse.trim()
      
      // Extract content from HTML document structure if present
      if (cleanedText.includes('<!DOCTYPE html>') || cleanedText.includes('<html')) {
        // Extract content between <body> and </body> tags
        const bodyMatch = cleanedText.match(/<body[^>]*>(.*?)<\/body>/s)
        if (bodyMatch) {
          cleanedText = bodyMatch[1]
        } else {
          // If no body tags, try to extract content after <html> tag
          const htmlMatch = cleanedText.match(/<html[^>]*>(.*?)<\/html>/s)
          if (htmlMatch) {
            cleanedText = htmlMatch[1]
          }
        }
      }
      
      cleanedText = cleanedText
        .replace(/^```json\\n/, '').replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\\n```$/, '').replace(/\s*```$/, '')
        .replace(/^```html\s*/, '').replace(/^```html\\n/, '') // Remove html code fence
        .replace(/^["']|["']$/g, '') // Remove quotes at start and end
        .replace(/\\n/g, '') // Remove literal \n characters
        .replace(/\n/g, '') // Remove actual newlines
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/>\s+</g, '><') // Remove spaces between HTML tags
        .replace(/^html\s+/i, '') // Remove standalone "html" at the beginning
        .replace(/\s+html\s+/i, ' ') // Remove standalone "html" in the middle
        .trim()
      
      // Convert sources to citations format
      const citations = sources.map(source => ({
        title: source.title,
        url: source.url,
        snippet: source.snippet || source.extractedText
      }))
      
      setRawResponse(JSON.stringify({ result }, null, 2))
      
      // Store activities with parsed data
      setActivities({ 
        text: cleanedText, 
        citations,
        timestamp: new Date().toISOString() 
      })
      setStatus('ok')
      
    } catch (e) {
      console.error('Activities search error:', e)
      
      // Fallback: try the regular web-search API if search-web-ai fails
      if (e.message?.includes('search-failed') || e.message?.includes('timed out')) {
        console.log('Trying fallback web-search API...')
        try {
          const fallbackResp = await fetch('/api/web-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: `Best activities and things to do in ${query?.city || 'Barcelona'} during ${dateRange || 'December 2025'}`,
              count: 5
            })
          })
          
          if (fallbackResp.ok) {
            const fallbackData = await fallbackResp.json()
            const fallbackText = fallbackData.results?.map(r => 
              `**${r.title}**\n${r.description}\n[Read more](${r.url})`
            ).join('\n\n') || 'No results found'
            
            setActivities({
              text: `# Activities in ${query?.city || 'Barcelona'}\n\n${fallbackText}`,
              citations: fallbackData.results?.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.description
              })) || [],
              timestamp: new Date().toISOString()
            })
            setStatus('ok')
            return
          }
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError)
        }
      }
      
      setStatus('error')
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#0b1020', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 940, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 16 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🌟 Discover Cool Activities</div>
          <div style={{ flex: 1 }} />
          <button 
            onClick={searchActivities} 
            disabled={!hasItinerary || status === 'running'} 
            style={{ 
              padding: '8px 16px', 
              borderRadius: 8, 
              background: hasItinerary ? '#0e7490' : '#334155', 
              border: hasItinerary ? '1px solid #06b6d4' : '1px solid #475569', 
              color: hasItinerary ? '#e0f2fe' : '#94a3b8', 
              cursor: hasItinerary ? 'pointer' : 'not-allowed',
              fontWeight: 600
            }}
          >
            {status === 'running' ? '🔍 Searching...' : '🔍 Find Activities'}
          </button>
          {activities && (
            <button 
              onClick={() => setShowRaw(!showRaw)} 
              style={{ 
                padding: '8px 12px', 
                borderRadius: 8, 
                background: '#111827', 
                border: '1px solid #1f2937', 
                color: '#e2e8f0', 
                cursor: 'pointer' 
              }}
            >
              {showRaw ? 'Hide Raw' : 'Show Raw'}
            </button>
          )}
        </div>

        {!hasItinerary ? (
          <div style={{ padding: 20, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Itinerary Yet</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              Create an itinerary first using the "Travel Planner" widget, then come back here to discover amazing activities!
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>📍 Searching for: {cityLabel}</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              {dateRange && <div>📅 {dateRange}</div>}
              {tripDescription && <div style={{ marginTop: 4 }}>✨ {tripDescription}</div>}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 16, background: '#7f1d1d', color: '#fecaca', border: '1px solid #dc2626', borderRadius: 10, marginBottom: 16 }}>
            ❌ Search failed. Please try again.
          </div>
        )}

        {status === 'running' && (
          <div style={{ 
            padding: 24, 
            background: '#1e293b', 
            border: '1px solid #334155', 
            borderRadius: 12, 
            marginBottom: 16,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: 48, 
              marginBottom: 16,
              animation: 'pulse 2s infinite'
            }}>
              🔍
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 600, 
              marginBottom: 8,
              color: '#e2e8f0'
            }}>
              Searching for Amazing Activities...
            </div>
            <div style={{ 
              color: '#94a3b8', 
              fontSize: 14,
              marginBottom: 16
            }}>
              Finding the coolest experiences in {cityLabel} for your {tripDescription || 'vacation'}
            </div>
            <div style={{
              width: '100%',
              height: 4,
              background: '#334155',
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #0e7490, #06b6d4, #0e7490)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite linear',
                borderRadius: 2
              }} />
            </div>
            <style jsx>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            `}</style>
          </div>
        )}

        {activities && (
          <div style={{ 
            background: '#ffffff', 
            color: '#0f172a', 
            borderRadius: 12, 
            padding: 24,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              marginBottom: 20, 
              color: '#0e7490',
              borderBottom: '2px solid #0e7490',
              paddingBottom: 12
            }}>
              🎯 Recommended Activities & Experiences
            </div>
            <div style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              paddingRight: 8
            }}>
              <HTMLRenderer content={activities.text} />
            </div>
            
            {activities.citations && activities.citations.length > 0 && (
              <div style={{ 
                marginTop: 24, 
                paddingTop: 20, 
                borderTop: '2px solid #e5e7eb' 
              }}>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 600, 
                  marginBottom: 16, 
                  color: '#374151',
                  borderBottom: '1px solid #d1d5db',
                  paddingBottom: 8
                }}>
                  📚 Sources & Citations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activities.citations.map((citation, idx) => (
                    <a
                      key={idx}
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: 10,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        textDecoration: 'none',
                        color: '#0e7490',
                        fontSize: 13,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0f2fe'
                        e.currentTarget.style.borderColor = '#06b6d4'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {citation.title || citation.url}
                      </div>
                      {citation.snippet && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {citation.snippet}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {activities.timestamp && (
              <div style={{ 
                marginTop: 20, 
                paddingTop: 16, 
                borderTop: '1px solid #e5e7eb', 
                fontSize: 12, 
                color: '#6b7280',
                textAlign: 'right'
              }}>
                Last updated: {new Date(activities.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {showRaw && rawResponse && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#93c5fd' }}>Search Query:</div>
            <pre style={{ 
              maxHeight: 200, 
              overflow: 'auto', 
              background: '#0b1220', 
              border: '1px solid #1f2937', 
              borderRadius: 8, 
              padding: 10, 
              color: '#e2e8f0', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: 13,
              marginBottom: 16
            }}>
              {searchPrompt}
            </pre>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#93c5fd' }}>Raw Response:</div>
            <pre style={{ 
              maxHeight: 300, 
              overflow: 'auto', 
              background: '#0b1220', 
              border: '1px solid #1f2937', 
              borderRadius: 8, 
              padding: 10, 
              color: '#93c5fd', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: 13
            }}>
              {rawResponse}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default TravelActivitiesFinder


