import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

function JournalMentalHealth() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [entries, setEntries] = useStorage('entries', []);
  const [currentEntry, setCurrentEntry] = useState('');
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

  const handleSave = useCallback(() => {
    if (!currentEntry.trim()) return;
    
    if (editingId) {
      setEntries(prev => prev.map(entry => 
        entry.id === editingId 
          ? { ...entry, content: currentEntry, updatedAt: Date.now() }
          : entry
      ));
      setEditingId(null);
    } else {
      const newEntry = {
        id: Date.now().toString(),
        content: currentEntry,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setEntries(prev => [newEntry, ...prev]);
    }
    setCurrentEntry('');
    textareaRef.current?.focus();
  }, [currentEntry, editingId, setEntries]);

  const handleEdit = useCallback((entry) => {
    setCurrentEntry(entry.content);
    setEditingId(entry.id);
    textareaRef.current?.focus();
  }, []);

  const handleDelete = useCallback((id) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
    if (editingId === id) {
      setCurrentEntry('');
      setEditingId(null);
    }
  }, [editingId, setEntries]);

  const handleCancel = useCallback(() => {
    setCurrentEntry('');
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
          Mental Health
        </h1>
        <p style={{ fontSize: '15px', color: '#666', fontWeight: '400' }}>
          A safe space for your thoughts and feelings
        </p>
      </div>

      {/* Entry Editor */}
      <div style={{ padding: '48px' }}>
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
          marginBottom: '48px'
        }}>
          <textarea
            ref={textareaRef}
            value={currentEntry}
            onChange={(e) => setCurrentEntry(e.target.value)}
            placeholder="What's on your mind today?"
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
              e.target.style.borderColor = '#6366f1';
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
                background: currentEntry.trim() ? '#6366f1' : '#e0e0e0',
                color: '#ffffff',
                cursor: currentEntry.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                boxShadow: currentEntry.trim() ? '0 4px 16px rgba(99, 102, 241, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (currentEntry.trim()) e.target.style.background = '#5558e3';
              }}
              onMouseLeave={(e) => {
                if (currentEntry.trim()) e.target.style.background = '#6366f1';
              }}
            >
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </div>

        {/* Entries List */}
        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: '#999' }}>
            <div style={{ fontSize: '18px', fontWeight: '400', marginBottom: '8px' }}>No entries yet</div>
            <div style={{ fontSize: '14px', color: '#bbb' }}>Start writing to create your first entry</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '32px',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.03)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#999', fontWeight: '500' }}>
                    {formatDate(entry.createdAt)}
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
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.color = '#6366f1';
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

export default JournalMentalHealth;
