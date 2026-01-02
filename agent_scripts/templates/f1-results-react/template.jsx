import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Header from './components/Header';
import YearSelector from './components/YearSelector';
import RaceSidebar from './components/RaceSidebar';
import RaceDetail from './components/RaceDetail';
import DriversView from './components/DriversView';
import PlayersView from './components/PlayersView';
import VisualizationsView from './components/VisualizationsView';
import BetsModal from './components/BetsModal';
import DriverProfileModal from './components/DriverProfileModal';
import { CACHE_KEYS, VIEWS } from './utils/constants';
import { 
  buildSeasonResultsUrl,
  buildRoundResultsUrl, 
  buildQualifyingUrl,
  buildScheduleUrl,
  buildDriverStandingsUrl,
  fetchFromAPI
} from './utils/apiUtils';
import {
  normalizeSeasonResults,
  normalizeRoundResults,
  normalizeQualifyingResults,
  normalizeSchedule,
  normalizeDriverStandings
} from './utils/dataUtils';

function F1ResultsWidget() {
  const cacheRef = useRef(new Map());
  
  // Global storage hooks
  const [year, setYear] = useGlobalStorage(CACHE_KEYS.YEAR, new Date().getFullYear());
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roundStore, setRoundStore] = useGlobalStorage(CACHE_KEYS.ROUNDS, {});
  const [schedule, setSchedule] = useState(null);
  const [scheduleStore, setScheduleStore] = useGlobalStorage(CACHE_KEYS.SCHEDULE, {});
  const [expandedRounds, setExpandedRounds] = useState({});
  const [betsStore, setBetsStore] = useGlobalStorage(CACHE_KEYS.BETS, {});
  const [showBets, setShowBets] = useState(false);
  const [betFocusRound, setBetFocusRound] = useState(null);
  const [betWarning, setBetWarning] = useState('');
  const [driverProfile, setDriverProfile] = useState(null);
  const [selectedRound, setSelectedRound] = useGlobalStorage(CACHE_KEYS.SELECTED_ROUND, null);
  const [view, setView] = useGlobalStorage(CACHE_KEYS.VIEW, VIEWS.RACES);
  const [qualifyingStore, setQualifyingStore] = useGlobalStorage(CACHE_KEYS.QUALIFYING, {});
  const [qualExpandedRounds, setQualExpandedRounds] = useState({});
  const [qualUserToggled, setQualUserToggled] = useState({});
  const [qualAutoExpanded, setQualAutoExpanded] = useState({});
  const [driverStandingsStore, setDriverStandingsStore] = useGlobalStorage(CACHE_KEYS.DRIVER_STANDINGS, {});
  const [userEmail, setUserEmail] = useGlobalStorage(CACHE_KEYS.USER_EMAIL, '');
  const [picksStore, setPicksStore] = useGlobalStorage(CACHE_KEYS.PICKS, {});
  const [submissionsStore, setSubmissionsStore] = useGlobalStorage(CACHE_KEYS.SUBMISSIONS, {});
  const [savingRounds, setSavingRounds] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [preloadingAllRaces, setPreloadingAllRaces] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({ done: 0, total: 0 });

  // Fetch season results
  const fetchSeason = useCallback(async (season) => {
    const cacheKey = String(season);
    if (cacheRef.current.has(cacheKey)) {
      setResults(cacheRef.current.get(cacheKey));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const url = buildSeasonResultsUrl(season);
      const json = await fetchFromAPI(url);
      const normalized = normalizeSeasonResults(json);
      cacheRef.current.set(cacheKey, normalized);
      setResults(normalized);
    } catch (e) {
      console.error('F1 results fetch failed:', e);
      setError('Failed to load results. Try another season or retry.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single round results
  const fetchRound = useCallback(async (season, round) => {
    try {
      const url = buildRoundResultsUrl(season, round);
      const json = await fetchFromAPI(url);
      const normalized = normalizeRoundResults(json);
      if (!normalized) return null;
      
      const seasons = { ...(roundStore || {}) };
      const seasonMap = { ...(seasons[season] || {}) };
      seasonMap[round] = normalized;
      seasons[season] = seasonMap;
      setRoundStore(seasons);
      return normalized;
    } catch (e) {
      console.error('F1 round fetch failed:', e);
      return null;
    }
  }, [roundStore, setRoundStore]);

  // Fetch qualifying results
  const fetchQualifying = useCallback(async (season, round) => {
    try {
      const url = buildQualifyingUrl(season, round);
      const json = await fetchFromAPI(url);
      const normalized = normalizeQualifyingResults(json);
      if (!normalized) return null;
      
      const seasons = { ...(qualifyingStore || {}) };
      const seasonMap = { ...(seasons[season] || {}) };
      seasonMap[round] = normalized;
      seasons[season] = seasonMap;
      setQualifyingStore(seasons);
      return normalized;
    } catch (e) {
      console.error('F1 qualifying fetch failed:', e);
      return null;
    }
  }, [qualifyingStore, setQualifyingStore]);

  // Merge schedule with results
  const displayRaces = useMemo(() => {
    const storedSeason = (roundStore && roundStore[year]) ? roundStore[year] : {};
    const byRoundFromResults = new Map((results || []).map((r) => [r.round, r]));
    const base = (schedule && schedule.length > 0)
      ? schedule
      : (results || []).map((r) => ({
          round: r.round,
          raceName: r.raceName,
          circuit: r.circuit,
          country: r.country,
          locality: r.locality,
          date: r.date,
          time: r.time,
        }));
    
    const merged = base.map((s) => {
      const stored = storedSeason[s.round];
      const seasonRes = byRoundFromResults.get(s.round);
      const allResults = stored?.results || seasonRes?.results || [];
      const podium = (allResults.length
        ? allResults.filter((r) => r.position >= 1 && r.position <= 3).sort((a, b) => a.position - b.position)
        : seasonRes?.podium || []);
      
      return {
        round: s.round,
        raceName: s.raceName,
        circuit: s.circuit,
        country: s.country,
        locality: s.locality,
        date: s.date,
        time: s.time,
        podium,
        results: allResults,
      };
    });
    
    return merged.sort((a, b) => a.round - b.round);
  }, [results, roundStore, year, schedule]);

  // Load full season schedule
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = (scheduleStore && scheduleStore[year]) ? scheduleStore[year] : null;
        if (cached && Array.isArray(cached) && cached.length > 0) {
          if (!cancelled) setSchedule(cached);
          return;
        }
        const url = buildScheduleUrl(year);
        const json = await fetchFromAPI(url);
        const normalized = normalizeSchedule(json);
        if (!cancelled) setSchedule(normalized);
        
        setScheduleStore(prev => {
          const next = { ...(prev || {}) };
          next[year] = normalized;
          return next;
        });
      } catch (e) {
        console.warn('Failed to load schedule:', e);
        if (!cancelled) setSchedule(null);
      }
    })();
    return () => { cancelled = true; };
  }, [year, scheduleStore, setScheduleStore]);

  // Load official driver standings
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = driverStandingsStore?.[year];
        if (cached && Array.isArray(cached) && cached.length > 0) return;
        
        const url = buildDriverStandingsUrl(year);
        const json = await fetchFromAPI(url);
        const drivers = normalizeDriverStandings(json);
        
        if (!cancelled && drivers.length) {
          setDriverStandingsStore(prev => ({ ...(prev || {}), [year]: drivers }));
        }
      } catch (e) {
        console.warn('Failed to load driver standings:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [year, driverStandingsStore, setDriverStandingsStore]);

  // Ensure a selected round is set
  useEffect(() => {
    const list = displayRaces || [];
    if (!list || list.length === 0) return;
    if (selectedRound == null || !list.some(r => r.round === selectedRound)) {
      setSelectedRound(list[0].round);
    }
  }, [displayRaces, selectedRound, setSelectedRound]);

  // Save all season rounds
  const saveAllRounds = async () => {
    if (savingRounds) return;
    const rounds = ((scheduleStore?.[year] || schedule || [])).map(r => r.round).sort((a, b) => a - b);
    if (!rounds || rounds.length === 0) return;
    
    setSavingRounds(true);
    setSaveProgress({ done: 0, total: rounds.length });
    
    for (let i = 0; i < rounds.length; i++) {
      const roundNum = rounds[i];
      await fetchRound(year, roundNum);
      setSaveProgress((p) => ({ done: p.done + 1, total: p.total }));
    }
    
    setSavingRounds(false);
  };

  // Preload all data (races + qualifying)
  const preloadAllData = async () => {
    if (preloadingAllRaces) return;
    const rounds = ((scheduleStore?.[year] || schedule || [])).map(r => r.round).sort((a, b) => a - b);
    if (!rounds || rounds.length === 0) return;
    
    setPreloadingAllRaces(true);
    setPreloadProgress({ done: 0, total: rounds.length * 2 });
    
    for (let i = 0; i < rounds.length; i++) {
      const roundNum = rounds[i];
      await fetchRound(year, roundNum);
      setPreloadProgress((p) => ({ done: p.done + 1, total: p.total }));
      
      await fetchQualifying(year, roundNum);
      setPreloadProgress((p) => ({ done: p.done + 1, total: p.total }));
    }
    
    setPreloadingAllRaces(false);
  };

  // Get driver options for betting
  const getDriverOptions = useCallback((round) => {
    const stored = (roundStore?.[year] || {})[round];
    const base = stored?.results || [];
    const qual = (qualifyingStore?.[year]?.[round]?.results) || [];
    const fallback = (results || []).find(r => r.round === round)?.results || [];
    const source = base.length ? base : (qual.length ? qual : fallback);
    
    const list = source.map(r => ({
      code: r.driverCode || r.driverName,
      name: r.driverName,
      constructor: r.constructor,
    }));
    
    const map = new Map();
    list.forEach(d => { if (!map.has(d.code)) map.set(d.code, d); });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roundStore, year, results, qualifyingStore]);

  // Get round score for email
  const getRoundScoreForEmail = useCallback((round, email) => {
    if (!email) return 0;
    const sel = picksStore?.[year]?.[round]?.[email]?.picks || [];
    if (!sel || sel.length === 0) return 0;
    
    const stored = (roundStore?.[year] || {})[round];
    const res = stored?.results || (results || []).find(r => r.round === round)?.results || [];
    const byCode = new Map(res.map(r => [r.driverCode || r.driverName, r]));
    
    let sum = 0;
    sel.slice(0, 2).forEach(code => {
      const rr = byCode.get(code);
      if (rr && typeof rr.points === 'number') sum += rr.points;
    });
    
    return sum;
  }, [picksStore, roundStore, results, year]);

  // Get totals for email
  const getTotalsForEmail = useCallback((email) => {
    if (!email) return 0;
    return (displayRaces || []).reduce((acc, race) => acc + getRoundScoreForEmail(race.round, email), 0);
  }, [displayRaces, getRoundScoreForEmail]);

  // Get round score from submission
  const getRoundScoreFromSubmission = useCallback((round, email) => {
    if (!email) return 0;
    const submission = submissionsStore?.[year]?.[round]?.[email];
    if (!submission || !submission.picks) return 0;
    
    const stored = (roundStore?.[year] || {})[round];
    const res = stored?.results || (results || []).find(r => r.round === round)?.results || [];
    const byCode = new Map(res.map(r => [r.driverCode || r.driverName, r]));
    
    let sum = 0;
    submission.picks.slice(0, 2).forEach(code => {
      const rr = byCode.get(code);
      if (rr && typeof rr.points === 'number') sum += rr.points;
    });
    
    return sum;
  }, [submissionsStore, roundStore, results, year]);

  // Get totals from submissions
  const getTotalsFromSubmissions = useCallback((email) => {
    if (!email) return 0;
    return (displayRaces || []).reduce((acc, race) => acc + getRoundScoreFromSubmission(race.round, email), 0);
  }, [displayRaces, getRoundScoreFromSubmission]);

  // Get leaderboard submissions
  const getLeaderboardSubmissions = useCallback(() => {
    const yearMap = submissionsStore?.[year] || {};
    const emails = new Set();
    Object.values(yearMap).forEach(perRound => {
      Object.keys(perRound || {}).forEach(e => emails.add(e));
    });
    const entries = Array.from(emails).map(e => ({ email: e, total: getTotalsFromSubmissions(e) }));
    return entries.sort((a, b) => b.total - a.total);
  }, [submissionsStore, year, getTotalsFromSubmissions]);

  // Get season pick count
  const getSeasonPickCountRaw = useCallback((email, code, excludeRound) => {
    if (!email || !code) return 0;
    let count = 0;
    
    const yearPicks = picksStore?.[year] || {};
    Object.entries(yearPicks).forEach(([roundKey, perRound]) => {
      if (excludeRound != null && Number(roundKey) === excludeRound) return;
      const forEmail = perRound?.[email];
      if (forEmail && Array.isArray(forEmail.picks)) {
        forEmail.picks.forEach(c => { if ((c || '') === code) count += 1; });
      }
    });
    
    const yearSubs = submissionsStore?.[year] || {};
    Object.entries(yearSubs).forEach(([roundKey, perRound]) => {
      if (excludeRound != null && Number(roundKey) === excludeRound) return;
      const sub = perRound?.[email];
      if (sub && Array.isArray(sub.picks)) {
        sub.picks.forEach(c => { if ((c || '') === code) count += 1; });
      }
    });
    
    return count;
  }, [picksStore, submissionsStore, year]);

  // All drivers in this season
  const allDrivers = useMemo(() => {
    const season = roundStore?.[year] || {};
    const map = new Map();
    
    Object.values(season).forEach((r) => {
      const list = r?.results || [];
      list.forEach((d) => {
        const code = d.driverCode || d.driverName;
        if (!map.has(code)) {
          map.set(code, { code, name: d.driverName, constructor: d.constructor });
        }
      });
    });
    
    if (map.size === 0) {
      (results || []).forEach((rr) => {
        (rr?.results || []).forEach((d) => {
          const code = d.driverCode || d.driverName;
          if (!map.has(code)) {
            map.set(code, { code, name: d.driverName, constructor: d.constructor });
          }
        });
      });
    }
    
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roundStore, results, year]);

  // Picks matrix
  const picksMatrix = useMemo(() => {
    const yearMap = submissionsStore?.[year] || {};
    const counts = new Map();
    
    Object.values(yearMap).forEach((perRound) => {
      Object.entries(perRound || {}).forEach(([email, sub]) => {
        const codeCounts = counts.get(email) || new Map();
        (sub?.picks || []).forEach((code) => {
          const key = code || '';
          codeCounts.set(key, (codeCounts.get(key) || 0) + 1);
        });
        counts.set(email, codeCounts);
      });
    });
    
    return counts;
  }, [submissionsStore, year]);

  // Driver finish positions
  const driverFinishPositionsByCode = useMemo(() => {
    const season = roundStore?.[year] || {};
    const map = new Map();
    
    Object.values(season).forEach((round) => {
      const list = round?.results || [];
      list.forEach((res) => {
        const code = res.driverCode || res.driverName;
        const pos = Number(res.position);
        if (Number.isFinite(pos)) {
          const arr = map.get(code) || [];
          arr.push(pos);
          map.set(code, arr);
        }
      });
    });
    
    return map;
  }, [roundStore, year]);

  // Driver standings
  const driverStandings = useMemo(() => {
    const official = driverStandingsStore?.[year];
    if (official && Array.isArray(official) && official.length) {
      const map = new Map();
      official.forEach((d, idx) => {
        map.set(d.code || d.name, { 
          rank: d.position || idx + 1, 
          points: d.points, 
          name: d.name, 
          constructor: d.constructor 
        });
      });
      return map;
    }
    
    const season = roundStore?.[year] || {};
    const pointsMap = new Map();
    
    Object.values(season).forEach((round) => {
      (round?.results || []).forEach((res) => {
        const code = res.driverCode || res.driverName;
        const prev = pointsMap.get(code) || { points: 0, name: res.driverName, constructor: res.constructor };
        prev.points += Number(res.points || 0);
        prev.name = res.driverName || prev.name;
        prev.constructor = res.constructor || prev.constructor;
        pointsMap.set(code, prev);
      });
    });
    
    const arr = Array.from(pointsMap.entries()).map(([code, v]) => ({ code, ...v }));
    arr.sort((a, b) => b.points - a.points);
    
    const rankMap = new Map();
    arr.forEach((d, idx) => rankMap.set(d.code, { 
      rank: idx + 1, 
      points: d.points, 
      name: d.name, 
      constructor: d.constructor 
    }));
    
    return rankMap;
  }, [driverStandingsStore, roundStore, year]);

  // Get driver recent finishes
  const getDriverRecentFinishes = useCallback((code, count = 5) => {
    const season = roundStore?.[year] || {};
    const entries = Object.values(season).map(r => ({ 
      round: r.round, 
      raceName: r.raceName, 
      list: r.results || [] 
    }));
    entries.sort((a, b) => b.round - a.round);
    
    const results = [];
    for (const e of entries) {
      const rec = e.list.find(res => (res.driverCode || res.driverName) === code);
      if (rec) {
        const qRound = (qualifyingStore?.[year]?.[e.round]?.results) || [];
        const qRec = qRound.find(q => (q.driverCode || q.driverName) === code);
        const qualPos = qRec && qRec.position ? Number(qRec.position) : null;
        results.push({ 
          round: e.round, 
          raceName: e.raceName, 
          qualPos: qualPos, 
          position: Number(rec.position), 
          points: Number(rec.points || 0) 
        });
        if (results.length >= count) break;
      }
    }
    
    return results;
  }, [roundStore, year, qualifyingStore]);

  // Get race by round
  const getRaceByRound = useCallback((round) => {
    if (round == null) return null;
    const fromSchedule = (schedule || []).find(r => r.round === round);
    if (fromSchedule) return fromSchedule;
    return (displayRaces || []).find(r => r.round === round) || null;
  }, [schedule, displayRaces]);

  // Is submitted
  const isSubmitted = useCallback((round, email) => {
    if (!email) return false;
    return !!(submissionsStore?.[year]?.[round]?.[email]);
  }, [submissionsStore, year]);

  // Submit round
  const submitRoundForEmail = useCallback((round, email) => {
    if (!email) return { ok: false, reason: 'missing-email' };
    const picks = (picksStore?.[year]?.[round]?.[email]?.picks) || [];
    if (!picks[0] || !picks[1]) return { ok: false, reason: 'missing-picks' };
    
    const note = betsStore?.[year]?.[round]?.note || '';
    const timestamp = new Date().toISOString();
    
    const next = { ...(submissionsStore || {}) };
    const byYear = { ...(next[year] || {}) };
    const perRound = { ...(byYear[round] || {}) };
    perRound[email] = { picks: [picks[0], picks[1]], note, submittedAt: timestamp };
    byYear[round] = perRound;
    next[year] = byYear;
    setSubmissionsStore(next);
    
    return { ok: true };
  }, [setSubmissionsStore, picksStore, betsStore, year, submissionsStore]);

  // Handle picks change
  const handlePicksChange = useCallback((round, email, newPicks) => {
    const next = { ...(picksStore || {}) };
    const byYear = { ...(next[year] || {}) };
    const perRound = { ...(byYear[round] || {}) };
    perRound[email] = { picks: newPicks };
    byYear[round] = perRound;
    next[year] = byYear;
    setPicksStore(next);
  }, [picksStore, setPicksStore, year]);

  // Handle bets change
  const handleBetsChange = useCallback((round, note) => {
    const next = { ...(betsStore || {}) };
    const byYear = { ...(next[year] || {}) };
    byYear[round] = { note };
    next[year] = byYear;
    setBetsStore(next);
  }, [betsStore, setBetsStore, year]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1020' }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 1120, 
        background: '#0f172a', 
        color: '#e2e8f0', 
        border: '1px solid #1f2937', 
        borderRadius: 12, 
        padding: 16, 
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)', 
        fontSize: 14, 
        height: '100%', 
        maxHeight: '100%', 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        <Header 
          view={view} 
          onViewChange={setView} 
          onShowBets={() => { setBetFocusRound(null); setShowBets(true); }}
        />

        <YearSelector year={year} onChange={setYear} />
        
        {/* Save/Preload buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button
            onClick={saveAllRounds}
            disabled={savingRounds}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: savingRounds ? '#334155' : '#1e40af',
              border: '1px solid #2563eb',
              color: 'white',
              cursor: savingRounds ? 'default' : 'pointer'
            }}
            title="Fetch each round and save to global storage"
          >
            {savingRounds ? `Saving ${saveProgress.done}/${saveProgress.total}…` : 'Save all schedule rounds'}
          </button>
          <button
            onClick={preloadAllData}
            disabled={preloadingAllRaces}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: preloadingAllRaces ? '#334155' : '#059669',
              border: '1px solid #10b981',
              color: 'white',
              cursor: preloadingAllRaces ? 'default' : 'pointer'
            }}
            title="Preload all races and qualifying data for the season"
          >
            {preloadingAllRaces ? `Loading ${preloadProgress.done}/${preloadProgress.total}…` : 'Preload All Data'}
          </button>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Stored: {Object.keys(roundStore?.[year] || {}).length || 0}/{(schedule?.length || results?.length || 0)} rounds
          </div>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: 24, opacity: 0.9 }}>Loading results…</div>
        )}
        {error && (
          <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fecaca', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        {view === VIEWS.RACES && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
            <RaceSidebar
              displayRaces={displayRaces}
              selectedRound={selectedRound}
              onSelectRound={setSelectedRound}
              userEmail={userEmail}
              isSubmitted={isSubmitted}
              roundStore={roundStore}
              year={year}
            />
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 8, padding: 12 }}>
              <RaceDetail
                race={getRaceByRound(selectedRound)}
                year={year}
                roundStore={roundStore}
                qualifyingStore={qualifyingStore}
                fetchRound={fetchRound}
                fetchQualifying={fetchQualifying}
                expandedRounds={expandedRounds}
                setExpandedRounds={setExpandedRounds}
                qualExpandedRounds={qualExpandedRounds}
                setQualExpandedRounds={setQualExpandedRounds}
                qualUserToggled={qualUserToggled}
                setQualUserToggled={setQualUserToggled}
                qualAutoExpanded={qualAutoExpanded}
                setQualAutoExpanded={setQualAutoExpanded}
                onShowBets={(round) => { setBetFocusRound(round); setShowBets(true); }}
                onShowDriverProfile={setDriverProfile}
                driverFinishPositionsByCode={driverFinishPositionsByCode}
              />
            </div>
          </div>
        )}

        {view === VIEWS.DRIVERS && (
          <DriversView year={year} driverStandings={driverStandings} />
        )}

        {view === VIEWS.PLAYERS && (
          <PlayersView
            year={year}
            userEmail={userEmail}
            onEmailChange={setUserEmail}
            submissionsStore={submissionsStore}
            allDrivers={allDrivers}
            getLeaderboardSubmissions={getLeaderboardSubmissions}
            picksMatrix={picksMatrix}
          />
        )}

        {view === VIEWS.VISUALIZATIONS && (
          <VisualizationsView
            year={year}
            qualifyingStore={qualifyingStore}
            roundStore={roundStore}
          />
        )}

        {showBets && (
          <BetsModal
            year={year}
            onClose={() => setShowBets(false)}
            userEmail={userEmail}
            onEmailChange={setUserEmail}
            displayRaces={displayRaces}
            betFocusRound={betFocusRound}
            betsStore={betsStore}
            picksStore={picksStore}
            submissionsStore={submissionsStore}
            onPicksChange={handlePicksChange}
            onBetsChange={handleBetsChange}
            onSubmit={submitRoundForEmail}
            getTotalsForEmail={getTotalsForEmail}
            getRoundScoreForEmail={getRoundScoreForEmail}
            getDriverOptions={getDriverOptions}
            getRaceByRound={getRaceByRound}
            isSubmitted={isSubmitted}
            getSeasonPickCountRaw={getSeasonPickCountRaw}
            betWarning={betWarning}
            onBetWarningChange={setBetWarning}
          />
        )}

        <DriverProfileModal
          driverProfile={driverProfile}
          onClose={() => setDriverProfile(null)}
          driverStandings={driverStandings}
          getDriverRecentFinishes={getDriverRecentFinishes}
        />
      </div>
    </div>
  );
}

export default F1ResultsWidget;
