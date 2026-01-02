import React, { useState, useRef } from 'react';

function LinkedInAnalyzerWidget() {
  // Persistent storage for analysis data
  // Use global storage to share saved profiles with search widget
  const [savedProfiles, setSavedProfiles] = useGlobalStorage('linkedin.savedProfiles', []);
  
  const [selectedProfiles, setSelectedProfiles] = useStorage('linkedin.analyzer.selected', []);
  const [analysisResults, setAnalysisResults] = useStorage('linkedin.analyzer.results', []);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI state (temporary)
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [error, setError] = useState('');
  const [profileSearchQuery, setProfileSearchQuery] = useState('');

  // Refs
  const profileUrlInputRef = useRef(null);

  // Analyze profile from URL
  const analyzeProfileFromUrl = async () => {
    const profileUrl = profileUrlInputRef.current?.value?.trim();
    
    if (!profileUrl) {
      setError('Please enter a LinkedIn profile URL');
      return;
    }

    // Basic URL validation
    if (!profileUrl.includes('linkedin.com/in/')) {
      setError('Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)');
      return;
    }

    setIsAnalyzingUrl(true);
    setError('');

    try {
      console.log('🔍 Analyzing LinkedIn profile from URL:', profileUrl);
      
      const response = await miyagiAPI.post('/api/integrations/linkedin-analyze-profile-url', {
        profileUrl: profileUrl
      });
      
      console.log('🔍 LinkedIn URL analysis response:', response);

      if (response.success && response.data.analysis) {
        setAnalysisResults([response.data.analysis]);
        setShowAnalysis(true);
        profileUrlInputRef.current.value = '';
      } else {
        setError('Failed to analyze profile. Please check the URL and try again.');
      }
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsAnalyzingUrl(false);
    }
  };

  // Toggle profile selection
  const toggleProfileSelection = (profileId) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  // Analyze selected profiles
  const analyzeProfiles = async () => {
    if (selectedProfiles.length === 0) {
      setError('Please select at least one profile to analyze');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const selectedProfilesData = selectedProfiles.map(id => 
        savedProfiles.find(p => p.id === id)
      ).filter(Boolean);

      const response = await miyagiAPI.post('/api/integrations/linkedin-analyze-profiles', {
        profiles: selectedProfilesData
      });

      if (response.success) {
        setAnalysisResults(response.data.analysis || []);
        setShowAnalysis(true);
        setSelectedProfiles([]);
      } else {
        setError('Failed to analyze profiles');
      }
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove profile
  const removeProfile = (profileId) => {
    const newProfiles = savedProfiles.filter(p => p.id !== profileId);
    const newSelected = selectedProfiles.filter(id => id !== profileId);
    setSavedProfiles(newProfiles);
    setSelectedProfiles(newSelected);
  };

  // Get filtered profiles based on search query
  const getFilteredProfiles = () => {
    if (!profileSearchQuery.trim()) return savedProfiles;
    
    const query = profileSearchQuery.toLowerCase();
    return savedProfiles.filter(profile => {
      const searchableText = [
        profile.name,
        profile.company,
        profile.headline,
        profile.location,
        profile.summary,
        profile.connections
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(query);
    });
  };

  // Clear all profiles
  const clearAllProfiles = () => {
    setSavedProfiles([]);
    setSelectedProfiles([]);
    setAnalysisResults([]);
    setShowAnalysis(false);
    setError('');
  };

  // Refresh saved profiles from global storage
  const refreshProfiles = async () => {
    setIsRefreshing(true);
    try {
      // Force a re-read of the global storage
      // This triggers a re-render with the latest data
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsRefreshing(false);
    } catch (err) {
      console.error('Failed to refresh profiles:', err);
      setIsRefreshing(false);
    }
  };


  // Handle key press for URL analysis
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      analyzeProfileFromUrl();
    }
  };

  return (
    <div style={{
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #64748b 100%)',
      minHeight: '100vh',
      position: 'relative'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
        marginBottom: '24px',
        position: 'relative',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '12px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 8px 16px rgba(30, 58, 138, 0.3)'
          }}>
            📊
          </div>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              LinkedIn Profile Analyzer
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Analyze profiles for outreach potential and generate talking points
            </p>
          </div>
        </div>

        {/* Saved Profiles Info */}
        <div style={{
          background: 'rgba(30, 58, 138, 0.05)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(30, 58, 138, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}>
              💾
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>
              Saved Profiles from LinkedIn Search
            </h3>
            <button
              onClick={refreshProfiles}
              disabled={isRefreshing}
              style={{
                padding: '8px 16px',
                backgroundColor: isRefreshing ? '#e5e7eb' : '#1e3a8a',
                color: isRefreshing ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                minWidth: '80px'
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) {
                  e.target.style.backgroundColor = '#1e40af';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRefreshing) {
                  e.target.style.backgroundColor = '#1e3a8a';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {isRefreshing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Refresh
                </div>
              ) : (
                '🔄 Refresh'
              )}
            </button>
          </div>
          
          {savedProfiles.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 20px',
              color: '#64748b'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                📋
              </div>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                No saved profiles yet
              </h4>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Use the LinkedIn Profile Search widget to find and save profiles first
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '8px',
              border: '1px solid rgba(30, 58, 138, 0.1)'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981'
              }} />
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {savedProfiles.length} profile{savedProfiles.length !== 1 ? 's' : ''} available for analysis
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {savedProfiles.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            padding: '16px 20px',
            background: 'rgba(30, 58, 138, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(30, 58, 138, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: selectedProfiles.length > 0 ? '#1e3a8a' : '#64748b'
              }} />
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151'
              }}>
                {selectedProfiles.length} profile{selectedProfiles.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={clearAllProfiles}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  border: '1px solid #64748b',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#64748b';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#64748b';
                }}
              >
                Clear All
              </button>
              <button
                onClick={analyzeProfiles}
                disabled={selectedProfiles.length === 0 || isLoading}
                style={{
                  padding: '8px 20px',
                  backgroundColor: selectedProfiles.length === 0 || isLoading ? '#e5e7eb' : '#1e3a8a',
                  color: selectedProfiles.length === 0 || isLoading ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedProfiles.length === 0 || isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '140px'
                }}
                onMouseEnter={(e) => {
                  if (!(selectedProfiles.length === 0 || isLoading)) {
                    e.target.style.backgroundColor = '#1e40af';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(selectedProfiles.length === 0 || isLoading)) {
                    e.target.style.backgroundColor = '#1e3a8a';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isLoading ? 'Analyzing...' : 'Analyze Profiles'}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            background: 'linear-gradient(135deg, #fed7d7 0%, #feb2b2 100%)',
            color: '#c53030',
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid rgba(197, 48, 48, 0.2)',
            boxShadow: '0 4px 12px rgba(197, 48, 48, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#c53030',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              !
            </div>
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '32px 20px',
            color: '#1e3a8a'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.8)',
              padding: '16px 24px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '3px solid rgba(30, 58, 138, 0.2)',
                borderTop: '3px solid #1e3a8a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ 
                fontSize: '16px', 
                fontWeight: '500',
                color: '#1e3a8a'
              }}>
                Analyzing profiles for outreach potential...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Profiles List */}
      {savedProfiles.length > 0 && !showAnalysis && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}>
              👥
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Select Profiles to Analyze ({getFilteredProfiles().length}
              {profileSearchQuery && savedProfiles.length !== getFilteredProfiles().length && ` of ${savedProfiles.length}`})
            </h2>
          </div>

          {/* Search Input */}
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <input
              type="text"
              value={profileSearchQuery}
              onChange={(e) => setProfileSearchQuery(e.target.value)}
              placeholder="Search by name, company, title, location..."
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                backgroundColor: 'white'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4299e1';
                e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
            <div style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#4299e1'
            }}>
              🔍
            </div>
            {profileSearchQuery && (
              <button
                onClick={() => setProfileSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#718096'
                }}
              >
                ✕
              </button>
            )}
          </div>
          
          {/* No Search Results Message */}
          {profileSearchQuery && getFilteredProfiles().length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: '#64748b'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                🔍
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                No profiles match your search
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Try different keywords or <span style={{ color: '#4299e1', cursor: 'pointer' }} onClick={() => setProfileSearchQuery('')}>clear search</span>
              </p>
            </div>
          )}
          
          {/* Profiles Grid */}
          {(!profileSearchQuery || getFilteredProfiles().length > 0) && (
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {getFilteredProfiles().map((profile) => (
              <div
                key={profile.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(30, 58, 138, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onClick={() => toggleProfileSelection(profile.id)}
                onMouseEnter={(e) => {
                  if (!selectedProfiles.includes(profile.id)) {
                    e.target.style.backgroundColor = 'rgba(30, 58, 138, 0.05)';
                    e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedProfiles.includes(profile.id)) {
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                    e.target.style.borderColor = 'rgba(30, 58, 138, 0.1)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={() => toggleProfileSelection(profile.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        margin: 0,
                        lineHeight: '1.4'
                      }}>
                        {profile.name}
                      </h3>
                      <div style={{
                        display: 'flex',
                        gap: '8px'
                      }}>
                        {profile.profileUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(profile.profileUrl, '_blank');
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#1e3a8a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#1e40af';
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#1e3a8a';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            🔗 Open
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProfile(profile.id);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#dc2626';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#ef4444';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    <p style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e3a8a',
                      margin: '0 0 8px 0',
                      lineHeight: '1.4'
                    }}>
                      {profile.headline}
                    </p>
                    
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      marginBottom: '12px',
                      fontSize: '14px',
                      color: '#64748b'
                    }}>
                      <span>🏢 {profile.company}</span>
                      <span>📍 {profile.location}</span>
                    </div>
                    
                    <p style={{
                      fontSize: '14px',
                      color: '#4a5568',
                      lineHeight: '1.6',
                      margin: 0
                    }}>
                      {profile.summary.substring(0, 150)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {showAnalysis && analysisResults.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                📊
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                Analysis Results
              </h2>
            </div>
            <button
              onClick={() => setShowAnalysis(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Back to Profiles
            </button>
          </div>
          
          <div style={{
            display: 'grid',
            gap: '24px'
          }}>
            {analysisResults.map((analysis, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(30, 58, 138, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
              >
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '8px'
                }}>
                  {analysis.profileName}
                </h3>
                
                {analysis.summary && (
                  <div style={{
                    fontSize: '14px',
                    color: '#64748b',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(30, 58, 138, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(30, 58, 138, 0.1)',
                    lineHeight: '1.5'
                  }}>
                    {analysis.summary}
                  </div>
                )}
                
                <div style={{
                  display: 'grid',
                  gap: '16px'
                }}>
                  {analysis.outreachPotential && (
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e3a8a',
                        marginBottom: '8px'
                      }}>
                        🎯 Outreach Potential
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#4a5568',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-line'
                      }}>
                        {analysis.outreachPotential}
                      </p>
                    </div>
                  )}
                  
                  {analysis.connectionPoints && (
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e3a8a',
                        marginBottom: '8px'
                      }}>
                        🔗 Connection Points
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#4a5568',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-line'
                      }}>
                        {analysis.connectionPoints}
                      </p>
                    </div>
                  )}
                  
                  {analysis.talkingPoints && (
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e3a8a',
                        marginBottom: '8px'
                      }}>
                        💬 Talking Points
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#4a5568',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-line'
                      }}>
                        {analysis.talkingPoints}
                      </p>
                    </div>
                  )}
                  
                  {analysis.personalizationIdeas && (
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e3a8a',
                        marginBottom: '8px'
                      }}>
                        ✨ Personalization Ideas
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#4a5568',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-line'
                      }}>
                        {analysis.personalizationIdeas}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LinkedInAnalyzerWidget;
