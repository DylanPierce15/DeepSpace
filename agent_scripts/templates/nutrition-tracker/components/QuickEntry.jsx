import React, { useState } from 'react';
import { COLORS } from '../utils/constants';

function QuickEntry({ onAddFood }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Parse input - try to extract calories
    const calorieMatch = input.match(/\b(\d+)\b/);
    
    if (calorieMatch) {
      const calories = parseInt(calorieMatch[0]);
      // Check if there's text before/after the number
      const beforeNum = input.substring(0, calorieMatch.index).trim();
      const afterNum = input.substring(calorieMatch.index + calorieMatch[0].length).trim();
      const name = (beforeNum + ' ' + afterNum).trim() || `${calories} cal`;

      onAddFood({
        id: Date.now(),
        name: name,
        calories: calories,
        protein: 0,
        carbs: 0,
        fat: 0,
        timestamp: new Date().toISOString()
      });

      setInput('');
    } else {
      // No number found, treat entire input as food name with 0 calories
      onAddFood({
        id: Date.now(),
        name: input.trim(),
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        timestamp: new Date().toISOString()
      });
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <form onSubmit={handleSubmit}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px' 
        }}>
          <span className="material-icons" style={{ 
            color: COLORS.primary, 
            fontSize: '24px' 
          }}>
            add_circle_outline
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type food and calories (e.g., 'Chicken salad 450' or just '450')"
            style={{
              flex: 1,
              padding: '14px 16px',
              border: `2px solid ${COLORS.border}`,
              borderRadius: '8px',
              fontSize: '15px',
              fontFamily: 'Roboto, sans-serif',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = COLORS.primary}
            onBlur={e => e.target.style.borderColor = COLORS.border}
          />
          <button
            type="submit"
            style={{
              padding: '14px 24px',
              border: 'none',
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'transform 0.2s',
              boxShadow: '0 2px 8px rgba(102,126,234,0.3)'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
            Add
          </button>
        </div>
        <div style={{ 
          marginTop: '8px', 
          marginLeft: '36px',
          fontSize: '12px', 
          color: COLORS.textSecondary 
        }}>
          Press Enter to add • Click on items to edit details
        </div>
      </form>
    </div>
  );
}

export default QuickEntry;

