import React, { useState } from 'react';
import { COLORS } from '../utils/constants';

function SettingsModal({ isOpen, onClose, preferences, onSave, isFirstTime }) {
  const [localPrefs, setLocalPrefs] = useState(preferences);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!localPrefs.dailyGoal || localPrefs.dailyGoal <= 0) {
      alert('Please set a daily calorie goal before continuing');
      return;
    }
    onSave(localPrefs);
    onClose();
  };

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
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ 
          margin: '0 0 24px 0', 
          color: COLORS.text, 
          fontSize: '24px', 
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons" style={{ 
            color: COLORS.primary, 
            fontSize: '28px' 
          }}>
            {isFirstTime ? 'flag' : 'settings'}
          </span>
          {isFirstTime ? 'Welcome! Set Your Goal' : 'Settings'}
        </h3>
        {isFirstTime && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: '#E3F2FD',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#1976D2'
          }}>
            👋 Welcome to Nutrition Tracker! Let's start by setting your daily calorie goal.
          </div>
        )}
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500',
            color: COLORS.text
          }}>
            Daily Calorie Goal
          </label>
          <input
            type="number"
            value={localPrefs.dailyGoal}
            onChange={(e) => setLocalPrefs({
              ...localPrefs,
              dailyGoal: parseInt(e.target.value) || 2000
            })}
            style={{
              width: '100%',
              padding: '14px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              fontSize: '16px',
              boxSizing: 'border-box',
              fontFamily: 'Roboto, sans-serif'
            }}
          />
          <div style={{ 
            fontSize: '12px', 
            color: COLORS.textSecondary,
            marginTop: '6px'
          }}>
            Recommended: 1800-2500 calories per day
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontSize: '14px',
            fontWeight: '500',
            color: COLORS.text
          }}>
            Daily Reset Time
          </label>
          <select
            value={localPrefs.resetHour}
            onChange={(e) => setLocalPrefs({
              ...localPrefs,
              resetHour: parseInt(e.target.value)
            })}
            style={{
              width: '100%',
              padding: '14px',
              border: `1px solid ${COLORS.border}`,
              borderRadius: '8px',
              fontSize: '16px',
              boxSizing: 'border-box',
              fontFamily: 'Roboto, sans-serif',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            {[...Array(24)].map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? '12:00 AM (Midnight)' : 
                 i < 12 ? `${i}:00 AM` : 
                 i === 12 ? '12:00 PM (Noon)' : 
                 `${i - 12}:00 PM`}
              </option>
            ))}
          </select>
          <div style={{ 
            fontSize: '12px', 
            color: COLORS.textSecondary,
            marginTop: '6px'
          }}>
            The time when your daily log resets to a new day
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '14px',
              border: 'none',
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span className="material-icons">check</span>
            {isFirstTime ? 'Get Started' : 'Save Settings'}
          </button>
          {!isFirstTime && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: '8px',
                background: 'white',
                color: COLORS.text,
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span className="material-icons">close</span>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;

