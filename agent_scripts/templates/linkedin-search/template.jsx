import React, { useState } from 'react';

function LinkedInSearchWidget() {
  // Persistent storage for search results
  const [profiles, setProfiles] = useStorage('linkedin.search.profiles', []);
  const [savedProfiles, setSavedProfiles] = useGlobalStorage('linkedin.savedProfiles', []);
  
  const [searchName, setSearchName] = useStorage('linkedin.search.name', '');
  const [searchCompany, setSearchCompany] = useStorage('linkedin.search.company', '');
  const [searchTitle, setSearchTitle] = useStorage('linkedin.search.title', '');
  const [searchEducation, setSearchEducation] = useStorage('linkedin.search.education', '');
  const [searchLocation, setSearchLocation] = useStorage('linkedin.search.location', '');
  const [view, setView] = useStorage('linkedin.search.view', 'search'); // 'search' or 'saved'

  // UI state (temporary)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedProfilesSearchQuery, setSavedProfilesSearchQuery] = useState('');

  // Search LinkedIn profiles
  const searchProfiles = async () => {
    const name = searchName.trim();
    const company = searchCompany.trim();
    const title = searchTitle.trim();
    const education = searchEducation.trim();
    const location = searchLocation.trim();

    // At least one field should be filled
    if (!name && !company && !title && !education && !location) {
      setError('Please fill in at least one search field');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 Searching LinkedIn profiles:', { name, company, title, education, location });
      
      const response = await miyagiAPI.post('/api/integrations/linkedin-search-profiles', {
        name: name,
        company: company,
        title: title,
        education: education,
        location: location,
        start: 0
      });
      
      console.log('🔍 LinkedIn API response:', response);

      if (response.data.profiles && response.data.profiles.length > 0) {
        const profileResults = response.data.profiles.map(profile => ({
          id: profile.id,
          name: profile.name,
          headline: profile.headline,
          location: profile.location,
          company: profile.company,
          profileUrl: profile.profileUrl,
          imageUrl: profile.imageUrl,
          connections: profile.connections,
          summary: profile.summary
        }));

        setProfiles(profileResults);
        setSearchName(name);
        setSearchCompany(company);
        setSearchTitle(title);
        setSearchEducation(education);
        setSearchLocation(location);
        setView('search');
      } else {
        setError('No profiles found. Try different search criteria.');
      }
    } catch (e) {
      setError(`Search failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save profile for outreach planning
  const saveProfile = (profile) => {
    const isAlreadySaved = savedProfiles.some(p => p.id === profile.id);
    if (isAlreadySaved) {
      setError('Profile already saved');
      return;
    }

    const profileToSave = {
      ...profile,
      savedAt: new Date().toISOString(),
      notes: ''
    };

    const newProfiles = [...savedProfiles, profileToSave];
    setSavedProfiles(newProfiles);
    setError('');
  };

  // Remove saved profile
  const removeSavedProfile = (profileId) => {
    const newProfiles = savedProfiles.filter(p => p.id !== profileId);
    setSavedProfiles(newProfiles);
  };

  // Get filtered saved profiles based on search query
  const getFilteredSavedProfiles = () => {
    if (!savedProfilesSearchQuery.trim()) return savedProfiles;
    
    const query = savedProfilesSearchQuery.toLowerCase();
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

  // Clear search results
  const clearSearch = () => {
    setProfiles([]);
    setSearchName('');
    setSearchCompany('');
    setSearchTitle('');
    setSearchEducation('');
    setSearchLocation('');
    if (nameInputRef.current) nameInputRef.current.value = '';
    if (companyInputRef.current) companyInputRef.current.value = '';
    if (titleInputRef.current) titleInputRef.current.value = '';
    if (educationInputRef.current) educationInputRef.current.value = '';
    if (locationInputRef.current) locationInputRef.current.value = '';
  };

  // Handle key press for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchProfiles();
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
            🔍
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
              LinkedIn Profile Search
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Search for LinkedIn profiles and save them for outreach planning
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid rgba(30, 58, 138, 0.1)'
        }}>
          <button
            onClick={() => setView('search')}
            style={{
              padding: '12px 20px',
              backgroundColor: view === 'search' ? '#1e3a8a' : 'transparent',
              color: view === 'search' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Search Profiles
          </button>
          <button
            onClick={() => setView('saved')}
            style={{
              padding: '12px 20px',
              backgroundColor: view === 'saved' ? '#1e3a8a' : 'transparent',
              color: view === 'saved' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Saved Profiles ({savedProfiles.length})
          </button>
        </div>

        {/* Search Section */}
        {view === 'search' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                type="text"
                placeholder="Name"
                style={{
                  padding: '16px 20px',
                  border: '2px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onKeyPress={handleKeyPress}
                onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
              />
              
              <input
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                type="text"
                placeholder="Company"
                style={{
                  padding: '16px 20px',
                  border: '2px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onKeyPress={handleKeyPress}
                onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
              />
              
              <input
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                type="text"
                placeholder="Title"
                style={{
                  padding: '16px 20px',
                  border: '2px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onKeyPress={handleKeyPress}
                onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
              />
              
              <input
                value={searchEducation}
                onChange={(e) => setSearchEducation(e.target.value)}
                type="text"
                placeholder="Education (University)"
                style={{
                  padding: '16px 20px',
                  border: '2px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onKeyPress={handleKeyPress}
                onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
              />
              
              <input
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                type="text"
                placeholder="Location"
                style={{
                  padding: '16px 20px',
                  border: '2px solid rgba(30, 58, 138, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  gridColumn: '1 / -1'
                }}
                onKeyPress={handleKeyPress}
                onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <button
                onClick={searchProfiles}
                disabled={isLoading}
                style={{
                  padding: '16px 32px',
                  background: isLoading 
                    ? 'linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%)' 
                    : 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: isLoading 
                    ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                    : '0 8px 24px rgba(30, 58, 138, 0.3)',
                  minWidth: '160px'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 12px 32px rgba(30, 58, 138, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 8px 24px rgba(30, 58, 138, 0.3)';
                  }
                }}
              >
                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Searching...
                  </div>
                ) : (
                  'Search Profiles'
                )}
              </button>
              
              {profiles.length > 0 && (
                <button
                  onClick={clearSearch}
                  style={{
                    padding: '16px 24px',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    border: '2px solid #64748b',
                    borderRadius: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
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
                  Clear Results
                </button>
              )}
            </div>
          </>
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
      </div>

      {/* Search Results */}
      {view === 'search' && profiles.length > 0 && (
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
              Profiles Found ({profiles.length})
            </h2>
          </div>
          
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {profiles.map((profile, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(30, 58, 138, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 24px rgba(30, 58, 138, 0.15)';
                  e.target.style.borderColor = 'rgba(30, 58, 138, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                  e.target.style.borderColor = 'rgba(30, 58, 138, 0.1)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#1e293b',
                      margin: '0 0 8px 0',
                      lineHeight: '1.4'
                    }}>
                      {profile.name}
                    </h3>
                    
                    {profile.headline && (
                      <p style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e3a8a',
                        margin: '0 0 8px 0',
                        lineHeight: '1.4'
                      }}>
                        {profile.headline}
                      </p>
                    )}
                    
                    {profile.summary && (
                      <p style={{
                        fontSize: '14px',
                        color: '#4a5568',
                        lineHeight: '1.6',
                        margin: 0
                      }}>
                        {profile.summary}
                      </p>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minWidth: '120px'
                  }}>
                    <button
                      onClick={() => saveProfile(profile)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#059669';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#10b981';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      💾 Save Profile
                    </button>
                    
                    {profile.profileUrl && (
                      <button
                        onClick={() => window.open(profile.profileUrl, '_blank')}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#1e3a8a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
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
                    
                    {profile.profileUrl && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(profile.profileUrl);
                          setError('Profile link copied to clipboard!');
                          setTimeout(() => setError(''), 2000);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: 'transparent',
                          color: '#1e3a8a',
                          border: '1px solid #1e3a8a',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#1e3a8a';
                          e.target.style.color = 'white';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.color = '#1e3a8a';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        📋 Copy Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Profiles */}
      {view === 'saved' && (
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
              💾
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Saved Profiles ({getFilteredSavedProfiles().length}
              {savedProfilesSearchQuery && savedProfiles.length !== getFilteredSavedProfiles().length && ` of ${savedProfiles.length}`})
            </h2>
          </div>

          {/* Search Input for Saved Profiles */}
          {savedProfiles.length > 0 && (
            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <input
                type="text"
                value={savedProfilesSearchQuery}
                onChange={(e) => setSavedProfilesSearchQuery(e.target.value)}
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
              {savedProfilesSearchQuery && (
                <button
                  onClick={() => setSavedProfilesSearchQuery('')}
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
          )}
          
          {savedProfiles.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: '#64748b'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                📋
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                No saved profiles yet
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Search for profiles and save them for outreach planning
              </p>
            </div>
          ) : getFilteredSavedProfiles().length === 0 ? (
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
                Try different keywords or <span style={{ color: '#4299e1', cursor: 'pointer' }} onClick={() => setSavedProfilesSearchQuery('')}>clear search</span>
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '20px'
            }}>
              {getFilteredSavedProfiles().map((profile, index) => (
                <div
                  key={index}
                  style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(30, 58, 138, 0.1)',
                    borderRadius: '16px',
                    padding: '24px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    {profile.imageUrl && (
                      <img
                        src={profile.imageUrl}
                        alt={profile.name}
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '12px',
                          objectFit: 'cover',
                          border: '2px solid rgba(30, 58, 138, 0.1)'
                        }}
                      />
                    )}
                    
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
                              onClick={() => window.open(profile.profileUrl, '_blank')}
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
                          
                          {profile.profileUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(profile.profileUrl);
                                setError('Profile link copied to clipboard!');
                                setTimeout(() => setError(''), 2000);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'transparent',
                                color: '#1e3a8a',
                                border: '1px solid #1e3a8a',
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
                                e.target.style.backgroundColor = '#1e3a8a';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = '#1e3a8a';
                                e.target.style.transform = 'translateY(0)';
                              }}
                            >
                              📋 Copy
                            </button>
                          )}
                          
                          <button
                            onClick={() => removeSavedProfile(profile.id)}
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
                      
                      {profile.headline && (
                        <p style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e3a8a',
                          margin: '0 0 8px 0',
                          lineHeight: '1.4'
                        }}>
                          {profile.headline}
                        </p>
                      )}
                      
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '12px',
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        {profile.location && (
                          <span>📍 {profile.location}</span>
                        )}
                        {profile.company && (
                          <span>🏢 {profile.company}</span>
                        )}
                        {profile.connections && (
                          <span>🔗 {profile.connections}</span>
                        )}
                      </div>
                      
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        marginTop: '8px'
                      }}>
                        Saved on {new Date(profile.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

export default LinkedInSearchWidget;
