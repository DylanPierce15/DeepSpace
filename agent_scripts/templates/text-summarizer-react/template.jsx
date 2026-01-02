import React, { useState, useEffect } from 'react';

function TextSummarizerWidget() {
  // Input slot - receives text from connected widgets
  const inputText = useInput('input-slot-1', '');
  
  const [summary, setSummary] = useState('');
  
  // Output slot - send summary to connected widgets
  const setOutput1 = useOutput('output-slot-1');
  
  // Auto-summarize when input changes
  useEffect(() => {
    if (inputText && inputText.trim()) {
      handleSummarize(inputText);
    } else {
      setSummary('');
      setOutput1('');
    }
  }, [inputText]);
  
  const handleSummarize = (text) => {
    // Simple summarization (extract first sentences, count words, etc.)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const wordCount = text.split(/\s+/).length;
    
    // Take first 2-3 sentences as summary
    const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
    const summaryText = summarySentences.join('. ') + (summarySentences.length > 0 ? '.' : '');
    
    const formattedSummary = `## Summary\n\n${summaryText}\n\n**Statistics:**\n- Word count: ${wordCount}\n- Sentences: ${sentences.length}\n- Characters: ${text.length}\n\n*Summarized at: ${new Date().toLocaleTimeString()}*`;
    
    setSummary(formattedSummary);
    
    // Send to output slot
    setOutput1(formattedSummary);
  };
  
  // Simple markdown renderer (basic support)
  const renderMarkdown = (md) => {
    if (!md) return null;
    
    return md.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('## ')) {
        return <h2 key={i} style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: '#1f2937' }}>{line.slice(3)}</h2>;
      }
      // Bold
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={i} style={{ marginBottom: '6px', fontSize: '13px', lineHeight: '1.6' }}>
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          </p>
        );
      }
      // Italic
      if (line.includes('*') && !line.includes('**')) {
        const parts = line.split('*');
        return (
          <p key={i} style={{ marginBottom: '6px', fontSize: '13px', lineHeight: '1.6' }}>
            {parts.map((part, j) => j % 2 === 1 ? <em key={j}>{part}</em> : part)}
          </p>
        );
      }
      // Bullets
      if (line.startsWith('- ')) {
        return <li key={i} style={{ marginLeft: '20px', fontSize: '13px', marginBottom: '4px' }}>{line.slice(2)}</li>;
      }
      // Regular paragraph
      if (line.trim()) {
        return <p key={i} style={{ marginBottom: '8px', fontSize: '13px', lineHeight: '1.6' }}>{line}</p>;
      }
      return <br key={i} />;
    });
  };
  
  return (
    <div style={{
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '8px'
      }}>
        📊 Text Summarizer
      </div>
      
      {/* Input Display */}
      {inputText && (
        <div style={{
          padding: '12px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#3b82f6',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Input ← Slot 1
          </div>
          <div style={{
            fontSize: '12px',
            color: '#1e40af',
            lineHeight: '1.5',
            maxHeight: '80px',
            overflow: 'auto',
            fontFamily: 'monospace'
          }}>
            {inputText.substring(0, 200)}{inputText.length > 200 ? '...' : ''}
          </div>
        </div>
      )}
      
      {/* Summary Output */}
      {summary ? (
        <div style={{
          padding: '16px',
          background: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: '8px',
          flex: 1,
          overflow: 'auto'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#16a34a',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Output → Slot 1 (Markdown)
          </div>
          <div style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#166534'
          }}>
            {renderMarkdown(summary)}
          </div>
        </div>
      ) : !inputText ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '14px',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ fontSize: '48px', opacity: 0.5 }}>📊</div>
          <div>
            Connect an output from another widget to <strong>Input Slot 1</strong> to begin
          </div>
          <div style={{ fontSize: '12px', color: '#d1d5db' }}>
            Drag from a blue input bauble (left side) to create a connection
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TextSummarizerWidget;
