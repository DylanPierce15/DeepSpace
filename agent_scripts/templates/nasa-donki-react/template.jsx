import React, { useState, useEffect } from 'react';

function NASADONKIWidget() {
  const [activeTab, setActiveTab] = useState('cme'); // 'cme', 'gst', 'flr'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState({ cme: false, gst: false, flr: false });
  const [error, setError] = useState({ cme: null, gst: null, flr: null });
  const [cmeData, setCmeData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [flrData, setFlrData] = useState(null);
  const [cmeViewMode, setCmeViewMode] = useState('chart'); // 'chart' or 'list'
  const [hoveredCme, setHoveredCme] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [flrViewMode, setFlrViewMode] = useState('chart'); // 'chart' or 'list'
  const [hoveredFlr, setHoveredFlr] = useState(null);
  const [flrTooltipPosition, setFlrTooltipPosition] = useState({ x: 0, y: 0 });
  const [gstViewMode, setGstViewMode] = useState('chart'); // 'chart' or 'list'
  const [hoveredGst, setHoveredGst] = useState(null);
  const [gstTooltipPosition, setGstTooltipPosition] = useState({ x: 0, y: 0 });

  // Set default dates on mount
  useEffect(() => {
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const thirtyDaysAgoUTC = thirtyDaysAgo.toISOString().split('T')[0];
    
    if (!startDate) setStartDate(thirtyDaysAgoUTC);
    if (!endDate) setEndDate(todayUTC);
  }, []);

  const fetchCME = async () => {
    setLoading(prev => ({ ...prev, cme: true }));
    setError(prev => ({ ...prev, cme: null }));
    try {
      const response = await miyagiAPI.post('nasa-donki-cme', {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      if (response.success && response.data.cme) {
        setCmeData(response.data.cme);
      } else {
        setError(prev => ({ ...prev, cme: response.error || 'Failed to fetch CME data' }));
      }
    } catch (e) {
      setError(prev => ({ ...prev, cme: e?.message || 'Network error' }));
    } finally {
      setLoading(prev => ({ ...prev, cme: false }));
    }
  };

  const fetchGST = async () => {
    setLoading(prev => ({ ...prev, gst: true }));
    setError(prev => ({ ...prev, gst: null }));
    try {
      const response = await miyagiAPI.post('nasa-donki-gst', {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      if (response.success && response.data.gst) {
        setGstData(response.data.gst);
      } else {
        setError(prev => ({ ...prev, gst: response.error || 'Failed to fetch GST data' }));
      }
    } catch (e) {
      setError(prev => ({ ...prev, gst: e?.message || 'Network error' }));
    } finally {
      setLoading(prev => ({ ...prev, gst: false }));
    }
  };

  const fetchFLR = async () => {
    setLoading(prev => ({ ...prev, flr: true }));
    setError(prev => ({ ...prev, flr: null }));
    try {
      const response = await miyagiAPI.post('nasa-donki-flr', {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      
      if (response.success && response.data.flr) {
        setFlrData(response.data.flr);
      } else {
        setError(prev => ({ ...prev, flr: response.error || 'Failed to fetch FLR data' }));
      }
    } catch (e) {
      setError(prev => ({ ...prev, flr: e?.message || 'Network error' }));
    } finally {
      setLoading(prev => ({ ...prev, flr: false }));
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchCME(), fetchGST(), fetchFLR()]);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return dateStr;
    }
  };

  // Calculate days between dates
  const getDaysRange = () => {
    if (!startDate || !endDate) return 30; // default
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 30;
    }
  };

  // Get summary data
  const getSummary = () => {
    const days = getDaysRange();
    
    // Solar Flares summary
    const flrCount = flrData ? flrData.length : 0;
    const mostRecentFlr = flrData && flrData.length > 0 
      ? flrData.sort((a, b) => new Date(b.peakTime || b.beginTime) - new Date(a.peakTime || a.beginTime))[0]
      : null;

    // Geomagnetic Storms summary
    const gstCount = gstData ? gstData.length : 0;
    const mostRecentGst = gstData && gstData.length > 0
      ? gstData.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]
      : null;
    const currentKp = mostRecentGst && mostRecentGst.allKpIndex && mostRecentGst.allKpIndex.length > 0
      ? mostRecentGst.allKpIndex.sort((a, b) => new Date(b.observedTime) - new Date(a.observedTime))[0]
      : null;
    const kpLevel = currentKp ? 
      (currentKp.kpIndex < 5 ? 'Quiet' : currentKp.kpIndex < 6 ? 'Minor' : currentKp.kpIndex < 7 ? 'Moderate' : 'Strong')
      : null;

    // CME Events summary
    const cmeCount = cmeData ? cmeData.length : 0;
    const mostRecentCme = cmeData && cmeData.length > 0
      ? cmeData.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]
      : null;

    return {
      days,
      flr: { count: flrCount, mostRecent: mostRecentFlr },
      gst: { count: gstCount, mostRecent: mostRecentGst, currentKp, kpLevel },
      cme: { count: cmeCount, mostRecent: mostRecentCme }
    };
  };

  const renderSummary = () => {
    const summary = getSummary();
    const hasData = summary.flr.count > 0 || summary.gst.count > 0 || summary.cme.count > 0;

    return (
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(138,43,226,0.5)',
        marginBottom: '24px',
        boxShadow: '0 0 20px rgba(138,43,226,0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <h2 style={{
          margin: '0 0 16px 0',
          fontSize: '20px',
          fontWeight: 700,
          color: '#FFD700',
          textShadow: '0 0 10px rgba(255,215,0,0.5)'
        }}>
          📊 Space Weather Summary
        </h2>
        
        {!hasData && (loading.cme || loading.gst || loading.flr) && (
          <div style={{ color: '#87CEEB', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Loading space weather data...
          </div>
        )}

        {!hasData && !loading.cme && !loading.gst && !loading.flr && (
          <div style={{ color: '#87CEEB', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
            Click "Fetch All Space Weather Data" to load summary
          </div>
        )}

        {hasData && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {/* Solar Flares Summary */}
            <div style={{
              flex: 1,
              minWidth: '250px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(255,140,0,0.15) 0%, rgba(255,215,0,0.15) 100%)',
              borderRadius: '10px',
              border: '1px solid rgba(255,215,0,0.4)',
              boxShadow: '0 4px 15px rgba(255,215,0,0.2)'
            }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>☀️</div>
              <div style={{ fontWeight: 600, fontSize: '16px', color: '#FFD700', marginBottom: '12px' }}>
                Solar Flares
              </div>
              <div style={{ fontSize: '14px', color: '#E0E0E0', marginBottom: '4px' }}>
                Last {summary.days} days: <strong style={{ color: '#FFD700' }}>{summary.flr.count}</strong> event{summary.flr.count !== 1 ? 's' : ''}
              </div>
              {summary.flr.mostRecent && (
                <div style={{ fontSize: '13px', color: '#87CEEB', marginTop: '8px' }}>
                  Most recent: {formatDateShort(summary.flr.mostRecent.peakTime || summary.flr.mostRecent.beginTime)}
                  <br />
                  <span style={{ color: '#FF6B6B', fontWeight: 600 }}>
                    Class: {summary.flr.mostRecent.classType}
                  </span>
                </div>
              )}
            </div>

            {/* Geomagnetic Storms Summary */}
            <div style={{
              flex: 1,
              minWidth: '250px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(70,130,180,0.15) 0%, rgba(135,206,235,0.15) 100%)',
              borderRadius: '10px',
              border: '1px solid rgba(135,206,235,0.4)',
              boxShadow: '0 4px 15px rgba(135,206,235,0.2)'
            }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🌌</div>
              <div style={{ fontWeight: 600, fontSize: '16px', color: '#87CEEB', marginBottom: '12px' }}>
                Geomagnetic Storms
              </div>
              <div style={{ fontSize: '14px', color: '#E0E0E0', marginBottom: '4px' }}>
                Last {summary.days} days: <strong style={{ color: '#87CEEB' }}>{summary.gst.count}</strong> event{summary.gst.count !== 1 ? 's' : ''}
              </div>
              {summary.gst.currentKp && (
                <div style={{ fontSize: '13px', color: '#87CEEB', marginTop: '8px' }}>
                  Current status: <strong style={{ color: summary.gst.currentKp.kpIndex >= 6 ? '#FF6B6B' : '#FFD700' }}>
                    Kp = {summary.gst.currentKp.kpIndex}
                  </strong>
                  <br />
                  <span style={{ color: '#E0E0E0' }}>({summary.gst.kpLevel})</span>
                </div>
              )}
              {!summary.gst.currentKp && summary.gst.mostRecent && (
                <div style={{ fontSize: '13px', color: '#87CEEB', marginTop: '8px' }}>
                  Most recent: {formatDateShort(summary.gst.mostRecent.startTime)}
                </div>
              )}
            </div>

            {/* CME Events Summary */}
            <div style={{
              flex: 1,
              minWidth: '250px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(138,43,226,0.15) 0%, rgba(147,112,219,0.15) 100%)',
              borderRadius: '10px',
              border: '1px solid rgba(138,43,226,0.4)',
              boxShadow: '0 4px 15px rgba(138,43,226,0.2)'
            }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🚀</div>
              <div style={{ fontWeight: 600, fontSize: '16px', color: '#9370DB', marginBottom: '12px' }}>
                CME Events
              </div>
              <div style={{ fontSize: '14px', color: '#E0E0E0', marginBottom: '4px' }}>
                Last {summary.days} days: <strong style={{ color: '#9370DB' }}>{summary.cme.count}</strong> event{summary.cme.count !== 1 ? 's' : ''}
              </div>
              {summary.cme.mostRecent && (
                <div style={{ fontSize: '13px', color: '#87CEEB', marginTop: '8px' }}>
                  Most recent: {formatDateShort(summary.cme.mostRecent.startTime)}
                  {summary.cme.mostRecent.cmeAnalyses && summary.cme.mostRecent.cmeAnalyses.length > 0 && (
                    <>
                      <br />
                      <span style={{ color: '#E0E0E0' }}>
                        Speed: {summary.cme.mostRecent.cmeAnalyses.find(a => a.isMostAccurate)?.speed || summary.cme.mostRecent.cmeAnalyses[0]?.speed || 'N/A'} km/s
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Process CME data for timeline visualization
  const processCMEForChart = () => {
    if (!cmeData || cmeData.length === 0) return [];
    
    return cmeData.map(cme => {
      const analysis = cme.cmeAnalyses?.find(a => a.isMostAccurate) || cme.cmeAnalyses?.[0];
      const speed = analysis?.speed || 0;
      
      // Categorize speed: slow < 500, moderate 500-1000, fast > 1000
      let size = 'small';
      if (speed >= 1000) size = 'large';
      else if (speed >= 500) size = 'medium';
      
      return {
        ...cme,
        date: new Date(cme.startTime),
        speed: speed,
        size: size,
        analysis: analysis
      };
    }).sort((a, b) => a.date - b.date);
  };

  const renderCMEChart = (processedCMEs) => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const chartHeight = 192; // h-48 = 12rem = 192px
    
    // Calculate position for each CME
    // Group CMEs by proximity to handle overlapping
    const groupCMEsByProximity = (cmes, threshold = 2) => {
      const groups = [];
      const used = new Set();
      
      cmes.forEach((cme, idx) => {
        if (used.has(idx)) return;
        
        const group = [cme];
        used.add(idx);
        
        // Find nearby CMEs (within threshold days)
        cmes.forEach((other, otherIdx) => {
          if (used.has(otherIdx) || idx === otherIdx) return;
          
          const daysDiff = Math.abs((cme.date - other.date) / (1000 * 60 * 60 * 24));
          if (daysDiff <= threshold) {
            group.push(other);
            used.add(otherIdx);
          }
        });
        
        groups.push(group.sort((a, b) => a.date - b.date));
      });
      
      return groups;
    };

    const groups = groupCMEsByProximity(processedCMEs, 1); // Group events within 1 day
    
    const positionedCMEs = [];
    groups.forEach(group => {
      group.forEach((cme, groupIndex) => {
        const daysFromStart = Math.ceil((cme.date - start) / (1000 * 60 * 60 * 24));
        const xPercent = (daysFromStart / totalDays) * 100;
        
        // Size mapping
        const sizeMap = {
          small: 6,
          medium: 10,
          large: 16
        };
        
        // Vertical offset for overlapping events
        // Spread them vertically in a fan pattern
        const groupSize = group.length;
        const verticalSpread = groupSize > 1 ? 60 : 0; // Max 60px spread
        const yOffset = groupSize > 1 
          ? ((groupIndex - (groupSize - 1) / 2) / (groupSize - 1)) * verticalSpread
          : 0;
        
        positionedCMEs.push({
          ...cme,
          x: xPercent,
          dotSize: sizeMap[cme.size] || 8,
          yOffset: yOffset
        });
      });
    });

    return (
      <div style={{
        height: `${chartHeight}px`,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)', // slate-950/60
        borderRadius: '12px',
        border: '1px solid rgba(30, 41, 59, 1)', // slate-800
        position: 'relative',
        marginBottom: '12px'
      }}>
        {processedCMEs.length === 0 ? (
          <div style={{ color: '#87CEEB', fontSize: '14px' }}>CME timeline chart placeholder</div>
        ) : (
          <>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '20px',
              right: '20px',
              top: '50%',
              height: '2px',
              background: 'rgba(135, 206, 235, 0.3)',
              transform: 'translateY(-50%)'
            }} />
            
            {/* CME dots */}
            {positionedCMEs.map((cme, index) => {
              const color = cme.size === 'large' ? '#FF6B6B' : cme.size === 'medium' ? '#FFD700' : '#87CEEB';
              
              return (
                <div
                  key={cme.activityID || index}
                  style={{
                    position: 'absolute',
                    left: `${Math.max(2, Math.min(98, cme.x))}%`,
                    top: `calc(50% + ${cme.yOffset || 0}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: `${cme.dotSize}px`,
                    height: `${cme.dotSize}px`,
                    borderRadius: '50%',
                    background: color,
                    border: '2px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: `0 0 ${cme.dotSize}px ${color}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: hoveredCme === cme.activityID ? 10 : 1
                  }}
                  onMouseEnter={(e) => {
                    setHoveredCme(cme.activityID);
                    setTooltipPosition({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    if (hoveredCme === cme.activityID) {
                      setTooltipPosition({ x: e.clientX, y: e.clientY });
                    }
                  }}
                  onMouseLeave={() => setHoveredCme(null)}
                />
              );
            })}
            
            {/* Tooltip */}
            {hoveredCme && (() => {
              const cme = positionedCMEs.find(c => c.activityID === hoveredCme);
              if (!cme) return null;
              
              return (
                <div style={{
                  position: 'fixed',
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y - 10}px`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(10, 10, 26, 0.95)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(138, 43, 226, 0.6)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                  minWidth: '200px',
                  pointerEvents: 'none',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px', fontSize: '14px' }}>
                    {cme.activityID}
                  </div>
                  <div style={{ color: '#87CEEB', fontSize: '12px', marginBottom: '4px' }}>
                    {formatDateShort(cme.startTime)}
                  </div>
                  {cme.speed > 0 && (
                    <div style={{ color: '#E0E0E0', fontSize: '12px' }}>
                      Speed: <strong style={{ color: '#FFD700' }}>{cme.speed} km/s</strong>
                    </div>
                  )}
                  {cme.analysis?.type && (
                    <div style={{ color: '#E0E0E0', fontSize: '12px' }}>
                      Type: {cme.analysis.type}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  const renderCME = () => {
    if (loading.cme) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>Loading CME data...</div>;
    }
    if (error.cme) {
      return <div style={{ padding: '16px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.5)', borderRadius: '8px', color: '#FF6B6B' }}>Error: {error.cme}</div>;
    }
    if (!cmeData || cmeData.length === 0) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>No CME events found in the selected date range.</div>;
    }

    const processedCMEs = processCMEForChart();

    return (
      <div>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: 700,
              color: '#FFD700',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'inline-block'
            }}>
              Coronal Mass Ejections
            </h2>
            <div style={{ color: '#87CEEB', fontSize: '14px', marginTop: '4px' }}>
              Each dot represents a CME event. <strong>Larger dots mean faster ejections.</strong>
            </div>
          </div>
          
          {/* Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid rgba(138, 43, 226, 0.5)'
          }}>
            <button
              onClick={() => setCmeViewMode('chart')}
              style={{
                padding: '8px 16px',
                background: cmeViewMode === 'chart' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: cmeViewMode === 'chart' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setCmeViewMode('list')}
              style={{
                padding: '8px 16px',
                background: cmeViewMode === 'list' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: cmeViewMode === 'list' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              List
            </button>
          </div>
        </div>

        {cmeViewMode === 'chart' ? (
          <>
            {/* Chart */}
            {renderCMEChart(processedCMEs)}
            
            {/* Mini Legend */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '16px',
              padding: '12px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#E0E0E0',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#87CEEB',
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }} />
                <span>Small — Slow CME</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#FFD700',
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }} />
                <span>Medium — Moderate</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#FF6B6B',
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }} />
                <span>Large — Fast CME</span>
              </div>
            </div>

            {/* What Those Dots Represent */}
            <div style={{
              marginBottom: '20px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(70, 130, 180, 0.15) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(138, 43, 226, 0.4)',
              boxShadow: '0 4px 15px rgba(138, 43, 226, 0.2)'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 700,
                color: '#FFD700',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
              }}>
                🌌 What Those Dots Represent
              </h3>
              
              <div style={{
                color: '#E0E0E0',
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '12px'
              }}>
                <p style={{ margin: '0 0 12px 0' }}>
                  CMEs are <strong style={{ color: '#FFD700' }}>massive clouds of solar plasma</strong> ejected into space. Unlike solar flares (which are bursts of light), CMEs are <strong style={{ color: '#87CEEB' }}>big physical blobs of charged particles</strong>.
                </p>
                
                <p style={{ margin: '0 0 12px 0' }}>
                  In DONKI data, each CME has:
                </p>
                
                <ul style={{
                  margin: '0 0 12px 0',
                  paddingLeft: '24px',
                  listStyle: 'none'
                }}>
                  <li style={{ marginBottom: '8px', position: 'relative', paddingLeft: '20px' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0',
                      color: '#FFD700',
                      fontSize: '16px'
                    }}>•</span>
                    <strong style={{ color: '#87CEEB' }}>a start time</strong> (when it left the Sun)
                  </li>
                  <li style={{ marginBottom: '8px', position: 'relative', paddingLeft: '20px' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0',
                      color: '#FFD700',
                      fontSize: '16px'
                    }}>•</span>
                    <strong style={{ color: '#87CEEB' }}>an estimated speed</strong> (km/s)
                  </li>
                </ul>
                
                <p style={{
                  margin: '0',
                  padding: '12px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}>
                  <strong style={{ color: '#FFD700' }}>Faster CMEs</strong> can reach Earth in as little as <strong style={{ color: '#FF6B6B' }}>1–2 days</strong> and are more likely to trigger geomagnetic storms. On your visualization, <strong style={{ color: '#FFD700' }}>larger dots indicate higher-speed CMEs</strong>, helping you quickly spot the most powerful ejections and when they occurred.
                </p>
              </div>
            </div>

            {/* Info line */}
            <div style={{
              color: '#87CEEB',
              fontSize: '13px',
              fontStyle: 'italic',
              marginBottom: '20px',
              padding: '8px 12px',
              background: 'rgba(135, 206, 235, 0.1)',
              borderRadius: '6px'
            }}>
              <strong>CMEs that are directed toward Earth</strong> can lead to geomagnetic storms and auroras <strong>a few days later</strong>.
            </div>
          </>
        ) : (
          /* List View */
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(135,206,235,0.1)', borderRadius: '8px', fontSize: '14px', color: '#87CEEB' }}>
              Found {cmeData.length} CME event{cmeData.length !== 1 ? 's' : ''}
            </div>
            {cmeData.map((cme, index) => (
              <div
                key={cme.activityID || index}
                style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: 'linear-gradient(145deg, #1a0a2e, #0a0a1a)',
                  borderRadius: '12px',
                  border: '1px solid rgba(138,43,226,0.6)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>
                    {cme.activityID || 'CME Event'}
                  </h3>
                  <div style={{ color: '#87CEEB', fontSize: '14px' }}>
                    Start Time: {formatDate(cme.startTime)}
                  </div>
                </div>
                
                {cme.note && (
                  <div style={{ marginBottom: '12px', color: '#E0E0E0', fontSize: '14px', lineHeight: 1.6 }}>
                    {cme.note}
                  </div>
                )}

                {cme.cmeAnalyses && cme.cmeAnalyses.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(138,43,226,0.1)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '8px' }}>CME Analysis:</div>
                    {cme.cmeAnalyses.map((analysis, idx) => (
                      <div key={idx} style={{ marginBottom: '12px', fontSize: '13px', color: '#E0E0E0' }}>
                        {analysis.isMostAccurate && <span style={{ color: '#FFD700', fontWeight: 600 }}>⭐ Most Accurate</span>}
                        <div>Speed: {analysis.speed} km/s</div>
                        <div>Type: {analysis.type}</div>
                        <div>Latitude: {analysis.latitude}°, Longitude: {analysis.longitude}°</div>
                        <div>Half Angle: {analysis.halfAngle}°</div>
                        {analysis.note && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{analysis.note}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {cme.link && (
                  <a
                    href={cme.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: 'linear-gradient(45deg, #0b57d0, #4285F4)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500
                    }}
                  >
                    View Details →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Process GST data for chart visualization
  const processGSTForChart = () => {
    if (!gstData || gstData.length === 0) return [];
    
    // Extract all Kp index readings with their dates
    const kpReadings = [];
    gstData.forEach(gst => {
      if (gst.allKpIndex && gst.allKpIndex.length > 0) {
        gst.allKpIndex.forEach(kp => {
          kpReadings.push({
            date: new Date(kp.observedTime),
            kpIndex: kp.kpIndex,
            source: kp.source,
            gstID: gst.gstID
          });
        });
      }
    });
    
    // Sort by date
    return kpReadings.sort((a, b) => a.date - b.date);
  };

  const renderGSTChart = (processedKpReadings) => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const chartHeight = 240; // h-60 = 15rem = 240px
    const maxKp = 9; // Kp index ranges from 0-9
    
    // Group Kp readings by proximity to handle overlapping
    const groupKpByProximity = (readings, threshold = 1) => {
      const groups = [];
      const used = new Set();
      
      readings.forEach((kp, idx) => {
        if (used.has(idx)) return;
        
        const group = [kp];
        used.add(idx);
        
        // Find nearby readings (within threshold days)
        readings.forEach((other, otherIdx) => {
          if (used.has(otherIdx) || idx === otherIdx) return;
          
          const daysDiff = Math.abs((kp.date - other.date) / (1000 * 60 * 60 * 24));
          if (daysDiff <= threshold) {
            group.push(other);
            used.add(otherIdx);
          }
        });
        
        groups.push(group.sort((a, b) => a.date - b.date));
      });
      
      return groups;
    };

    const groups = groupKpByProximity(processedKpReadings, 1);
    
    // Calculate position and height for each Kp reading
    const positionedKpReadings = [];
    groups.forEach(group => {
      group.forEach((kp, groupIndex) => {
        const daysFromStart = Math.ceil((kp.date - start) / (1000 * 60 * 60 * 24));
        const baseXPercent = (daysFromStart / totalDays) * 100;
        
        // Horizontal offset for overlapping readings
        const groupSize = group.length;
        const horizontalSpread = groupSize > 1 ? 3 : 0;
        const xOffset = groupSize > 1 
          ? ((groupIndex - (groupSize - 1) / 2) / (groupSize - 1)) * horizontalSpread
          : 0;
        const xPercent = baseXPercent + xOffset;
        const clampedXPercent = Math.max(3, Math.min(97, xPercent));
        
        // Bar height based on Kp value (0-9 scale)
        const barHeight = (kp.kpIndex / maxKp) * (chartHeight - 40);
        
        // Color by Kp level
        let color = '#4ade80'; // Green for Kp 0-3 (Quiet)
        if (kp.kpIndex >= 6) {
          color = '#ef4444'; // Red for Kp 6+ (Storm)
        } else if (kp.kpIndex >= 4) {
          color = '#fbbf24'; // Yellow for Kp 4-5 (Active)
        }
        
        positionedKpReadings.push({
          ...kp,
          x: clampedXPercent,
          barHeight: Math.max(4, barHeight),
          color: color
        });
      });
    });

    return (
      <div style={{
        height: `${chartHeight}px`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        background: 'rgba(15, 23, 42, 0.6)', // slate-950/60
        borderRadius: '12px',
        border: '1px solid rgba(30, 41, 59, 1)', // slate-800
        position: 'relative',
        marginBottom: '12px',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        {processedKpReadings.length === 0 ? (
          <div style={{ color: '#87CEEB', fontSize: '14px', width: '100%', textAlign: 'center' }}>Geomagnetic Kp index chart placeholder</div>
        ) : (
          <>
            {/* Bars */}
            {positionedKpReadings.map((kp, index) => (
              <div
                key={`${kp.gstID}-${kp.date.getTime()}-${index}`}
                style={{
                  position: 'absolute',
                  left: `${kp.x}%`,
                  bottom: '40px',
                  width: '6px',
                  height: `${kp.barHeight}px`,
                  background: `linear-gradient(to top, ${kp.color}, ${kp.color}dd)`,
                  borderRadius: '3px 3px 0 0',
                  border: `1px solid ${kp.color}`,
                  boxShadow: `0 0 8px ${kp.color}80`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: hoveredGst === `${kp.gstID}-${kp.date.getTime()}` ? 10 : 1,
                  transform: 'translateX(-50%)'
                }}
                onMouseEnter={(e) => {
                  setHoveredGst(`${kp.gstID}-${kp.date.getTime()}`);
                  setGstTooltipPosition({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => {
                  if (hoveredGst === `${kp.gstID}-${kp.date.getTime()}`) {
                    setGstTooltipPosition({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setHoveredGst(null)}
              />
            ))}
            
            {/* Tooltip */}
            {hoveredGst && (() => {
              const kp = positionedKpReadings.find(k => `${k.gstID}-${k.date.getTime()}` === hoveredGst);
              if (!kp) return null;
              
              return (
                <div style={{
                  position: 'fixed',
                  left: `${gstTooltipPosition.x}px`,
                  top: `${gstTooltipPosition.y - 10}px`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(10, 10, 26, 0.95)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(138, 43, 226, 0.6)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                  minWidth: '200px',
                  pointerEvents: 'none',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px', fontSize: '14px' }}>
                    {kp.gstID}
                  </div>
                  <div style={{ color: '#87CEEB', fontSize: '12px', marginBottom: '4px' }}>
                    {formatDateShort(kp.date.toISOString())}
                  </div>
                  <div style={{ color: '#E0E0E0', fontSize: '12px' }}>
                    Kp Index: <strong style={{ color: kp.color }}>{kp.kpIndex}</strong>
                  </div>
                  {kp.source && (
                    <div style={{ color: '#E0E0E0', fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                      Source: {kp.source}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  const renderGST = () => {
    if (loading.gst) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>Loading GST data...</div>;
    }
    if (error.gst) {
      return <div style={{ padding: '16px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.5)', borderRadius: '8px', color: '#FF6B6B' }}>Error: {error.gst}</div>;
    }
    if (!gstData || gstData.length === 0) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>No geomagnetic storms found in the selected date range.</div>;
    }

    const processedKpReadings = processGSTForChart();

    return (
      <div style={{
        marginTop: '24px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.7)', // slate-900/70
        border: '1px solid rgba(51, 65, 85, 1)', // slate-700
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px' }}>🌌</span>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: '#FFD700'
            }}>
              Geomagnetic Storms
            </h2>
          </div>
          
          {/* Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid rgba(138, 43, 226, 0.5)'
          }}>
            <button
              onClick={() => setGstViewMode('chart')}
              style={{
                padding: '6px 12px',
                background: gstViewMode === 'chart' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: gstViewMode === 'chart' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setGstViewMode('list')}
              style={{
                padding: '6px 12px',
                background: gstViewMode === 'list' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: gstViewMode === 'list' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              List
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 600,
          color: '#FFD700'
        }}>
          Geomagnetic Storms
        </h3>

        {/* Subtitle */}
        <div style={{
          fontSize: '13px',
          color: '#87CEEB',
          opacity: 0.8
        }}>
          Kp index over time (0–9). Storm conditions usually start at Kp 5+.
        </div>

        {gstViewMode === 'chart' ? (
          <>
            {/* Chart */}
            {renderGSTChart(processedKpReadings)}
            
            {/* Legend */}
            <div style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 0 4px #4ade80'
                }} />
                <span style={{ fontSize: '12px', color: '#E0E0E0' }}>
                  <strong style={{ color: '#4ade80' }}>Kp 0–3</strong> • Quiet
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#fbbf24',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 0 4px #fbbf24'
                }} />
                <span style={{ fontSize: '12px', color: '#E0E0E0' }}>
                  <strong style={{ color: '#fbbf24' }}>Kp 4–5</strong> • Active
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 0 4px #ef4444'
                }} />
                <span style={{ fontSize: '12px', color: '#E0E0E0' }}>
                  <strong style={{ color: '#ef4444' }}>Kp 6+</strong> • Storm
                </span>
              </div>
            </div>

            {/* Footer text */}
            <div style={{
              fontSize: '12px',
              color: '#87CEEB',
              opacity: 0.8,
              marginBottom: '20px',
              fontStyle: 'italic'
            }}>
              Higher Kp values mean stronger geomagnetic storms and better chances for auroras at lower latitudes.
            </div>

            {/* Understanding Kp Index */}
            <div style={{
              marginTop: '20px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(70, 130, 180, 0.15) 0%, rgba(135, 206, 235, 0.15) 50%, rgba(138, 43, 226, 0.15) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(135, 206, 235, 0.4)',
              boxShadow: '0 4px 15px rgba(135, 206, 235, 0.2)'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 700,
                color: '#87CEEB',
                textShadow: '0 0 10px rgba(135, 206, 235, 0.5)'
              }}>
                🌌 Understanding Kp Index
              </h3>
              
              <div style={{
                color: '#E0E0E0',
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '12px'
              }}>
                <p style={{ margin: '0 0 12px 0' }}>
                  Geomagnetic storms happen when <strong style={{ color: '#FFD700' }}>energetic solar particles hit Earth's magnetic field</strong>. The DONKI GST data shows a <strong style={{ color: '#87CEEB' }}>Kp index for each storm</strong>, ranging from 0 to 9.
                </p>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    padding: '12px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#4ade80', marginBottom: '4px', fontSize: '15px' }}>
                      Kp 0–3
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      — calm magnetic conditions
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '12px',
                    background: 'rgba(251, 191, 36, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '4px', fontSize: '15px' }}>
                      Kp 4–5
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      — unsettled or "active" levels
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '4px', fontSize: '15px' }}>
                      Kp 5+
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      — storm-level conditions (minor to severe)
                    </div>
                  </div>
                </div>
                
                <p style={{
                  margin: '0',
                  padding: '12px',
                  background: 'rgba(135, 206, 235, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(135, 206, 235, 0.3)'
                }}>
                  <strong style={{ color: '#87CEEB' }}>High Kp values</strong> are associated with stronger disturbances, which can cause <strong style={{ color: '#FFD700' }}>GPS errors, radio blackouts</strong>, and—most exciting—<strong style={{ color: '#FFD700' }}>bright auroras visible at lower latitudes</strong>. Tracking changes in Kp helps you understand when Earth's magnetic environment is most disturbed.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* List View */
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(135,206,235,0.1)', borderRadius: '8px', fontSize: '14px', color: '#87CEEB' }}>
              Found {gstData.length} geomagnetic storm{gstData.length !== 1 ? 's' : ''}
            </div>
            {gstData.map((gst, index) => (
              <div
                key={gst.gstID || index}
                style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: 'linear-gradient(145deg, #1a0a2e, #0a0a1a)',
                  borderRadius: '12px',
                  border: '1px solid rgba(138,43,226,0.6)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>
                    {gst.gstID || 'Geomagnetic Storm'}
                  </h3>
                  <div style={{ color: '#87CEEB', fontSize: '14px' }}>
                    Start Time: {formatDate(gst.startTime)}
                  </div>
                </div>

                {gst.allKpIndex && gst.allKpIndex.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '8px' }}>Kp Index:</div>
                    {gst.allKpIndex.map((kp, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#E0E0E0', marginBottom: '4px' }}>
                        {formatDate(kp.observedTime)}: Kp = {kp.kpIndex} (Source: {kp.source})
                      </div>
                    ))}
                  </div>
                )}

                {gst.linkedEvents && gst.linkedEvents.length > 0 && (
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#E0E0E0' }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px' }}>Linked Events:</div>
                    {gst.linkedEvents.map((event, idx) => (
                      <div key={idx}>{event.activityID}</div>
                    ))}
                  </div>
                )}

                {gst.link && (
                  <a
                    href={gst.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: 'linear-gradient(45deg, #0b57d0, #4285F4)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500
                    }}
                  >
                    View Details →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Process FLR data for chart visualization
  const processFLRForChart = () => {
    if (!flrData || flrData.length === 0) return [];
    
    return flrData.map(flr => {
      // Parse class type (e.g., "M2.3", "C9.6", "X1.5")
      const classType = flr.classType || '';
      const classLetter = classType.charAt(0).toUpperCase(); // C, M, or X
      const classNumber = parseFloat(classType.substring(1)) || 0;
      
      // Calculate intensity value for bar height
      // C class: 0-9.9, M class: 10-99.9, X class: 100+
      let intensity = 0;
      if (classLetter === 'X') {
        intensity = 100 + classNumber * 10; // X1 = 110, X10 = 200
      } else if (classLetter === 'M') {
        intensity = 10 + classNumber; // M1 = 11, M9 = 19
      } else if (classLetter === 'C') {
        intensity = classNumber; // C1 = 1, C9 = 9
      }
      
      return {
        ...flr,
        date: new Date(flr.peakTime || flr.beginTime),
        classLetter: classLetter,
        classNumber: classNumber,
        intensity: intensity
      };
    }).sort((a, b) => a.date - b.date);
  };

  const renderFLRChart = (processedFLRs) => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const chartHeight = 240; // h-60 = 15rem = 240px
    const maxIntensity = Math.max(...processedFLRs.map(f => f.intensity), 1);
    
    // Group flares by proximity to handle overlapping
    const groupFLRsByProximity = (flrs, threshold = 1) => {
      const groups = [];
      const used = new Set();
      
      flrs.forEach((flr, idx) => {
        if (used.has(idx)) return;
        
        const group = [flr];
        used.add(idx);
        
        // Find nearby flares (within threshold days)
        flrs.forEach((other, otherIdx) => {
          if (used.has(otherIdx) || idx === otherIdx) return;
          
          const daysDiff = Math.abs((flr.date - other.date) / (1000 * 60 * 60 * 24));
          if (daysDiff <= threshold) {
            group.push(other);
            used.add(otherIdx);
          }
        });
        
        groups.push(group.sort((a, b) => a.date - b.date));
      });
      
      return groups;
    };

    const groups = groupFLRsByProximity(processedFLRs, 1); // Group events within 1 day
    
    // Calculate position and height for each flare with horizontal spread
    const positionedFLRs = [];
    groups.forEach(group => {
      group.forEach((flr, groupIndex) => {
        const daysFromStart = Math.ceil((flr.date - start) / (1000 * 60 * 60 * 24));
        const baseXPercent = (daysFromStart / totalDays) * 100;
        
        // Horizontal offset for overlapping flares
        const groupSize = group.length;
        const horizontalSpread = groupSize > 1 ? 3 : 0; // Max 3% spread per side
        const xOffset = groupSize > 1 
          ? ((groupIndex - (groupSize - 1) / 2) / (groupSize - 1)) * horizontalSpread
          : 0;
        const xPercent = baseXPercent + xOffset;
        const clampedXPercent = Math.max(3, Math.min(97, xPercent));
        
        const barHeight = (flr.intensity / maxIntensity) * (chartHeight - 40); // Leave 40px for labels
        
        // Color by class
        let color = '#87CEEB'; // C class - blue
        if (flr.classLetter === 'M') color = '#FFD700'; // M class - gold
        if (flr.classLetter === 'X') color = '#FF6B6B'; // X class - red
        
        positionedFLRs.push({
          ...flr,
          x: clampedXPercent,
          barHeight: Math.max(4, barHeight), // Minimum 4px height
          color: color
        });
      });
    });

    return (
      <div style={{
        height: `${chartHeight}px`,
        width: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        background: 'rgba(15, 23, 42, 0.6)', // slate-950/60
        borderRadius: '12px',
        border: '1px solid rgba(30, 41, 59, 1)', // slate-800
        position: 'relative',
        marginBottom: '12px',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        {processedFLRs.length === 0 ? (
          <div style={{ color: '#87CEEB', fontSize: '14px', width: '100%', textAlign: 'center' }}>Solar flare chart placeholder</div>
        ) : (
          <>
            {/* Bars */}
            {positionedFLRs.map((flr, index) => (
              <div
                key={flr.flrID || index}
                style={{
                  position: 'absolute',
                  left: `${flr.x}%`,
                  bottom: '40px',
                  width: '6px',
                  height: `${flr.barHeight}px`,
                  background: `linear-gradient(to top, ${flr.color}, ${flr.color}dd)`,
                  borderRadius: '3px 3px 0 0',
                  border: `1px solid ${flr.color}`,
                  boxShadow: `0 0 8px ${flr.color}80`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: hoveredFlr === flr.flrID ? 10 : 1,
                  transform: 'translateX(-50%)' // Center the bar on its position
                }}
                onMouseEnter={(e) => {
                  setHoveredFlr(flr.flrID);
                  setFlrTooltipPosition({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => {
                  if (hoveredFlr === flr.flrID) {
                    setFlrTooltipPosition({ x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setHoveredFlr(null)}
              />
            ))}
            
            {/* Tooltip */}
            {hoveredFlr && (() => {
              const flr = positionedFLRs.find(f => f.flrID === hoveredFlr);
              if (!flr) return null;
              
              return (
                <div style={{
                  position: 'fixed',
                  left: `${flrTooltipPosition.x}px`,
                  top: `${flrTooltipPosition.y - 10}px`,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(10, 10, 26, 0.95)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(138, 43, 226, 0.6)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                  minWidth: '200px',
                  pointerEvents: 'none',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px', fontSize: '14px' }}>
                    {flr.flrID}
                  </div>
                  <div style={{ color: '#87CEEB', fontSize: '12px', marginBottom: '4px' }}>
                    {formatDateShort(flr.peakTime || flr.beginTime)}
                  </div>
                  <div style={{ color: '#E0E0E0', fontSize: '12px' }}>
                    Class: <strong style={{ color: flr.color }}>{flr.classType}</strong>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  const renderFLR = () => {
    if (loading.flr) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>Loading FLR data...</div>;
    }
    if (error.flr) {
      return <div style={{ padding: '16px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.5)', borderRadius: '8px', color: '#FF6B6B' }}>Error: {error.flr}</div>;
    }
    if (!flrData || flrData.length === 0) {
      return <div style={{ padding: '40px', textAlign: 'center', color: '#87CEEB' }}>No solar flares found in the selected date range.</div>;
    }

    const processedFLRs = processFLRForChart();

    return (
      <div style={{
        marginTop: '24px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.7)', // slate-900/70
        border: '1px solid rgba(51, 65, 85, 1)', // slate-700
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px' }}>☀️</span>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: '#FFD700'
            }}>
              Solar Flares
            </h2>
            <span style={{
              padding: '4px 10px',
              background: 'rgba(138, 43, 226, 0.3)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#87CEEB',
              border: '1px solid rgba(138, 43, 226, 0.5)'
            }}>
              Intensity over time
            </span>
          </div>
          
          {/* Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid rgba(138, 43, 226, 0.5)'
          }}>
            <button
              onClick={() => setFlrViewMode('chart')}
              style={{
                padding: '6px 12px',
                background: flrViewMode === 'chart' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: flrViewMode === 'chart' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setFlrViewMode('list')}
              style={{
                padding: '6px 12px',
                background: flrViewMode === 'list' ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'transparent',
                color: flrViewMode === 'list' ? '#1a0a2e' : '#E0E0E0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              List
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 600,
          color: '#FFD700'
        }}>
          Solar Flares
        </h3>

        {/* Subtitle */}
        <div style={{
          fontSize: '13px',
          color: '#87CEEB',
          opacity: 0.8
        }}>
          Brightness classes (C, M, X) over the selected date range.
        </div>

        {flrViewMode === 'chart' ? (
          <>
            {/* Chart */}
            {renderFLRChart(processedFLRs)}
            
            {/* Legend */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                  width: '16px',
                  height: '4px',
                  background: 'linear-gradient(to right, #87CEEB, #FFD700, #FF6B6B)',
                  borderRadius: '2px'
                }} />
                <span style={{ fontSize: '12px', color: '#E0E0E0' }}>
                  Higher bar = stronger flare (C → M → X)
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#87CEEB', opacity: 0.8 }}>
                Hover a point to see exact class and time.
              </div>
            </div>

            {/* Footer link */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '8px',
              marginBottom: '20px'
            }}>
              <button
                onClick={() => setFlrViewMode('list')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#87CEEB',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#FFD700';
                  e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#87CEEB';
                  e.target.style.background = 'transparent';
                }}
              >
                View all flare events →
              </button>
            </div>

            {/* What the Data Means */}
            <div style={{
              marginTop: '20px',
              padding: '20px',
              background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.15) 0%, rgba(255, 215, 0, 0.15) 50%, rgba(138, 43, 226, 0.15) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.4)',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: 700,
                color: '#FFD700',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
              }}>
                ☀️ What the Data Means
              </h3>
              
              <div style={{
                color: '#E0E0E0',
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '12px'
              }}>
                <p style={{ margin: '0 0 12px 0' }}>
                  Solar flares are <strong style={{ color: '#FFD700' }}>sudden bursts of energy from the Sun</strong>, caused by the snapping and reconnecting of magnetic field lines. The DONKI results show each flare's <strong style={{ color: '#87CEEB' }}>class (C, M, or X)</strong> and intensity number.
                </p>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    padding: '12px',
                    background: 'rgba(135, 206, 235, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(135, 206, 235, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#87CEEB', marginBottom: '4px', fontSize: '15px' }}>
                      C-class
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      = small, common, usually harmless
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '12px',
                    background: 'rgba(255, 215, 0, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 215, 0, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px', fontSize: '15px' }}>
                      M-class
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      = medium strength, can disrupt radio signals
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '12px',
                    background: 'rgba(255, 107, 107, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 107, 107, 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, color: '#FF6B6B', marginBottom: '4px', fontSize: '15px' }}>
                      X-class
                    </div>
                    <div style={{ color: '#E0E0E0', fontSize: '13px' }}>
                      = strongest flares, capable of affecting satellites and power grids
                    </div>
                  </div>
                </div>
                
                <p style={{
                  margin: '0',
                  padding: '12px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}>
                  The flare timeline helps you see <strong style={{ color: '#FFD700' }}>periods of increased solar activity</strong>, and the class values tell you how powerful each event was. <strong style={{ color: '#FFD700' }}>A higher class number</strong> generally means a more energetic and potentially more disruptive flare.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* List View */
          <div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(135,206,235,0.1)', borderRadius: '8px', fontSize: '14px', color: '#87CEEB' }}>
              Found {flrData.length} solar flare{flrData.length !== 1 ? 's' : ''}
            </div>
            {flrData.map((flr, index) => (
              <div
                key={flr.flrID || index}
                style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: 'linear-gradient(145deg, #1a0a2e, #0a0a1a)',
                  borderRadius: '12px',
                  border: '1px solid rgba(138,43,226,0.6)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>
                    {flr.flrID || 'Solar Flare'}
                  </h3>
                  <div style={{ color: '#87CEEB', fontSize: '14px', marginBottom: '8px' }}>
                    <div>Begin: {formatDate(flr.beginTime)}</div>
                    <div>Peak: {formatDate(flr.peakTime)}</div>
                    <div>End: {formatDate(flr.endTime)}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#FF6B6B', marginTop: '8px' }}>
                    Class: {flr.classType}
                  </div>
                </div>

                {flr.sourceLocation && (
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: '#E0E0E0' }}>
                    Source Location: {flr.sourceLocation}
                  </div>
                )}

                {flr.activeRegionNum && (
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: '#E0E0E0' }}>
                    Active Region: {flr.activeRegionNum}
                  </div>
                )}

                {flr.note && (
                  <div style={{ marginBottom: '12px', color: '#E0E0E0', fontSize: '14px', lineHeight: 1.6 }}>
                    {flr.note}
                  </div>
                )}

                {flr.instruments && flr.instruments.length > 0 && (
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#E0E0E0' }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px' }}>Instruments:</div>
                    {flr.instruments.map((inst, idx) => (
                      <div key={idx}>{inst.displayName}</div>
                    ))}
                  </div>
                )}

                {flr.linkedEvents && flr.linkedEvents.length > 0 && (
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#E0E0E0' }}>
                    <div style={{ fontWeight: 600, color: '#FFD700', marginBottom: '4px' }}>Linked Events:</div>
                    {flr.linkedEvents.map((event, idx) => (
                      <div key={idx}>{event.activityID}</div>
                    ))}
                  </div>
                )}

                {flr.link && (
                  <a
                    href={flr.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-block',
                      marginTop: '12px',
                      padding: '8px 16px',
                      background: 'linear-gradient(45deg, #0b57d0, #4285F4)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500
                    }}
                  >
                    View Details →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)',
      color: '#E0E0E0',
      position: 'relative',
      overflow: 'auto'
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
          🚀 NASA DONKI Space Weather
        </h1>
        <p style={{
          margin: 0,
          color: '#87CEEB',
          fontSize: '14px',
          textShadow: '0 0 8px rgba(135,206,235,0.5)'
        }}>
          Monitor Coronal Mass Ejections, Geomagnetic Storms, and Solar Flares
        </p>
      </div>

      {/* Controls */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(138,43,226,0.5)',
        marginBottom: '24px',
        boxShadow: '0 0 20px rgba(138,43,226,0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
              fontSize: '14px',
              color: '#E0E0E0'
            }}>
              Start Date (YYYY-MM-DD)
            </label>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(138,43,226,0.5)',
              borderRadius: '12px',
              boxShadow: '0 0 10px rgba(138,43,226,0.3)'
            }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#E0E0E0',
                  outline: 'none'
                }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
              fontSize: '14px',
              color: '#E0E0E0'
            }}>
              End Date (YYYY-MM-DD)
            </label>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(138,43,226,0.5)',
              borderRadius: '12px',
              boxShadow: '0 0 10px rgba(138,43,226,0.3)'
            }}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#E0E0E0',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading.cme || loading.gst || loading.flr}
          style={{
            padding: '12px 24px',
            background: loading.cme || loading.gst || loading.flr ? '#555' : 'linear-gradient(45deg, #0b57d0, #4285F4)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading.cme || loading.gst || loading.flr ? 'not-allowed' : 'pointer',
            width: '100%',
            maxWidth: '300px',
            boxShadow: loading.cme || loading.gst || loading.flr ? 'none' : '0 0 15px rgba(11,87,208,0.6)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading.cme || loading.gst || loading.flr ? 'Loading...' : 'Fetch All Space Weather Data'}
        </button>
      </div>

      {/* Space Weather Summary */}
      {renderSummary()}

      {/* Tabs */}
      <div style={{
        marginBottom: '24px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 1
      }}>
        {['cme', 'gst', 'flr'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'cme' && !cmeData && !loading.cme) fetchCME();
              if (tab === 'gst' && !gstData && !loading.gst) fetchGST();
              if (tab === 'flr' && !flrData && !loading.flr) fetchFLR();
            }}
            style={{
              padding: '10px 18px',
              background: activeTab === tab ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'rgba(255,255,255,0.1)',
              color: activeTab === tab ? '#1a0a2e' : '#E0E0E0',
              border: activeTab === tab ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              boxShadow: activeTab === tab ? '0 0 10px rgba(255,215,0,0.6)' : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {tab === 'cme' ? 'Coronal Mass Ejection' : tab === 'gst' ? 'Geomagnetic Storm' : 'Solar Flare'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {activeTab === 'cme' && renderCME()}
        {activeTab === 'gst' && renderGST()}
        {activeTab === 'flr' && renderFLR()}
      </div>
    </div>
  );
}

export default NASADONKIWidget;

