import React from 'react';

/**
 * Sidebar showing list of races for the season
 */
const RaceSidebar = ({
  displayRaces,
  selectedRound,
  onSelectRound,
  userEmail,
  isSubmitted,
  roundStore,
  year
}) => {
  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      background: '#0b1220',
      border: '1px solid #1f2937',
      borderRadius: 8,
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      overflowY: 'auto'
    }}>
      {(displayRaces || []).map((race) => {
        const submitted = isSubmitted(race.round, userEmail);
        const isSelected = race.round === selectedRound;
        const stored = (roundStore?.[year] || {})[race.round];
        const hasResults = !!(stored?.results || race.results)?.length;
        
        return (
          <button
            key={`sb-${race.round}`}
            onClick={() => onSelectRound(race.round)}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid ' + (isSelected ? '#2563eb' : '#233047'),
              background: isSelected ? '#142043' : '#0f172a',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700 }}>{`Rd ${race.round}`}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {race.date ? new Date(`${race.date}T${race.time || '00:00:00Z'}`).toLocaleDateString([], { month: 'short', day: '2-digit' }) : ''}
              </div>
            </div>
            <div style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {race.raceName}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {submitted && <span style={{ fontSize: 11, color: '#86efac' }}>Submitted ✓</span>}
              {hasResults && <span style={{ fontSize: 11, color: '#93c5fd' }}>Results</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default RaceSidebar;

