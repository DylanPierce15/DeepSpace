import React, { useMemo } from 'react';

/**
 * Players leaderboard and picks matrix view
 */
const PlayersView = ({ 
  year, 
  userEmail, 
  onEmailChange, 
  submissionsStore, 
  allDrivers,
  getLeaderboardSubmissions,
  picksMatrix
}) => {
  const leaderboard = getLeaderboardSubmissions();

  return (
    <div style={{ marginTop: 12, flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Players Leaderboard</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Based on submitted picks</div>
      </div>
      
      {/* Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(70px,auto)', gap: 8 }}>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Email</div>
        <div style={{ opacity: 0.7, fontSize: 12, textAlign: 'right' }}>Total</div>
        {leaderboard.map(entry => (
          <React.Fragment key={`players-${entry.email}`}>
            <div style={{ fontSize: 12 }}>{entry.email}</div>
            <div style={{ fontSize: 12, textAlign: 'right' }}>{entry.total}</div>
          </React.Fragment>
        ))}
      </div>

      {/* Filter by email */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
          <input
            type="email"
            placeholder="Filter by email (leave empty to show all)"
            value={userEmail}
            onChange={(e) => onEmailChange(e.target.value.trim())}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0' }}
          />
        </div>
        
        {/* Submitted picks per round */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,auto) 1fr 1fr', gap: 8, alignItems: 'start' }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Round</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Email</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Picks</div>
          {(() => {
            const yearMap = submissionsStore?.[year] || {};
            const rows = [];
            Object.entries(yearMap).forEach(([roundKey, perRound]) => {
              Object.entries(perRound || {}).forEach(([email, sub]) => {
                if (userEmail && email !== userEmail) return;
                const picks = (sub?.picks || []).join(', ');
                rows.push({ round: Number(roundKey), email, picks });
              });
            });
            rows.sort((a, b) => a.round - b.round || a.email.localeCompare(b.email));
            if (rows.length === 0) {
              return (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#94a3b8' }}>
                  No picks submitted yet.
                </div>
              );
            }
            return rows.map((r, idx) => (
              <React.Fragment key={`picks-${idx}`}>
                <div>Rd {r.round}</div>
                <div style={{ color: '#94a3b8' }}>{r.email}</div>
                <div style={{ color: '#e2e8f0' }}>{r.picks}</div>
              </React.Fragment>
            ));
          })()}
        </div>
        
        {/* Picks Matrix */}
        <div style={{ marginTop: 16, fontWeight: 700 }}>Picks Matrix</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
          How many times each player picked each driver (max 3)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${allDrivers.length}, 120px)`, gap: 4, alignItems: 'stretch' }}>
            <div style={{ position: 'sticky', left: 0, background: '#0f172a', zIndex: 1, padding: '8px', border: '1px solid #233047', borderRadius: 6, fontWeight: 700 }}>
              Player
            </div>
            {allDrivers.map(d => (
              <div key={`hdr-${d.code}`} style={{ padding: '8px', border: '1px solid #233047', borderRadius: 6, background: '#0b1220', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <div style={{ fontWeight: 700 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.constructor}</div>
              </div>
            ))}
            {(() => {
              const emails = Array.from(picksMatrix.keys()).sort();
              if (emails.length === 0) {
                return (
                  <div style={{ gridColumn: `1 / span ${allDrivers.length + 1}`, fontSize: 12, color: '#94a3b8', padding: 8 }}>
                    No submissions yet.
                  </div>
                );
              }
              return emails.flatMap(email => {
                const codeCounts = picksMatrix.get(email) || new Map();
                const cells = allDrivers.map(d => {
                  const cnt = codeCounts.get(d.code) || 0;
                  const capped = Math.min(cnt, 3);
                  const bg = capped === 0 ? 'transparent' : `rgba(30, 64, 175, ${0.18 * capped})`;
                  const border = capped === 0 ? '#233047' : '#1e40af';
                  return (
                    <div key={`cell-${email}-${d.code}`} style={{ padding: '8px', textAlign: 'center', border: `1px solid ${border}`, borderRadius: 6, background: bg, fontWeight: capped > 0 ? 700 : 400 }}>
                      {capped > 0 ? capped : ''}
                    </div>
                  );
                });
                return [
                  <div key={`row-lbl-${email}`} style={{ position: 'sticky', left: 0, background: '#0f172a', zIndex: 1, padding: '8px', border: '1px solid #233047', borderRadius: 6, fontWeight: 700 }}>
                    {email}
                  </div>,
                  ...cells
                ];
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayersView;

