import React, { useMemo, useState } from 'react'

function TravelPlanGenerator() {
  const [query] = useGlobalStorage('itinerary.query', null)
  const [chosenPlan] = useGlobalStorage('chosen.plan', null)
  const [pricing] = useGlobalStorage('trip.plan.pricing', {})
  // All options enabled by default - no checkboxes needed
  const includePrices = true
  const includeItemDetails = true
  const includeOverview = true
  const includeTransit = true
  const includeChecklist = true
  const includeActivityGuide = true
  const [pdfStatus, setPdfStatus] = useStorage('organizer.pdfStatus', 'idle')
  const [tips, setTips] = useGlobalStorage('itinerary.tips', null)
  const [tipsStatus, setTipsStatus] = useGlobalStorage('itinerary.tips.status', 'idle')
  const [tipsRaw, setTipsRaw] = useStorage('organizer.tipsRaw', '')
  const [tipsUpdatedAt, setTipsUpdatedAt] = useGlobalStorage('itinerary.tips.updatedAt', null)

  const tripLabel = useMemo(() => {
    const city = query?.city || 'Trip'
    const from = query?.fromISO || ''
    const to = query?.toISO || ''
    return `${city} ${from && to ? `(${from} → ${to})` : ''}`.trim()
  }, [query])

  const plan = chosenPlan || { title: 'Plan', days: [] }
  const priceForPlan = pricing && plan?.id ? pricing[plan.id] : null

  const getAuthToken = () => {
    // Check multiple sources for Clerk token
    if (typeof window !== 'undefined') {
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
    }
    
    return null
  }

  const fetchTips = async () => {
    if (!plan || !Array.isArray(plan.days)) return
    setTipsStatus('running')
    try { setTips(null); setTipsRaw('') } catch {}
    try {
      const prompt = `Given this trip plan JSON, produce:
1) Getting Around for ${query?.city}: 4-8 bullets about metro zones, passes, airport transfer, late-night options.
2) Must-know tips: 5-8 bullets about etiquette/safety.
3) City Overview: weather (typical), local SIM options, tipping norms, power plug type.
4) Transit Quick-Cards: airport transfer summary, metro map URL, recommended passes, late-night options.
5) Booking Checklist: per-day items that may require advance tickets with booking window, cancellation notes, and link if applicable.
6) Activity Guide: for each distinct item title in the plan, write a concise 5–10 sentence paragraph. Focus on practical, visit-ready details: what to see, best time of day, expected crowding, time-on-site, any ticket/ID rules, and accessibility notes. For flights/airports, skip airline marketing; provide actionable advice like recommended arrival time at the airport, security/immigration wait expectations, baggage connection tips, and transport to/from the airport. Use plain text.

CRITICAL: Return ONLY valid JSON. Do NOT wrap in markdown code blocks, do NOT add \`\`\`json or \`\`\` around the response. Return the raw JSON object directly.

Schema: {
  gettingAround: string[],
  tips: string[],
  overview: { weather?: string, sim?: string, tipping?: string, powerPlugs?: string },
  transit: { airportTransfer?: string, metroMapUrl?: string, passes?: string[], lateNight?: string[] },
  bookingChecklist: Array<{ date: string, items: Array<{ title: string, bookingWindow?: string, cancellation?: string, link?: string }> }>,
  activityGuide: Array<{ title: string, paragraph: string }>
}

Trip Plan: ${JSON.stringify(plan, null, 2)}`

      const response = await miyagiAPI.post('generate-text', { 
        prompt, 
        provider: 'openai', 
        model: 'gpt-4o-mini', 
        max_tokens: 16000 
      })
      
      if (!response.success || !response.data.text) {
        throw new Error(response.error || 'Failed to generate tips')
      }
      
      const aiResp = response.data.text
      setTipsRaw(aiResp)
      
      // Clean the response - remove markdown code fences if present
      let cleanedResponse = aiResp.trim()
      console.log('Original response:', aiResp.substring(0, 200))
      
      // Simple cleaning - just remove markdown code blocks if they exist
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      console.log('Cleaned response:', cleanedResponse.substring(0, 200))
      
      const parsed = JSON.parse(cleanedResponse)
      console.log('Parsed tips data:', parsed)
      setTips(parsed)
      setTipsUpdatedAt(new Date().toISOString())
      setTipsStatus('ok')
    } catch (e) {
      setTipsStatus('error')
    }
  }

  const handleDownloadPdf = async () => {
    try {
      setPdfStatus('running')
      
      // Use jsPDF directly for better React compatibility
      async function loadScript(src) {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = src
          script.async = true
          script.onload = () => {
            console.log('Script loaded successfully:', src)
            resolve()
          }
          script.onerror = (error) => {
            console.error('Script loading failed:', src, error)
            reject(error)
          }
          document.head.appendChild(script)
        })
      }
      
      if (!window.jsPDF) {
        console.log('Loading jsPDF library...')
        try {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
          console.log('Primary CDN loaded')
        } catch (error) {
          console.log('Primary CDN failed, trying alternative...')
          try {
            await loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js')
            console.log('Alternative CDN loaded')
          } catch (error2) {
            console.log('Alternative CDN failed, trying third option...')
            await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
            console.log('Third CDN loaded')
          }
        }
        console.log('jsPDF loaded, checking window.jsPDF:', !!window.jsPDF)
        console.log('window.jsPDF keys:', window.jsPDF ? Object.keys(window.jsPDF) : 'undefined')
      }

      console.log('Generating PDF with jsPDF...')
      console.log('window.jsPDF:', window.jsPDF)
      
      // Create new PDF document - try different approaches
      let doc
      if (window.jsPDF && window.jsPDF.jsPDF) {
        // UMD format
        doc = new window.jsPDF.jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })
      } else if (window.jsPDF) {
        // Direct format
        doc = new window.jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })
      } else {
        console.error('jsPDF not available, trying browser PDF fallback...')
        // Fallback: use browser's print to PDF
        const htmlContent = generateItineraryHTML(plan, tripLabel, priceForPlan, tips)
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${plan?.title || 'Travel Plan'}</title>
            <style>
              @media print {
                body { margin: 0; }
                @page { margin: 1in; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
          </html>
        `)
        printWindow.document.close()
        
        // Wait for content to load then trigger print dialog
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
          // Close the window after printing
          setTimeout(() => {
            printWindow.close()
          }, 1000)
        }, 500)
        
        setPdfStatus('ok')
        console.log('Browser PDF print dialog opened')
        return
      }
      
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      const contentWidth = pageWidth - (margin * 2)
      
      // Helper function to add text with word wrapping
      const addText = (text, fontSize = 12, fontWeight = 'normal', color = '#333333') => {
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', fontWeight)
        doc.setTextColor(color)
        
        const lines = doc.splitTextToSize(text, contentWidth)
        doc.text(lines, margin, yPosition)
        yPosition += lines.length * (fontSize * 0.35) + 5
      }
      
      // Helper function to add a line break
      const addLineBreak = (size = 10) => {
        yPosition += size
      }
      
      // Helper function to check if we need a new page
      const checkNewPage = () => {
        if (yPosition > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage()
          yPosition = 20
        }
      }
      
      // Cover page
      addText(plan?.title || 'Travel Plan', 24, 'bold', '#1a365d')
      addLineBreak(10)
      addText(tripLabel, 16, 'normal', '#2b6cb0')
      addLineBreak(20)
      
      if (priceForPlan?.status === 'ok') {
        addText('ESTIMATED COST', 12, 'bold', '#333333')
        addText(`Total: ${priceForPlan.currency} ${priceForPlan.total?.toLocaleString()}`, 14, 'bold', '#333333')
        addText(`Per Person: ${priceForPlan.currency} ${priceForPlan.perPerson?.toLocaleString()}`, 12, 'normal', '#333333')
        addLineBreak(30)
      }
      
      // Daily Itinerary
      addText('DAILY ITINERARY', 18, 'bold', '#1a365d')
      addLineBreak(15)
      
      if (plan?.days && Array.isArray(plan.days) && plan.days.length > 0) {
        plan.days.forEach((day, dayIndex) => {
          checkNewPage()
          addText(`Day ${dayIndex + 1}: ${day.date || 'TBD'}`, 14, 'bold', '#1a365d')
          addLineBreak(10)
          
          if (day.items && Array.isArray(day.items)) {
            day.items.forEach(item => {
              checkNewPage()
              if (item.time && item.time !== 'TBD') {
                addText(item.time, 11, 'bold', '#2d3748')
              }
              addText(item.title || 'Activity', 12, 'bold', '#1a365d')
              if (item.details) {
                addText(item.details, 10, 'normal', '#718096')
              }
              addLineBreak(8)
            })
          } else {
            addText('No activities planned for this day.', 10, 'normal', '#718096')
            addLineBreak(10)
          }
        })
      } else {
        addText('No itinerary available. Please generate a travel plan first.', 10, 'normal', '#718096')
      }
      
      // Tips sections
      if (tips) {
        addLineBreak(20)
        checkNewPage()
        
        if (tips.overview) {
          addText('CITY OVERVIEW', 16, 'bold', '#1a365d')
          addLineBreak(10)
          
          if (tips.overview.weather) {
            addText(`Weather: ${tips.overview.weather}`, 11, 'normal', '#2d3748')
            addLineBreak(5)
          }
          if (tips.overview.sim) {
            addText(`SIM Cards: ${tips.overview.sim}`, 11, 'normal', '#2d3748')
            addLineBreak(5)
          }
          if (tips.overview.tipping) {
            addText(`Tipping: ${tips.overview.tipping}`, 11, 'normal', '#2d3748')
            addLineBreak(5)
          }
          if (tips.overview.powerPlugs) {
            addText(`Power Plugs: ${tips.overview.powerPlugs}`, 11, 'normal', '#2d3748')
            addLineBreak(10)
          }
        }
        
        if (tips.gettingAround?.length > 0) {
          checkNewPage()
          addText('GETTING AROUND', 16, 'bold', '#1a365d')
          addLineBreak(10)
          tips.gettingAround.forEach(tip => {
            addText(`• ${tip}`, 11, 'normal', '#2d3748')
            addLineBreak(5)
          })
        }
        
        if (tips.tips?.length > 0) {
          checkNewPage()
          addText('ESSENTIAL TIPS', 16, 'bold', '#1a365d')
          addLineBreak(10)
          tips.tips.forEach(tip => {
            addText(`• ${tip}`, 11, 'normal', '#2d3748')
            addLineBreak(5)
          })
        }
      }
      
      // Save the PDF
      const filename = `${(plan?.title || 'plan').replace(/\s+/g, '_')}.pdf`
      doc.save(filename)
      
      setPdfStatus('ok')
      console.log('PDF generated successfully with jsPDF')
      
    } catch (e) {
      console.error('PDF generation error:', e)
      setPdfStatus('error')
    }
  }
  
  // Generate text content for fallback
  const generateTextContent = (plan, tripLabel, priceForPlan, tips) => {
    let content = `${plan?.title || 'Travel Plan'}\n`
    content += `${tripLabel}\n\n`
    
    if (priceForPlan?.status === 'ok') {
      content += `ESTIMATED COST\n`
      content += `Total: ${priceForPlan.currency} ${priceForPlan.total?.toLocaleString()}\n`
      content += `Per Person: ${priceForPlan.currency} ${priceForPlan.perPerson?.toLocaleString()}\n\n`
    }
    
    content += `DAILY ITINERARY\n`
    content += `${'='.repeat(50)}\n\n`
    
    if (plan?.days && Array.isArray(plan.days) && plan.days.length > 0) {
      plan.days.forEach((day, dayIndex) => {
        content += `Day ${dayIndex + 1}: ${day.date || 'TBD'}\n`
        content += `${'-'.repeat(30)}\n`
        
        if (day.items && Array.isArray(day.items)) {
          day.items.forEach(item => {
            if (item.time && item.time !== 'TBD') {
              content += `${item.time} - `
            }
            content += `${item.title || 'Activity'}\n`
            if (item.details) {
              content += `  ${item.details}\n`
            }
            content += `\n`
          })
        } else {
          content += `No activities planned for this day.\n\n`
        }
      })
    } else {
      content += `No itinerary available. Please generate a travel plan first.\n\n`
    }
    
    if (tips) {
      if (tips.overview) {
        content += `CITY OVERVIEW\n`
        content += `${'='.repeat(50)}\n`
        if (tips.overview.weather) content += `Weather: ${tips.overview.weather}\n`
        if (tips.overview.sim) content += `SIM Cards: ${tips.overview.sim}\n`
        if (tips.overview.tipping) content += `Tipping: ${tips.overview.tipping}\n`
        if (tips.overview.powerPlugs) content += `Power Plugs: ${tips.overview.powerPlugs}\n`
        content += `\n`
      }
      
      if (tips.gettingAround?.length > 0) {
        content += `GETTING AROUND\n`
        content += `${'='.repeat(50)}\n`
        tips.gettingAround.forEach(tip => {
          content += `• ${tip}\n`
        })
        content += `\n`
      }
      
      if (tips.tips?.length > 0) {
        content += `ESSENTIAL TIPS\n`
        content += `${'='.repeat(50)}\n`
        tips.tips.forEach(tip => {
          content += `• ${tip}\n`
        })
        content += `\n`
      }
    }
    
    return content
  }
  
  // Generate clean HTML template with McKinsey styling
  const generateItineraryHTML = (plan, tripLabel, priceForPlan, tips) => {
    return `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: white;">
        <!-- Cover Page -->
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 32px; font-weight: bold; color: #1a365d; margin-bottom: 16px;">${plan?.title || 'Travel Plan'}</h1>
          <p style="font-size: 18px; color: #2b6cb0; margin-bottom: 30px;">${tripLabel}</p>
          ${priceForPlan?.status === 'ok' ? `
            <div style="display: inline-block; background: #2b6cb0; color: white; padding: 20px 40px; border-radius: 8px;">
              <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">ESTIMATED COST</div>
              <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Total: ${priceForPlan.currency} ${priceForPlan.total?.toLocaleString()}</div>
              <div style="font-size: 14px;">Per Person: ${priceForPlan.currency} ${priceForPlan.perPerson?.toLocaleString()}</div>
            </div>
          ` : ''}
        </div>
        
        <!-- Daily Itinerary -->
        <div style="margin-bottom: 40px;">
          <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">DAILY ITINERARY</h2>
          ${plan?.days && Array.isArray(plan.days) && plan.days.length > 0 ? plan.days.map((day, dayIndex) => `
            <div style="margin-bottom: 30px;">
              <h3 style="font-size: 18px; font-weight: 600; color: #1a365d; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Day ${dayIndex + 1}: ${day.date || 'TBD'}</h3>
              ${day.items && Array.isArray(day.items) ? day.items.map(item => {
                const time = item.time && item.time !== 'TBD' ? item.time : null
                const title = item.title || 'Activity'
                const details = item.details || ''
                
                return `
                  <div style="margin: 16px 0; padding: 12px; border-left: 3px solid #2b6cb0; background: #f7fafc;">
                    ${time ? `<div style="font-weight: 600; color: #2d3748; margin-bottom: 4px;">${time}</div>` : ''}
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 8px;">${title}</div>
                    ${details ? `<div style="color: #718096; margin-bottom: 8px;">${details}</div>` : ''}
                    ${''}
                  </div>
                `
              }).join('') : '<p>No activities planned for this day.</p>'}
            </div>
          `).join('') : '<p>No itinerary available. Please generate a travel plan first.</p>'}
        </div>
        
        ${tips ? `
          <!-- City Overview & Transportation -->
          <div style="margin-bottom: 40px;">
            ${tips.overview ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">CITY OVERVIEW</h2>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 30px;">
                ${tips.overview.weather ? `
                  <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">Weather</div>
                    <div style="color: #2d3748; font-size: 14px;">${tips.overview.weather}</div>
                  </div>
                ` : ''}
                ${tips.overview.sim ? `
                  <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">SIM Cards</div>
                    <div style="color: #2d3748; font-size: 14px;">${tips.overview.sim}</div>
                  </div>
                ` : ''}
                ${tips.overview.tipping ? `
                  <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">Tipping</div>
                    <div style="color: #2d3748; font-size: 14px;">${tips.overview.tipping}</div>
                  </div>
                ` : ''}
                ${tips.overview.powerPlugs ? `
                  <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">Power Plugs</div>
                    <div style="color: #2d3748; font-size: 14px;">${tips.overview.powerPlugs}</div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            ${tips.gettingAround?.length > 0 ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">GETTING AROUND</h2>
              <ul style="margin: 16px 0; padding-left: 20px;">
                ${tips.gettingAround.map(tip => `<li style="margin: 8px 0;">${tip}</li>`).join('')}
              </ul>
            ` : ''}
            
            ${tips.transit ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">TRANSPORTATION GUIDE</h2>
              ${tips.transit.airportTransfer ? `
                <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
                  <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">Airport Transfer</div>
                  <div style="color: #2d3748; font-size: 14px;">${tips.transit.airportTransfer}</div>
                </div>
              ` : ''}
              ${tips.transit.metroMapUrl ? `
                <div style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;">
                  <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">Metro Map</div>
                  <div style="color: #2d3748; font-size: 14px;"><a href="${tips.transit.metroMapUrl}" style="color: #2b6cb0;">${tips.transit.metroMapUrl}</a></div>
                </div>
              ` : ''}
              ${tips.transit.passes?.length > 0 ? `
                <h3 style="margin: 20px 0 12px 0; color: #1a365d;">Recommended Passes:</h3>
                <ul style="padding-left: 20px;">
                  ${tips.transit.passes.map(pass => `<li style="margin: 8px 0;">${pass}</li>`).join('')}
                </ul>
              ` : ''}
              ${tips.transit.lateNight?.length > 0 ? `
                <h3 style="margin: 20px 0 12px 0; color: #1a365d;">Late Night Options:</h3>
                <ul style="padding-left: 20px;">
                  ${tips.transit.lateNight.map(option => `<li style="margin: 8px 0;">${option}</li>`).join('')}
                </ul>
              ` : ''}
            ` : ''}
          </div>
          
          <!-- Tips & Activity Guide -->
          <div>
            ${tips.tips?.length > 0 ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">ESSENTIAL TIPS</h2>
              <ul style="margin: 16px 0; padding-left: 20px;">
                ${tips.tips.map(tip => `<li style="margin: 8px 0;">${tip}</li>`).join('')}
              </ul>
            ` : ''}
            
            ${tips.activityGuide?.length > 0 ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">ACTIVITY GUIDE</h2>
              ${tips.activityGuide.map(activity => `
                <div style="margin: 20px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-weight: 600; color: #1a365d; margin-bottom: 8px;">${activity.title}</div>
                  <div style="color: #2d3748; line-height: 1.7;">${activity.paragraph}</div>
                </div>
              `).join('')}
            ` : ''}
            
            ${tips.bookingChecklist?.length > 0 ? `
              <h2 style="font-size: 24px; font-weight: bold; color: #1a365d; margin-bottom: 20px; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px;">BOOKING CHECKLIST</h2>
              ${tips.bookingChecklist.map(day => `
                <h3 style="margin: 20px 0 12px 0; color: #1a365d;">${day.date}</h3>
                ${day.items.map(item => `
                  <div style="margin: 12px 0; padding: 12px; background: #f7fafc; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1a365d; margin-bottom: 4px;">${item.title}</div>
                    ${item.bookingWindow ? `<div style="color: #718096; font-size: 14px; margin: 2px 0;">Booking Window: ${item.bookingWindow}</div>` : ''}
                    ${item.cancellation ? `<div style="color: #718096; font-size: 14px; margin: 2px 0;">Cancellation: ${item.cancellation}</div>` : ''}
                    ${item.link ? `<div style="color: #718096; font-size: 14px; margin: 2px 0;">Link: <a href="${item.link}" style="color: #2b6cb0;">${item.link}</a></div>` : ''}
                  </div>
                `).join('')}
              `).join('')}
            ` : ''}
          </div>
        ` : ''}
      </div>
    `
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#0b1020', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 940, background: '#0f172a', color: '#e2e8f0', border: '1px solid #1f2937', borderRadius: 12, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontSize: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Travel Plan Generator</div>
          <div style={{ flex: 1 }} />
          <button onClick={fetchTips} disabled={tipsStatus === 'running'} style={{ padding: '8px 12px', borderRadius: 8, background: '#0b4f20', border: '1px solid #14532d', color: '#d1fae5', cursor: 'pointer' }}>
            {tipsStatus === 'running' ? 'Generating…' : (tipsStatus === 'ok' ? 'Generate Full Plan' : 'Generate PDF')}
          </button>
          <button onClick={handleDownloadPdf} disabled={pdfStatus === 'running' || tipsStatus !== 'ok'} style={{ padding: '8px 12px', borderRadius: 8, background: '#1e40af', border: '1px solid #2563eb', color: 'white', cursor: 'pointer', opacity: tipsStatus !== 'ok' ? 0.5 : 1 }}>
            {pdfStatus === 'running' ? 'Downloading…' : 'Download PDF Plan'}
          </button>
        </div>

        {/* Plan Summary */}
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{plan?.title || 'Plan'}</div>
              <div style={{ color: '#94a3b8' }}>{tripLabel}</div>
            </div>
            {priceForPlan?.status === 'ok' ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{priceForPlan.currency} {priceForPlan.total?.toLocaleString()}</div>
                <div style={{ color: '#94a3b8' }}>Per Person: {priceForPlan.currency} {priceForPlan.perPerson?.toLocaleString()}</div>
              </div>
            ) : null}
          </div>
          <div style={{ color: '#94a3b8' }}>Generated itinerary summary and logistics inside.</div>
        </div>

        {/* Daily Schedule */}
        {plan?.days && Array.isArray(plan.days) && plan.days.length > 0 ? (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, borderBottom: '2px solid #334155', paddingBottom: 8 }}>Daily Schedule</div>
            {plan.days.map((day, dayIndex) => (
              <div key={dayIndex} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 12 }}>
                  Day {dayIndex + 1}: {day.date || 'TBD'}
                </div>
                {day.items && Array.isArray(day.items) && day.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {day.items.map((item, itemIndex) => (
                      <div key={itemIndex} style={{ background: '#334155', borderRadius: 6, padding: 12, borderLeft: '3px solid #3b82f6' }}>
                        {item.time && item.time !== 'TBD' ? (
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
                            {item.time}
                          </div>
                        ) : null}
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                          {item.title || 'Activity'}
                        </div>
                        {item.details ? (
                          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                            {item.details}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>No activities planned for this day.</div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Tips Content */}
        {console.log('Rendering tips:', { tips, tipsStatus, hasTips: !!tips, statusOk: tipsStatus === 'ok' })}
        {tips && tipsStatus === 'ok' ? (
                        <div>
            {/* Overview & Getting Around */}
            {tips.overview ? (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>City Overview</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {tips.overview.weather ? (
                    <div style={{ background: '#334155', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Weather</div>
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>{tips.overview.weather}</div>
                            </div>
                          ) : null}
                  {tips.overview.sim ? (
                    <div style={{ background: '#334155', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>SIM Cards</div>
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>{tips.overview.sim}</div>
                          </div>
                        ) : null}
                  {tips.overview.tipping ? (
                    <div style={{ background: '#334155', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Tipping</div>
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>{tips.overview.tipping}</div>
                </div>
              ) : null}
                  {tips.overview.powerPlugs ? (
                    <div style={{ background: '#334155', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Power Plugs</div>
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>{tips.overview.powerPlugs}</div>
                </div>
              ) : null}
                </div>
                </div>
              ) : null}

            {/* Getting Around */}
            {tips.gettingAround && Array.isArray(tips.gettingAround) && tips.gettingAround.length > 0 ? (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Getting Around</div>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {tips.gettingAround.map((tip, i) => (
                    <li key={i} style={{ marginBottom: 8, color: '#e2e8f0' }}>{tip}</li>
                  ))}
                  </ul>
                </div>
              ) : null}

            {/* Essential Tips */}
            {tips.tips && Array.isArray(tips.tips) && tips.tips.length > 0 ? (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Essential Tips</div>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {tips.tips.map((tip, i) => (
                    <li key={i} style={{ marginBottom: 8, color: '#e2e8f0' }}>{tip}</li>
                  ))}
                </ul>
                </div>
              ) : null}


            {/* Activity Guide */}
            {tips.activityGuide && Array.isArray(tips.activityGuide) && tips.activityGuide.length > 0 ? (
              <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Activity Guide</div>
                <div style={{ display: 'grid', gap: 12 }}>
                {tips.activityGuide.map((ag, i) => (
                    <div key={i} style={{ border: '1px solid #475569', borderRadius: 6, padding: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{ag.title}</div>
                      <div style={{ color: '#94a3b8', fontSize: 14 }}>{ag.paragraph}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  )
}

export default TravelPlanGenerator