import React, { useState, useEffect } from 'react';

function WowRotationStats() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [guideData, setGuideData] = useState(null);
  
  // Read from global storage to sync with search widget
  const [playerData] = useGlobalStorage('wowPlayerSearch', null);

  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  // Fetch guide data when playerData changes
  useEffect(() => {
    if (playerData && playerData.class && playerData.spec) {
      fetchGuideData();
    }
  }, [playerData]);

  // Determine role based on spec name
  const getSpecRole = (specName) => {
    const healerSpecs = ['Holy', 'Discipline', 'Restoration', 'Mistweaver', 'Preservation'];
    const tankSpecs = ['Blood', 'Protection', 'Guardian', 'Brewmaster', 'Vengeance'];
    
    if (healerSpecs.includes(specName)) return 'healer';
    if (tankSpecs.includes(specName)) return 'tank';
    return 'dps';
  };

  const fetchGuideData = async () => {
    if (!playerData || !playerData.class || !playerData.spec) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const role = getSpecRole(playerData.spec);
      const roleLabel = role === 'dps' ? 'DPS' : role === 'healer' ? 'Healer' : 'Tank';
      
      // Build search queries for Wowhead guides
      const statQuery = `wowhead ${playerData.spec} ${playerData.class} stat priority ${roleLabel} guide`;
      const rotationQuery = `wowhead ${playerData.spec} ${playerData.class} rotation ${roleLabel} guide`;
      
      // Search for both guides in parallel
      let overviewResponse, rotationResponse;
      try {
        [overviewResponse, rotationResponse] = await Promise.all([
          miyagiAPI.post('search-web-raw', {
            searchPrompt: statQuery,
            count: 3
          }),
          miyagiAPI.post('search-web-raw', {
            searchPrompt: rotationQuery,
            count: 3
          })
        ]);
      } catch (apiError) {
        console.error('API call failed:', apiError);
        throw new Error(`Search API failed: ${apiError.message}`);
      }

      // autoRoutes wraps responses in { success, data: { sources, query } }
      const overviewSources = overviewResponse?.data?.sources || overviewResponse?.sources || [];
      const rotationSources = rotationResponse?.data?.sources || rotationResponse?.sources || [];

      // Check if we got any results
      const hasOverviewData = overviewSources.length > 0;
      const hasRotationData = rotationSources.length > 0;

      if (!hasOverviewData && !hasRotationData) {
        setError(`No guide data found for ${playerData.spec} ${playerData.class}. Try searching manually on Wowhead.`);
        return;
      }
        
      // Combine extracted text from all sources for better coverage
      const overviewContent = hasOverviewData 
        ? overviewSources
            .map(s => s.extractedText || s.snippet || '')
            .join('\n\n')
            .substring(0, 15000)
        : '';
      const rotationContent = hasRotationData
        ? rotationSources
            .map(s => s.extractedText || s.snippet || '')
            .join('\n\n')
            .substring(0, 15000)
        : '';

      if (overviewContent.length < 100 && rotationContent.length < 100) {
        setError('Could not extract enough guide content. The pages may be loading dynamically.');
        return;
      }

      const aiResponse = await miyagiAPI.post('generate-text', {
        prompt: `You are analyzing World of Warcraft class guides for ${playerData.spec} ${playerData.class}. Extract rotation and stat priority information.

${overviewContent.length > 100 ? `STAT PRIORITY / OVERVIEW CONTENT:
${overviewContent.substring(0, 12000)}` : '(No overview content available)'}

${rotationContent.length > 100 ? `ROTATION CONTENT:
${rotationContent.substring(0, 12000)}` : '(No rotation content available)'}

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "summary": "A clear 2-3 sentence overview of the ${playerData.spec} ${playerData.class} playstyle and strengths",
  "rotation": [
    "Priority 1: Most important ability or opener",
    "Priority 2: Core rotation ability",
    "Priority 3: Secondary abilities",
    "Priority 4: Filler/maintenance abilities"
  ],
  "stats": [
    "Stat Priority: (e.g., Crit > Mastery > Haste > Versatility)"
  ]
}

IMPORTANT:
- Extract the stat priority order (look for > symbols or ordered lists)
- List 3-6 rotation priorities based on what abilities are mentioned
- If data is missing, provide reasonable defaults based on typical ${playerData.spec} ${playerData.class} gameplay
- Always return valid JSON`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.3
      });
      
      // autoRoutes wraps response in { success, data: { text, ... } }
      const aiText = aiResponse?.data?.text || aiResponse?.text || aiResponse;
        
      // Parse the AI response
      try {
        if (aiResponse?.error || aiResponse?.data?.error) {
          const errMsg = aiResponse?.error || aiResponse?.data?.error;
          throw new Error(errMsg);
        }
        if (!aiText || (typeof aiText === 'string' && aiText.length === 0)) {
          throw new Error('AI returned empty response');
        }
          
        // Clean up the response in case it has markdown code blocks
        let cleanedResponse = (typeof aiText === 'string' ? aiText : JSON.stringify(aiText)).trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }
          
        const parsed = JSON.parse(cleanedResponse);
        setGuideData(parsed);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        // Fallback to showing raw response
        const fallbackText = aiResponse?.data?.text || aiResponse?.text || (typeof aiText === 'string' ? aiText : '');
        setGuideData({
          summary: (typeof fallbackText === 'string' ? fallbackText.substring(0, 500) : '') || 'Failed to parse AI response',
          rotation: ['Unable to parse guide data. Please try again.'],
          stats: []
        });
      }
    } catch (err) {
      console.error('Error fetching guide:', err);
      setError(err.message || 'Failed to fetch guide data');
    } finally {
      setLoading(false);
    }
  };


  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading...</div>;
  }

  if (!playerData || !playerData.class || !playerData.spec) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: '40px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}>
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-3">{'\u{1F4CB}'}</div>
          <p className="text-gray-500 text-sm">No class selected</p>
          <p className="text-gray-400 text-xs mt-1">Search for a class to see rotation & stats</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '40px',
      height: '100%',
      overflow: 'auto',
      background: '#fafafa'
    }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">Rotation & Stats</h1>
        <p className="text-sm text-gray-500">
          {playerData.class} {'\u{2022}'} {playerData.spec}
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-blue-600 text-sm font-medium">Loading guide data...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {!loading && guideData && (
        <div className="space-y-4">
          {/* Summary */}
          {guideData.summary && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Overview</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{guideData.summary}</p>
            </div>
          )}

          {/* Rotation */}
          {guideData.rotation && guideData.rotation.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Rotation Priority</h2>
              <div className="space-y-3">
                {guideData.rotation.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {guideData.stats && guideData.stats.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wide">Stat Priority</h2>
              <div className="space-y-3">
                {guideData.stats.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-1.5"></div>
                    <div className="flex-1 text-sm text-gray-700 leading-relaxed font-medium">
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!guideData.summary && (!guideData.rotation || guideData.rotation.length === 0) && (!guideData.stats || guideData.stats.length === 0) && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="text-gray-400 text-3xl mb-2">{'\u{1F4C4}'}</div>
              <p className="text-gray-500 text-sm">No guide data found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different class or spec</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WowRotationStats;
