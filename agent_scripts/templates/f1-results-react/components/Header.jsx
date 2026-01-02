import React from 'react';
import { VIEWS } from '../utils/constants';

/**
 * Application header with view tabs and action buttons
 */
const Header = ({ view, onViewChange, onShowBets }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>🏎️</span>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>F1 Results</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'inline-flex', background: '#0b1220', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden', marginRight: 8 }}>
          <button
            onClick={() => onViewChange(VIEWS.RACES)}
            style={{
              padding: '6px 10px',
              background: view === VIEWS.RACES ? '#1e40af' : 'transparent',
              color: view === VIEWS.RACES ? 'white' : '#e2e8f0',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Races
          </button>
          <button
            onClick={() => onViewChange(VIEWS.DRIVERS)}
            style={{
              padding: '6px 10px',
              background: view === VIEWS.DRIVERS ? '#1e40af' : 'transparent',
              color: view === VIEWS.DRIVERS ? 'white' : '#e2e8f0',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Driver Standings
          </button>
          <button
            onClick={() => onViewChange(VIEWS.PLAYERS)}
            style={{
              padding: '6px 10px',
              background: view === VIEWS.PLAYERS ? '#1e40af' : 'transparent',
              color: view === VIEWS.PLAYERS ? 'white' : '#e2e8f0',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Players
          </button>
          <button
            onClick={() => onViewChange(VIEWS.VISUALIZATIONS)}
            style={{
              padding: '6px 10px',
              background: view === VIEWS.VISUALIZATIONS ? '#1e40af' : 'transparent',
              color: view === VIEWS.VISUALIZATIONS ? 'white' : '#e2e8f0',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Visualizations
          </button>
        </div>
        
        <button
          onClick={onShowBets}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #334155',
            background: '#0b1220',
            color: '#e2e8f0',
            cursor: 'pointer'
          }}
          title="Open bets window"
        >
          Bets
        </button>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Ergast via Jolpi</div>
      </div>
    </div>
  );
};

export default Header;

