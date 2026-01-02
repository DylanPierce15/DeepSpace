import React, { useEffect } from 'react';
import { MEDAL_EMOJI, QUALIFYING_BAR_COLORS, QUALIFYING_THRESHOLDS } from '../utils/constants';
import { parseQualifyingTime, calculatePercentile } from '../utils/dataUtils';

/**
 * Race detail view showing podium, qualifying, and full results
 */
const RaceDetail = ({
  race,
  year,
  roundStore,
  qualifyingStore,
  fetchRound,
  fetchQualifying,
  expandedRounds,
  setExpandedRounds,
  qualExpandedRounds,
  setQualExpandedRounds,
  qualUserToggled,
  setQualUserToggled,
  qualAutoExpanded,
  setQualAutoExpanded,
  onShowBets,
  onShowDriverProfile,
  driverFinishPositionsByCode
}) => {
  if (!race) {
    return (
      <div style={{ textAlign: 'center', padding: 24, opacity: 0.8 }}>
        Select a race on the left.
      </div>
    );
  }

  const isExpanded = !!expandedRounds[race.round];
  const stored = (roundStore?.[year] || {})[race.round];
  const fullResults = (stored && stored.results) || race.results || [];

  // Auto-expand qualifying by default if user hasn't toggled for this round
  useEffect(() => {
    const isShown = !!qualExpandedRounds[race.round];
    const hasQual = !!(qualifyingStore?.[year]?.[race.round]);
    const userTouched = !!qualUserToggled[race.round];
    
    if (!userTouched) {
      if (!isShown && !hasQual) {
        fetchQualifying(year, race.round);
        setQualExpandedRounds((prev) => ({ ...prev, [race.round]: true }));
        setQualAutoExpanded((prev) => ({ ...prev, [race.round]: true }));
      } else if (!isShown && hasQual) {
        setQualExpandedRounds((prev) => ({ ...prev, [race.round]: true }));
        setQualAutoExpanded((prev) => ({ ...prev, [race.round]: true }));
      }
    }
  }, [race.round, year, qualExpandedRounds, qualifyingStore, qualUserToggled]);

  const renderPodium = (podium) => {
    if (!podium || podium.length === 0) {
      return (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>No results yet</div>
      );
    }
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        {podium.map((r) => (
          <div key={`${r.position}-${r.driverCode}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{MEDAL_EMOJI[r.position]}</span>
              <span style={{ fontWeight: 600 }}>{r.driverName}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.constructor}</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.timeText || r.status}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderQualifying = () => {
    const qual = (qualifyingStore?.[year] || {})[race.round];
    const qres = qual?.results || [];
    
    if (!qres.length) {
      return <div style={{ fontSize: 12, color: '#94a3b8' }}>No qualifying data.</div>;
    }

    const bestQ1 = Math.min(...qres.map(r => parseQualifyingTime(r.Q1)).filter(v => v != null));
    const bestQ2 = Math.min(...qres.map(r => parseQualifyingTime(r.Q2)).filter(v => v != null));
    const bestQ3 = Math.min(...qres.map(r => parseQualifyingTime(r.Q3)).filter(v => v != null));

    const getBarStyle = (ms, best) => {
      if (ms == null || best == null) return { pct: 0, color: '#233047' };
      const delta = Math.max(ms - best, 0);
      const pct = Math.min(100, 30 + (delta / 1500) * 70);
      const color = delta <= QUALIFYING_THRESHOLDS.fast 
        ? QUALIFYING_BAR_COLORS.fast 
        : delta <= QUALIFYING_THRESHOLDS.medium 
          ? QUALIFYING_BAR_COLORS.medium 
          : QUALIFYING_BAR_COLORS.slow;
      return { pct, color };
    };

    const format = (t) => t || '—';

    // Value picks suggestions
    const suggestions = qres.map(q => {
      const code = q.driverCode || q.driverName;
      const finishes = driverFinishPositionsByCode.get(code) || [];
      const p75 = calculatePercentile(finishes, 0.75);
      const bestPos = q.position ? Number(q.position) : null;
      const outperform = (p75 != null && bestPos != null) ? (bestPos < p75) : false;
      const margin = (p75 != null && bestPos != null) ? (p75 - bestPos) : null;
      return { code, name: q.driverName, constructor: q.constructor, outperform, margin };
    }).filter(s => s.outperform).sort((a, b) => (b.margin || 0) - (a.margin || 0)).slice(0, 5);

    return (
      <>
        {suggestions.length > 0 && (
          <div style={{ fontSize: 12, color: '#93c5fd', marginBottom: 8 }}>
            Best value picks: {suggestions.map(s => `${s.name.split(' ')[1] || s.name} (${s.constructor})`).join(', ')}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(28px,48px) 1fr 1fr 1fr 1fr 1fr', gap: 8 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Pos</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Driver</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Q1</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Q2</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Q3</div>
          <div style={{ opacity: 0.7, fontSize: 12, textAlign: 'right' }}>Δ pole</div>
          {qres.map((q) => {
            const m1 = parseQualifyingTime(q.Q1);
            const m2 = parseQualifyingTime(q.Q2);
            const m3 = parseQualifyingTime(q.Q3);
            const b1 = getBarStyle(m1, bestQ1);
            const b2 = getBarStyle(m2, bestQ2);
            const b3 = getBarStyle(m3, bestQ3);
            const poleMs = (Number.isFinite(bestQ3) ? bestQ3 : (Number.isFinite(bestQ2) ? bestQ2 : (Number.isFinite(bestQ1) ? bestQ1 : null)));
            const driverBest = (m3 ?? m2 ?? m1);
            const deltaBest = (poleMs != null && driverBest != null) ? Math.max(driverBest - poleMs, 0) : null;
            
            return (
              <React.Fragment key={`q-${q.position}-${q.driverCode}`}>
                <div>{q.position}</div>
                <div style={{ fontWeight: 600 }}>
                  <button
                    onClick={() => onShowDriverProfile({ code: q.driverCode || q.driverName, name: q.driverName })}
                    style={{
                      background: 'transparent',
                      color: '#e2e8f0',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      margin: 0,
                      textDecoration: 'underline'
                    }}
                    title="View driver profile"
                  >
                    {q.driverName}
                  </button>
                  <span style={{ color: '#94a3b8' }}> · {q.constructor}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: '#0b1220', border: '1px solid #233047', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${b1.pct}%`, height: '100%', background: b1.color }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', minWidth: 68, textAlign: 'right' }}>{format(q.Q1)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: '#0b1220', border: '1px solid #233047', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${b2.pct}%`, height: '100%', background: b2.color }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', minWidth: 68, textAlign: 'right' }}>{format(q.Q2)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: '#0b1220', border: '1px solid #233047', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${b3.pct}%`, height: '100%', background: b3.color }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', minWidth: 68, textAlign: 'right' }}>{format(q.Q3)}</div>
                </div>
                <div style={{ fontSize: 12, textAlign: 'right', color: '#94a3b8' }}>
                  {deltaBest != null ? `+${(deltaBest / 1000).toFixed(3)}s` : '—'}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700 }}>{`Rd ${race.round} • ${race.raceName}`}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {race.locality}{race.locality && race.country ? ', ' : ''}{race.country} • {race.circuit}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {race.date ? new Date(`${race.date}T${race.time || '00:00:00Z'}`).toLocaleDateString([], { month: 'short', day: '2-digit' }) : ''}
          </div>
          <button
            onClick={() => onShowBets(race.round)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
            title="Write my bet for this race"
          >
            Bet
          </button>
          <button
            onClick={async () => {
              const qual = (qualifyingStore?.[year] || {})[race.round];
              if (!qual) {
                await fetchQualifying(year, race.round);
              }
              setQualUserToggled((prev) => ({ ...prev, [race.round]: true }));
              setQualExpandedRounds((prev) => ({ ...prev, [race.round]: !prev[race.round] }));
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
            title="View qualifying classification"
          >
            {qualExpandedRounds[race.round] ? 'Hide quali' : 'View quali'}
          </button>
          <button
            onClick={async () => {
              if (!stored) {
                await fetchRound(year, race.round);
              }
              setExpandedRounds((prev) => ({ ...prev, [race.round]: !prev[race.round] }));
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#0b1220',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
            title="View full 20-driver classification"
          >
            {isExpanded ? 'Hide full results' : 'View full results'}
          </button>
        </div>
      </div>
      
      {renderPodium(race.podium)}
      
      {qualExpandedRounds[race.round] && (
        <div style={{ marginTop: 10, borderTop: '1px dashed #233047', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Qualifying</div>
          </div>
          {renderQualifying()}
        </div>
      )}
      
      {isExpanded && (
        <div style={{ marginTop: 10, borderTop: '1px dashed #233047', paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Full classification</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(24px,48px) 1fr 1fr minmax(60px,auto) minmax(40px,auto)', gap: 8 }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Pos</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Driver</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Constructor</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Time/Status</div>
            <div style={{ opacity: 0.7, fontSize: 12, textAlign: 'right' }}>Pts</div>
            {fullResults.map((r) => (
              <React.Fragment key={`${r.position}-${r.driverCode}`}>
                <div>{r.position}</div>
                <div style={{ fontWeight: 600 }}>{r.driverName}</div>
                <div style={{ color: '#94a3b8' }}>{r.constructor}</div>
                <div style={{ color: '#94a3b8' }}>{r.timeText || r.status}</div>
                <div style={{ textAlign: 'right' }}>{r.points}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RaceDetail;

