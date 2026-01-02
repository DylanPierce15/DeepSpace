/**
 * Download season metadata (schedule, drivers, constructors, standings)
 * Does NOT download individual race data - user must download races manually
 */
export async function downloadSeasonMetadata(
  season,
  stores,
  setters,
  callbacks
) {
  const {
    scheduleStore,
    roundStore,
    qualifyingStore,
    sprintStore,
    pitStopsStore,
    lapTimesStore,
    driverStandingsStore,
    constructorStandingsStore,
    driversStore,
    constructorsStore
  } = stores;

  const {
    setScheduleStore,
    setRoundStore,
    setQualifyingStore,
    setSprintStore,
    setPitStopsStore,
    setLapTimesStore,
    setDriverStandingsStore,
    setConstructorStandingsStore,
    setDriversStore,
    setConstructorsStore
  } = setters;

  const { addLog, setProgress } = callbacks;

  addLog(`Fetching season ${season} metadata...`, 'info');

  // Step 1: Fetch season schedule
  let schedule = scheduleStore[season];
  if (!schedule || schedule.length === 0) {
    addLog('Fetching season schedule...', 'info');
    setProgress({ current: 1, total: 10, status: 'Fetching schedule...' });
    
    const scheduleResult = await miyagiAPI.post('f1-season-schedule', { season });
    const scheduleData = scheduleResult.data || scheduleResult;
    
    if (scheduleResult.success && scheduleData.schedule) {
      schedule = scheduleData.schedule;
      setScheduleStore(prev => ({ ...prev, [season]: schedule }));
      addLog(`✓ Schedule fetched: ${schedule.length} races`, 'success');
    } else {
      throw new Error('Failed to fetch schedule');
    }
  } else {
    addLog(`✓ Schedule already cached: ${schedule.length} races`, 'success');
  }

  if (!schedule || schedule.length === 0) {
    throw new Error('No races found for this season');
  }

  // Step 2: Fetch season-wide data (no throttle needed for these 4 calls)
  setProgress({ current: 2, total: 10, status: 'Fetching drivers...' });
  
  if (!driversStore[season]) {
    addLog('Fetching all drivers...', 'info');
    const driversResult = await miyagiAPI.post('f1-all-drivers', { season });
    const driversData = driversResult.data || driversResult;
    if (driversResult.success && driversData.drivers) {
      setDriversStore(prev => ({ ...prev, [season]: driversData.drivers }));
      addLog(`✓ Drivers fetched: ${driversData.drivers?.length || 0}`, 'success');
    }
  } else {
    addLog('✓ Drivers already cached', 'success');
  }

  setProgress({ current: 3, total: 10, status: 'Fetching constructors...' });
  
  if (!constructorsStore[season]) {
    addLog('Fetching all constructors...', 'info');
    const constructorsResult = await miyagiAPI.post('f1-all-constructors', { season });
    const constructorsData = constructorsResult.data || constructorsResult;
    if (constructorsResult.success && constructorsData.constructors) {
      setConstructorsStore(prev => ({ ...prev, [season]: constructorsData.constructors }));
      addLog(`✓ Constructors fetched: ${constructorsData.constructors?.length || 0}`, 'success');
    }
  } else {
    addLog('✓ Constructors already cached', 'success');
  }

  setProgress({ current: 4, total: 10, status: 'Fetching driver standings...' });
  
  if (!driverStandingsStore[season]) {
    addLog('Fetching driver standings...', 'info');
    const standingsResult = await miyagiAPI.post('f1-driver-standings', { season });
    const standingsData = standingsResult.data || standingsResult;
    if (standingsResult.success && standingsData.standings) {
      setDriverStandingsStore(prev => ({ ...prev, [season]: standingsData.standings }));
      addLog(`✓ Driver standings fetched: ${standingsData.standings?.length || 0} drivers`, 'success');
    }
  } else {
    addLog('✓ Driver standings already cached', 'success');
  }

  setProgress({ current: 5, total: 10, status: 'Fetching constructor standings...' });
  
  if (!constructorStandingsStore[season]) {
    addLog('Fetching constructor standings...', 'info');
    const constructorStandingsResult = await miyagiAPI.post('f1-constructor-standings', { season });
    const cStandingsData = constructorStandingsResult.data || constructorStandingsResult;
    if (constructorStandingsResult.success && cStandingsData.standings) {
      setConstructorStandingsStore(prev => ({ ...prev, [season]: cStandingsData.standings }));
      addLog(`✓ Constructor standings fetched: ${cStandingsData.standings?.length || 0} teams`, 'success');
    }
  } else {
    addLog('✓ Constructor standings already cached', 'success');
  }

  addLog(`✅ Season ${season} metadata loaded!`, 'success');
  setProgress({ current: 5, total: 5, status: 'Complete!' });
}

/**
 * Download data for a single race
 */
export async function downloadRaceData(
  season,
  race,
  stores,
  setters,
  callbacks
) {
  const {
    roundStore,
    qualifyingStore,
    sprintStore,
    pitStopsStore,
    lapTimesStore
  } = stores;

  const {
    setRoundStore,
    setQualifyingStore,
    setSprintStore,
    setPitStopsStore,
    setLapTimesStore
  } = setters;

  const { addLog, setProgress } = callbacks;

  const round = parseInt(race.round);
  const seasonRounds = roundStore[season] || {};
  const seasonQualifying = qualifyingStore[season] || {};
  const seasonSprint = sprintStore[season] || {};
  const seasonPitStops = pitStopsStore[season] || {};
  const seasonLapTimes = lapTimesStore[season] || {};

  addLog(`Downloading ${race.raceName} (Round ${round})...`, 'info');

  let currentStep = 0;
  const totalSteps = 5;
  const throttle = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const THROTTLE_DELAY = 800; // 800ms between calls

  // Race results
  currentStep++;
  setProgress({ current: currentStep, total: totalSteps, status: 'Race results...' });
  const raceResult = await miyagiAPI.post('f1-race-results', { season, round });
  const raceData = raceResult.data || raceResult;
  if (raceResult.success && raceData.results) {
    seasonRounds[round] = { results: raceData.results, raceName: race.raceName };
    addLog(`  ✓ Race results: ${raceData.results?.length || 0} drivers`, 'success');
  }
  await throttle(THROTTLE_DELAY);

  // Qualifying
  currentStep++;
  setProgress({ current: currentStep, total: totalSteps, status: 'Qualifying...' });
  const qualResult = await miyagiAPI.post('f1-qualifying', { season, round });
  const qualData = qualResult.data || qualResult;
  if (qualResult.success && qualData.qualifying) {
    seasonQualifying[round] = { results: qualData.qualifying };
    addLog(`  ✓ Qualifying: ${qualData.qualifying?.length || 0} drivers`, 'success');
  }
  await throttle(THROTTLE_DELAY);

  // Sprint
  currentStep++;
  setProgress({ current: currentStep, total: totalSteps, status: 'Sprint...' });
  const sprintResult = await miyagiAPI.post('f1-sprint', { season, round });
  const sprintData = sprintResult.data || sprintResult;
  if (sprintResult.success && sprintData.sprint && sprintData.sprint.length > 0) {
    seasonSprint[round] = { results: sprintData.sprint };
    addLog(`  ✓ Sprint: ${sprintData.sprint.length} drivers`, 'success');
  } else {
    addLog(`  - No sprint for this race`, 'info');
  }
  await throttle(THROTTLE_DELAY);

  // Pit stops
  currentStep++;
  setProgress({ current: currentStep, total: totalSteps, status: 'Pit stops...' });
  const pitStopsResult = await miyagiAPI.post('f1-pit-stops', { season, round });
  const pitData = pitStopsResult.data || pitStopsResult;
  if (pitStopsResult.success && pitData.pitStops) {
    seasonPitStops[round] = pitData.pitStops;
    addLog(`  ✓ Pit stops: ${pitData.pitStops?.length || 0}`, 'success');
  }
  await throttle(THROTTLE_DELAY);

  // Lap times
  currentStep++;
  setProgress({ current: currentStep, total: totalSteps, status: 'Lap times...' });
  const lapTimesResult = await miyagiAPI.post('f1-lap-times', { season, round });
  const lapData = lapTimesResult.data || lapTimesResult;
  if (lapTimesResult.success && lapData.lapTimes) {
    seasonLapTimes[round] = lapData.lapTimes;
    addLog(`  ✓ Lap times: ${lapData.lapTimes?.totalLaps || 0} laps`, 'success');
  }

  // Save all data to global storage
  setRoundStore(prev => ({ ...prev, [season]: seasonRounds }));
  setQualifyingStore(prev => ({ ...prev, [season]: seasonQualifying }));
  setSprintStore(prev => ({ ...prev, [season]: seasonSprint }));
  setPitStopsStore(prev => ({ ...prev, [season]: seasonPitStops }));
  setLapTimesStore(prev => ({ ...prev, [season]: seasonLapTimes }));

  addLog(`✅ ${race.raceName} complete!`, 'success');
  setProgress({ current: totalSteps, total: totalSteps, status: 'Complete!' });
}

/**
 * Clear all cached data for a season
 */
export function clearSeasonCache(season, stores, setters, addLog) {
  if (!confirm(`Clear all cached data for season ${season}? This cannot be undone.`)) {
    return;
  }
  
  const {
    scheduleStore,
    roundStore,
    qualifyingStore,
    sprintStore,
    pitStopsStore,
    lapTimesStore,
    driverStandingsStore,
    constructorStandingsStore,
    driversStore,
    constructorsStore
  } = stores;

  const {
    setScheduleStore,
    setRoundStore,
    setQualifyingStore,
    setSprintStore,
    setPitStopsStore,
    setLapTimesStore,
    setDriverStandingsStore,
    setConstructorStandingsStore,
    setDriversStore,
    setConstructorsStore
  } = setters;

  // Remove season from all stores
  const removeSeasonKey = (store, setter) => {
    const updated = { ...store };
    delete updated[season];
    setter(updated);
  };
  
  removeSeasonKey(scheduleStore, setScheduleStore);
  removeSeasonKey(roundStore, setRoundStore);
  removeSeasonKey(qualifyingStore, setQualifyingStore);
  removeSeasonKey(sprintStore, setSprintStore);
  removeSeasonKey(pitStopsStore, setPitStopsStore);
  removeSeasonKey(lapTimesStore, setLapTimesStore);
  removeSeasonKey(driverStandingsStore, setDriverStandingsStore);
  removeSeasonKey(constructorStandingsStore, setConstructorStandingsStore);
  removeSeasonKey(driversStore, setDriversStore);
  removeSeasonKey(constructorsStore, setConstructorsStore);
  
  addLog(`🗑️ Cleared all cache for season ${season}`, 'warning');
}

/**
 * Get summary of cached data for a season
 */
export function getCachedDataSummary(season, stores) {
  const {
    scheduleStore,
    roundStore,
    qualifyingStore,
    sprintStore,
    pitStopsStore,
    driversStore,
    constructorsStore
  } = stores;

  const seasonRounds = roundStore[season] || {};
  const seasonQualifying = qualifyingStore[season] || {};
  const seasonSprint = sprintStore[season] || {};
  const seasonPitStops = pitStopsStore[season] || {};
  const seasonSchedule = scheduleStore[season] || [];
  
  return {
    schedule: seasonSchedule.length || 0,
    races: Object.keys(seasonRounds).length,
    qualifying: Object.keys(seasonQualifying).length,
    sprint: Object.keys(seasonSprint).length,
    pitStops: Object.keys(seasonPitStops).length,
    drivers: driversStore[season] ? driversStore[season].length : 0,
    constructors: constructorsStore[season] ? constructorsStore[season].length : 0,
  };
}

