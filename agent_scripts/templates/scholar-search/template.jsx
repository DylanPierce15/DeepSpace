import React, { useState } from 'react';

function GoogleScholarSearchWidget() {
  // Persistent storage for search results
  const [authors, setAuthors] = useStorage('scholar.search.authors', []);
  const [papers, setPapers] = useStorage('scholar.search.papers', []);
  const [savedPapers, setSavedPapers] = useGlobalStorage('scholar.savedPapers', []);
  const [savedAuthors, setSavedAuthors] = useGlobalStorage('scholar.savedAuthors', []);
  const [paperSummaries, setPaperSummaries] = useGlobalStorage('scholar.paperSummaries', {}); // Map of paper IDs to summaries
  const [libraries, setLibraries] = useGlobalStorage('scholar.libraries', []); // List of library objects with id, name, papers
  const [currentAuthorId, setCurrentAuthorId] = useStorage('scholar.search.currentAuthorId', null);
  const [currentAuthorName, setCurrentAuthorName] = useStorage('scholar.search.currentAuthorName', '');
  const [currentSearchedAuthorName, setCurrentSearchedAuthorName] = useStorage('scholar.search.searchedName', '');
  const [currentAuthorEmail, setCurrentAuthorEmail] = useStorage('scholar.search.authorEmail', '');
  const [view, setView] = useStorage('scholar.search.view', 'authors');
  const [tab, setTab] = useStorage('scholar.search.tab', 'search'); // 'search', 'library', 'saved-authors'
  const [sortBy, setSortBy] = useStorage('scholar.search.sort', '');
  const [isPaperSearch, setIsPaperSearch] = useStorage('scholar.search.isPaperSearch', false);

  // UI state (temporary)
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSearchingAuthors, setIsSearchingAuthors] = useState(false);
  const [isSearchingPapers, setIsSearchingPapers] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState('');
  const [authorNameInput, setAuthorNameInput] = useState('');
  const [paperSearchInput, setPaperSearchInput] = useState('');
  const [summaryPaper, setSummaryPaper] = useStorage('scholar.search.summaryPaper', null);
  const [summary, setSummary] = useStorage('scholar.search.summary', '');
  const [summaryTabVisible, setSummaryTabVisible] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [pendingPaper, setPendingPaper] = useState(null);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryNote, setNewLibraryNote] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [isManagingLibraries, setIsManagingLibraries] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState(null);
  const [editLibraryName, setEditLibraryName] = useState('');
  const [editLibraryNote, setEditLibraryNote] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [authorSearchQuery, setAuthorSearchQuery] = useState('');

  // Save paper to global storage with library selection
  const savePaper = (paper) => {
    // Check if paper is already saved in any library
    const isAlreadySaved = libraries.some(lib => 
      lib.papers.some(p => 
        p.link === paper.link || 
        (paper.result_id && p.result_id === paper.result_id) ||
        (p.title === paper.title && p.year === paper.year)
      )
    );
    
    if (isAlreadySaved) {
      setError('Paper already saved');
      return;
    }

    // Show library selection modal
    setPendingPaper(paper);
    setShowLibraryModal(true);
  };

  // Create new library
  const createLibrary = () => {
    if (!newLibraryName.trim()) {
      setError('Library name cannot be empty');
      return;
    }

    const newLibrary = {
      id: `library-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newLibraryName.trim(),
      note: newLibraryNote.trim() || '',
      papers: [],
      createdAt: new Date().toISOString()
    };

    setLibraries(prev => [...prev, newLibrary]);
    setSelectedLibraryId(newLibrary.id);
    setNewLibraryName('');
    setNewLibraryNote('');
  };

  // Add paper to selected library
  const confirmSavePaper = () => {
    if (!selectedLibraryId && !newLibraryName.trim()) {
      setError('Please select a library or create a new one');
      return;
    }

    const paperToSave = {
      id: `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...pendingPaper,
      savedAt: new Date().toISOString()
    };

    const libraryId = selectedLibraryId || (newLibraryName.trim() ? null : null);
    
    if (newLibraryName.trim() && !selectedLibraryId) {
      // Create new library and add paper
      const newLibrary = {
        id: `library-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newLibraryName.trim(),
        note: newLibraryNote.trim() || '',
        papers: [paperToSave],
        createdAt: new Date().toISOString()
      };
      setLibraries(prev => [...prev, newLibrary]);
      setNewLibraryName('');
      setNewLibraryNote('');
    } else if (selectedLibraryId) {
      // Add paper to existing library
      setLibraries(prev => prev.map(lib => 
        lib.id === selectedLibraryId 
          ? { ...lib, papers: [...lib.papers, paperToSave] }
          : lib
      ));
    }

    // Close modal and clear state
    setShowLibraryModal(false);
    setPendingPaper(null);
    setSelectedLibraryId('');
    setError('');
    setNewLibraryName('');
    setNewLibraryNote('');
  };

  // Close library modal
  const cancelSavePaper = () => {
    setShowLibraryModal(false);
    setPendingPaper(null);
    setSelectedLibraryId('');
    setNewLibraryName('');
    setNewLibraryNote('');
    setError('');
  };

  // Remove paper from library
  const removePaperFromLibrary = (libraryId, paperId) => {
    setLibraries(prev => prev.map(lib => 
      lib.id === libraryId 
        ? { ...lib, papers: lib.papers.filter(p => p.id !== paperId) }
        : lib
    ));
  };

  // Delete library
  const deleteLibrary = (libraryId) => {
    setLibraries(prev => prev.filter(lib => lib.id !== libraryId));
  };

  // Expand/collapse library
  const [expandedLibraries, setExpandedLibraries] = useState({});
  
  const toggleLibrary = (libraryId) => {
    setExpandedLibraries(prev => ({
      ...prev,
      [libraryId]: !prev[libraryId]
    }));
  };

  // Edit library name and note
  const startEditLibrary = (library) => {
    setEditingLibrary(library.id);
    setEditLibraryName(library.name);
    setEditLibraryNote(library.note || '');
  };

  const saveEditLibrary = () => {
    if (!editLibraryName.trim()) {
      setError('Library name cannot be empty');
      return;
    }

    setLibraries(prev => prev.map(lib => 
      lib.id === editingLibrary 
        ? { ...lib, name: editLibraryName.trim(), note: editLibraryNote.trim() || '' }
        : lib
    ));
    setEditingLibrary(null);
    setEditLibraryName('');
    setEditLibraryNote('');
  };

  const cancelEditLibrary = () => {
    setEditingLibrary(null);
    setEditLibraryName('');
    setEditLibraryNote('');
  };

  // Remove paper from saved papers
  const removeSavedPaper = (paperId) => {
    const newSavedPapers = savedPapers.filter(p => p.id !== paperId);
    setSavedPapers(newSavedPapers);
  };

  // Filter papers based on search query (searches in title, authors, and publication)
  const filterPaper = (paper, query) => {
    if (!query.trim()) return true;
    const lowerQuery = query.toLowerCase();
    
    // Search in title
    const titleMatch = paper.title?.toLowerCase().includes(lowerQuery) || false;
    
    // Search in authors (handle both string and array formats)
    let authorsMatch = false;
    if (paper.authors) {
      if (typeof paper.authors === 'string') {
        authorsMatch = paper.authors.toLowerCase().includes(lowerQuery);
      } else if (Array.isArray(paper.authors)) {
        authorsMatch = paper.authors.some(author => 
          typeof author === 'string' && author.toLowerCase().includes(lowerQuery)
        );
      }
    }
    
    // Search in publication
    const publicationMatch = paper.publication?.toLowerCase().includes(lowerQuery) || false;
    
    // Debug logging (can be removed in production)
    if (titleMatch || authorsMatch || publicationMatch) {
      console.log('Match found:', { title: paper.title, authors: paper.authors, query: lowerQuery });
    }
    
    return titleMatch || authorsMatch || publicationMatch;
  };

  // Get all unique authors from all papers in libraries
  const getAllAuthors = () => {
    const authorsSet = new Set();
    libraries.forEach(lib => {
      lib.papers.forEach(paper => {
        if (paper.authors) {
          if (typeof paper.authors === 'string') {
            // Split by comma if it's a comma-separated list
            paper.authors.split(',').forEach(author => {
              const trimmed = author.trim();
              if (trimmed) authorsSet.add(trimmed);
            });
          } else if (Array.isArray(paper.authors)) {
            paper.authors.forEach(author => {
              if (author && typeof author === 'string') {
                authorsSet.add(author.trim());
              }
            });
          }
        }
      });
    });
    return Array.from(authorsSet).sort();
  };

  // Get filtered libraries for display
  const getFilteredLibraries = () => {
    let filtered = libraries;
    
    // First filter by author selection
    if (selectedAuthor) {
      filtered = libraries
        .map(lib => ({
          ...lib,
          papers: lib.papers.filter(paper => {
            if (!paper.authors) return false;
            const authorsText = typeof paper.authors === 'string' 
              ? paper.authors 
              : Array.isArray(paper.authors) ? paper.authors.join(', ') : '';
            return authorsText.toLowerCase().includes(selectedAuthor.toLowerCase());
          })
        }))
        .filter(lib => lib.papers.length > 0);
    }
    
    // Then filter by search query
    if (librarySearchQuery.trim()) {
      filtered = filtered
        .map(lib => ({
          ...lib,
          papers: lib.papers.filter(paper => filterPaper(paper, librarySearchQuery))
        }))
        .filter(lib => lib.papers.length > 0);
    }
    
    return filtered;
  };

  // Save author to global storage
  const saveAuthor = (author) => {
    // Check if author is already saved by checking ID or link
    const isAlreadySaved = savedAuthors.some(a => 
      a.id === author.id || 
      a.link === author.link
    );
    
    if (isAlreadySaved) {
      setError('Author already saved');
      return;
    }

    const authorToSave = {
      id: author.id, // Keep the original Google Scholar author ID
      name: author.name,
      link: author.link,
      snippet: author.snippet,
      savedAt: new Date().toISOString()
    };
    const newSavedAuthors = [...savedAuthors, authorToSave];
    setSavedAuthors(newSavedAuthors);
    setError('');
    console.log('💾 Saved author:', authorToSave);
  };

  // Remove author from saved authors
  const removeSavedAuthor = (authorId) => {
    const newSavedAuthors = savedAuthors.filter(a => a.id !== authorId);
    setSavedAuthors(newSavedAuthors);
  };

  // Search authors
  const searchAuthors = async () => {
    const authorName = authorNameInput.trim();
    if (!authorName) {
      setError('Please enter an author name');
      return;
    }

    setIsLoading(true);
    setIsSearchingAuthors(true);
    setLoadingMessage('Searching for researchers...');
    setError('');
    setCurrentSearchedAuthorName(authorName);

    try {
      console.log('🔍 Searching for author:', authorName);
      console.log('🔍 API function available:', typeof api);
      
      const response = await miyagiAPI.post('/api/integrations/scholar-search-authors', {
        name: authorName,
        start: 0
      });
      
      console.log('🔍 API response:', response);

      if (response.data.authors && response.data.authors.length > 0) {
        // The API returns authors directly in the response
        const authorResults = response.data.authors.map(author => ({
          id: author.authorId,
          name: author.name,
          link: author.profileUrl,
          snippet: author.affiliations || `Cited by ${author.citedBy || 0}`
        }));

        setAuthors(authorResults);
        setView('authors');
      } else {
        setError('No authors found. Try a different search term.');
      }
    } catch (e) {
      setError(`Search failed: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsSearchingAuthors(false);
    }
  };

  // Search papers directly
  const searchPapers = async () => {
    const query = paperSearchInput.trim();
    if (!query) {
      setError('Please enter a paper title or keywords');
      return;
    }

    setIsLoading(true);
    setIsSearchingPapers(true);
    setLoadingMessage('Searching for papers...');
    setError('');

    try {
      const response = await miyagiAPI.post('/api/integrations/scholar-search-papers', {
        query: query,
        page: 1
      });

      if (response.data.papers && response.data.papers.length > 0) {
        const papersData = response.data.papers.map(paper => ({
          title: paper.title,
          year: paper.year,
          citationCount: paper.citationCount || 0,
          authors: paper.authors,
          link: paper.link,
          publication: paper.publication
        }));

        setPapers(papersData);
        setView('papers');
        setIsPaperSearch(true); // Mark as paper search
      } else {
        setError('No papers found. Try a different search term.');
      }
    } catch (e) {
      setError(`Search failed: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsSearchingPapers(false);
    }
  };

  // Load papers for an author
  const loadPapers = async (authorId, sortValue) => {
    console.log('loadPapers called with authorId:', authorId, 'sortValue:', sortValue);
    setIsLoading(true);
    setError('');
    setView('papers');
    setTab('search'); // Switch to search tab to show papers
    setIsPaperSearch(false); // Clear paper search flag - we're viewing author's papers
    setCurrentAuthorId(authorId);

    try {
      const params = { authorId };
      // Use the provided sortValue if available, otherwise use current sortBy state
      const effectiveSort = sortValue !== undefined ? sortValue : sortBy;
      if (effectiveSort) {
        params.sort = effectiveSort;
      }

      console.log('Calling API with params:', params);
      const response = await miyagiAPI.post('/api/integrations/scholar-get-author-papers', params);
      
      console.log('🔍 Papers API response:', response);

      if (response.data.papers && response.data.papers.length > 0) {
        // The API returns papers directly in the response
        const papersData = response.data.papers.map(paper => ({
          title: paper.title,
          year: paper.year,
          citationCount: paper.citationCount || 0,
          authors: paper.authors,
          link: paper.link,
          publication: paper.publication,
          result_id: paper.result_id
        }));

        setPapers(papersData);

        // Try to get author name from saved authors first, then fall back to searched name
        const savedAuthor = savedAuthors.find(a => a.id === authorId);
        const authorName = savedAuthor?.name || currentSearchedAuthorName;
        setCurrentAuthorName(authorName);

        // Get author email
        try {
          const authorDetails = await miyagiAPI.post('/api/integrations/scholar-get-author-details', { authorId });
          if (authorDetails.success) {
            setCurrentAuthorEmail(authorDetails.data?.author?.email || '');
          }
        } catch (e) {
          console.log('Could not fetch author email:', e.message);
        }
      } else {
        setError('No papers found for this author.');
      }
    } catch (e) {
      setError(`Failed to load papers: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sort papers
  const sortPapers = async (newSortBy) => {
    if (!currentAuthorId) return;
    // Use the new sort value if provided, otherwise use the current sortBy state
    const sortValue = newSortBy !== undefined ? newSortBy : sortBy;
    await loadPapers(currentAuthorId, sortValue);
  };

  // Show authors view
  const showAuthors = () => {
    setView('authors');
  };

  // Clear all results and return to search inputs
  const clearResults = () => {
    setAuthors([]);
    setPapers([]);
    setView('authors'); // Reset to default view
    setIsPaperSearch(false);
  };

  // Summarize a single paper
  const summarizePaper = async (paper) => {
    setIsLoading(true);
    setIsSummarizing(true);
    setLoadingMessage('Summarizing...');
    setError('');

    try {
      // Create citation details
      const citationDetails = [{
        title: paper.title,
        description: `Research paper: ${paper.title}`,
        publication_date: `${paper.year}/01`,
        authors: paper.authors
      }];

      // Call summarization API
      const summaryResponse = await miyagiAPI.post('/api/integrations/scholar-summarize-papers', {
        papers: citationDetails,
        authorName: paper.authors || 'Unknown Author'
      });

      if (summaryResponse.success) {
        const summaryText = summaryResponse.summary || summaryResponse;
        setSummaryPaper(paper);
        setSummary(summaryText);
        setSummaryTabVisible(true);
        setTab('summary'); // Switch to summary tab
        
        // Save the summary to storage
        const paperId = paper.link || paper.result_id || `${paper.title}-${paper.year}`;
        setPaperSummaries(prev => ({
          ...prev,
          [paperId]: summaryText
        }));
      } else {
        setError('Failed to generate summary');
      }
    } catch (e) {
      setError(`Summarization failed: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsSummarizing(false);
      setLoadingMessage('');
    }
  };

  // Close summary tab
  const closeSummaryTab = () => {
    setSummaryTabVisible(false);
    setSummaryPaper(null);
    setSummary('');
    if (tab === 'summary') {
      setTab('search'); // Go back to search tab
    }
  };

  // Check if a paper has a saved summary
  const getPaperId = (paper) => {
    return paper.link || paper.result_id || `${paper.title}-${paper.year}`;
  };

  const hasSummary = (paper) => {
    const paperId = getPaperId(paper);
    return paperSummaries[paperId] !== undefined;
  };

  const getSummary = (paper) => {
    const paperId = getPaperId(paper);
    return paperSummaries[paperId] || '';
  };

  // View existing summary for a paper
  const viewSummary = (paper) => {
    const paperId = getPaperId(paper);
    const savedSummary = paperSummaries[paperId];
    if (savedSummary) {
      setSummaryPaper(paper);
      setSummary(savedSummary);
      setSummaryTabVisible(true);
      setTab('summary');
    }
  };

  // Handle key press for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchAuthors();
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
            🔬
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
              Google Scholar Search
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              margin: '4px 0 0 0',
              fontWeight: '500'
            }}>
              Research professors and explore their publications
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid rgba(30, 58, 138, 0.1)'
        }}>
          <button
            onClick={() => setTab('search')}
            style={{
              padding: '12px 24px',
              background: tab === 'search' ? 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)' : 'transparent',
              color: tab === 'search' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Search
          </button>
          <button
            onClick={() => setTab('library')}
            style={{
              padding: '12px 24px',
              background: tab === 'library' ? 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)' : 'transparent',
              color: tab === 'library' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Library
          </button>
          <button
            onClick={() => setTab('saved-authors')}
            style={{
              padding: '12px 24px',
              background: tab === 'saved-authors' ? 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)' : 'transparent',
              color: tab === 'saved-authors' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Saved Authors
          </button>
          {summaryTabVisible && (
            <button
              onClick={() => setTab('summary')}
              style={{
                padding: '12px 24px',
                background: tab === 'summary' ? 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)' : 'transparent',
                color: tab === 'summary' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📝 Paper Summary
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSummaryTab();
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                ×
              </button>
            </button>
          )}
        </div>

        {/* Search Section */}
        {tab === 'search' && (
          <>
        <div style={{
          display: 'flex',
          gap: '16px',
            marginBottom: '24px',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <div style={{ flex: 1, position: 'relative', width: '100%', boxSizing: 'border-box' }}>
            <input
                value={authorNameInput}
                onChange={(e) => setAuthorNameInput(e.target.value)}
              type="text"
              placeholder="Enter researcher name..."
              style={{
                width: '100%',
                padding: '16px 20px 16px 48px',
                border: '2px solid rgba(102, 126, 234, 0.2)',
                borderRadius: '16px',
                fontSize: '16px',
                outline: 'none',
                transition: 'all 0.3s ease',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  boxSizing: 'border-box'
              }}
              onKeyPress={handleKeyPress}
              onFocus={(e) => {
                e.target.style.borderColor = '#1e3a8a';
                e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              }}
            />
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#1e3a8a'
            }}>
              🔍
            </div>
          </div>
          <button
            onClick={searchAuthors}
            disabled={isSearchingAuthors || isSearchingPapers}
            style={{
              padding: '16px 32px',
              background: (isSearchingAuthors || isSearchingPapers)
                ? 'linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%)' 
                : 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (isSearchingAuthors || isSearchingPapers) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: (isSearchingAuthors || isSearchingPapers)
                ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                : '0 8px 24px rgba(102, 126, 234, 0.3)',
              minWidth: '160px',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (!(isSearchingAuthors || isSearchingPapers)) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(isSearchingAuthors || isSearchingPapers)) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
              }
            }}
          >
            {isSearchingAuthors ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Searching for researchers...
              </div>
            ) : (
              'Search Authors'
            )}
          </button>
        </div>

          {/* Paper Search Section */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ flex: 1, position: 'relative', width: '100%', boxSizing: 'border-box' }}>
              <input
                value={paperSearchInput}
                onChange={(e) => setPaperSearchInput(e.target.value)}
                type="text"
                placeholder="Enter paper titles or keywords..."
                style={{
                  width: '100%',
                  padding: '16px 20px 16px 48px',
                  border: '2px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchPapers();
                  }
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1e3a8a';
                  e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.95)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                }}
              />
              <div style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '18px',
                color: '#1e3a8a'
              }}>
                📄
              </div>
            </div>
            <button
              onClick={searchPapers}
              disabled={isSearchingAuthors || isSearchingPapers}
              style={{
                padding: '16px 32px',
                background: (isSearchingAuthors || isSearchingPapers)
                  ? 'linear-gradient(135deg, #cbd5e0 0%, #a0aec0 100%)' 
                  : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (isSearchingAuthors || isSearchingPapers) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: (isSearchingAuthors || isSearchingPapers)
                  ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                  : '0 8px 24px rgba(72, 187, 120, 0.3)',
                minWidth: '160px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!(isSearchingAuthors || isSearchingPapers)) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 12px 32px rgba(72, 187, 120, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!(isSearchingAuthors || isSearchingPapers)) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 24px rgba(72, 187, 120, 0.3)';
                }
              }}
            >
              {isSearchingPapers ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span>Searching for papers...</span>
                </div>
              ) : (
                'Search Papers'
              )}
            </button>
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
                border: '3px solid rgba(102, 126, 234, 0.2)',
                borderTop: '3px solid #1e3a8a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ 
                fontSize: '16px', 
                fontWeight: '500',
                color: '#1e3a8a'
              }}>
                {loadingMessage || 'Loading...'}
              </span>
            </div>
          </div>
        )}

      {/* Library Tab */}
      {tab === 'library' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          marginTop: '24px'
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
                background: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                📚
              </div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                My Libraries ({libraries.length})
              </h2>
            </div>
            {libraries.length > 0 && (
              <button
                onClick={() => setIsManagingLibraries(!isManagingLibraries)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isManagingLibraries ? '#4299e1' : '#e2e8f0',
                  color: isManagingLibraries ? 'white' : '#4a5568',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isManagingLibraries ? 'Done' : 'Manage'}
              </button>
            )}
          </div>

          {/* Search Bar for Libraries */}
          {libraries.length > 0 && (
            <>
              <div style={{
                marginBottom: '12px',
                position: 'relative'
              }}>
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => {
                    setLibrarySearchQuery(e.target.value);
                    // Auto-expand all libraries when user starts searching
                    if (e.target.value.trim() && !librarySearchQuery.trim()) {
                      libraries.forEach(lib => {
                        setExpandedLibraries(prev => ({ ...prev, [lib.id]: true }));
                      });
                    }
                  }}
                  placeholder="Search papers by title, authors, or publication..."
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 40px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#9f7aea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(159, 122, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '18px',
                  color: '#9f7aea'
                }}>
                  🔍
                </div>
                {librarySearchQuery && (
                  <button
                    onClick={() => setLibrarySearchQuery('')}
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
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#718096'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Author Filter */}
              <div style={{
                marginBottom: '16px',
                position: 'relative'
              }}>
                <input
                  type="text"
                  placeholder="Filter by author name..."
                  value={selectedAuthor}
                  onChange={(e) => {
                    setSelectedAuthor(e.target.value);
                    setShowAuthorDropdown(true);
                  }}
                  onFocus={() => setShowAuthorDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAuthorDropdown(false), 200)}
                  style={{
                    width: '100%',
                    padding: '10px 16px 10px 40px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '16px',
                  color: '#9f7aea'
                }}>
                  👤
                </div>
                {selectedAuthor && (
                  <button
                    onClick={() => {
                      setSelectedAuthor('');
                      setShowAuthorDropdown(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '16px',
                      cursor: 'pointer',
                      color: '#718096'
                    }}
                  >
                    ✕
                  </button>
                )}
                
                {/* Author Dropdown */}
                {showAuthorDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000
                  }}>
                    {getAllAuthors()
                      .filter(author => 
                        !selectedAuthor || 
                        author.toLowerCase().includes(selectedAuthor.toLowerCase())
                      )
                      .slice(0, 10).length > 0 ? (
                        getAllAuthors()
                          .filter(author => 
                            !selectedAuthor || 
                            author.toLowerCase().includes(selectedAuthor.toLowerCase())
                          )
                          .slice(0, 10)
                          .map((author, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedAuthor(author);
                                setShowAuthorDropdown(false);
                              }}
                              onMouseDown={(e) => e.preventDefault()}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#4a5568',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f7fafc'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                              {author}
                            </button>
                          ))
                      ) : (
                        <div style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: '#718096',
                          fontSize: '14px'
                        }}>
                          No authors found
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Selected Author Badge */}
              {selectedAuthor && (
                <div style={{
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#718096'
                  }}>
                    Filtering by:
                  </span>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    background: '#9f7aea',
                    color: 'white',
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}>
                    {selectedAuthor}
                    <button
                      onClick={() => setSelectedAuthor('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: 0
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {librarySearchQuery && (
                <div style={{
                  marginBottom: '16px',
                  fontSize: '14px',
                  color: '#718096',
                  fontStyle: 'italic'
                }}>
                  {getFilteredLibraries().reduce((total, lib) => total + lib.papers.length, 0)} matching paper{getFilteredLibraries().reduce((total, lib) => total + lib.papers.length, 0) !== 1 ? 's' : ''} found
                </div>
              )}
            </>
          )}
          
          {libraries.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                No libraries yet
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#718096'
              }}>
                Save papers to create libraries and organize your research
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '16px'
            }}>
              {getFilteredLibraries().map((library) => (
                <div
                  key={library.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}
                >
                  {/* Library Header */}
                  <div
                    onClick={() => toggleLibrary(library.id)}
                    style={{
                      padding: '16px',
                      backgroundColor: expandedLibraries[library.id] ? '#f7fafc' : '#fafafa',
                      cursor: 'pointer',
                      borderBottom: expandedLibraries[library.id] ? '1px solid #e2e8f0' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f4f8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = expandedLibraries[library.id] ? '#f7fafc' : '#fafafa'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <span style={{ fontSize: '20px' }}>{expandedLibraries[library.id] ? '📂' : '📁'}</span>
                      <div style={{ flex: 1 }}>
                        {editingLibrary === library.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            <input
                              type="text"
                              value={editLibraryName}
                              onChange={(e) => setEditLibraryName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                padding: '8px 12px',
                                border: '2px solid #4299e1',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none'
                              }}
                            />
                            <textarea
                              value={editLibraryNote}
                              onChange={(e) => setEditLibraryNote(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Add a note..."
                              rows={2}
                              style={{
                                padding: '8px 12px',
                                border: '2px solid #4299e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                outline: 'none',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEditLibrary();
                                }}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#48bb78',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditLibrary();
                                }}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: '#e2e8f0',
                                  color: '#4a5568',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#1a202c',
                              margin: 0
                            }}>
                              {library.name}
                            </h3>
                            {library.note && (
                              <p style={{
                                fontSize: '12px',
                                color: '#718096',
                                margin: '4px 0 0 0',
                                fontStyle: 'italic'
                              }}>
                                {library.note}
                              </p>
                            )}
                            <p style={{
                              fontSize: '12px',
                              color: '#718096',
                              margin: '4px 0 0 0'
                            }}>
                              {library.papers.length} {library.papers.length === 1 ? 'paper' : 'papers'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {isManagingLibraries && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditLibrary(library);
                            }}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#4299e1',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete library "${library.name}" and all its papers?`)) {
                                deleteLibrary(library.id);
                              }
                            }}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#fc8181',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                      <span style={{ fontSize: '18px', color: '#718096', userSelect: 'none' }}>
                        {expandedLibraries[library.id] ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* Library Papers (shown when expanded) */}
                  {expandedLibraries[library.id] && library.papers.length > 0 && (
                    <div style={{ padding: '16px', backgroundColor: '#fafafa' }}>
                      <div style={{
                        display: 'grid',
                        gap: '12px'
                      }}>
                        {library.papers.map((paper) => (
                          <div
                            key={paper.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '12px',
                              backgroundColor: 'white'
                            }}
                          >
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
                  marginBottom: '8px',
                  fontSize: '14px',
                  color: '#718096'
                }}>
                  {paper.year && <span>📅 {paper.year}</span>}
                  {paper.citationCount !== undefined && <span>📊 {paper.citationCount} citations</span>}
                  {paper.publication && (
                    <span>📖 {paper.publication}</span>
                  )}
                </div>

                {paper.authors && (
                  <p style={{
                    fontSize: '14px',
                    color: '#4a5568',
                    marginBottom: '12px'
                  }}>
                    <strong>Authors:</strong> {paper.authors}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  {paper.link && (
                    <a
                      href={paper.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        backgroundColor: '#4299e1',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#3182ce'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#4299e1'}
                    >
                      View Paper
                    </a>
                  )}
                  {hasSummary(paper) && (
                    <button
                      onClick={() => viewSummary(paper)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#9f7aea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#805ad5'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#9f7aea'}
                    >
                      📖 View Summary
                    </button>
                  )}
                  {isManagingLibraries && (
                    <button
                      onClick={() => removePaperFromLibrary(library.id, paper.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fc8181',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f56565'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#fc8181'}
                    >
                      🗑️ Delete
                    </button>
                  )}
                        </div>
                      </div>
                      ))}
                      </div>
                    </div>
                  )}
                  
                  {expandedLibraries[library.id] && library.papers.length === 0 && (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#718096'
                    }}>
                      <p style={{ fontSize: '14px', margin: 0 }}>This library is empty</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authors Section */}
      {tab === 'search' && view === 'authors' && authors.length > 0 && (
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
              background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
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
              Authors Found ({authors.length})
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gap: '20px'
          }}>
            {authors.map((author, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
                onClick={() => loadPapers(author.id)}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-4px)';
                  e.target.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.15)';
                  e.target.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                  e.target.style.borderColor = 'rgba(102, 126, 234, 0.1)';
                }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '8px',
                  lineHeight: '1.4'
                }}>
                  {author.name}
                </h3>
                {author.snippet && (
                  <p style={{
                    color: '#64748b',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: 0,
                    marginBottom: '12px'
                  }}>
                    {author.snippet}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  {author.link && (
                    <a
                      href={author.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
                    >
                      🔗 Open Profile
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      saveAuthor(author);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#48bb78',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#38a169'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#48bb78'}
                  >
                    💾 Save Author
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Authors Tab */}
      {tab === 'saved-authors' && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          marginTop: '24px'
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
              background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              👤
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Saved Authors ({savedAuthors.filter(author => {
                if (!authorSearchQuery.trim()) return true;
                const query = authorSearchQuery.toLowerCase();
                return author.name.toLowerCase().includes(query) ||
                       (author.snippet && author.snippet.toLowerCase().includes(query));
              }).length})
            </h2>
          </div>
          
          {/* Search Input */}
          {savedAuthors.length > 0 && (
            <div style={{
              marginBottom: '24px',
              position: 'relative'
            }}>
              <input
                type="text"
                value={authorSearchQuery}
                onChange={(e) => setAuthorSearchQuery(e.target.value)}
                placeholder="Search authors by name..."
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 40px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
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
                  onClick={() => setAuthorSearchQuery('')}
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#718096'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
          
          {savedAuthors.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                No authors saved yet
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#718096'
              }}>
                Search for authors and click "Save Author" to add them here
              </p>
            </div>
          )}
          {savedAuthors.length > 0 && (
            <div style={{
              display: 'grid',
              gap: '16px'
            }}>
              {savedAuthors
                .filter(author => {
                  if (!authorSearchQuery.trim()) return true;
                  const query = authorSearchQuery.toLowerCase();
                  return author.name.toLowerCase().includes(query) ||
                         (author.snippet && author.snippet.toLowerCase().includes(query));
                })
                .map((author) => (
              <div
                key={author.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                }}
              >
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '8px'
                }}>
                  {author.name}
                </h3>
                {author.snippet && (
                  <p style={{
                    color: '#64748b',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    marginBottom: '12px'
                  }}>
                    {author.snippet}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    onClick={() => {
                      // Extract Google Scholar authorId from saved author
                      // Saved authors might have it in authorId field or id field
                      const authorId = author.authorId || author.id;
                      console.log('View Papers clicked for author:', author, 'authorId:', authorId);
                      loadPapers(authorId);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#3182ce'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#4299e1'}
                  >
                    📄 View Papers
                  </button>
                  {author.link && (
                    <a
                      href={author.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#5568d3'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
                    >
                      🔗 Open Profile
                    </a>
                  )}
                  <button
                    onClick={() => removeSavedAuthor(author.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#fc8181',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f56565'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#fc8181'}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Papers Section */}
      {tab === 'search' && view === 'papers' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            {isPaperSearch ? (
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1a202c'
              }}>
                Search Results
              </h2>
            ) : (
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1a202c'
            }}>
              Papers by {currentAuthorName}
            </h2>
            )}
            <button
              onClick={clearResults}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#cbd5e0'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#e2e8f0'}
            >
              ← Back to Search
            </button>
          </div>

          {/* Sort Options - Only show for author papers, not direct paper searches */}
          {!isPaperSearch && (
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              alignItems: 'center'
            }}>
              <label style={{
                fontSize: '14px',
                color: '#4a5568',
                fontWeight: '500'
              }}>
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSortValue = e.target.value;
                  setSortBy(newSortValue);
                  sortPapers(newSortValue);
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Citations (default)</option>
                <option value="pubdate">Publication Date</option>
              </select>
            </div>
          )}

          {/* Papers Grid */}
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {papers.map((paper, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#f7fafc'
                }}
              >
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
                  marginBottom: '8px',
                  fontSize: '14px',
                  color: '#718096'
                }}>
                  <span>📅 {paper.year}</span>
                  <span>📊 {paper.citationCount} citations</span>
                  {paper.publication && (
                    <span>📖 {paper.publication}</span>
                  )}
                </div>

                {paper.authors && (
                  <p style={{
                    fontSize: '14px',
                    color: '#4a5568',
                    marginBottom: '12px'
                  }}>
                    <strong>Authors:</strong> {paper.authors}
                  </p>
                )}

                {paper.link && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px'
                  }}>
                  <a
                    href={paper.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      backgroundColor: '#4299e1',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#3182ce'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#4299e1'}
                  >
                    View Paper
                  </a>
                    <button
                      onClick={() => savePaper(paper)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#38a169'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#48bb78'}
                    >
                      💾 Save Paper
                    </button>
                    {hasSummary(paper) ? (
                      <button
                        onClick={() => viewSummary(paper)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#9f7aea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#805ad5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#9f7aea'}
                      >
                        📖 View Summary
                      </button>
                    ) : (
                      <button
                        onClick={() => summarizePaper(paper)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#9f7aea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#805ad5'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#9f7aea'}
                      >
                        📝 Summarize
                      </button>
                    )}
                  </div>
                )}
              </div>
                ))}
            </div>
        </div>
      )}

      {/* Paper Summary Tab */}
      {tab === 'summary' && summaryTabVisible && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          marginTop: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              📝
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0
            }}>
              Paper Summary
            </h2>
          </div>

          {/* Paper Info */}
          {summaryPaper && (
            <div style={{
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1a202c',
                marginBottom: '12px'
              }}>
                {summaryPaper.title}
              </h3>
              <div style={{
                display: 'flex',
                gap: '16px',
                fontSize: '14px',
                color: '#718096',
                marginBottom: '8px'
              }}>
                <span>📅 {summaryPaper.year}</span>
                <span>📊 {summaryPaper.citationCount} citations</span>
                {summaryPaper.publication && (
                  <span>📖 {summaryPaper.publication}</span>
                )}
              </div>
              {summaryPaper.authors && (
                <p style={{
                  fontSize: '14px',
                  color: '#4a5568',
                  marginTop: '8px'
                }}>
                  <strong>Authors:</strong> {summaryPaper.authors}
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          <div style={{
            background: 'linear-gradient(135deg, #fef5e7 0%, #fef3e0 100%)',
            border: '2px solid #f6e05e',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1a202c',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🧠</span> Summary
            </h3>
            <div style={{
              fontSize: '15px',
              lineHeight: '1.8',
              color: '#2d3748',
              whiteSpace: 'pre-line'
            }}>
              {summary ? summary.split('\n').map((line, idx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return <div key={idx} style={{ marginBottom: '8px' }}> </div>;
                
                // Remove all bullet point markers
                const cleanedLine = trimmedLine.replace(/^[-*•]\s*/, '').trim();
                
                // Process markdown bold
                const parts = cleanedLine.split(/(\*\*.*?\*\*)/g);
                
                return (
                  <div key={idx} style={{ marginBottom: '12px' }}>
                    {parts.map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i} style={{ fontWeight: '600', color: '#1a202c' }}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                );
              }) : 'Generating summary...'}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Library Selection Modal */}
      {showLibraryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1a202c',
              marginBottom: '24px'
            }}>
              Save Paper to Library
            </h2>

            {/* Library Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                Select Library:
              </label>
              <select
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'white',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Choose a library...</option>
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name} ({lib.papers.length} papers)
                  </option>
                ))}
              </select>
            </div>

            {/* Or Create New */}
            <div style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '2px solid #e2e8f0',
              boxSizing: 'border-box'
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                Or Create New Library:
              </label>
              <input
                type="text"
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                placeholder="Library name..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              <textarea
                value={newLibraryNote}
                onChange={(e) => setNewLibraryNote(e.target.value)}
                placeholder="Add a note (optional)..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  marginBottom: '12px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={createLibrary}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#9f7aea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Create Library
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#fed7d7',
                color: '#c53030',
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={cancelSavePaper}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSavePaper}
                disabled={!selectedLibraryId && !newLibraryName.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: selectedLibraryId || newLibraryName.trim() ? '#4299e1' : '#cbd5e0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: selectedLibraryId || newLibraryName.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Save Paper
              </button>
            </div>
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

export default GoogleScholarSearchWidget;
