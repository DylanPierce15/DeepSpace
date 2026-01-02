import React, { useState, useEffect } from 'react';
import SeasonSelector from './components/SeasonSelector';
import CachedDataSummary from './components/CachedDataSummary';
import RaceList from './components/RaceList';
import ProgressBar from './components/ProgressBar';
import ErrorDisplay from './components/ErrorDisplay';
import ActivityLog from './components/ActivityLog';
import Instructions from './components/Instructions';
import { STORAGE_KEYS } from './utils/constants';
import { downloadSeasonMetadata, downloadRaceData, clearSeasonCache, getCachedDataSummary } from './utils/downloadUtils';

function F1DataDownloader() {
  const [season, setSeason] = useState(new Date().getFullYear());
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [downloadingRound, setDownloadingRound] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  
  // Global storage hooks
  const [scheduleStore, setScheduleStore] = useGlobalStorage(STORAGE_KEYS.SCHEDULE, {});
  const [roundStore, setRoundStore] = useGlobalStorage(STORAGE_KEYS.ROUNDS, {});
  const [qualifyingStore, setQualifyingStore] = useGlobalStorage(STORAGE_KEYS.QUALIFYING, {});
  const [sprintStore, setSprintStore] = useGlobalStorage(STORAGE_KEYS.SPRINT, {});
  const [pitStopsStore, setPitStopsStore] = useGlobalStorage(STORAGE_KEYS.PIT_STOPS, {});
  const [lapTimesStore, setLapTimesStore] = useGlobalStorage(STORAGE_KEYS.LAP_TIMES, {});
  const [driverStandingsStore, setDriverStandingsStore] = useGlobalStorage(STORAGE_KEYS.DRIVER_STANDINGS, {});
  const [constructorStandingsStore, setConstructorStandingsStore] = useGlobalStorage(STORAGE_KEYS.CONSTRUCTOR_STANDINGS, {});
  const [driversStore, setDriversStore] = useGlobalStorage(STORAGE_KEYS.ALL_DRIVERS, {});
  const [constructorsStore, setConstructorsStore] = useGlobalStorage(STORAGE_KEYS.ALL_CONSTRUCTORS, {});

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, { timestamp, message, type }]);
  };

  // Auto-load metadata when season changes
  useEffect(() => {
    const loadMetadata = async () => {
      if (isLoadingMetadata || downloadingRound) return;
      
      const hasSchedule = scheduleStore[season] && scheduleStore[season].length > 0;
      if (hasSchedule) return; // Already loaded
      
      setIsLoadingMetadata(true);
      setError(null);
      
      try {
        const stores = {
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
        };

        const setters = {
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
        };

        const callbacks = { addLog, setProgress };

        await downloadSeasonMetadata(season, stores, setters, callbacks);
      } catch (err) {
        const errorMsg = err.message || 'Unknown error';
        setError(errorMsg);
        addLog(`❌ Metadata error: ${errorMsg}`, 'error');
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    loadMetadata();
  }, [season]);

  const handleDownloadRace = async (race) => {
    if (downloadingRound || isLoadingMetadata) return;
    
    const round = parseInt(race.round);
    setDownloadingRound(round);
    setError(null);
    
    try {
      const stores = {
        roundStore,
        qualifyingStore,
        sprintStore,
        pitStopsStore,
        lapTimesStore
      };

      const setters = {
        setRoundStore,
        setQualifyingStore,
        setSprintStore,
        setPitStopsStore,
        setLapTimesStore
      };

      const callbacks = { addLog, setProgress };

      await downloadRaceData(season, race, stores, setters, callbacks);
    } catch (err) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
      addLog(`❌ Error: ${errorMsg}`, 'error');
    } finally {
      setDownloadingRound(null);
    }
  };

  const handleClear = () => {
    const stores = {
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
    };

    const setters = {
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
    };

    clearSeasonCache(season, stores, setters, addLog);
  };

  const cached = getCachedDataSummary(season, {
    scheduleStore,
    roundStore,
    qualifyingStore,
    sprintStore,
    pitStopsStore,
    driversStore,
    constructorsStore
  });

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#e2e8f0',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            margin: '0 0 8px 0',
            background: 'linear-gradient(to right, #f97316, #dc2626)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🏎️ F1 Data Downloader
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Download complete F1 season data and cache it to global storage
          </p>
        </div>

        <SeasonSelector 
          season={season} 
          onChange={setSeason} 
          disabled={isLoadingMetadata || !!downloadingRound} 
        />

        <CachedDataSummary season={season} cached={cached} />

        <button
          onClick={handleClear}
          disabled={isLoadingMetadata || !!downloadingRound}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            background: (isLoadingMetadata || downloadingRound) ? '#334155' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (isLoadingMetadata || downloadingRound) ? 'not-allowed' : 'pointer',
            marginBottom: '20px'
          }}
        >
          🗑️ Clear Season Cache
        </button>

        <RaceList
          schedule={scheduleStore[season] || []}
          season={season}
          cachedRounds={roundStore[season] || {}}
          onDownloadRace={handleDownloadRace}
          downloadingRound={downloadingRound}
        />

        {(isLoadingMetadata || downloadingRound) && <ProgressBar progress={progress} />}

        <ErrorDisplay error={error} />

        <ActivityLog log={log} />

        <Instructions />
      </div>
    </div>
  );
}

export default F1DataDownloader;

