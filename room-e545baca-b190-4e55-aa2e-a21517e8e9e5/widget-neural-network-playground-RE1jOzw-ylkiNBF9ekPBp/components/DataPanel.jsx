import React from 'react';

function DataPanel({
  dataset,
  onDatasetChange,
  noise,
  onNoiseChange,
  trainTestRatio,
  onTrainTestRatioChange,
  batchSize,
  onBatchSizeChange,
  onRegenerate,
  darkMode
}) {
  const datasets = [
    { id: 'circle', name: 'Circle', description: 'Beginner: Separate the inner circle' },
    { id: 'xor', name: 'XOR', description: 'Intermediate: Separate diagonal corners' },
    { id: 'gaussian', name: 'Gaussian', description: 'Easy: Separate two distinct blobs' },
    { id: 'spiral', name: 'Spiral', description: 'Hard: Separate intertwined spirals' }
  ];

  // SVG Icons for datasets
  const icons = {
    circle: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
    xor: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <rect x="4" y="4" width="7" height="7" fill="currentColor" rx="1" />
        <rect x="13" y="13" width="7" height="7" fill="currentColor" rx="1" />
        <rect x="4" y="13" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1" />
        <rect x="13" y="4" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1" />
      </svg>
    ),
    gaussian: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <circle cx="8" cy="16" r="3" fill="currentColor" />
        <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    spiral: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
        <path d="M12 12L16 16" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  };
  
  return (
    <div 
      className="rounded-3xl p-6 flex flex-col"
      style={{ 
        width: '250px',
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
        flexShrink: 0
      }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold tracking-tight" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
          1. Choose Data
        </h3>
        <p className="text-xs mt-1 font-light" style={{ color: darkMode ? '#94a3b8' : '#6b7280' }}>
          What shape do you want to learn?
        </p>
      </div>
      
      {/* Dataset Picker */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          {datasets.map(ds => (
            <button
              key={ds.id}
              onClick={() => onDatasetChange(ds.id)}
              className="w-full p-3 rounded-2xl text-left transition-all flex flex-col items-center justify-center gap-2 aspect-square group relative overflow-hidden"
              style={{
                backgroundColor: dataset === ds.id ? (darkMode ? '#312e81' : '#f5f7ff') : (darkMode ? '#0f172a' : '#ffffff'),
                color: dataset === ds.id ? (darkMode ? '#a5b4fc' : '#6366f1') : (darkMode ? '#64748b' : '#9ca3af'),
                border: dataset === ds.id ? (darkMode ? '2px solid #6366f1' : '2px solid #6366f1') : (darkMode ? '1px solid #334155' : '1px solid #f0f0f0'),
                boxShadow: dataset === ds.id ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'none'
              }}
              title={ds.description}
            >
              <div style={{ opacity: dataset === ds.id ? 1 : 0.7 }}>
                {icons[ds.id]}
              </div>
              <span className="text-xs font-medium">{ds.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Sliders */}
      <div className="space-y-5 flex-grow">
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <label className="text-xs font-medium" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>Noise</label>
              <span className="text-[10px]" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Messiness of data</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ 
              color: darkMode ? '#f1f5f9' : '#111827',
              backgroundColor: darkMode ? '#0f172a' : '#f3f4f6'
            }}>{noise}</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={noise}
            onChange={(e) => onNoiseChange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            style={{ backgroundColor: darkMode ? '#334155' : '#f3f4f6' }}
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <label className="text-xs font-medium" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>Train/Test Split</label>
              <span className="text-[10px]" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Data for learning vs checking</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ 
              color: darkMode ? '#f1f5f9' : '#111827',
              backgroundColor: darkMode ? '#0f172a' : '#f3f4f6'
            }}>
              {Math.round(trainTestRatio * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.1"
            value={trainTestRatio}
            onChange={(e) => onTrainTestRatioChange(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            style={{ backgroundColor: darkMode ? '#334155' : '#f3f4f6' }}
          />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex flex-col">
              <label className="text-xs font-medium" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>Batch Size</label>
              <span className="text-[10px]" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Points processed at once</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ 
              color: darkMode ? '#f1f5f9' : '#111827',
              backgroundColor: darkMode ? '#0f172a' : '#f3f4f6'
            }}>{batchSize}</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={batchSize}
            onChange={(e) => onBatchSizeChange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            style={{ backgroundColor: darkMode ? '#334155' : '#f3f4f6' }}
          />
        </div>
      </div>
      
      {/* Regenerate Button */}
      <button
        onClick={onRegenerate}
        className="w-full mt-6 py-3 rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-2"
        style={{
          color: darkMode ? '#a5b4fc' : '#6366f1',
          backgroundColor: darkMode ? '#1e1b4b' : '#eef2ff',
          border: darkMode ? '1px solid #312e81' : '1px solid #e0e7ff'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#312e81' : '#ddd6fe'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#1e1b4b' : '#eef2ff'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        New Random Data
      </button>
    </div>
  );
}

export default DataPanel;
