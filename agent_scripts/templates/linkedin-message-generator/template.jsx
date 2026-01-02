import React, { useState, useRef } from 'react';

function LinkedInMessageGeneratorWidget() {
  // Persistent storage for message generation
  const [savedProfiles, setSavedProfiles] = useGlobalStorage('linkedin.savedProfiles', []);
  const [selectedProfiles, setSelectedProfiles] = useStorage('linkedin.generator.selected', []);
  const [generatedMessages, setGeneratedMessages] = useStorage('linkedin.generator.messages', []);
  const [showMessages, setShowMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileSearchQuery, setProfileSearchQuery] = useState('');

  // Input refs
  const intentionInputRef = useRef(null);

  // Select/deselect profile
  const toggleProfileSelection = (profileId) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  // Select all profiles
  const selectAllProfiles = () => {
    setSelectedProfiles(savedProfiles.map(p => p.id));
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedProfiles([]);
  };

  // Generate messages
  const generateMessages = async () => {
    if (selectedProfiles.length === 0) {
      setError('Please select at least one profile');
      return;
    }

    const intention = intentionInputRef.current?.value?.trim();
    if (!intention) {
      setError('Please enter your intention for the message');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedProfileData = savedProfiles.filter(p => selectedProfiles.includes(p.id));
      
      // cleaned debug removed
      
      const response = await miyagiAPI.post('/api/integrations/linkedin-generate-messages', {
        method: 'POST',
        body: {
          profiles: selectedProfileData,
          intention: intention
        }
      });

      if (response.success && response.data.messages) {
        setGeneratedMessages(response.data.messages);
        setShowMessages(true);
        setSuccess('Messages generated successfully!');
      } else {
        setError(response.error || 'Failed to generate messages');
      }
    } catch (err) {
      setError('Failed to generate messages: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy message to clipboard
  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message);
      setSuccess('Message copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to copy message');
    }
  };

  // Clear messages
  const clearMessages = () => {
    setGeneratedMessages([]);
    setShowMessages(false);
    setSuccess('');
    setError('');
  };

  // Refresh saved profiles from global storage
  const refreshProfiles = async () => {
    setIsRefreshing(true);
    try {
      // Force a re-read of the global storage
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsRefreshing(false);
    } catch (err) {
      console.error('Failed to refresh profiles:', err);
      setIsRefreshing(false);
    }
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
        {/* Header */}
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
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)'
        }}>
          💬
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
            LinkedIn Message Generator
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '16px',
            margin: '4px 0 0 0',
            fontWeight: '500'
          }}>
            Generate personalized outreach messages and connection requests
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
              {savedProfiles.length} profile{savedProfiles.length !== 1 ? 's' : ''} available for message generation
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {savedProfiles.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(30, 58, 138, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3b82f6'
            }} />
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              {selectedProfiles.length} profile{selectedProfiles.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={clearAllSelections}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f1f5f9';
            }}
          >
            Clear All
          </button>
          <button
            onClick={selectAllProfiles}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1e3a8a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
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
            Select All
          </button>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '16px'
          }}>
            ❌
          </div>
          <span style={{
            fontSize: '14px',
            color: '#dc2626'
          }}>
            {error}
          </span>
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '16px'
          }}>
            ✅
          </div>
          <span style={{
            fontSize: '14px',
            color: '#16a34a'
          }}>
            {success}
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e40af'
            }}>
              Generating personalized messages...
            </span>
          </div>
        </div>
      )}
      </div>

      {/* Profile Selection */}
      {savedProfiles.length > 0 && !showMessages && (
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
              Select Profiles to Generate Messages ({getFilteredProfiles().length}
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
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {getFilteredProfiles().map(profile => (
              <div
                key={profile.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  background: selectedProfiles.includes(profile.id) 
                    ? 'rgba(30, 58, 138, 0.05)' 
                    : 'rgba(248, 250, 252, 0.8)',
                  border: selectedProfiles.includes(profile.id) 
                    ? '2px solid #1e3a8a' 
                    : '1px solid rgba(30, 58, 138, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => toggleProfileSelection(profile.id)}
                onMouseEnter={(e) => {
                  if (!selectedProfiles.includes(profile.id)) {
                    e.currentTarget.style.background = 'rgba(30, 58, 138, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(30, 58, 138, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedProfiles.includes(profile.id)) {
                    e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                    e.currentTarget.style.borderColor = 'rgba(30, 58, 138, 0.1)';
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  onChange={() => toggleProfileSelection(profile.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '2px',
                    transform: 'scale(1.2)',
                    accentColor: '#1e3a8a'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1e293b',
                      margin: 0
                    }}>
                      {profile.name}
                    </h3>
                  </div>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    margin: 0,
                    marginBottom: '8px',
                    lineHeight: '1.4'
                  }}>
                    {profile.headline}
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>
                    {profile.company && (
                      <span>🏢 {profile.company}</span>
                    )}
                    {profile.location && (
                      <span>📍 {profile.location}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Intention Input */}
          <div style={{
            marginBottom: '24px'
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Your Intention
            </label>
            <textarea
              ref={intentionInputRef}
              placeholder="e.g., 'I want to connect with this person, generate me a connection request' or 'Send a message to request a coffee chat about their research'"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px 16px',
                border: '2px solid rgba(30, 58, 138, 0.2)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1e3a8a'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(30, 58, 138, 0.2)'}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateMessages}
            disabled={isLoading || selectedProfiles.length === 0}
            style={{
              width: '100%',
              padding: '16px 24px',
              backgroundColor: isLoading || selectedProfiles.length === 0 ? '#e5e7eb' : '#1e3a8a',
              color: isLoading || selectedProfiles.length === 0 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading || selectedProfiles.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isLoading || selectedProfiles.length === 0 ? 'none' : '0 4px 12px rgba(30, 58, 138, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && selectedProfiles.length > 0) {
                e.target.style.backgroundColor = '#1e40af';
                e.target.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && selectedProfiles.length > 0) {
                e.target.style.backgroundColor = '#1e3a8a';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Generating...
              </div>
            ) : (
              `Generate Messages (${selectedProfiles.length} profile${selectedProfiles.length !== 1 ? 's' : ''})`
            )}
          </button>
        </div>
      )}

      {/* Generated Messages */}
      {showMessages && generatedMessages.length > 0 && (
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
            justifyContent: 'space-between',
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
                💬
              </div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0
              }}>
                Generated Messages
              </h2>
            </div>
            <button
              onClick={clearMessages}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f1f5f9';
              }}
            >
              Back to Profiles
            </button>
          </div>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {generatedMessages.map((message, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(248, 250, 252, 0.8)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid rgba(30, 58, 138, 0.1)'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    {message.profileName}
                  </h3>
                  <button
                    onClick={() => copyMessage(message.message)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#1e3a8a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
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
                    📋 Copy
                  </button>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#4a5568',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-line',
                  background: 'white',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(30, 58, 138, 0.1)'
                }}>
                  {message.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LinkedInMessageGeneratorWidget;
