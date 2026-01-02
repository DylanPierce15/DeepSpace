import React, { useState, useRef, useEffect } from 'react';
import { generateNoteId } from '../utils/noteUtils';

export default function AIChatModal({ isOpen, onClose, onCreateNote, allNotes = [], currentFolderId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Strip HTML for plain text context
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

  // Get notes context (up to 20k characters)
  const getNotesContext = () => {
    if (!allNotes || allNotes.length === 0) return '';
    
    // Sort by most recent first
    const sortedNotes = [...allNotes].sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return timeB - timeA;
    });
    
    let context = '\n\nExisting notes in the system:\n';
    let totalLength = context.length;
    const maxLength = 20000;
    
    for (const note of sortedNotes) {
      const noteText = stripHtml(note.content);
      const noteEntry = `\n- ${noteText.substring(0, 200)}${noteText.length > 200 ? '...' : ''}\n`;
      
      if (totalLength + noteEntry.length > maxLength) break;
      
      context += noteEntry;
      totalLength += noteEntry.length;
    }
    
    return context;
  };

  // Clean AI response (remove markdown code blocks and HTML wrappers)
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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Build conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      conversationHistory.push({ role: 'user', content: userMessage });

      // Create prompt with notes context
      const notesContext = getNotesContext();
      console.log('Notes context length:', notesContext.length);
      console.log('Number of notes in context:', allNotes.length);
      
      const systemPrompt = `You are a helpful AI assistant that helps users create well-organized notes. When users ask you to create a note, generate it in clean HTML format using appropriate tags like <h2>, <h3>, <p>, <ul>, <ol>, <strong>, <em>, etc. (DO NOT use <h1>, <html>, <head>, <body>, <!DOCTYPE>, or wrap in markdown code blocks). Keep the content focused and well-structured.${notesContext}`;
      
      console.log('System prompt with context:', systemPrompt.substring(0, 500) + '...');
      
      const fullPrompt = conversationHistory.map(m => {
        return `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`;
      }).join('\n\n');

      const response = await miyagiAPI('/api/integrations/generate-text', {
        prompt: `${systemPrompt}\n\n${fullPrompt}\n\nAssistant:`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        max_completion_tokens: 1500,
        temperature: 0.7
      });

      // Extract text from wrapped response { success, data: { text } }
      const text = response?.data?.text || response?.text || (typeof response === 'string' ? response : null);
      if (text) {
        const cleanedResponse = cleanAIResponse(text);
        setMessages(prev => [...prev, { role: 'assistant', content: cleanedResponse }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = (content) => {
    const newNote = {
      id: generateNoteId(),
      content: content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId: currentFolderId // Use current folder
    };
    
    onCreateNote(newNote);
    setMessages([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f9fafb',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
            AI Assistant
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              color: '#6b7280',
              fontWeight: 600,
              fontSize: '18px'
            }}
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: '#f9fafb'
        }}>
          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
              padding: '40px 20px'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#6b7280' }}>Start a conversation</div>
              <div>Ask me to create a note, brainstorm ideas, or organize your thoughts.</div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '12px',
                background: msg.role === 'user' ? '#8b5cf6' : 'white',
                color: msg.role === 'user' ? 'white' : '#111827',
                fontSize: '14px',
                lineHeight: '1.6',
                boxShadow: msg.role === 'user' ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCreateNote(msg.content)}
                    style={{
                      marginTop: '12px',
                      padding: '6px 12px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'block',
                      width: '100%',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                  >
                    Create Note
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start'
            }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'white',
                color: '#6b7280',
                fontSize: '14px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          background: 'white',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask AI to create or organize a note..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{
                padding: '10px 20px',
                background: !input.trim() || loading ? '#9ca3af' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'background 0.2s'
              }}
            >
              Send
            </button>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}

