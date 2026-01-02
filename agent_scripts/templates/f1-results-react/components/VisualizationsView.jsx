import React from 'react';
import QualifyingPositionsChart from './QualifyingPositionsChart';
import RacePositionsChart from './RacePositionsChart';

/**
 * View containing data visualizations
 */
const VisualizationsView = ({ year, qualifyingStore, roundStore }) => {
  return (
    <div style={{ marginTop: 12, flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #1f2937', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>F1 Data Visualizations</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Season {year}</div>
        </div>
        
        {/* Qualifying Positions Line Chart */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Driver Qualifying Positions Over Season</div>
          <div style={{ background: '#0b1220', border: '1px solid #233047', borderRadius: 8, padding: 16, minHeight: 600 }}>
            <QualifyingPositionsChart year={year} qualifyingStore={qualifyingStore} />
          </div>
        </div>

        {/* Race Positions Line Chart */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Driver Race Finishing Positions Over Season</div>
          <div style={{ background: '#0b1220', border: '1px solid #233047', borderRadius: 8, padding: 16, minHeight: 600 }}>
            <RacePositionsChart year={year} roundStore={roundStore} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizationsView;

