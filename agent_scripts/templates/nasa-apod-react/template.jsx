import React, { useState, useEffect } from 'react';

function NASAAPODWidget() {
  const [mode, setMode] = useState('today'); // 'today', 'date', 'range', 'random'
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apodData, setApodData] = useState(null);
  const [romanticSentence, setRomanticSentence] = useState(null);
  const [generatingSentence, setGeneratingSentence] = useState(false);

  // Load today's APOD on mount
  useEffect(() => {
    if (mode === 'today' && !apodData) {
      fetchAPOD();
    }
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // Parse YYYY-MM-DD directly to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const generateRomanticSentence = async (apod) => {
    if (!apod || generatingSentence) return;
    
    setGeneratingSentence(true);
    try {
      const prompt = `Based on this NASA Astronomy Picture of the Day:

Title: "${apod.title}"
Date: ${formatDate(apod.date)}
Explanation: ${apod.explanation.substring(0, 500)}...

Write a single, beautiful, romantic, meaningful, or deeply interesting sentence that captures the essence, wonder, or emotional impact of this cosmic image. Make it poetic, profound, or thought-provoking. It should be one complete sentence that makes people pause and reflect on the beauty and mystery of the universe. Do not include quotes or attribution - just the sentence itself.`;

      const response = await miyagiAPI.post('generate-text', {
        prompt: prompt,
        system_prompt: 'You are a poetic writer who creates beautiful, meaningful, and thought-provoking sentences about the cosmos. Write with wonder, romance, and depth. Always respond with just one complete sentence, no quotes, no attribution.',
        max_tokens: 100,
        temperature: 0.9
      });

      if (response.success && response.data.text) {
        // Clean up the sentence - remove quotes if present
        const cleaned = response.data.text.trim().replace(/^["']|["']$/g, '');
        setRomanticSentence(cleaned);
      }
    } catch (e) {
      console.error('Failed to generate romantic sentence:', e);
      // Don't show error to user, just skip it
    } finally {
      setGeneratingSentence(false);
    }
  };

  const fetchAPOD = async () => {
    setLoading(true);
    setError(null);
    setApodData(null);

    try {
      const body = {};
      
      if (mode === 'date' && date) {
        body.date = date;
      } else if (mode === 'range' && startDate) {
        body.start_date = startDate;
        if (endDate) body.end_date = endDate;
      } else if (mode === 'random' && count) {
        body.count = count;
      }
      
      // Always request video thumbnails for better video display
      body.thumbs = true;

      const response = await miyagiAPI.post('nasa-apod', body);
      
      if (response.success && response.data.apod) {
        setApodData(response.data.apod);
        
        // Generate romantic/meaningful sentence only for Today's APOD (single object, not array)
        if (mode === 'today' && !Array.isArray(response.data.apod)) {
          generateRomanticSentence(response.data.apod);
        } else {
          setRomanticSentence(null);
        }
      } else {
        setError(response.error || 'Failed to fetch APOD');
        setRomanticSentence(null);
      }
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const renderAPOD = (apod, index = null) => {
    if (!apod) return null;

    const isVideo = apod.media_type === 'video';
    // Always use thumbnail for videos if available, otherwise use the video URL
    const imageUrl = isVideo && apod.thumbnail_url 
      ? apod.thumbnail_url 
      : apod.url;
    const hdImageUrl = apod.hdurl;
    
    // Handle video URLs - convert YouTube embed URLs to watch URLs
    const getVideoUrl = (url) => {
      if (!url) return url;
      // Convert YouTube embed URLs to watch URLs
      const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) {
        return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
      }
      // Convert youtu.be short URLs to watch URLs
      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (shortMatch) {
        return `https://www.youtube.com/watch?v=${shortMatch[1]}`;
      }
      return url;
    };
    const videoUrl = isVideo ? getVideoUrl(apod.url) : null;

    return (
      <div 
        key={index !== null ? index : apod.date} 
        style={{ 
          marginBottom: index !== null ? '32px' : '0',
          borderRadius: '16px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.95) 0%, rgba(10, 5, 25, 0.95) 100%)',
          border: '1px solid rgba(138, 43, 226, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(138, 43, 226, 0.2)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Image/Video */}
        <div style={{ position: 'relative', width: '100%', background: '#000' }}>
          {isVideo ? (
            <div style={{ 
              padding: '60px 40px', 
              textAlign: 'center',
              background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Animated stars background */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(2px 2px at 20% 30%, white, transparent), radial-gradient(2px 2px at 60% 70%, white, transparent), radial-gradient(1px 1px at 50% 50%, white, transparent), radial-gradient(1px 1px at 80% 10%, white, transparent), radial-gradient(2px 2px at 90% 60%, white, transparent)',
                backgroundSize: '200% 200%',
                opacity: 0.6,
                animation: 'twinkle 8s ease-in-out infinite'
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))' }}>🎥</div>
                <div style={{ fontWeight: 700, marginBottom: '12px', fontSize: '18px', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>Video Content</div>
                <a 
                  href={videoUrl || apod.url} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ 
                    color: '#FFD700', 
                    textDecoration: 'none',
                    fontSize: '16px',
                    display: 'inline-block',
                    marginTop: '12px',
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 215, 0, 0.4)',
                    transition: 'all 0.3s',
                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
                    fontWeight: 600
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 140, 0, 0.3) 100%)';
                    e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.5)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  {videoUrl && videoUrl.includes('youtube.com') ? 'Watch on YouTube →' : 'Watch Video →'}
                </a>
              </div>
              {apod.thumbnail_url && (
                <div style={{ marginTop: '24px', position: 'relative', zIndex: 1 }}>
                  <img 
                    src={apod.thumbnail_url} 
                    alt="Video thumbnail"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px',
                      borderRadius: '12px',
                      border: '2px solid rgba(255, 215, 0, 0.4)',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <img 
              src={imageUrl} 
              alt={apod.title}
              style={{ 
                width: '100%', 
                height: 'auto',
                display: 'block'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          )}
          <div style={{ 
            display: 'none',
            padding: '60px 40px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)',
            color: '#FFD700',
            fontSize: '18px'
          }}>
            <div>Image failed to load</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', background: 'linear-gradient(180deg, rgba(20, 10, 40, 0.8) 0%, rgba(10, 5, 25, 0.9) 100%)' }}>
          {/* Title and Date */}
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '20px', 
              fontWeight: 700,
              color: '#FFD700',
              lineHeight: 1.3,
              textShadow: '0 0 20px rgba(255, 215, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.5)'
            }}>
              {apod.title}
            </h2>
            <div style={{ 
              color: '#B0C4DE', 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: 'rgba(138, 43, 226, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(138, 43, 226, 0.4)'
              }}>
                <span style={{ fontSize: '16px' }}>🌌</span> {formatDate(apod.date)}
              </span>
              {apod.copyright && (
                <span style={{ 
                  padding: '4px 12px',
                  background: 'rgba(70, 130, 180, 0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(70, 130, 180, 0.4)',
                  color: '#87CEEB'
                }}>
                  © {apod.copyright}
                </span>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div style={{ 
            color: '#E0E0E0', 
            fontSize: '15px', 
            lineHeight: 1.8,
            marginBottom: '20px',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
          }}>
            {apod.explanation}
          </div>

          {/* Links */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap',
            paddingTop: '16px',
            borderTop: '1px solid rgba(138, 43, 226, 0.3)'
          }}>
            {!isVideo && hdImageUrl && (
              <a 
                href={hdImageUrl} 
                target="_blank" 
                rel="noreferrer"
                style={{ 
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%)',
                  color: '#FFD700',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 140, 0, 0.3) 100%)';
                  e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 140, 0, 0.2) 100%)';
                  e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.2)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                ⭐ View HD Image
              </a>
            )}
            <a 
              href={isVideo ? (videoUrl || apod.url) : apod.url} 
              target="_blank" 
              rel="noreferrer"
              style={{ 
                padding: '10px 20px',
                background: 'linear-gradient(135deg, rgba(70, 130, 180, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)',
                color: '#87CEEB',
                textDecoration: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                border: '1px solid rgba(70, 130, 180, 0.4)',
                boxShadow: '0 4px 15px rgba(70, 130, 180, 0.2)',
                transition: 'all 0.3s'
              }}
              title={isVideo ? `Video URL: ${videoUrl || apod.url}` : 'View original on NASA'}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(70, 130, 180, 0.3) 0%, rgba(138, 43, 226, 0.3) 100%)';
                e.target.style.boxShadow = '0 6px 20px rgba(70, 130, 180, 0.4)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(70, 130, 180, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)';
                e.target.style.boxShadow = '0 4px 15px rgba(70, 130, 180, 0.2)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              {isVideo ? '🎬 Watch Video' : '🔗 View Original'}
            </a>
            {apod.service_version && (
              <span style={{ 
                padding: '10px 16px',
                color: '#9370DB',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(147, 112, 219, 0.15)',
                borderRadius: '10px',
                border: '1px solid rgba(147, 112, 219, 0.3)'
              }}>
                API v{apod.service_version}
              </span>
            )}
          </div>

          {/* Romantic/Meaningful Sentence - Only for Today's APOD */}
          {mode === 'today' && index === null && (romanticSentence || generatingSentence) && (
            <div style={{
              marginTop: '24px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 140, 0, 0.15) 50%, rgba(138, 43, 226, 0.15) 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 215, 0, 0.4)',
              boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3), 0 0 30px rgba(255, 215, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Shining overlay effect */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                animation: 'shine 3s infinite',
                pointerEvents: 'none'
              }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: '#FFD700',
                  fontWeight: 600,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
                }}>
                  ✨ AI Reflection
                </div>
                {generatingSentence ? (
                  <div style={{
                    color: '#FFD700',
                    fontSize: '16px',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    textShadow: '0 0 15px rgba(255, 215, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>✨</span>
                    <span>Contemplating the cosmos...</span>
                  </div>
                ) : romanticSentence ? (
                  <div style={{
                    color: '#FFD700',
                    fontSize: '16px',
                    fontStyle: 'italic',
                    lineHeight: 1.8,
                    textShadow: '0 0 20px rgba(255, 215, 0, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)',
                    fontWeight: 500,
                    letterSpacing: '0.3px'
                  }}>
                    "{romanticSentence}"
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      padding: '24px', 
      fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
      maxWidth: '100%',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'auto'
    }}>
      {/* Animated starry background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(2px 2px at 20% 30%, rgba(255, 255, 255, 0.8), transparent),
          radial-gradient(2px 2px at 60% 70%, rgba(255, 255, 255, 0.6), transparent),
          radial-gradient(1px 1px at 50% 50%, rgba(255, 255, 255, 0.9), transparent),
          radial-gradient(1px 1px at 80% 10%, rgba(255, 255, 255, 0.7), transparent),
          radial-gradient(2px 2px at 90% 60%, rgba(255, 255, 255, 0.8), transparent),
          radial-gradient(1px 1px at 30% 80%, rgba(255, 255, 255, 0.6), transparent),
          radial-gradient(2px 2px at 70% 20%, rgba(255, 255, 255, 0.7), transparent),
          radial-gradient(1px 1px at 40% 50%, rgba(255, 255, 255, 0.8), transparent)
        `,
        backgroundSize: '200% 200%',
        opacity: 0.6,
        animation: 'twinkle 10s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Nebula overlay */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(138, 43, 226, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(70, 130, 180, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '24px', 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #87CEEB 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
            letterSpacing: '1px'
          }}>
            🚀 NASA Astronomy Picture of the Day
          </h1>
          <p style={{ 
            margin: 0, 
            color: '#B0C4DE', 
            fontSize: '14px',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
          }}>
            Explore the cosmos with NASA's daily astronomical images
          </p>
        </div>

        {/* Controls */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.95) 0%, rgba(20, 10, 40, 0.95) 100%)',
          padding: '28px',
          borderRadius: '20px',
          border: '1px solid rgba(138, 43, 226, 0.4)',
          marginBottom: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 30px rgba(138, 43, 226, 0.2)',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Mode Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '12px', 
              fontWeight: 700,
              fontSize: '16px',
              color: '#FFD700',
              textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
            }}>
              Query Mode
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['today', 'date', 'range', 'random'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setApodData(null);
                  }}
                  style={{
                    padding: '12px 20px',
                    background: mode === m 
                      ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 140, 0, 0.3) 100%)'
                      : 'linear-gradient(135deg, rgba(70, 130, 180, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)',
                    color: mode === m ? '#FFD700' : '#87CEEB',
                    border: mode === m 
                      ? '1px solid rgba(255, 215, 0, 0.5)'
                      : '1px solid rgba(70, 130, 180, 0.4)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    boxShadow: mode === m 
                      ? '0 4px 15px rgba(255, 215, 0, 0.3), 0 0 20px rgba(255, 215, 0, 0.2)'
                      : '0 2px 10px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (mode !== m) {
                      e.target.style.background = 'linear-gradient(135deg, rgba(70, 130, 180, 0.3) 0%, rgba(138, 43, 226, 0.3) 100%)';
                      e.target.style.boxShadow = '0 4px 15px rgba(70, 130, 180, 0.4)';
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (mode !== m) {
                      e.target.style.background = 'linear-gradient(135deg, rgba(70, 130, 180, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)';
                      e.target.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {m === 'today' ? "🌌 Today's APOD" : m === 'date' ? '📅 Specific Date' : m === 'range' ? '📆 Date Range' : '🎲 Random'}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific inputs */}
          {mode === 'date' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                fontWeight: 600,
                fontSize: '14px',
                color: '#87CEEB'
              }}>
                Date (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={{ 
                  width: '100%',
                  maxWidth: '300px',
                  padding: '12px 16px', 
                  border: '1px solid rgba(138, 43, 226, 0.4)', 
                  borderRadius: '12px', 
                  fontSize: '14px',
                  background: 'rgba(20, 10, 40, 0.8)',
                  color: '#E0E0E0',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
          )}

          {mode === 'range' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '10px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#87CEEB'
                }}>
                  Start Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || new Date().toISOString().split('T')[0]}
                  style={{ 
                    width: '100%',
                    maxWidth: '300px',
                    padding: '12px 16px', 
                    border: '1px solid rgba(138, 43, 226, 0.4)', 
                    borderRadius: '12px', 
                    fontSize: '14px',
                    background: 'rgba(20, 10, 40, 0.8)',
                    color: '#E0E0E0',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '10px', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#87CEEB'
                }}>
                  End Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ 
                    width: '100%',
                    maxWidth: '300px',
                    padding: '12px 16px', 
                    border: '1px solid rgba(138, 43, 226, 0.4)', 
                    borderRadius: '12px', 
                    fontSize: '14px',
                    background: 'rgba(20, 10, 40, 0.8)',
                    color: '#E0E0E0',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </div>
            </div>
          )}

          {mode === 'random' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                fontWeight: 600,
                fontSize: '14px',
                color: '#87CEEB'
              }}>
                Number of Random Images (1-100)
              </label>
              <input
                type="number"
                value={count}
                min={1}
                max={100}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ 
                  width: '100%',
                  maxWidth: '200px',
                  padding: '12px 16px', 
                  border: '1px solid rgba(138, 43, 226, 0.4)', 
                  borderRadius: '12px', 
                  fontSize: '14px',
                  background: 'rgba(20, 10, 40, 0.8)',
                  color: '#E0E0E0',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
          )}

          {/* Fetch Button */}
          <button
            onClick={fetchAPOD}
            disabled={loading || (mode === 'date' && !date) || (mode === 'range' && !startDate)}
            style={{
              padding: '14px 28px',
              background: loading 
                ? 'linear-gradient(135deg, rgba(100, 100, 100, 0.3) 0%, rgba(80, 80, 80, 0.3) 100%)'
                : 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 140, 0, 0.3) 100%)',
              color: loading ? '#999' : '#FFD700',
              border: loading 
                ? '1px solid rgba(100, 100, 100, 0.4)'
                : '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: '350px',
              boxShadow: loading 
                ? '0 2px 10px rgba(0, 0, 0, 0.3)'
                : '0 6px 25px rgba(255, 215, 0, 0.4), 0 0 30px rgba(255, 215, 0, 0.2)',
              transition: 'all 0.3s',
              textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.boxShadow = '0 8px 30px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.3)';
                e.target.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.boxShadow = '0 6px 25px rgba(255, 215, 0, 0.4), 0 0 30px rgba(255, 215, 0, 0.2)';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? '⏳ Loading...' : mode === 'today' ? "✨ Load Today's APOD" : '🚀 Fetch APOD'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ 
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(220, 20, 60, 0.2) 0%, rgba(139, 0, 0, 0.2) 100%)',
            border: '1px solid rgba(220, 20, 60, 0.5)',
            borderRadius: '16px',
            color: '#FF6B6B',
            marginBottom: '32px',
            fontSize: '15px',
            boxShadow: '0 4px 20px rgba(220, 20, 60, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <strong style={{ color: '#FFB6C1' }}>⚠️ Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {!loading && apodData && (
          <div>
            {Array.isArray(apodData) ? (
              <div>
                <div style={{ 
                  marginBottom: '24px',
                  padding: '16px 24px',
                  background: 'linear-gradient(135deg, rgba(70, 130, 180, 0.2) 0%, rgba(138, 43, 226, 0.2) 100%)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  color: '#87CEEB',
                  fontWeight: 600,
                  border: '1px solid rgba(70, 130, 180, 0.4)',
                  boxShadow: '0 4px 15px rgba(70, 130, 180, 0.2)',
                  textAlign: 'center'
                }}>
                  ✨ Found {apodData.length} APOD{apodData.length !== 1 ? 's' : ''}
                </div>
                {apodData.map((apod, index) => renderAPOD(apod, index))}
              </div>
            ) : (
              renderAPOD(apodData)
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ 
            padding: '60px 40px',
            textAlign: 'center',
            color: '#87CEEB',
            fontSize: '18px'
          }}>
            <div style={{ 
              marginBottom: '20px',
              fontSize: '48px',
              animation: 'spin 2s linear infinite',
              filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.5))'
            }}>🌌</div>
            <div style={{ 
              textShadow: '0 0 20px rgba(135, 206, 235, 0.5)',
              fontWeight: 600
            }}>
              Exploring the cosmos...
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shine {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default NASAAPODWidget;
