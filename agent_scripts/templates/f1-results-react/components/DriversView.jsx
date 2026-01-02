import React, { useMemo } from 'react';

/**
 * Driver standings view grouped by team/constructor
 */
const DriversView = ({ year, driverStandings }) => {
  // Group drivers by constructor/team
  const driverStandingsByTeam = useMemo(() => {
    const arr = Array.from(driverStandings.entries())
      .map(([code, s]) => ({ code, ...s }))
      .sort((a, b) => a.rank - b.rank);
    
    const teams = new Map();
    arr.forEach(driver => {
      const team = driver.constructor || 'Unknown';
      if (!teams.has(team)) {
        teams.set(team, {
          name: team,
          drivers: [],
          totalPoints: 0
        });
      }
      teams.get(team).drivers.push(driver);
      teams.get(team).totalPoints += driver.points;
    });
    
    return Array.from(teams.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [driverStandings]);

  if (driverStandingsByTeam.length === 0) {
    return (
      <div style={{ marginTop: 12, flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>No standings available</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Driver Standings</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Season {year}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {driverStandingsByTeam.map((team) => (
            <div key={`team-${team.name}`} style={{ border: '1px solid #374151', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #374151' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{team.name}</div>
                <div style={{ fontSize: 14, color: '#94a3b8' }}>{team.totalPoints} pts</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px,auto) 1fr minmax(70px,auto)', gap: 8 }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Pos</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Driver</div>
                <div style={{ opacity: 0.7, fontSize: 12, textAlign: 'right' }}>Pts</div>
                {team.drivers.map(d => (
                  <React.Fragment key={`ds-${d.code}`}>
                    <div>P{d.rank}</div>
                    <div style={{ fontWeight: 700 }}>{d.name}</div>
                    <div style={{ textAlign: 'right' }}>{d.points}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriversView;

