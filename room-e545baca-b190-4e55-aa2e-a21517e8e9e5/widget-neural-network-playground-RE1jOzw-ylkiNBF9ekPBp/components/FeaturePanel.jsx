import React from 'react';
import { featureDefinitions } from '../utils/features.js';

function FeaturePanel({ enabledFeatures, onToggleFeature, onHover, darkMode }) {
  return (
    <div 
      className="flex flex-col gap-2"
      style={{ 
        width: '190px',
        flexShrink: 0
      }}
    >
      <div className="mb-1 px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: darkMode ? '#e2e8f0' : '#111827' }}>
          Features
        </h4>
      </div>
      
      <div className="space-y-2">
        {featureDefinitions.map(feature => (
          <button
            key={feature.key}
            onClick={() => onToggleFeature(feature.key)}
            onMouseEnter={() => onHover && onHover({ type: 'feature', id: feature.key })}
            onMouseLeave={() => onHover && onHover(null)}
            className="w-full px-3.5 py-3 rounded-xl text-left transition-all flex items-center gap-3"
            style={{
              backgroundColor: darkMode ? '#0f172a' : '#ffffff',
              border: enabledFeatures[feature.key] ? (darkMode ? '1px solid #6366f1' : '1px solid #6366f1') : (darkMode ? '1px solid #334155' : '1px solid #e5e7eb'),
              boxShadow: enabledFeatures[feature.key] ? '0 3px 8px rgba(99, 102, 241, 0.15)' : 'none',
              opacity: enabledFeatures[feature.key] ? 1 : 0.6
            }}
          >
            <div 
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                backgroundColor: enabledFeatures[feature.key] ? '#6366f1' : (darkMode ? '#334155' : '#f3f4f6'),
              }}
            >
              {enabledFeatures[feature.key] && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight" style={{ 
                color: enabledFeatures[feature.key] ? (darkMode ? '#f1f5f9' : '#111827') : (darkMode ? '#64748b' : '#6b7280')
              }}>
                {feature.label}
              </div>
              <div className="text-[10px] leading-tight mt-1" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>
                {getFeatureDescription(feature.key)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function getFeatureDescription(key) {
  switch(key) {
    case 'x1': return 'Horizontal position';
    case 'x2': return 'Vertical position';
    case 'x1_squared': return 'Distance from vertical center';
    case 'x2_squared': return 'Distance from horizontal center';
    case 'x1_x2': return 'Diagonal interaction';
    case 'sin_x1': return 'Wavy horizontal pattern';
    case 'sin_x2': return 'Wavy vertical pattern';
    default: return 'Input value';
  }
}

export default FeaturePanel;
