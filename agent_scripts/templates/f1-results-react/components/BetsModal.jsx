import React from 'react';

/**
 * Modal for managing race bets and picks
 */
const BetsModal = ({
  year,
  onClose,
  userEmail,
  onEmailChange,
  displayRaces,
  betFocusRound,
  betsStore,
  picksStore,
  submissionsStore,
  onPicksChange,
  onBetsChange,
  onSubmit,
  getTotalsForEmail,
  getRoundScoreForEmail,
  getDriverOptions,
  getRaceByRound,
  isSubmitted,
  getSeasonPickCountRaw,
  betWarning,
  onBetWarningChange
}) => {
  const round = betFocusRound != null ? betFocusRound : (displayRaces && displayRaces[0]?.round);
  const race = getRaceByRound(round);

  if (!race) {
    return (
      <div
        className="bets-modal"
        onClick={(e) => {
          if (e.target && e.target.className === 'bets-modal') {
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
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
          background: '#0f172a',
          color: '#e2e8f0',
          border: '1px solid #1f2937',
          borderRadius: 12,
          padding: 16
        }}>
          <div style={{ padding: 12, color: '#94a3b8' }}>
            Select a race to place your bet.
          </div>
        </div>
      </div>
    );
  }

  const note = betsStore?.[year]?.[race.round]?.note || '';
  const opts = getDriverOptions(race.round);
  const picks = (picksStore?.[year]?.[race.round]?.[userEmail]?.picks) || [];
  const submitted = isSubmitted(race.round, userEmail);

  const handlePickChange = (index, code) => {
    const otherIndex = index === 0 ? 1 : 0;
    const otherPick = picks[otherIndex] || '';
    
    // Prevent duplicate within the round
    if (code && code === otherPick) {
      onBetWarningChange(`You already picked ${code} as Driver ${otherIndex + 1} for this round.`);
      return;
    }
    
    // Enforce max 3 selections per driver across season
    const totalSoFar = getSeasonPickCountRaw(userEmail, code, race.round) + (code ? 1 : 0);
    if (code && totalSoFar > 3) {
      onBetWarningChange(`${code} cannot be picked more than 3 times in the season.`);
      return;
    }
    
    const newPicks = [...picks];
    newPicks[index] = code;
    onPicksChange(race.round, userEmail, newPicks);
    onBetWarningChange('');
  };

  return (
    <div
      className="bets-modal"
      onClick={(e) => {
        if (e.target && e.target.className === 'bets-modal') {
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
        maxWidth: 600,
        maxHeight: '80vh',
        overflow: 'auto',
        background: '#0f172a',
        color: '#e2e8f0',
        border: '1px solid #1f2937',
        borderRadius: 12,
        padding: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📝</span>
            <div style={{ fontWeight: 700 }}>My Bet · {year}</div>
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
            title="Close"
          >
            Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="email"
            placeholder="Your email (required to score)"
            value={userEmail}
            onChange={(e) => onEmailChange(e.target.value.trim())}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0'
            }}
          />
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Score: {getTotalsForEmail(userEmail)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: '1px solid #233047', borderRadius: 8, padding: 12, background: '#0b1220' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{`Rd ${race.round} • ${race.raceName}`}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {race.date ? new Date(`${race.date}T${race.time || '00:00:00Z'}`).toLocaleDateString([], { month: 'short', day: '2-digit' }) : ''}
                </div>
                <button
                  onClick={() => onSubmit(race.round, userEmail)}
                  disabled={!userEmail || submitted}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #334155',
                    background: (!userEmail || submitted) ? '#233047' : '#1e40af',
                    color: 'white',
                    cursor: (!userEmail || submitted) ? 'default' : 'pointer'
                  }}
                  title={submitted ? 'Already submitted' : 'Submit this race picks'}
                >
                  {submitted ? 'Submitted' : 'Submit'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select
                value={picks[0] || ''}
                onChange={(e) => handlePickChange(0, e.target.value)}
                disabled={submitted}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #334155',
                  background: submitted ? '#141b30' : '#0b1220',
                  color: '#e2e8f0'
                }}
              >
                <option value="">Pick driver 1</option>
                {opts.map(o => (
                  <option key={o.code} value={o.code}>
                    {o.name} · {o.constructor}
                  </option>
                ))}
              </select>
              <select
                value={picks[1] || ''}
                onChange={(e) => handlePickChange(1, e.target.value)}
                disabled={submitted}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid #334155',
                  background: submitted ? '#141b30' : '#0b1220',
                  color: '#e2e8f0'
                }}
              >
                <option value="">Pick driver 2</option>
                {opts.map(o => (
                  <option key={o.code} value={o.code}>
                    {o.name} · {o.constructor}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Round score for {userEmail || '—'}: {getRoundScoreForEmail(race.round, userEmail)}
              </div>
              {submitted && (
                <div style={{ fontSize: 12, color: '#86efac' }}>Submitted ✓</div>
              )}
            </div>

            {betWarning && (
              <div style={{ marginBottom: 8, fontSize: 12, color: '#fca5a5' }}>
                {betWarning}
              </div>
            )}

            <textarea
              id={`bet-input-${race.round}`}
              placeholder="Your bet (winner, podium, notes...)"
              value={note}
              onChange={(e) => onBetsChange(race.round, e.target.value)}
              disabled={submitted}
              style={{
                width: '100%',
                minHeight: 72,
                resize: 'vertical',
                borderRadius: 8,
                border: '1px solid #334155',
                background: submitted ? '#141b30' : '#0b1220',
                color: '#e2e8f0',
                padding: 10,
                fontFamily: 'inherit',
                fontSize: 13
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetsModal;

