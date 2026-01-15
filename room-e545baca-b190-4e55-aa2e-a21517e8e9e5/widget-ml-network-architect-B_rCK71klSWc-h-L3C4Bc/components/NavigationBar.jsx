import React, { useState } from 'react';

const NavigationBar = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase().trim();
    
    // Simple search logic
    if (query.includes('k-means') || query.includes('kmeans') || query.includes('clustering')) {
      onNavigate('/kmeans');
    } else if (query.includes('linear') || query.includes('regression') || query.includes('lr')) {
      onNavigate('/linear-regression');
    }
  };

  return (
    <nav style={{
      position: 'fixed',
      left: '220px',
      top: 0,
      right: 0,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e0e0e0',
      padding: '15px 30px',
      zIndex: 5
    }}>
      <form 
        onSubmit={handleSearch}
        style={{
          maxWidth: '350px',
          display: 'flex',
          gap: '8px'
        }}
      >
        <input
          type="search"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '2px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif',
            outline: 'none'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#0066cc';
            e.target.style.outline = '1px solid #0066cc';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#ddd';
            e.target.style.outline = 'none';
          }}
        />
        <button 
          type="submit"
          style={{
            padding: '8px 16px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
        >
          Search
        </button>
      </form>
    </nav>
  );
};

export default NavigationBar;

