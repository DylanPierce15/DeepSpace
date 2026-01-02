import React, { useState, useEffect, useMemo } from 'react';

function PollingWidget() {
  // Global storage for polling data (canvas-wide, shared across all users)
  // Break down into separate keys for better syncing
  const [pollTitle, setPollTitle] = useGlobalStorage('poll-title', 'What do you think about our latest product?');
  const [pollState, setPollState] = useGlobalStorage('poll-state', 'editing'); // 'editing' | 'voting'
  const [pollOptions, setPollOptions] = useGlobalStorage('poll-options', ['Amazing', 'Good, but could be better', 'Neutral', 'Not satisfied']);
  const [pollVoters, setPollVoters] = useGlobalStorage('poll-voters', {}); // userId -> {vote: optionIndex, timestamp: number}

  // Local widget state (not persisted)
  const [dragOver, setDragOver] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Generate user ID for voting tracking
  const userId = useMemo(() => {
    // Try to get authenticated user ID first
    const getAuthToken = () => {
      if (window.__clerk_token) return window.__clerk_token;
      
      const localStorageToken = localStorage.getItem('__session');
      if (localStorageToken) return localStorageToken;
      
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === '__session') return value;
      }
      return null;
    };

    const authToken = getAuthToken();
    if (authToken) {
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        return payload.sub; // Clerk user ID
      } catch (error) {
        console.log('Failed to parse auth token');
      }
    }
    
    // Fallback to session-based ID
    let userId = localStorage.getItem('poll_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('poll_user_id', userId);
    }
    return userId;
  }, []);

  // Check if user has voted
  const userVote = pollVoters[userId];
  const hasVoted = !!userVote;

  // Calculate vote counts
  const voteCounts = useMemo(() => {
    const counts = new Array(pollOptions.length).fill(0);
    Object.values(pollVoters).forEach(voterData => {
      if (voterData.vote >= 0 && voterData.vote < pollOptions.length) {
        counts[voterData.vote]++;
      }
    });
    return counts;
  }, [pollVoters, pollOptions.length]);

  const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);
  const voterCount = Object.keys(pollVoters).length;

  // Update poll title
  const updateTitle = (newTitle) => {
    setPollTitle(newTitle);
  };

  // Add new option
  const addOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  // Update option text
  const updateOption = (index, text) => {
    const newOptions = [...pollOptions];
    newOptions[index] = text;
    setPollOptions(newOptions);
  };

  // Remove option
  const removeOption = (index) => {
    if (pollOptions.length <= 2) return;
    
    const newOptions = pollOptions.filter((_, i) => i !== index);
    setPollOptions(newOptions);
  };

  // Start poll
  const startPoll = () => {
    const validOptions = pollOptions.filter(opt => opt.trim() !== '');
    const uniqueOptions = [...new Set(validOptions.map(opt => opt.trim()))];
    
    if (validOptions.length < 2 || uniqueOptions.length < 2) {
      return;
    }

    setPollState('voting');
    setPollOptions(validOptions.map(opt => opt.trim()));
    setPollVoters({});
  };

  // Submit vote
  const submitVote = (optionIndex) => {
    if (hasVoted || pollState !== 'voting') return;

    const newVoters = {
      ...pollVoters,
      [userId]: {
        vote: optionIndex,
        timestamp: Date.now()
      }
    };

    setPollVoters(newVoters);
  };

  // Reset poll
  const resetPoll = () => {
    if (!confirm('Reset Poll?\n\nThis will clear all votes and return to editing mode.\nPoll title and options will be preserved.\n\nThis action will affect all users.')) {
      return;
    }

    setPollState('editing');
    setPollVoters({});
  };

  // Check if can start poll
  const canStartPoll = () => {
    const validOptions = pollOptions.filter(opt => opt.trim() !== '');
    const uniqueOptions = [...new Set(validOptions.map(opt => opt.trim()))];
    return validOptions.length >= 2 && uniqueOptions.length >= 2;
  };

  // Get results data for display
  const resultsData = useMemo(() => {
    const maxVotes = Math.max(...voteCounts);
    
    return pollOptions.map((option, index) => {
      const votes = voteCounts[index];
      const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const isWinner = votes > 0 && votes === maxVotes;
      
      return {
        option,
        votes,
        percentage,
        isWinner
      };
    }).sort((a, b) => b.votes - a.votes);
  }, [pollOptions, voteCounts, totalVotes]);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
      background: '#ffffff',
      color: '#37352f',
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      minHeight: '100vh',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e9e9e7',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e9e9e7',
          background: '#fbfbfa'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 500,
            color: '#37352f',
            margin: '0 0 4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="11" width="4" height="3" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="6" y="8" width="4" height="6" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="10" y="5" width="4" height="9" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span>Quick Poll</span>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#787774',
            margin: 0
          }}>
            Create and share polls in real-time
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {pollState === 'editing' ? (
            /* Editor Mode */
            <div>
              <input
                type="text"
                value={pollTitle}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="What's your poll question?"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e9e9e7',
                  borderRadius: '3px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  marginBottom: '20px',
                  transition: 'all 0.1s ease',
                  background: '#ffffff',
                  color: '#37352f',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#37352f';
                  e.target.style.boxShadow = '0 0 0 1px #37352f';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e9e9e7';
                  e.target.style.boxShadow = 'none';
                }}
              />

              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#787774',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    Options
                  </div>
                  <button
                    onClick={addOption}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #e9e9e7',
                      borderRadius: '3px',
                      background: '#ffffff',
                      color: '#37352f',
                      fontSize: '12px',
                      fontWeight: 400,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(55, 53, 47, 0.08)';
                      e.target.style.borderColor = '#d3d3d1';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#ffffff';
                      e.target.style.borderColor = '#e9e9e7';
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Add
                  </button>
                </div>

                <div>
                  {pollOptions.map((option, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      padding: '8px 12px',
                      border: '1px solid #e9e9e7',
                      borderRadius: '3px',
                      background: '#fbfbfa',
                      transition: 'all 0.1s ease'
                    }}>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '1px solid transparent',
                          borderRadius: '3px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          background: 'transparent',
                          transition: 'all 0.1s ease',
                          color: '#37352f'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#37352f';
                          e.target.style.background = '#ffffff';
                          e.target.style.boxShadow = '0 0 0 1px #37352f';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'transparent';
                          e.target.style.background = 'transparent';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        onClick={() => removeOption(index)}
                        disabled={pollOptions.length <= 2}
                        style={{
                          padding: '4px',
                          border: 'none',
                          borderRadius: '3px',
                          background: 'transparent',
                          color: pollOptions.length <= 2 ? '#a4a4a2' : '#eb5757',
                          cursor: pollOptions.length <= 2 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.1s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '24px',
                          height: '24px',
                          fontSize: '18px',
                          lineHeight: 1
                        }}
                        onMouseEnter={(e) => {
                          if (pollOptions.length > 2) {
                            e.target.style.background = 'rgba(235, 87, 87, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'transparent';
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={startPoll}
                disabled={!canStartPoll()}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '3px',
                  background: canStartPoll() ? '#37352f' : '#e9e9e7',
                  color: canStartPoll() ? '#ffffff' : '#a4a4a2',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: canStartPoll() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (canStartPoll()) {
                    e.target.style.background = '#2f2e2a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canStartPoll()) {
                    e.target.style.background = '#37352f';
                  }
                }}
              >
                Start Poll
              </button>
            </div>
          ) : (
            /* Voting Mode */
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: 500,
                color: '#37352f',
                margin: '0 0 16px 0',
                padding: 0
              }}>
                {pollTitle}
              </div>

              <div style={{ marginBottom: '20px' }}>
                {pollOptions.map((option, index) => (
                  <div
                    key={index}
                    onClick={() => !hasVoted && submitVote(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                      padding: '12px 16px',
                      border: hasVoted && userVote.vote === index ? '1px solid #52c41a' : '1px solid #e9e9e7',
                      borderRadius: '3px',
                      background: hasVoted && userVote.vote === index ? 'rgba(82, 196, 26, 0.08)' : '#ffffff',
                      cursor: hasVoted ? 'default' : 'pointer',
                      transition: 'all 0.1s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!hasVoted) {
                        e.target.style.background = 'rgba(55, 53, 47, 0.08)';
                        e.target.style.borderColor = '#d3d3d1';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!hasVoted) {
                        e.target.style.background = '#ffffff';
                        e.target.style.borderColor = '#e9e9e7';
                      } else if (userVote.vote === index) {
                        e.target.style.background = 'rgba(82, 196, 26, 0.08)';
                        e.target.style.borderColor = '#52c41a';
                      }
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: hasVoted && userVote.vote === index ? '1.5px solid #52c41a' : '1.5px solid #d3d3d1',
                      borderRadius: '50%',
                      background: hasVoted && userVote.vote === index ? '#52c41a' : '#ffffff',
                      position: 'relative',
                      flexShrink: 0,
                      transition: 'all 0.1s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {hasVoted && userVote.vote === index && (
                        <span style={{
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          lineHeight: 1
                        }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <div style={{
                      flex: 1,
                      fontSize: '14px',
                      color: '#37352f',
                      fontWeight: 400
                    }}>
                      {option}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#787774',
                      fontWeight: 500
                    }}>
                      {voteCounts[index]}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '4px 8px',
                background: '#f7f6f3',
                borderRadius: '3px',
                fontSize: '12px',
                color: '#787774',
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                {voterCount} {voterCount === 1 ? 'person has' : 'people have'} voted
              </div>

              {hasVoted && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(82, 196, 26, 0.08)',
                  border: '1px solid rgba(82, 196, 26, 0.2)',
                  borderRadius: '3px',
                  color: '#52c41a',
                  fontSize: '12px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline-block' }}>
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  You voted for: <strong>{pollOptions[userVote.vote]}</strong>
                </div>
              )}

              <button
                onClick={resetPoll}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  border: '1px solid #e9e9e7',
                  borderRadius: '3px',
                  background: '#ffffff',
                  color: '#787774',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  marginBottom: '16px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(55, 53, 47, 0.08)';
                  e.target.style.borderColor = '#d3d3d1';
                  e.target.style.color = '#37352f';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ffffff';
                  e.target.style.borderColor = '#e9e9e7';
                  e.target.style.color = '#787774';
                }}
              >
                Reset Poll
              </button>

              {/* Results Section */}
              <div style={{
                paddingTop: '16px',
                borderTop: '1px solid #e9e9e7'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#787774',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    Results
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#787774',
                    background: '#f7f6f3',
                    padding: '2px 8px',
                    borderRadius: '3px'
                  }}>
                    {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                  </div>
                </div>

                <div>
                  {resultsData.map((result, index) => (
                    <div key={index} style={{ marginBottom: '12px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 400,
                          color: '#37352f',
                          flex: 1
                        }}>
                          {result.option}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          color: '#787774'
                        }}>
                          <span>{result.votes}</span>
                          <span>{result.percentage}%</span>
                        </div>
                      </div>
                      <div style={{
                        height: '4px',
                        background: '#e9e9e7',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          background: result.isWinner ? '#52c41a' : '#37352f',
                          borderRadius: '2px',
                          transition: 'width 0.5s ease',
                          width: `${result.percentage}%`
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PollingWidget;
