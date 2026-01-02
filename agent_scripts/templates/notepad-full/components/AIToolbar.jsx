import React, { useState, useRef, useEffect } from 'react';
import { extractNoteTitle } from '../utils/noteUtils';

export default function AIDropdown({ note, onUpdate, onOpenChat }) {
  const [loading, setLoading] = useState(null); // 'summarize', 'cleanup', or null
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const stripHtml = (html) => {
    if (!html) return '';
    let text = html.replace(/<[^>]*>/g, ' ');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    return text.replace(/\s+/g, ' ').trim();
  };

  const cleanAIResponse = (response) => {
    if (!response) return '';
    
    // Remove markdown code blocks (```html, ```javascript, etc.)
    let cleaned = response.replace(/```[\w]*\n?/g, '');
    
    // Remove <!DOCTYPE html> and <html>, <head>, <body> wrapper tags
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/?html[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/?head[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/?body[^>]*>/gi, '');
    cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
    cleaned = cleaned.replace(/<title[^>]*>.*?<\/title>/gi, '');
    
    // Clean up extra whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  };

  const handleSummarize = async () => {
    if (!note?.content || loading) return;
    
    setLoading('summarize');
    try {
      const cleanText = stripHtml(note.content);
      
      const prompt = `Please provide a concise summary of the following note in 2-3 sentences. Format as a single paragraph.\n\nNote content:\n${cleanText}`;
      
      const response = await miyagiAPI('/api/integrations/generate-text', {
        prompt: prompt,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_completion_tokens: 200,
        temperature: 0.3
      });

      console.log('AI response:', response);

      // Extract text from wrapped response { success, data: { text } }
      const text = response?.data?.text || response?.text || (typeof response === 'string' ? response : null);
      if (text) {
        const cleanedResponse = cleanAIResponse(text);
        console.log('AI Summary result (cleaned):', cleanedResponse);
        
        // Append summary to the note
        const summaryHtml = `<hr><h3>Summary</h3><p>${cleanedResponse}</p>`;
        const newContent = note.content + summaryHtml;
        
        console.log('Updating note with new content, length:', newContent.length);
        
        const updatedNote = {
          ...note,
          content: newContent,
          updatedAt: Date.now()
        };
        
        console.log('Calling onUpdate with:', updatedNote);
        onUpdate(updatedNote);
      }
    } catch (error) {
      console.error('Summarize error:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleCleanup = async () => {
    if (!note?.content || loading) return;
    
    setLoading('cleanup');
    try {
      const cleanText = stripHtml(note.content);
      
      const prompt = `Please rewrite and organize the following note to be clear, well-structured, and easy to read. Maintain the original meaning and key points, but improve the organization, grammar, and clarity. Format the output in HTML with appropriate headings (<h2>, <h3>), paragraphs (<p>), and lists (<ul>, <ol>) where appropriate.\n\nNote content:\n${cleanText}`;
      
      const response = await miyagiAPI('/api/integrations/generate-text', {
        prompt: prompt,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_completion_tokens: 2000,
        temperature: 0.4
      });

      console.log('AI cleanup response:', response);

      // Extract text from wrapped response { success, data: { text } }
      const text = response?.data?.text || response?.text || (typeof response === 'string' ? response : null);
      if (text) {
        const cleanedResponse = cleanAIResponse(text);
        console.log('Replacing note content with cleaned version');
        // Replace note content with cleaned up version
        onUpdate({
          ...note,
          content: cleanedResponse,
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('Failed to clean up note. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleMenuClick = async (action) => {
    setDropdownOpen(false);
    
    if (action === 'summarize') {
      await handleSummarize();
    } else if (action === 'cleanup') {
      await handleCleanup();
    } else if (action === 'chat') {
      onOpenChat();
    }
  };

  const DropdownItem = ({ onClick, label, description, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        transition: 'background 0.15s',
        opacity: disabled ? 0.5 : 1,
        borderRadius: '4px'
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{label}</div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>{description}</div>
    </button>
  );

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={loading}
        title="AI Tools"
        style={{
          padding: '6px 10px',
          background: loading ? '#f3f4f6' : 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: loading ? 'wait' : 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          color: '#374151',
          transition: 'all 0.15s',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          minWidth: '52px',
        }}
      >
        {loading ? 'AI...' : 'AI'}
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▾</span>
      </button>

      {dropdownOpen && !loading && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          minWidth: '220px',
          background: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          padding: '4px',
          animation: 'slideDown 0.15s ease-out'
        }}>
          <DropdownItem
            onClick={() => handleMenuClick('summarize')}
            label="Summarize Note"
            description="Add a summary to the end"
            disabled={!note?.content}
          />
          <DropdownItem
            onClick={() => handleMenuClick('cleanup')}
            label="Clean Up & Organize"
            description="Rewrite for clarity"
            disabled={!note?.content}
          />
          <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 8px' }} />
          <DropdownItem
            onClick={() => handleMenuClick('chat')}
            label="AI Chat"
            description="Create notes with AI"
          />
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

