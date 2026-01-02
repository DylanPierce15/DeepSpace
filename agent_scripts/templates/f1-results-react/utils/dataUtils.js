// Data normalization and transformation utilities

/**
 * Normalize season results from Ergast API
 */
export const normalizeSeasonResults = (apiJson) => {
  const races = apiJson?.MRData?.RaceTable?.Races || [];
  return races.map((race) => {
    const round = Number(race.round);
    const circuit = race?.Circuit?.circuitName || 'Unknown Circuit';
    const country = race?.Circuit?.Location?.country || '';
    const locality = race?.Circuit?.Location?.locality || '';
    const date = race?.date || null;
    const time = race?.time || null;
    const results = (race?.Results || []).map((r) => ({
      position: Number(r.position),
      driverCode: r?.Driver?.code || r?.Driver?.familyName || '',
      driverName: `${r?.Driver?.givenName || ''} ${r?.Driver?.familyName || ''}`.trim(),
      constructor: r?.Constructor?.name || '',
      status: r?.status || '',
      grid: r?.grid ? Number(r.grid) : null,
      points: r?.points ? Number(r.points) : 0,
      timeMillis: r?.Time?.millis ? Number(r.Time.millis) : null,
      timeText: r?.Time?.time || null,
    }));
    const podium = results
      .filter((r) => r.position >= 1 && r.position <= 3)
      .sort((a, b) => a.position - b.position);
    return {
      round,
      raceName: race?.raceName || `Round ${round}`,
      circuit,
      country,
      locality,
      date,
      time,
      podium,
      results,
    };
  }).sort((a, b) => a.round - b.round);
};

/**
 * Normalize single round results
 */
export const normalizeRoundResults = (apiJson) => {
  const race = (apiJson?.MRData?.RaceTable?.Races || [])[0] || null;
  if (!race) return null;
  
  const round = Number(race.round);
  const circuit = race?.Circuit?.circuitName || 'Unknown Circuit';
  const country = race?.Circuit?.Location?.country || '';
  const locality = race?.Circuit?.Location?.locality || '';
  const date = race?.date || null;
  const time = race?.time || null;
  const results = (race?.Results || []).map((r) => ({
    position: Number(r.position),
    driverCode: r?.Driver?.code || r?.Driver?.familyName || '',
    driverName: `${r?.Driver?.givenName || ''} ${r?.Driver?.familyName || ''}`.trim(),
    constructor: r?.Constructor?.name || '',
    status: r?.status || '',
    grid: r?.grid ? Number(r.grid) : null,
    points: r?.points ? Number(r.points) : 0,
    timeMillis: r?.Time?.millis ? Number(r.Time.millis) : null,
    timeText: r?.Time?.time || null,
  }));
  
  return {
    round,
    raceName: race?.raceName || `Round ${round}`,
    circuit,
    country,
    locality,
    date,
    time,
    results,
  };
};

/**
 * Normalize qualifying results
 */
export const normalizeQualifyingResults = (apiJson) => {
  const race = (apiJson?.MRData?.RaceTable?.Races || [])[0] || null;
  if (!race) return null;
  
  const round = Number(race.round);
  const circuit = race?.Circuit?.circuitName || 'Unknown Circuit';
  const country = race?.Circuit?.Location?.country || '';
  const locality = race?.Circuit?.Location?.locality || '';
  const date = race?.date || null;
  const time = race?.time || null;
  const results = (race?.QualifyingResults || []).map((q) => ({
    position: Number(q.position),
    driverCode: q?.Driver?.code || q?.Driver?.familyName || '',
    driverName: `${q?.Driver?.givenName || ''} ${q?.Driver?.familyName || ''}`.trim(),
    constructor: q?.Constructor?.name || '',
    Q1: q?.Q1 || null,
    Q2: q?.Q2 || null,
    Q3: q?.Q3 || null,
  }));
  
  return {
    round,
    raceName: race?.raceName || `Round ${round}`,
    circuit,
    country,
    locality,
    date,
    time,
    results,
  };
};

/**
 * Normalize season schedule
 */
export const normalizeSchedule = (apiJson) => {
  const races = apiJson?.MRData?.RaceTable?.Races || [];
  return races.map((race) => ({
    round: Number(race.round),
    raceName: race?.raceName || `Round ${race.round}`,
    circuit: race?.Circuit?.circuitName || 'Unknown Circuit',
    country: race?.Circuit?.Location?.country || '',
    locality: race?.Circuit?.Location?.locality || '',
    date: race?.date || null,
    time: race?.time || null,
  })).sort((a, b) => a.round - b.round);
};

/**
 * Normalize driver standings
 */
export const normalizeDriverStandings = (apiJson) => {
  const standingsLists = apiJson?.MRData?.StandingsTable?.StandingsLists || [];
  const first = standingsLists[0];
  return (first?.DriverStandings || []).map(d => ({
    code: d?.Driver?.code || d?.Driver?.familyName || '',
    name: `${d?.Driver?.givenName || ''} ${d?.Driver?.familyName || ''}`.trim(),
    constructor: d?.Constructors?.[0]?.name || '',
    points: Number(d?.points || 0),
    position: Number(d?.position || 0)
  }));
};

/**
 * Parse qualifying time string to milliseconds
 */
export const parseQualifyingTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const parts = timeStr.split(':');
  let ms = 0;
  
  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (Number.isFinite(m) && Number.isFinite(s)) {
      ms = m * 60000 + Math.round(s * 1000);
    } else {
      return null;
    }
  } else if (parts.length === 1) {
    const s = Number(parts[0]);
    if (Number.isFinite(s)) {
      ms = Math.round(s * 1000);
    } else {
      return null;
    }
  } else {
    return null;
  }
  
  return ms;
};

/**
 * Calculate percentile of an array
 */
export const calculatePercentile = (arr, p) => {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((x, y) => x - y);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

