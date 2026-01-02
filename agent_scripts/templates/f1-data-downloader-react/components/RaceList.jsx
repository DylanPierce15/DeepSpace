import React from 'react';

export default function RaceList({ 
  schedule, 
  season,
  cachedRounds,
  onDownloadRace,
  downloadingRound
}) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <div style={{ 
      background: '#1e293b', 
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        🏁 {season} Season Races
      </h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {schedule.map(race => {
          const round = parseInt(race.round);
          const isCached = !!cachedRounds[round];
          const isDownloading = downloadingRound === round;
          
          return (
            <div 
              key={race.round}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                marginBottom: '8px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  {race.raceName}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Round {round} • {race.Circuit?.Location?.locality}, {race.Circuit?.Location?.country}
                </div>
              </div>
              
              <button
                onClick={() => onDownloadRace(race)}
                disabled={isDownloading}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: isCached 
                    ? '#10b981' 
                    : isDownloading 
                      ? '#475569'
                      : '#f97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDownloading ? 'not-allowed' : 'pointer',
                  minWidth: '100px'
                }}
              >
                {isDownloading ? '...' : isCached ? '✓ Cached' : 'Download'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

