import React, { useState } from 'react';

function TextGeneratorWidget() {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  
  // Output slot - send generated text to connected widgets
  const setOutput1 = useOutput('output-slot-1');
  
  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    // Simple text generation (no API needed for demo)
    const templates = [
      `Based on "${prompt}", here's an interesting perspective: This concept represents a fundamental shift in how we approach the problem. By examining the core principles, we can derive meaningful insights that lead to innovative solutions.`,
      `Exploring "${prompt}" reveals several key dimensions. First, we must consider the historical context. Second, the practical applications become evident. Finally, the future implications suggest transformative potential.`,
      `The topic of "${prompt}" invites deep analysis. Through systematic examination, we discover that the underlying patterns mirror broader themes in the field. This connection opens pathways to novel understanding.`
    ];
    
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const generated = randomTemplate + `\n\n**Generated at:** ${new Date().toLocaleTimeString()}`;
    
    setGeneratedText(generated);
    
    // Send to output slot - this propagates to connected inputs!
    setOutput1(generated);
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
        📝 Text Generator
      </div>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <label style={{ fontSize: '14px', fontWeight: '500', color: '#4b5563' }}>
          Topic / Prompt
        </label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter a topic..."
          style={{
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleGenerate();
            }
          }}
        />
      </div>
      
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim()}
        style={{
          padding: '12px 24px',
          background: !prompt.trim() ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s'
        }}
      >
        ✨ Generate Text
      </button>
      
      {generatedText && (
        <div style={{
          marginTop: '8px',
          padding: '16px',
          background: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: '8px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#16a34a',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Output → Slot 1
          </div>
          <div style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#166534',
            whiteSpace: 'pre-wrap'
          }}>
            {generatedText}
          </div>
        </div>
      )}
      
      <div style={{
        marginTop: 'auto',
        padding: '12px',
        background: '#eff6ff',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Tip:</strong> Connect Output Slot 1 (right side) to another widget's input to send the generated text automatically!
      </div>
    </div>
  );
}

export default TextGeneratorWidget;
