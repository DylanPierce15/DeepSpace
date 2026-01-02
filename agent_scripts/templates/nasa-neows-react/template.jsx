import React, { useState, useEffect } from 'react';

function NearEarthObjectsWidget() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [neosData, setNeosData] = useState(null);
  const [allNeos, setAllNeos] = useState([]);
  const [expandedNeoId, setExpandedNeoId] = useState(null);
  const [neoContent, setNeoContent] = useState({}); // Store LLM-generated content per NEO ID

  // Set default dates on mount
  useEffect(() => {
    // Get current UTC date (not local date)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayUTCStr = todayUTC.toISOString().split('T')[0];
    
    // Add 7 days in UTC
    const sevenDaysLater = new Date(todayUTC);
    sevenDaysLater.setUTCDate(sevenDaysLater.getUTCDate() + 7);
    const sevenDaysLaterUTCStr = sevenDaysLater.toISOString().split('T')[0];
    
    if (!startDate) setStartDate(todayUTCStr);
    if (!endDate) setEndDate(sevenDaysLaterUTCStr);
  }, []);

  // Process NEOs data when it changes
  useEffect(() => {
    if (neosData && neosData.near_earth_objects) {
      // Flatten the date-based structure into a single array
      const flattened = [];
      Object.keys(neosData.near_earth_objects).forEach(date => {
        neosData.near_earth_objects[date].forEach(neo => {
          // Get the closest approach data for this date
          const approach = neo.close_approach_data?.find(
            ca => ca.close_approach_date === date
          ) || neo.close_approach_data?.[0];
          
          if (approach) {
            flattened.push({
              ...neo,
              approachDate: date,
              approach: approach
            });
          }
        });
      });
      
      // Sort by closest approach date
      flattened.sort((a, b) => {
        const dateA = new Date(a.approachDate);
        const dateB = new Date(b.approachDate);
        return dateA - dateB;
      });
      
      setAllNeos(flattened);
    }
  }, [neosData]);

  const fetchNeos = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await miyagiAPI.post('nasa-neows-feed', {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      if (response.success && response.data.neos) {
        setNeosData(response.data.neos);
      } else {
        setError(response.error || 'Failed to fetch near-Earth objects');
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on date change
  useEffect(() => {
    if (startDate && endDate) {
      fetchNeos();
    }
  }, [startDate, endDate]);

  // Generate LLM content for a NEO
  const generateNeoContent = async (neo) => {
    const neoId = neo.id || neo.neo_reference_id;
    if (neoContent[neoId]?.generating || neoContent[neoId]?.introduction) {
      return; // Already generating or already generated
    }

    // Mark as generating
    setNeoContent(prev => ({
      ...prev,
      [neoId]: { generating: true, introduction: null, funFact: null }
    }));

    try {
      const approach = neo.approach;
      const missLD = parseFloat(approach?.miss_distance?.lunar || 0);
      const missKm = parseFloat(approach?.miss_distance?.kilometers || 0);
      const minDiam = neo.estimated_diameter?.meters?.estimated_diameter_min || 0;
      const maxDiam = neo.estimated_diameter?.meters?.estimated_diameter_max || 0;
      const avgDiam = Math.round((minDiam + maxDiam) / 2);
      const speed = parseFloat(approach?.relative_velocity?.kilometers_per_second || 0);
      const name = neo.name || `NEO-${neo.id}`;
      const approachDate = neo.approachDate || approach?.close_approach_date || '';

      // Generate introduction (1-2 sentences)
      const introPrompt = `This is a near-Earth asteroid named "${name}" that will make its closest approach on ${approachDate}. 

Key facts:
- Distance at closest approach: ${missLD.toFixed(1)} lunar distances (${missKm.toLocaleString()} km)
- Estimated size: ${avgDiam} meters (range: ${Math.round(minDiam)}-${Math.round(maxDiam)} meters)
- Speed: ${speed.toFixed(1)} km/s
- Potentially hazardous: ${neo.is_potentially_hazardous_asteroid ? 'Yes' : 'No'}

Write 1-2 sentences that introduce this asteroid in a clear, informative way. Focus on what makes it notable (size, distance, speed, or hazard status). Keep it concise and factual.`;

      const introduction = await miyagiAPI.post('generate-text', {
        prompt: introPrompt,
        system_prompt: 'You are a science communicator who explains astronomical objects clearly and accessibly. Write concise, factual introductions.',
        max_tokens: 100,
        temperature: 0.7
      });

      // Generate fun fact (size/speed comparison)
      const funFactPrompt = `This near-Earth asteroid "${name}" has:
- Size: ${avgDiam} meters (range: ${Math.round(minDiam)}-${Math.round(maxDiam)} meters)
- Speed: ${speed.toFixed(1)} km/s

Create a fun, engaging comparison that helps people understand the size and/or speed in relatable terms. For example, compare the size to a building, sports field, or landmark. Compare the speed to familiar objects like jets, bullets, or cars. Make it vivid and memorable. Write 1-2 sentences.`;

      const funFact = await miyagiAPI.post('generate-text', {
        prompt: funFactPrompt,
        system_prompt: 'You are a creative science communicator who makes astronomical facts relatable through vivid comparisons. Write engaging, memorable comparisons.',
        max_tokens: 120,
        temperature: 0.8
      });

      // Clean up responses - API returns { success, text, ... }
      const cleanIntro = introduction?.success && introduction?.text 
        ? introduction.text.trim().replace(/^["']|["']$/g, '')
        : null;
      const cleanFunFact = funFact?.success && funFact?.text
        ? funFact.text.trim().replace(/^["']|["']$/g, '')
        : null;

      setNeoContent(prev => ({
        ...prev,
        [neoId]: {
          generating: false,
          introduction: cleanIntro,
          funFact: cleanFunFact
        }
      }));
    } catch (e) {
      console.error('Failed to generate NEO content:', e);
      setNeoContent(prev => ({
        ...prev,
        [neoId]: {
          generating: false,
          introduction: null,
          funFact: null,
          error: 'Failed to generate content'
        }
      }));
    }
  };

  // Handle dropdown toggle
  const toggleDropdown = (neo) => {
    const neoId = neo.id || neo.neo_reference_id;
    if (expandedNeoId === neoId) {
      setExpandedNeoId(null);
    } else {
      setExpandedNeoId(neoId);
      // Generate content if not already generated
      if (!neoContent[neoId]?.introduction) {
        generateNeoContent(neo);
      }
    }
  };

  // Calculate summary stats
  const getSummaryStats = () => {
    if (!allNeos || allNeos.length === 0) {
      return {
        closest: null,
        largest: null,
        fastest: null,
        hasHazardous: false
      };
    }

    // Find closest (minimum miss distance in lunar distances)
    const closest = allNeos.reduce((min, neo) => {
      const missLD = parseFloat(neo.approach?.miss_distance?.lunar || Infinity);
      const minMissLD = parseFloat(min.approach?.miss_distance?.lunar || Infinity);
      return missLD < minMissLD ? neo : min;
    }, allNeos[0]);

    // Find largest (maximum average diameter)
    const largest = allNeos.reduce((max, neo) => {
      const avgDiam = (neo.estimated_diameter?.meters?.estimated_diameter_min || 0) +
                      (neo.estimated_diameter?.meters?.estimated_diameter_max || 0);
      const maxAvgDiam = (max.estimated_diameter?.meters?.estimated_diameter_min || 0) +
                         (max.estimated_diameter?.meters?.estimated_diameter_max || 0);
      return avgDiam > maxAvgDiam ? neo : max;
    }, allNeos[0]);

    // Find fastest (maximum velocity in km/s)
    const fastest = allNeos.reduce((max, neo) => {
      const speed = parseFloat(neo.approach?.relative_velocity?.kilometers_per_second || 0);
      const maxSpeed = parseFloat(max.approach?.relative_velocity?.kilometers_per_second || 0);
      return speed > maxSpeed ? neo : max;
    }, allNeos[0]);

    // Check for hazardous objects
    const hasHazardous = allNeos.some(neo => neo.is_potentially_hazardous_asteroid === true);

    return { closest, largest, fastest, hasHazardous };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    return dateStr; // YYYY-MM-DD format
  };

  // Orbit Diagram Component
  const OrbitDiagram = ({ missLD, width = 160 }) => {
    // Clamp position: 0 LD -> left (0%), 1 LD -> right (100%), >1 LD -> pin to right
    const positionPercent = Math.min(100, (missLD / 1) * 100);
    const isOverOneLD = missLD > 1;
    
    return (
      <div style={{
        marginTop: '4px',
        width: `${width}px`,
        height: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        color: '#94a3b8' // slate-400
      }}>
        {/* Earth emoji */}
        <div style={{
          fontSize: '16px',
          flexShrink: 0,
          lineHeight: '1'
        }}>
          🌍
        </div>
        
        {/* Horizontal bar */}
        <div style={{
          flex: 1,
          height: '2px',
          borderRadius: '9999px',
          background: 'rgba(51, 65, 85, 0.8)', // slate-700/80
          position: 'relative'
        }}>
          {/* Asteroid dot */}
          <div style={{
            position: 'absolute',
            top: '-3px',
            left: `${Math.min(100, positionPercent)}%`,
            transform: 'translateX(-50%)',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#818cf8', // indigo-400
            boxShadow: '0 0 8px rgba(129, 140, 248, 0.9)',
            zIndex: 2
          }} />
          
          {/* Label for >1 LD */}
          {isOverOneLD && (
            <div style={{
              position: 'absolute',
              top: '-18px',
              right: '0',
              fontSize: '9px',
              color: '#64748b', // slate-500
              whiteSpace: 'nowrap'
            }}>
              +{missLD.toFixed(1)} LD
            </div>
          )}
        </div>
        
        {/* Moon emoji */}
        <div style={{
          fontSize: '16px',
          flexShrink: 0,
          lineHeight: '1'
        }}>
          🌕
        </div>
      </div>
    );
  };

  // Dropdown Detail Component
  const DropdownDetail = ({ neo }) => {
    const neoId = neo.id || neo.neo_reference_id;
    const approach = neo.approach;
    const missLD = parseFloat(approach?.miss_distance?.lunar || 0);
    const missKm = parseFloat(approach?.miss_distance?.kilometers || 0);
    const minDiam = neo.estimated_diameter?.meters?.estimated_diameter_min || 0;
    const maxDiam = neo.estimated_diameter?.meters?.estimated_diameter_max || 0;
    const avgDiam = Math.round((minDiam + maxDiam) / 2);
    const speed = parseFloat(approach?.relative_velocity?.kilometers_per_second || 0);
    const name = neo.name || `NEO-${neo.id}`;
    const approachDate = neo.approachDate || approach?.close_approach_date || '';
    const approachTime = approach?.close_approach_date_full || '';
    const content = neoContent[neoId] || {};

    return (
      <div style={{
        marginTop: '12px',
        padding: '16px',
        background: 'rgba(2, 6, 23, 0.8)', // slate-950/80
        border: '1px solid rgba(51, 65, 85, 0.8)', // slate-700/80
        borderRadius: '12px',
        borderTop: '2px solid rgba(129, 140, 248, 0.5)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: '#f8fafc' // slate-50
          }}>
            {name}
          </h3>
          <div style={{
            fontSize: '12px',
            color: '#94a3b8' // slate-400
          }}>
            Closest approach on {formatDateShort(approachDate)}
            {approachTime && ` at ${approachTime.split('T')[1]?.split('.')[0] || ''} UTC`}
          </div>
        </div>

        {/* Hero row */}
        <div style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {/* Left: Orbit diagram */}
          <div style={{ flex: '0 0 auto' }}>
            <OrbitDiagram missLD={missLD} width={220} />
            <div style={{
              marginTop: '8px',
              fontSize: '10px',
              color: '#64748b', // slate-500
              textAlign: 'center'
            }}>
              {missLD.toFixed(1)} LD from Earth
            </div>
          </div>

          {/* Right: Key metrics */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Distance</div>
                <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 500 }}>
                  {missLD.toFixed(1)} LD
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  (~{missKm.toLocaleString()} km)
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Size</div>
                <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 500 }}>
                  ~{avgDiam} m
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Range: {Math.round(minDiam)}–{Math.round(maxDiam)} m
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Speed</div>
                <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 500 }}>
                  {speed.toFixed(1)} km/s
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Status</div>
                {neo.is_potentially_hazardous_asteroid ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '9999px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    padding: '4px 8px',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 500
                  }}>
                    PHO
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '4px 8px',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 500
                  }}>
                    Safe pass
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Introduction */}
        {content.generating ? (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#87CEEB',
            fontStyle: 'italic'
          }}>
            Generating introduction...
          </div>
        ) : content.introduction ? (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#E0E0E0',
            lineHeight: 1.6
          }}>
            {content.introduction}
          </div>
        ) : content.error ? (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'rgba(255, 0, 0, 0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#FF6B6B'
          }}>
            {content.error}
          </div>
        ) : null}

        {/* Fun Fact */}
        {content.generating ? (
          <div style={{
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(30, 41, 59, 1)',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#87CEEB',
            fontStyle: 'italic'
          }}>
            Generating fun fact...
          </div>
        ) : content.funFact ? (
          <div style={{
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.8)', // slate-900/80
            border: '1px solid rgba(30, 41, 59, 1)', // slate-800
            borderRadius: '12px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#FFD700',
              marginBottom: '8px'
            }}>
              Fun fact
            </div>
            <div style={{
              fontSize: '12px',
              color: '#cbd5e1', // slate-300
              lineHeight: 1.6
            }}>
              {content.funFact}
            </div>
          </div>
        ) : null}

        {/* NASA JPL link */}
        {neo.nasa_jpl_url && (
          <div style={{
            marginTop: '16px',
            textAlign: 'right'
          }}>
            <a
              href={neo.nasa_jpl_url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '12px',
                color: '#818cf8', // indigo-400
                textDecoration: 'none'
              }}
            >
              View on NASA JPL →
            </a>
          </div>
        )}
      </div>
    );
  };

  const stats = getSummaryStats();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '20px',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)',
      color: '#E0E0E0',
      overflow: 'auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: 700,
          background: 'linear-gradient(45deg, #FFD700, #FFA500)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 15px rgba(255,215,0,0.8)'
        }}>
          🚀 NASA Near-Earth Objects In The Coming Week
        </h1>
        <p style={{
          margin: 0,
          color: '#87CEEB',
          fontSize: '14px',
          textShadow: '0 0 8px rgba(135,206,235,0.5)'
        }}>
          Monitor near-Earth asteroids approaching Earth
        </p>
      </div>

      <section style={{
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.7)', // slate-900/70
        border: '1px solid rgba(30, 41, 59, 1)', // slate-800
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Controls */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(138,43,226,0.5)',
          marginBottom: '16px',
          boxShadow: '0 0 20px rgba(138,43,226,0.3)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '13px',
              color: '#87CEEB'
            }}>
              Tracking the coming week automatically:
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(51, 65, 85, 1)',
              borderRadius: '10px',
              color: '#E0E0E0',
              fontSize: '15px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div><strong>Start:</strong> {startDate || '—'}</div>
              <div><strong>End:</strong> {endDate || '—'}</div>
            </div>
          </div>

          {/* Safety badge */}
          <div style={{ alignSelf: 'flex-start' }}>
            {stats.hasHazardous ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '9999px',
                background: 'rgba(245, 158, 11, 0.15)', // amber-500/15
                color: '#fcd34d', // amber-300
                border: '1px solid rgba(245, 158, 11, 0.4)', // amber-500/40
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 500
              }}>
                Monitoring
              </span>
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '9999px',
                background: 'rgba(16, 185, 129, 0.1)', // emerald-500/10
                color: '#6ee7b7', // emerald-300
                border: '1px solid rgba(16, 185, 129, 0.4)', // emerald-500/40
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 500
              }}>
                No impact threat
              </span>
            )}
          </div>
        </div>

        {/* Summary row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px'
        }}>
          {/* Closest pass card */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.6)', // slate-950/60
            border: '1px solid rgba(30, 41, 59, 1)', // slate-800
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94a3b8' // slate-400
            }}>
              Closest pass
            </div>
            {stats.closest ? (
              <>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#f8fafc' // slate-50
                }}>
                  {parseFloat(stats.closest.approach?.miss_distance?.lunar || 0).toFixed(1)} LD
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#94a3b8' // slate-400
                }}>
                  ≈ {parseFloat(stats.closest.approach?.miss_distance?.kilometers || 0).toLocaleString()} km
                </div>
              </>
            ) : (
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                fontStyle: 'italic'
              }}>
                No objects in range
              </div>
            )}
          </div>

          {/* Largest object card */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(30, 41, 59, 1)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94a3b8'
            }}>
              Largest object
            </div>
            {stats.largest ? (() => {
              const minDiam = stats.largest.estimated_diameter?.meters?.estimated_diameter_min || 0;
              const maxDiam = stats.largest.estimated_diameter?.meters?.estimated_diameter_max || 0;
              const avgDiam = Math.round((minDiam + maxDiam) / 2);
              return (
                <>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#f8fafc'
                  }}>
                    ~ {avgDiam} m
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>
                    Range: {Math.round(minDiam)}–{Math.round(maxDiam)} m
                  </div>
                </>
              );
            })() : (
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                fontStyle: 'italic'
              }}>
                No objects in range
              </div>
            )}
          </div>

          {/* Fastest speed card */}
          <div style={{
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(30, 41, 59, 1)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#94a3b8'
            }}>
              Fastest speed
            </div>
            {stats.fastest ? (() => {
              const speed = parseFloat(stats.fastest.approach?.relative_velocity?.kilometers_per_second || 0);
              const jetSpeed = 0.25; // km/s for a jet airliner
              const factor = Math.round(speed / jetSpeed);
              return (
                <>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#f8fafc'
                  }}>
                    {speed.toFixed(1)} km/s
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>
                    That's ~{factor}× a jet airliner
                  </div>
                </>
              );
            })() : (
              <div style={{
                fontSize: '14px',
                color: '#94a3b8',
                fontStyle: 'italic'
              }}>
                No objects in range
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          borderTop: '1px solid rgba(30, 41, 59, 0.8)', // slate-800/80
          paddingTop: '12px'
        }} />

        {/* Loading state */}
        {loading && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#87CEEB'
          }}>
            Loading near-Earth objects...
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            padding: '16px',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            borderRadius: '8px',
            color: '#FF6B6B'
          }}>
            Error: {error}
          </div>
        )}

        {/* Asteroid list */}
        {!loading && !error && (
          <div style={{
            flex: 1,
            minHeight: '200px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {allNeos.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#87CEEB',
                fontSize: '14px'
              }}>
                No near-Earth objects found for this period. Try another date range.
              </div>
            ) : (
              allNeos.map((neo, index) => {
                const neoId = neo.id || neo.neo_reference_id;
                const approach = neo.approach;
                const missLD = parseFloat(approach?.miss_distance?.lunar || 0);
                const minDiam = neo.estimated_diameter?.meters?.estimated_diameter_min || 0;
                const maxDiam = neo.estimated_diameter?.meters?.estimated_diameter_max || 0;
                const avgDiam = Math.round((minDiam + maxDiam) / 2);
                const speed = parseFloat(approach?.relative_velocity?.kilometers_per_second || 0);
                const name = neo.name || `NEO-${neo.id}`;
                const approachDate = neo.approachDate || approach?.close_approach_date || '';
                const isExpanded = expandedNeoId === neoId;

                return (
                  <div key={neo.id || index}>
                    <div
                      onClick={() => toggleDropdown(neo)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        borderRadius: '12px',
                        background: 'rgba(15, 23, 42, 0.7)', // slate-950/70
                        border: '1px solid rgba(30, 41, 59, 1)', // slate-800
                        padding: '10px 12px',
                        transition: 'border-color 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 1)'; // slate-600
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(30, 41, 59, 1)'; // slate-800
                      }}
                    >
                      {/* Icon badge */}
                      <div style={{
                        marginTop: '2px',
                        display: 'flex',
                        height: '32px',
                        width: '32px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
                        color: '#c7d2fe', // indigo-200
                        fontSize: '12px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        NEO
                      </div>

                      {/* Orbit diagram */}
                      <div style={{ flexShrink: 0 }}>
                        <OrbitDiagram missLD={missLD} width={160} />
                        <div style={{
                          display: 'block',
                          fontSize: '9px',
                          color: '#64748b', // slate-500
                          marginTop: '2px'
                        }}>
                          {missLD.toFixed(1)} LD from Earth
                        </div>
                      </div>

                      {/* Main text column */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Line 1: name + date */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#f8fafc' // slate-50
                          }}>
                            {name}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: '#94a3b8' // slate-400
                          }}>
                            {formatDateShort(approachDate)}
                          </div>
                        </div>

                        {/* Line 2: key metrics */}
                        <div style={{
                          marginTop: '4px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px 12px',
                          fontSize: '11px',
                          color: '#cbd5e1' // slate-300
                        }}>
                          <span>Distance: {missLD.toFixed(1)} LD</span>
                          <span>Size: ~{avgDiam} m</span>
                          <span>Speed: {speed.toFixed(1)} km/s</span>
                        </div>
                      </div>

                      {/* Right side: hazard badge + chevron */}
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {neo.is_potentially_hazardous_asteroid ? (
                          <span style={{
                            marginTop: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: '9999px',
                            background: 'rgba(239, 68, 68, 0.15)', // red-500/15
                            color: '#fca5a5', // red-300
                            border: '1px solid rgba(239, 68, 68, 0.4)', // red-500/40
                            padding: '4px 8px',
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 500
                          }}>
                            PHO
                          </span>
                        ) : (
                          <span style={{
                            marginTop: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.1)', // emerald-500/10
                            color: '#6ee7b7', // emerald-300
                            border: '1px solid rgba(16, 185, 129, 0.4)', // emerald-500/40
                            padding: '4px 8px',
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 500
                          }}>
                            Safe pass
                          </span>
                        )}
                        <div style={{
                          fontSize: '14px',
                          color: '#94a3b8',
                          marginTop: '4px',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}>
                          →
                        </div>
                      </div>
                    </div>

                    {/* Dropdown detail */}
                    {isExpanded && (
                      <DropdownDetail neo={neo} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default NearEarthObjectsWidget;
