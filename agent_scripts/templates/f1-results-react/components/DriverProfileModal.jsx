import React from 'react';

/**
 * Modal showing detailed driver profile and recent finishes
 */
const DriverProfileModal = ({ driverProfile, onClose, driverStandings, getDriverRecentFinishes }) => {
  if (!driverProfile) return null;

  const st = driverStandings.get(driverProfile.code);
  const recent = getDriverRecentFinishes(driverProfile.code, 5);

  return (
    <div
      className="driver-modal"
      onClick={(e) => {
        if (e.target && e.target.className === 'driver-modal') {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 520,
        maxHeight: '80vh',
        overflow: 'auto',
        background: '#0f172a',
        color: '#e2e8f0',
        border: '1px solid #1f2937',
        borderRadius: 12,
        padding: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{driverProfile.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {st ? (
                <>Standing: P{st.rank} · {st.points} pts · {st.constructor}</>
              ) : (
                'No standing available'
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Last 5 Races</div>
          {(!recent || recent.length === 0) ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No recent finishes</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px,auto) 1fr minmax(70px,auto) minmax(60px,auto) minmax(60px,auto)', gap: 8 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Rd</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Race</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Qual</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Pos</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Pts</div>
              {recent.map((r, i) => (
                <React.Fragment key={`df-${i}`}>
                  <div>{r.round}</div>
                  <div style={{ color: '#94a3b8' }}>{r.raceName}</div>
                  <div>{r.qualPos != null ? `P${r.qualPos}` : '—'}</div>
                  <div style={{ fontWeight: 700 }}>P{r.position}</div>
                  <div>{r.points}</div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriverProfileModal;

