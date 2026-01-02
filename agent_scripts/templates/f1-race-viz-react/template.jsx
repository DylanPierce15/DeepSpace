import React, { useState } from 'react';
import RaceSelector from './components/RaceSelector';
import ChartSelector from './components/ChartSelector';
import PositionEvolutionChart from './components/PositionEvolutionChart';
import LeadChangesChart from './components/LeadChangesChart';
import PitStopChart from './components/PitStopChart';
import QualiVsRaceChart from './components/QualiVsRaceChart';
import FastestLapsChart from './components/FastestLapsChart';
import { STORAGE_KEYS, CHART_TYPES } from './utils/constants';
import { 
  extractPositionEvolution, 
  extractLeadChanges, 
  extractPitStopData,
  compareQualifyingToRace,
  extractFastestLaps
} from './utils/chartUtils';

function F1RaceVisualizations() {
  const [season, setSeason] = useState(new Date().getFullYear());
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedChart, setSelectedChart] = useState(CHART_TYPES.POSITION_EVOLUTION);

  // Read from global storage
  const [scheduleStore] = useGlobalStorage(STORAGE_KEYS.SCHEDULE, {});
  const [roundStore] = useGlobalStorage(STORAGE_KEYS.ROUNDS, {});
  const [qualifyingStore] = useGlobalStorage(STORAGE_KEYS.QUALIFYING, {});
  const [pitStopsStore] = useGlobalStorage(STORAGE_KEYS.PIT_STOPS, {});
  const [lapTimesStore] = useGlobalStorage(STORAGE_KEYS.LAP_TIMES, {});

  const schedule = scheduleStore[season] || [];
  const selectedRace = schedule.find(r => parseInt(r.round) === selectedRound);
  
  // Get data for selected race
  const raceData = selectedRound ? (roundStore[season]?.[selectedRound] || null) : null;
  const qualifyingData = selectedRound ? (qualifyingStore[season]?.[selectedRound] || null) : null;
  const pitStopsData = selectedRound ? (pitStopsStore[season]?.[selectedRound] || null) : null;
  const lapTimesData = selectedRound ? (lapTimesStore[season]?.[selectedRound] || null) : null;

  // Process data for charts
  const positionData = lapTimesData ? extractPositionEvolution(lapTimesData) : null;
  const leadChanges = lapTimesData ? extractLeadChanges(lapTimesData) : null;
  const pitStopViz = pitStopsData && lapTimesData ? extractPitStopData(pitStopsData, lapTimesData) : null;
  const qualiComparison = qualifyingData && raceData ? compareQualifyingToRace(qualifyingData.results, raceData.results) : null;
  const fastestLaps = raceData ? extractFastestLaps(raceData.results) : null;

  const renderChart = () => {
    if (!selectedRound) {
      return (
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            Select a race to view visualizations
          </div>
          <div style={{ fontSize: '13px' }}>
            Choose a race from the dropdown above
          </div>
        </div>
      );
    }

    if (!raceData) {
      return (
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#fbbf24'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            No race data cached for {selectedRace?.raceName}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Use the F1 Data Downloader widget to fetch this race's data first
          </div>
        </div>
      );
    }

    switch (selectedChart) {
      case CHART_TYPES.POSITION_EVOLUTION:
        return <PositionEvolutionChart data={positionData} />;
      
      case CHART_TYPES.LEAD_CHANGES:
        return <LeadChangesChart leadChanges={leadChanges} maxLap={positionData?.maxLap || 70} />;
      
      case CHART_TYPES.PIT_STRATEGY:
        return <PitStopChart pitStopData={pitStopViz} maxLap={positionData?.maxLap || 70} />;
      
      case CHART_TYPES.LAP_TIMES:
        return <FastestLapsChart fastestLaps={fastestLaps} />;
      
      case CHART_TYPES.QUALI_VS_RACE:
        return <QualiVsRaceChart comparison={qualiComparison} />;
      
      default:
        return null;
    }
  };

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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
            📊 F1 Race Visualizations
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
            Interactive race analysis and data visualizations
          </p>
        </div>

        {/* Season Selector */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>
            Season
          </label>
          <input
            type="number"
            value={season}
            onChange={(e) => {
              setSeason(parseInt(e.target.value));
              setSelectedRound(null);
            }}
            min="2000"
            max={new Date().getFullYear()}
            style={{
              width: '120px',
              padding: '8px 12px',
              fontSize: '14px',
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#e2e8f0',
              outline: 'none'
            }}
          />
        </div>

        <RaceSelector
          season={season}
          schedule={schedule}
          selectedRound={selectedRound}
          onSelect={setSelectedRound}
        />

        {selectedRound && (
          <ChartSelector
            selectedChart={selectedChart}
            onSelect={setSelectedChart}
          />
        )}

        {renderChart()}
      </div>
    </div>
  );
}

export default F1RaceVisualizations;

