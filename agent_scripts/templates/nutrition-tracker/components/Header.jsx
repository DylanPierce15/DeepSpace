import React from 'react';
import { COLORS } from '../utils/constants';

function Header({ onSettingsClick, selectedDate, currentDateKey, onPrevDay, onNextDay, onToday }) {
  const isToday = selectedDate === currentDateKey;
  
  // Format the date for display
  const formatDisplayDate = (dateKey) => {
    const date = new Date(dateKey);
    const today = new Date(currentDateKey);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateKey === currentDateKey) {
      return 'Today';
    } else if (dateKey === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '28px', 
            fontWeight: '500', 
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '32px', 
              color: COLORS.primary 
            }}>
              restaurant
            </span>
            Nutrition Tracker
          </h1>
        </div>
        <button
          onClick={onSettingsClick}
          style={{
            padding: '10px',
            border: 'none',
            borderRadius: '8px',
            background: COLORS.background,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = COLORS.border}
          onMouseOut={e => e.currentTarget.style.background = COLORS.background}
        >
          <span className="material-icons" style={{ color: COLORS.textSecondary }}>
            settings
          </span>
        </button>
      </div>

      {/* Date Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: COLORS.background,
        borderRadius: '12px',
        padding: '12px'
      }}>
        <button
          onClick={onPrevDay}
          style={{
            padding: '8px',
            border: 'none',
            borderRadius: '8px',
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span className="material-icons" style={{ color: COLORS.text, fontSize: '20px' }}>
            chevron_left
          </span>
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
          justifyContent: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '500',
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '20px', 
              color: isToday ? COLORS.primary : COLORS.textSecondary 
            }}>
              {isToday ? 'today' : 'calendar_today'}
            </span>
            {formatDisplayDate(selectedDate)}
          </div>
          
          {!isToday && (
            <button
              onClick={onToday}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: COLORS.primary,
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              Today
            </button>
          )}
        </div>

        <button
          onClick={onNextDay}
          disabled={isToday}
          style={{
            padding: '8px',
            border: 'none',
            borderRadius: '8px',
            background: isToday ? COLORS.background : 'white',
            cursor: isToday ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: isToday ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
            opacity: isToday ? 0.5 : 1
          }}
          onMouseOver={e => !isToday && (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={e => !isToday && (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span className="material-icons" style={{ color: COLORS.text, fontSize: '20px' }}>
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}

export default Header;

