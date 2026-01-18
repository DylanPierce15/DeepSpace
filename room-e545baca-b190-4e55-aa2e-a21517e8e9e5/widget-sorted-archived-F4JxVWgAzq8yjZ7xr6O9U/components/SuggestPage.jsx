import React, { useState, useEffect } from 'react';

export default function SuggestPage({ isActive }) {
  const [url, setUrl] = useState('');
  const [suggestions, setSuggestions] = useGlobalStorage('discovery-hub-suggestions', []);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Apply dark retro background
  useEffect(() => {
    if (!isActive) return;

    document.body.style.background = '#0a0a12';
    document.body.style.transition = 'background 0.5s ease';
    
    return () => {
      document.body.style.background = '#0a0a12';
    };
  }, [isActive]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    // Add to suggestions
    const newSuggestion = {
      id: Date.now(),
      url: url.trim(),
      timestamp: new Date().toISOString(),
    };

    setSuggestions(prev => [...(prev || []), newSuggestion]);
    
    // Show success state
    setSubmitted(true);
    setUrl('');
    setError('');

    // Reset after 3 seconds
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setError('');
  };

  if (!isActive) return null;

  return (
    <div 
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{
        fontFamily: 'VT323, monospace',
      }}
    >
      {/* Starfield background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(1px 1px at 20px 30px, #fff, transparent),
            radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 90px 40px, #FF10F0, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 160px 120px, #FF10F0, transparent),
            radial-gradient(1px 1px at 200px 50px, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 20px 130px, rgba(255,255,255,0.9), transparent),
            radial-gradient(1px 1px at 100px 180px, rgba(255,255,255,0.4), transparent),
            radial-gradient(1.5px 1.5px at 180px 20px, #FF10F0, transparent)
          `,
          backgroundSize: '250px 220px',
          zIndex: 0,
        }}
      />

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 100%)',
          zIndex: 99,
        }}
      />

      {/* Content */}
      <div 
        className="relative z-50 max-w-2xl w-full mx-8"
        style={{
          marginTop: '80px', // Space for navigation
        }}
      >
        {/* Title Box */}
        <div 
          className="mb-8 p-6 text-center"
          style={{
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            border: '4px solid',
            borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
            boxShadow: 'inset 3px 3px 0 #4a4a6a, inset -3px -3px 0 #08080f, 0 0 40px #FF10F030',
          }}
        >
          <div 
            className="mb-2"
            style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '16px',
              color: '#FF10F0',
              textShadow: '0 0 15px #FF10F0',
              letterSpacing: '2px',
            }}
          >
            SUGGEST A WEBSITE
          </div>
          <div 
            style={{
              fontSize: '20px',
              color: '#aaa',
              lineHeight: '1.6',
            }}
          >
            Found a cool website? Share it with us! {'\u{1F680}'}
          </div>
        </div>

        {/* Form Box */}
        <div 
          className="p-8"
          style={{
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            border: '4px solid',
            borderColor: '#3a3a5a #0a0a12 #0a0a12 #3a3a5a',
            boxShadow: 'inset 3px 3px 0 #4a4a6a, inset -3px -3px 0 #08080f, 0 0 40px #FF10F030',
          }}
        >
          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label 
                  className="block mb-3"
                  style={{
                    fontSize: '18px',
                    color: '#ccc',
                    letterSpacing: '1px',
                  }}
                >
                  WEBSITE URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={handleUrlChange}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3"
                  style={{
                    fontFamily: 'VT323, monospace',
                    fontSize: '20px',
                    background: 'linear-gradient(180deg, #0a0a12 0%, #12121f 100%)',
                    border: '2px solid',
                    borderColor: '#2a2a3a #4a4a6a #4a4a6a #2a2a3a',
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.5)',
                    color: '#39FF14',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#5a5a7a #7a7a9a #7a7a9a #5a5a7a';
                    e.target.style.boxShadow = 'inset 2px 2px 4px rgba(0,0,0,0.5), 0 0 10px #FF10F040';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#2a2a3a #4a4a6a #4a4a6a #2a2a3a';
                    e.target.style.boxShadow = 'inset 2px 2px 4px rgba(0,0,0,0.5)';
                  }}
                />
                {error && (
                  <div 
                    className="mt-2"
                    style={{
                      fontSize: '16px',
                      color: '#FF3300',
                      textShadow: '0 0 8px #FF3300',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3"
                style={{
                  fontFamily: 'VT323, monospace',
                  fontSize: '20px',
                  background: 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)',
                  border: '2px solid',
                  borderColor: '#4a4a6a #1a1a22 #1a1a22 #4a4a6a',
                  boxShadow: 'inset 1px 1px 0 #5a5a7a, 0 0 10px #FF10F040',
                  color: '#FF10F0',
                  textShadow: '0 0 8px #FF10F0',
                  cursor: 'pointer',
                  letterSpacing: '2px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(180deg, #3a3a55 0%, #2a2a40 100%)';
                  e.target.style.boxShadow = 'inset 1px 1px 0 #6a6a8a, 0 0 20px #FF10F060';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(180deg, #2e2e45 0%, #1e1e30 100%)';
                  e.target.style.boxShadow = 'inset 1px 1px 0 #5a5a7a, 0 0 10px #FF10F040';
                }}
              >
                [SUBMIT SUGGESTION]
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              <div 
                className="mb-4"
                style={{
                  fontSize: '48px',
                }}
              >
                ✓
              </div>
              <div 
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '14px',
                  color: '#39FF14',
                  textShadow: '0 0 15px #39FF14',
                  letterSpacing: '2px',
                  marginBottom: '12px',
                }}
              >
                SUGGESTION RECEIVED!
              </div>
              <div 
                style={{
                  fontSize: '18px',
                  color: '#aaa',
                }}
              >
                Thank you for sharing {'\u{1F4AB}'}
              </div>
            </div>
          )}
        </div>

        {/* Info text */}
        <div 
          className="mt-6 text-center"
          style={{
            fontSize: '16px',
            color: '#666',
            lineHeight: '1.6',
          }}
        >
          We review all suggestions and add the best ones to Discovery Hub
        </div>
      </div>
    </div>
  );
}
