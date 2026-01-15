import React, { useEffect, useRef, useState } from 'react';

function TopBar({ 
  isPlaying, 
  onTogglePlay, 
  onReset,
  learningRate, 
  onLearningRateChange,
  activation,
  onActivationChange,
  regularization,
  onRegularizationChange,
  regularizationRate,
  onRegularizationRateChange,
  onShowHelp,
  darkMode,
  onToggleDarkMode
}) {
  const [showLRDropdown, setShowLRDropdown] = React.useState(false);
  const [showActDropdown, setShowActDropdown] = React.useState(false);
  const [showRegDropdown, setShowRegDropdown] = React.useState(false);
  const [showRegRateDropdown, setShowRegRateDropdown] = React.useState(false);
  
  const lrRef = useRef(null);
  const actRef = useRef(null);
  const regRef = useRef(null);
  const regRateRef = useRef(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (lrRef.current && !lrRef.current.contains(event.target)) {
        setShowLRDropdown(false);
      }
      if (actRef.current && !actRef.current.contains(event.target)) {
        setShowActDropdown(false);
      }
      if (regRef.current && !regRef.current.contains(event.target)) {
        setShowRegDropdown(false);
      }
      if (regRateRef.current && !regRateRef.current.contains(event.target)) {
        setShowRegRateDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const lrOptions = [0.001, 0.01, 0.03, 0.1];
  const activationOptions = ['tanh', 'relu', 'sigmoid', 'linear'];
  const regularizationOptions = ['None', 'L1', 'L2'];
  const regularizationRateOptions = [0, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10];

  const dropdownButtonStyle = {
    border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
    backgroundColor: darkMode ? '#1e293b' : '#fff',
    color: darkMode ? '#e2e8f0' : '#374151',
    boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
    transition: 'all 0.2s ease',
  };

  const dropdownMenuStyle = {
    border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
    backgroundColor: darkMode ? '#1e293b' : '#fff',
    boxShadow: darkMode ? '0 10px 40px rgba(0, 0, 0, 0.5)' : '0 10px 40px rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    padding: '4px',
  };
  
  return (
    <div 
      className="px-8 py-5 flex items-center gap-6 sticky top-0 z-50"
      style={{ 
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        borderBottom: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
      }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={onTogglePlay}
        className="rounded-xl font-medium text-white transition-all flex items-center gap-2 hover:opacity-90 active:scale-95"
        style={{ 
          backgroundColor: '#6366f1',
          padding: '12px 28px',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
          fontSize: '15px'
        }}
      >
        {isPlaying ? (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
            Pause
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Train
          </>
        )}
      </button>
      
      {/* Reset Button */}
      <button
        onClick={onReset}
        className="rounded-xl font-medium transition-all active:scale-95"
        style={{ 
          padding: '12px 24px',
          fontSize: '15px',
          color: darkMode ? '#94a3b8' : '#6b7280',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = darkMode ? '#334155' : '#f9fafb';
          e.currentTarget.style.color = darkMode ? '#e2e8f0' : '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = darkMode ? '#94a3b8' : '#6b7280';
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
      
      {/* Divider */}
      <div className="h-8 w-px mx-2" style={{ backgroundColor: darkMode ? '#334155' : '#e5e7eb' }}></div>
      
      <div className="flex items-center gap-4 flex-wrap">
        {/* Learning Rate Dropdown */}
        <div className="relative" ref={lrRef}>
          <div className="text-xs font-medium mb-1 ml-1 uppercase tracking-wider" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Learning Rate</div>
          <button
            onClick={() => setShowLRDropdown(!showLRDropdown)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-3 min-w-[100px]"
            style={dropdownButtonStyle}
          >
            <span>{learningRate}</span>
            <svg className="w-3.5 h-3.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showLRDropdown && (
            <div 
              className="absolute top-full mt-2 z-10"
              style={{ ...dropdownMenuStyle, minWidth: '140px' }}
            >
              {lrOptions.map(lr => (
                <button
                  key={lr}
                  onClick={() => {
                    onLearningRateChange(lr);
                    setShowLRDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors text-sm font-medium rounded-lg"
                  style={{
                    backgroundColor: learningRate === lr ? (darkMode ? '#312e81' : '#f5f7ff') : 'transparent',
                    color: learningRate === lr ? (darkMode ? '#a5b4fc' : '#6366f1') : (darkMode ? '#e2e8f0' : '#374151')
                  }}
                >
                  {lr}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Activation Dropdown */}
        <div className="relative" ref={actRef}>
          <div className="text-xs font-medium mb-1 ml-1 uppercase tracking-wider" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Activation</div>
          <button
            onClick={() => setShowActDropdown(!showActDropdown)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-3 min-w-[120px]"
            style={dropdownButtonStyle}
          >
            <span className="capitalize">{activation}</span>
            <svg className="w-3.5 h-3.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showActDropdown && (
            <div 
              className="absolute top-full mt-2 z-10"
              style={{ ...dropdownMenuStyle, minWidth: '140px' }}
            >
              {activationOptions.map(act => (
                <button
                  key={act}
                  onClick={() => {
                    onActivationChange(act);
                    setShowActDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors text-sm font-medium rounded-lg capitalize"
                  style={{
                    backgroundColor: activation === act ? (darkMode ? '#312e81' : '#f5f7ff') : 'transparent',
                    color: activation === act ? (darkMode ? '#a5b4fc' : '#6366f1') : (darkMode ? '#e2e8f0' : '#374151')
                  }}
                >
                  {act}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Regularization Dropdown */}
        <div className="relative" ref={regRef}>
          <div className="text-xs font-medium mb-1 ml-1 uppercase tracking-wider" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Regularization</div>
          <button
            onClick={() => setShowRegDropdown(!showRegDropdown)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-3 min-w-[110px]"
            style={dropdownButtonStyle}
          >
            <span>{regularization}</span>
            <svg className="w-3.5 h-3.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showRegDropdown && (
            <div 
              className="absolute top-full mt-2 z-10"
              style={{ ...dropdownMenuStyle, minWidth: '120px' }}
            >
              {regularizationOptions.map(reg => (
                <button
                  key={reg}
                  onClick={() => {
                    onRegularizationChange(reg);
                    setShowRegDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors text-sm font-medium rounded-lg"
                  style={{
                    backgroundColor: regularization === reg ? (darkMode ? '#312e81' : '#f5f7ff') : 'transparent',
                    color: regularization === reg ? (darkMode ? '#a5b4fc' : '#6366f1') : (darkMode ? '#e2e8f0' : '#374151')
                  }}
                >
                  {reg}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Regularization Rate Dropdown */}
        <div className="relative" ref={regRateRef} style={{ opacity: regularization === 'None' ? 0.3 : 1, pointerEvents: regularization === 'None' ? 'none' : 'auto' }}>
          <div className="text-xs font-medium mb-1 ml-1 uppercase tracking-wider" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Reg. Rate</div>
          <button
            onClick={() => setShowRegRateDropdown(!showRegRateDropdown)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-3 min-w-[100px]"
            style={dropdownButtonStyle}
          >
            <span>{regularizationRate}</span>
            <svg className="w-3.5 h-3.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showRegRateDropdown && (
            <div 
              className="absolute top-full mt-2 z-10 max-h-64 overflow-y-auto"
              style={{ ...dropdownMenuStyle, minWidth: '120px' }}
            >
              {regularizationRateOptions.map(rate => (
                <button
                  key={rate}
                  onClick={() => {
                    onRegularizationRateChange(rate);
                    setShowRegRateDropdown(false);
                  }}
                  className="w-full px-4 py-2.5 text-left transition-colors text-sm font-medium rounded-lg"
                  style={{
                    backgroundColor: regularizationRate === rate ? (darkMode ? '#312e81' : '#f5f7ff') : 'transparent',
                    color: regularizationRate === rate ? (darkMode ? '#a5b4fc' : '#6366f1') : (darkMode ? '#e2e8f0' : '#374151')
                  }}
                >
                  {rate}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-grow"></div>

      {/* Dark Mode Toggle Button */}
      <button
        onClick={onToggleDarkMode}
        className="rounded-full w-10 h-10 flex items-center justify-center transition-all"
        style={{
          color: darkMode ? '#94a3b8' : '#9ca3af',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = darkMode ? '#334155' : '#f9fafb';
          e.currentTarget.style.color = darkMode ? '#e2e8f0' : '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = darkMode ? '#94a3b8' : '#9ca3af';
        }}
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      {/* Help Button */}
      <button
        onClick={onShowHelp}
        className="rounded-full w-10 h-10 flex items-center justify-center transition-all"
        style={{
          color: darkMode ? '#94a3b8' : '#9ca3af',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = darkMode ? '#334155' : '#f9fafb';
          e.currentTarget.style.color = darkMode ? '#e2e8f0' : '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = darkMode ? '#94a3b8' : '#9ca3af';
        }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>
  );
}

export default TopBar;
