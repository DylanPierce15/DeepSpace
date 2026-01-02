import React, { useMemo, useState, useEffect } from 'react'

function TravelWeatherAnalysis() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [chosenPlan] = useGlobalStorage('chosen.plan', null)
  const [analysis, setAnalysis] = useGlobalStorage('travel.weather.analysis', null)
  const [status, setStatus] = useGlobalStorage('travel.weather.status', 'idle')
  const [showDetails, setShowDetails] = useStorage('weather.showDetails', false)
  const [weatherData, setWeatherData] = useStorage('weather.forecast', null)

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

  const analyzeWeather = async () => {
    if (!hasItinerary) return
    
    setStatus('running')
    setAnalysis(null)
    setWeatherData(null)
    
    try {
      // Step 1: Get weather forecast
      const weatherResp = await miyagiAPI.post('weather-forecast', { 
        location: query.city,
        units: 'metric'
      })
      
      setWeatherData(weatherResp)
      
      // Step 2: Build analysis prompt with plan details
      const planSummary = chosenPlan.days.map(day => {
        const items = (day.items || []).map(it => {
          const title = it?.title || ''
          const description = it?.description || ''
          return description ? `${title} (${description})` : title
        }).filter(Boolean).join(', ')
        return `${day.date}: ${items}`
      }).join('\n')

      // Extract relevant weather info
      const forecastSummary = weatherResp.list?.slice(0, 8).map(item => {
        const date = new Date(item.dt * 1000).toISOString().split('T')[0]
        const temp = Math.round(item.main.temp)
        const weather = item.weather[0]?.main || 'Unknown'
        const desc = item.weather[0]?.description || ''
        const wind = Math.round(item.wind?.speed || 0)
        const rain = item.rain?.['3h'] || 0
        return `${date}: ${temp}°C, ${weather} (${desc}), Wind: ${wind}m/s, Rain: ${rain}mm`
      }).join('\n') || 'No forecast data available'

      const analysisPrompt = `You are a travel weather advisor. Analyze the weather conditions for this travel plan and provide a verdict.

TRAVEL PLAN:
Destination: ${query.city}
Dates: ${dateRange}

Activities:
${planSummary}

WEATHER FORECAST:
${forecastSummary}

INSTRUCTIONS:
1. Analyze if the weather conditions match the planned activities
2. Identify any potential weather-related concerns or issues
3. Provide a simple verdict: "Perfect", "Good", "Concerning", or "Bad"
4. Give a brief explanation (2-3 sentences max)
5. Provide 1-2 specific recommendations

Format your response EXACTLY as:
VERDICT: [Perfect/Good/Concerning/Bad]
SUMMARY: [Brief 2-3 sentence explanation]
RECOMMENDATIONS: [1-2 specific tips]`

      // Step 3: Get AI analysis
      const aiResp = await miyagiAPI.post('generate-text', { 
        prompt: analysisPrompt,
        model: 'gpt-4o-mini',
        max_tokens: 500,
        temperature: 0.3
      })
      
      // Parse the response - generate-text returns { success, text, ... }
      if (!aiResp.success || !aiResp.text) {
        throw new Error(aiResp.error || 'AI analysis failed')
      }
      const text = aiResp.text
      const verdictMatch = text.match(/VERDICT:\s*(Perfect|Good|Concerning|Bad)/i)
      const summaryMatch = text.match(/SUMMARY:\s*([^\n]+(?:\n[^\n]+)*?)(?=\nRECOMMENDATIONS:|$)/i)
      const recommendationsMatch = text.match(/RECOMMENDATIONS:\s*([^\n]+(?:\n[^\n]+)*?)$/i)
      
      const verdict = verdictMatch ? verdictMatch[1] : 'Unknown'
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Analysis unavailable'
      const recommendations = recommendationsMatch ? recommendationsMatch[1].trim() : 'No specific recommendations'
      
      setAnalysis({
        verdict,
        summary,
        recommendations,
        rawAnalysis: text,
        timestamp: new Date().toISOString()
      })
      setStatus('ok')
      
    } catch (e) {
      console.error('Weather analysis error:', e)
      setStatus('error')
    }
  }

  const getVerdictEmoji = (verdict) => {
    switch (verdict?.toLowerCase()) {
      case 'perfect': return '✅'
      case 'good': return '👍'
      case 'concerning': return '⚠️'
      case 'bad': return '❌'
      default: return '❓'
    }
  }

  const getVerdictColor = (verdict) => {
    switch (verdict?.toLowerCase()) {
      case 'perfect': return '#10b981'
      case 'good': return '#3b82f6'
      case 'concerning': return '#f59e0b'
      case 'bad': return '#ef4444'
      default: return '#6b7280'
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#0b1020', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 940, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 16 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🌦️ Weather Analysis</div>
          <div style={{ flex: 1 }} />
          <button 
            onClick={analyzeWeather} 
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
            {status === 'running' ? '🔄 Analyzing...' : '🔍 Analyze Weather'}
          </button>
          {analysis && (
            <button 
              onClick={() => setShowDetails(!showDetails)} 
              style={{ 
                padding: '8px 12px', 
                borderRadius: 8, 
                background: '#111827', 
                border: '1px solid #1f2937', 
                color: '#e2e8f0', 
                cursor: 'pointer' 
              }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>

        {!hasItinerary ? (
          <div style={{ padding: 20, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Itinerary Yet</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              Create an itinerary first using the "Travel Planner" widget, then come back here to analyze the weather!
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>📍 Analyzing: {cityLabel}</div>
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              {dateRange && <div>📅 {dateRange}</div>}
              {chosenPlan?.days && (
                <div style={{ marginTop: 4 }}>
                  🎯 {chosenPlan.days.length} days planned
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: 16, background: '#7f1d1d', color: '#fecaca', border: '1px solid #dc2626', borderRadius: 10, marginBottom: 16 }}>
            ❌ Analysis failed. Please try again.
          </div>
        )}

        {analysis && (
          <div>
            {/* Verdict Card */}
            <div style={{ 
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
              borderRadius: 12, 
              padding: 24, 
              marginBottom: 16,
              border: `2px solid ${getVerdictColor(analysis.verdict)}`,
              boxShadow: `0 4px 20px ${getVerdictColor(analysis.verdict)}40`
            }}>
              <div style={{ 
                fontSize: 48, 
                textAlign: 'center', 
                marginBottom: 12 
              }}>
                {getVerdictEmoji(analysis.verdict)}
              </div>
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                textAlign: 'center',
                color: getVerdictColor(analysis.verdict),
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: 16
              }}>
                {analysis.verdict} Weather
              </div>
              <div style={{ 
                fontSize: 15, 
                lineHeight: 1.7, 
                color: '#cbd5e1',
                textAlign: 'center'
              }}>
                {analysis.summary}
              </div>
            </div>

            {/* Recommendations */}
            <div style={{ 
              background: '#1e293b', 
              border: '1px solid #334155', 
              borderRadius: 10, 
              padding: 16,
              marginBottom: 16
            }}>
              <div style={{ 
                fontSize: 16, 
                fontWeight: 600, 
                marginBottom: 12,
                color: '#60a5fa'
              }}>
                💡 Recommendations
              </div>
              <div style={{ 
                fontSize: 14, 
                lineHeight: 1.7, 
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap'
              }}>
                {analysis.recommendations}
              </div>
            </div>

            {/* Weather Details (collapsible) */}
            {showDetails && weatherData && weatherData.list && (
              <div style={{ 
                background: '#1e293b', 
                border: '1px solid #334155', 
                borderRadius: 10, 
                padding: 16
              }}>
                <div style={{ 
                  fontSize: 16, 
                  fontWeight: 600, 
                  marginBottom: 12,
                  color: '#93c5fd'
                }}>
                  📊 Forecast Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {weatherData.list.slice(0, 8).map((item, idx) => {
                    const date = new Date(item.dt * 1000)
                    const dateStr = date.toLocaleDateString()
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    const temp = Math.round(item.main.temp)
                    const feelsLike = Math.round(item.main.feels_like)
                    const weather = item.weather[0]
                    const wind = Math.round(item.wind?.speed || 0)
                    const rain = item.rain?.['3h'] || 0

                    return (
                      <div 
                        key={idx}
                        style={{
                          padding: 12,
                          background: '#0f172a',
                          border: '1px solid #1f2937',
                          borderRadius: 8
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>
                            {dateStr} {timeStr}
                          </div>
                          <div style={{ fontSize: 20 }}>
                            {temp}°C
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: '#94a3b8' }}>
                          <div>🌡️ Feels like: {feelsLike}°C</div>
                          <div>☁️ {weather?.main} - {weather?.description}</div>
                          <div>💨 Wind: {wind} m/s</div>
                          {rain > 0 && <div>🌧️ Rain: {rain} mm</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {analysis.timestamp && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1f2937', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                Last analyzed: {new Date(analysis.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TravelWeatherAnalysis
