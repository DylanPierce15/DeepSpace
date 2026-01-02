import React, { useState } from 'react';

function EmailDrafterWidget() {
  // Persistent storage for papers and email draft
  const [savedPapers, setSavedPapers] = useGlobalStorage('scholar.savedPapers', []);
  const [savedAuthors, setSavedAuthors] = useGlobalStorage('scholar.savedAuthors', []);
  const [libraries, setLibraries] = useGlobalStorage('scholar.libraries', []);
  const [selectedPapers, setSelectedPapers] = useStorage('scholar.drafter.selected', []);
  const [emailDraft, setEmailDraft] = useStorage('scholar.drafter.draft', '');
  const [selectedAuthorId, setSelectedAuthorId] = useStorage('scholar.drafter.selectedAuthorId', '');
  const [userInstructions, setUserInstructions] = useStorage('scholar.drafter.instructions', '');

  // Get all papers from all libraries
  const getAllPapers = () => {
    return libraries.flatMap(lib => lib.papers);
  };

  // UI state (temporary)
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authorSearchQuery, setAuthorSearchQuery] = useState('');
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [selectedAuthorName, setSelectedAuthorName] = useState('');

  // Get filtered authors based on search query
  const getFilteredAuthors = () => {
    if (!authorSearchQuery.trim()) return savedAuthors;
    
    const query = authorSearchQuery.toLowerCase();
    return savedAuthors.filter(author => 
      author.name.toLowerCase().includes(query) ||
      (author.snippet && author.snippet.toLowerCase().includes(query))
    );
  };

  // Handle author selection from dropdown
  const handleAuthorSelect = (author) => {
    setSelectedAuthorId(author.id);
    setSelectedAuthorName(author.name);
    setAuthorSearchQuery(author.name);
    setShowAuthorDropdown(false);
    setSelectedPapers([]); // Clear paper selection when author changes
  };

  // Initialize search query from selected author
  React.useEffect(() => {
    if (selectedAuthorId && !authorSearchQuery) {
      const author = savedAuthors.find(a => a.id === selectedAuthorId);
      if (author) {
        setAuthorSearchQuery(author.name);
        setSelectedAuthorName(author.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAuthorId]);

  // Toggle paper selection
  const togglePaperSelection = (paperId) => {
    setSelectedPapers(prev => 
      prev.includes(paperId) 
        ? prev.filter(id => id !== paperId)
        : [...prev, paperId]
    );
  };

  // Get filtered papers for selected author
  const getFilteredPapers = () => {
    if (!selectedAuthorId) return [];
    const selectedAuthor = savedAuthors.find(a => a.id === selectedAuthorId);
    if (!selectedAuthor) return [];
    
    // Normalize author name for matching
    const authorName = selectedAuthor.name.toLowerCase();
    const nameParts = authorName.split(' ');
    const lastName = nameParts[nameParts.length - 1]; // Last name (e.g., "hinton")
    
    // Get all papers from libraries
    const allPapers = getAllPapers();
    
    // Filter papers that contain the author's name or last name
    return allPapers.filter(paper => {
      const paperAuthors = (paper.authors || '').toLowerCase();
      
      // Check if full name matches
      if (paperAuthors.includes(authorName)) return true;
      
      // Check if last name matches (handles abbreviations like "GE Hinton", "G Hinton")
      if (paperAuthors.includes(lastName)) {
        // Verify it's likely the same person by checking first initial(s)
        const firstInitials = nameParts.slice(0, -1).map(p => p[0]).join('');
        if (firstInitials && paperAuthors.includes(firstInitials.toLowerCase())) {
          return true;
        }
        // If no first initials in paper authors, still match (might be a last-name-only listing)
        return true;
      }
      
      return false;
    });
  };

  // Start email drafting
  const startDraftEmail = async () => {
    if (selectedPapers.length === 0) {
      setError('Please select at least one paper');
      return;
    }

    if (!selectedAuthorId) {
      setError('Please select an author to contact');
      return;
    }

    const selectedAuthor = savedAuthors.find(a => a.id === selectedAuthorId);
    if (!selectedAuthor) {
      setError('Selected author not found');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Get all papers from libraries
      const allPapers = getAllPapers();
      
      // Get selected papers data
      const selectedPapersData = selectedPapers.map(id => allPapers.find(p => p.id === id)).filter(Boolean);
      
      // Create citation details for the API
      const citationDetails = selectedPapersData.map(paper => ({
        title: paper.title,
        description: `Research paper: ${paper.title}`,
        publication_date: `${paper.year}/01`,
        authors: paper.authors
      }));

      // Call email drafting API
      const emailResponse = await miyagiAPI.post('/api/integrations/scholar-draft-email', {
        papers: citationDetails,
        authorName: selectedAuthor.name,
        userInstructions: userInstructions || undefined
      });

      if (emailResponse.success) {
        // Parse the email response
        const emailData = emailResponse.email || emailResponse;
        
        // If the message contains a subject line, extract it
        let finalSubject = emailData.subject || 'Interest in your research work';
        let finalMessage = emailData.message || '';
        
        // Check if the message starts with "Subject: " and extract it
        if (finalMessage.startsWith('Subject:')) {
          const lines = finalMessage.split('\n');
          const subjectLine = lines[0];
          const subjectMatch = subjectLine.match(/^Subject:\s*(.+)$/i);
          
          if (subjectMatch) {
            finalSubject = subjectMatch[1].trim();
            // Remove the subject line from the message
            finalMessage = lines.slice(1).join('\n').trim();
          }
        }
        
        setEmailDraft({
          subject: finalSubject,
          message: finalMessage,
          recipient: emailData.recipient || selectedAuthor.name
        });
        setShowEmailDraft(true);
        setSelectedPapers([]);
      } else {
        setError('Failed to draft email');
      }
    } catch (e) {
      setError(`Email drafting failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all papers
  const clearPapers = () => {
    setSelectedPapers([]);
    setEmailDraft('');
    setShowEmailDraft(false);
    setError('');
    setSuccess('');
  };

  return (
    <div style={{
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      maxWidth: '900px',
      margin: '0 auto',
      background: 'linear-gradient(135deg, #1e40af 0%, #64748b 100%)',
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
            background: 'linear-gradient(135deg, #1e40af 0%, #64748b 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 8px 16px rgba(30, 64, 175, 0.3)'
          }}>
            ✉️
          </div>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e40af 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              Email Drafter
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Draft professional emails expressing interest in research work
            </p>
          </div>
        </div>

        {/* Important Note */}
        <div style={{
          background: 'linear-gradient(135deg, #fef5e7 0%, #fef3e0 100%)',
          border: '2px solid #f6e05e',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(246, 224, 94, 0.2)'
        }}>
          <div style={{
            fontSize: '24px',
            minWidth: '32px'
          }}>
            💡
          </div>
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#744210',
              marginBottom: '4px'
            }}>
              Before drafting your email:
            </div>
            <div style={{
              fontSize: '14px',
              color: '#744210',
              lineHeight: '1.5'
            }}>
              Research an author in the <strong>Google Scholar Search</strong> widget and save them first before reaching out!
            </div>
          </div>
        </div>

        {/* Author Selection */}
        <div style={{ marginBottom: '20px', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#4a5568',
            marginBottom: '8px'
          }}>
            Select Author to Contact: *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={authorSearchQuery}
              onChange={(e) => {
                setAuthorSearchQuery(e.target.value);
                setShowAuthorDropdown(true);
              }}
              placeholder="Search for an author..."
              onFocus={(e) => {
                setShowAuthorDropdown(true);
                e.target.style.borderColor = '#4299e1';
              }}
              onBlur={(e) => {
                setTimeout(() => setShowAuthorDropdown(false), 200);
                e.target.style.borderColor = '#e2e8f0';
              }}
              style={{
                width: '100%',
                padding: '12px 16px 12px 40px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                backgroundColor: 'white'
              }}
            />
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#4299e1'
            }}>
              🔍
            </div>
            {authorSearchQuery && (
              <button
                onClick={() => {
                  setAuthorSearchQuery('');
                  setSelectedAuthorId('');
                  setSelectedAuthorName('');
                  setSelectedPapers([]);
                }}
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
          
          {/* Dropdown */}
          {showAuthorDropdown && getFilteredAuthors().length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              maxHeight: '300px',
              overflowY: 'auto',
              background: 'white',
              border: '2px solid #4299e1',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1000
            }}>
              {getFilteredAuthors().map((author) => (
                <button
                  key={author.id}
                  onClick={() => handleAuthorSelect(author)}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#2d3748',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f7fafc'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {author.name}
                  </div>
                  {author.snippet && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#718096',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {author.snippet}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Instructions (Optional) */}
        {selectedAuthorId && (
          <div style={{ marginBottom: '20px', width: '100%', boxSizing: 'border-box' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              Personal Instructions (optional):
            </label>
            <textarea
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              placeholder="E.g., 'I am a PhD student at MIT working on deep learning. Please mention that I'm interested in collaborating on vision projects.'"
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                backgroundColor: 'white',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#4299e1'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        )}

        {/* Action Buttons */}
        {selectedAuthorId && getFilteredPapers().length > 0 && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <button
              onClick={startDraftEmail}
              disabled={selectedPapers.length === 0 || isLoading || !selectedAuthorId}
              style={{
                padding: '10px 20px',
                backgroundColor: selectedPapers.length === 0 || isLoading || !selectedAuthorId ? '#cbd5e0' : '#4299e1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: selectedPapers.length === 0 || isLoading || !selectedAuthorId ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? 'Drafting...' : `Draft Email (${selectedPapers.length})`}
            </button>
            <button
              onClick={clearPapers}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#c53030'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#e53e3e'}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            backgroundColor: '#fed7d7',
            color: '#c53030',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div style={{
            backgroundColor: '#c6f6d5',
            color: '#22543d',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ✅ {success}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#718096'
          }}>
            <div style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              border: '2px solid #e2e8f0',
              borderTop: '2px solid #4299e1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ marginLeft: '8px' }}>Drafting professional email...</span>
          </div>
        )}
      </div>

      {/* Papers List */}
      {getAllPapers().length === 0 && !showEmailDraft && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            📄
          </div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#4a5568',
            marginBottom: '8px'
          }}>
            No papers saved yet
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#718096',
            marginBottom: '24px'
          }}>
            Go to Scholar Search widget to search for papers and save them
          </p>
        </div>
      )}

      {selectedAuthorId && getFilteredPapers().length > 0 && !showEmailDraft && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '16px'
          }}>
            Papers by {savedAuthors.find(a => a.id === selectedAuthorId)?.name || 'Selected Author'} ({getFilteredPapers().length})
          </h2>
          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {getFilteredPapers().map((paper) => (
              <div
                key={paper.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: selectedPapers.includes(paper.id) ? '#ebf8ff' : '#f7fafc',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => togglePaperSelection(paper.id)}
                onMouseEnter={(e) => {
                  if (!selectedPapers.includes(paper.id)) {
                    e.target.style.backgroundColor = '#f0f9ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedPapers.includes(paper.id)) {
                    e.target.style.backgroundColor = '#f7fafc';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedPapers.includes(paper.id)}
                    onChange={() => togglePaperSelection(paper.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      marginTop: '2px'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1a202c',
                      marginBottom: '8px'
                    }}>
                      {paper.title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#718096'
                    }}>
                      <span>📅 {paper.year}</span>
                      <span>👤 {paper.authors}</span>
                      {paper.publication && (
                        <span>📖 {paper.publication}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Draft Display */}
      {showEmailDraft && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          marginTop: '24px',
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e40af 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Drafted Email
            </h2>
            <button
              onClick={() => setShowEmailDraft(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#cbd5e0'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#e2e8f0'}
            >
              Back to Papers
            </button>
          </div>

          {/* Subject Section */}
          <div style={{ marginBottom: '24px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568'
              }}>
                Subject: *
              </label>
              <button
                onClick={async () => {
                  const subject = emailDraft?.subject || 'Interest in your research work';
                  await navigator.clipboard.writeText(subject);
                  setSuccess('✅ Subject copied!');
                  setTimeout(() => setSuccess(''), 3000);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#3182ce'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#4299e1'}
              >
                📋 Copy
              </button>
            </div>
            <input
              type="text"
              value={emailDraft?.subject || 'Interest in your research work'}
              readOnly
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#f7fafc',
                color: '#2d3748',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Message Section */}
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568'
              }}>
                Message: *
              </label>
              <button
                onClick={async () => {
                  const message = emailDraft?.message || '';
                  await navigator.clipboard.writeText(message);
                  setSuccess('✅ Message copied!');
                  setTimeout(() => setSuccess(''), 3000);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#3182ce'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#4299e1'}
              >
                📋 Copy
              </button>
            </div>
            <textarea
              value={emailDraft?.message || ''}
              readOnly
              rows={10}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #4299e1',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#f7fafc',
                color: '#2d3748',
                outline: 'none',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Reminder about placeholders */}
          {emailDraft?.message && /\[.*?\]/.test(emailDraft.message) && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#fef5e7',
              border: '2px solid #ffa726',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#e65100'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontWeight: '600'
              }}>
                ⚠️ Important Reminder
              </div>
              <p style={{ margin: 0, lineHeight: '1.6' }}>
                This email contains placeholders like <strong>[Your Name]</strong>, <strong>[Your Position]</strong>, etc. 
                Remember to replace them with your actual information before sending!
              </p>
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

export default EmailDrafterWidget;
