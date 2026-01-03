import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const CATEGORIES = {
  mentalHealth: {
    id: 'mentalHealth',
    name: 'Mental Health',
    color: '#6366f1',
    hoverColor: '#5558e3',
    lightColor: 'rgba(99, 102, 241, 0.1)',
    placeholder: "What's on your mind today?",
    fieldLabel: null,
    fieldPlaceholder: null,
    emptyMessage: 'No entries yet',
    emptySubtext: 'Start writing to create your first entry'
  },
  school: {
    id: 'school',
    name: 'School & Studies',
    color: '#0ea5e9',
    hoverColor: '#0284c7',
    lightColor: 'rgba(14, 165, 233, 0.1)',
    placeholder: 'What did you learn today?',
    fieldLabel: 'Subject or Topic',
    fieldPlaceholder: 'Subject or Topic (optional)',
    emptyMessage: 'No notes yet',
    emptySubtext: 'Start documenting your learning journey'
  },
  personal: {
    id: 'personal',
    name: 'Personal Favorites',
    color: '#f59e0b',
    hoverColor: '#d97706',
    lightColor: 'rgba(245, 158, 11, 0.1)',
    placeholder: 'What made you smile today?',
    fieldLabel: 'Title',
    fieldPlaceholder: 'Give it a title (optional)',
    emptyMessage: 'No memories yet',
    emptySubtext: 'Start capturing your favorite moments'
  }
};

function JournalNotebook() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [entries, setEntries] = useStorage('entries', []);
  const [activeCategory, setActiveCategory] = useState('mentalHealth');
  const [currentEntry, setCurrentEntry] = useState('');
  const [currentField, setCurrentField] = useState('');
  const [editingId, setEditingId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => { 
      document.body.style.background = ''; 
      document.documentElement.style.minHeight = ''; 
    };
  }, []);

  const category = CATEGORIES[activeCategory];

  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.category === activeCategory).sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, activeCategory]);

  const handleSave = useCallback(() => {
    if (!currentEntry.trim()) return;
    
    if (editingId) {
      setEntries(prev => prev.map(entry => 
        entry.id === editingId 
          ? { ...entry, content: currentEntry, field: currentField, updatedAt: Date.now() }
          : entry
      ));
      setEditingId(null);
    } else {
      const newEntry = {
        id: Date.now().toString(),
        category: activeCategory,
        content: currentEntry,
        field: currentField,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setEntries(prev => [newEntry, ...prev]);
    }
    setCurrentEntry('');
    setCurrentField('');
    textareaRef.current?.focus();
  }, [currentEntry, currentField, editingId, activeCategory, setEntries]);

  const handleEdit = useCallback((entry) => {
    setCurrentEntry(entry.content);
    setCurrentField(entry.field || '');
    setEditingId(entry.id);
    textareaRef.current?.focus();
  }, []);

  const handleDelete = useCallback((id) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
    if (editingId === id) {
      setCurrentEntry('');
      setCurrentField('');
      setEditingId(null);
    }
  }, [editingId, setEntries]);

  const handleCancel = useCallback(() => {
    setCurrentEntry('');
    setCurrentField('');
    setEditingId(null);
  }, []);

  const handleCategoryChange = useCallback((categoryId) => {
    setActiveCategory(categoryId);
    setCurrentEntry('');
    setCurrentField('');
    setEditingId(null);
  }, []);

  const formatDate = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, -apple-system, sans-serif' }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '48px 48px 32px', borderBottom: '1px solid #f0f0f0' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '300', color: '#1a1a1a', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          Journal Notebook
        </h1>
        <p style={{ fontSize: '15px', color: '#666', fontWeight: '400' }}>
          Your personal space for mental health, learning, and favorite moments
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{ padding: '32px 48px 0', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.values(CATEGORIES).map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              style={{
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '500',
                border: 'none',
                borderBottom: activeCategory === cat.id ? `3px solid ${cat.color}` : '3px solid transparent',
                background: 'transparent',
                color: activeCategory === cat.id ? cat.color : '#666',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '-1px'
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== cat.id) {
                  e.target.style.color = '#333';
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== cat.id) {
                  e.target.style.color = '#666';
                }
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Entry Editor */}
      <div style={{ padding: '48px' }}>
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
          marginBottom: '48px',
          border: `1px solid ${category.lightColor}`
        }}>
          {category.fieldLabel && (
            <input
              type="text"
              value={currentField}
              onChange={(e) => setCurrentField(e.target.value)}
              placeholder={category.fieldPlaceholder}
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '16px',
                fontWeight: '500',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                fontFamily: 'inherit',
                color: '#1a1a1a',
                background: '#fafafa',
                outline: 'none',
                transition: 'all 0.2s ease',
                marginBottom: '16px'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = category.color;
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#f0f0f0';
                e.target.style.background = '#fafafa';
              }}
            />
          )}
          <textarea
            ref={textareaRef}
            value={currentEntry}
            onChange={(e) => setCurrentEntry(e.target.value)}
            placeholder={category.placeholder}
            style={{
              width: '100%',
              minHeight: '180px',
              padding: '20px',
              fontSize: '16px',
              lineHeight: '1.6',
              border: '1px solid #f0f0f0',
              borderRadius: '12px',
              resize: 'vertical',
              fontFamily: 'inherit',
              color: '#1a1a1a',
              background: '#fafafa',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = category.color;
              e.target.style.background = '#ffffff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#f0f0f0';
              e.target.style.background = '#fafafa';
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
            {editingId && (
              <button
                onClick={handleCancel}
                style={{
                  padding: '14px 28px',
                  fontSize: '15px',
                  fontWeight: '500',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  background: '#ffffff',
                  color: '#666',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = '#ffffff'}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!currentEntry.trim()}
              style={{
                padding: '14px 32px',
                fontSize: '15px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '10px',
                background: currentEntry.trim() ? category.color : '#e0e0e0',
                color: '#ffffff',
                cursor: currentEntry.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                boxShadow: currentEntry.trim() ? `0 4px 16px ${category.lightColor}` : 'none'
              }}
              onMouseEnter={(e) => {
                if (currentEntry.trim()) e.target.style.background = category.hoverColor;
              }}
              onMouseLeave={(e) => {
                if (currentEntry.trim()) e.target.style.background = category.color;
              }}
            >
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: '#999' }}>
            <div style={{ fontSize: '18px', fontWeight: '400', marginBottom: '8px' }}>{category.emptyMessage}</div>
            <div style={{ fontSize: '14px', color: '#bbb' }}>{category.emptySubtext}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '32px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease',
                  borderLeft: `4px solid ${category.color}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.03)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    {entry.field && (
                      <div style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: category.color, 
                        marginBottom: '4px' 
                      }}>
                        {entry.field}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', color: '#999', fontWeight: '500' }}>
                      {formatDate(entry.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEdit(entry)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        background: '#ffffff',
                        color: '#666',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = category.color;
                        e.target.style.color = category.color;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = '#f0f0f0';
                        e.target.style.color = '#666';
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: '500',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        background: '#ffffff',
                        color: '#666',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#ef4444';
                        e.target.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = '#f0f0f0';
                        e.target.style.color = '#666';
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ 
                  fontSize: '15px', 
                  lineHeight: '1.7', 
                  color: '#333',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {entry.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default JournalNotebook;
