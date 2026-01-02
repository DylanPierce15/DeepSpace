import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import QuickEntry from './components/QuickEntry';
import StatsPanel from './components/StatsPanel';
import DailyLog from './components/DailyLog';
import SettingsModal from './components/SettingsModal';
import { STORAGE_KEYS, DEFAULTS, VIEWS } from './utils/constants';
import { getCurrentDateKey } from './utils/dateUtils';

function NutritionTrackerWidget() {
  const [muiLoaded, setMuiLoaded] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  
  // Global storage - persists across widget instances
  const [foodHistory, setFoodHistory] = useGlobalStorage(STORAGE_KEYS.FOOD_HISTORY, {});
  const [preferences, setPreferences] = useGlobalStorage(STORAGE_KEYS.PREFERENCES, DEFAULTS.PREFERENCES);
  
  // Local UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [activeView, setActiveView] = useState(VIEWS.TODAY);
  
  // Calculate current date key based on reset hour
  const currentDateKey = useMemo(() => {
    return getCurrentDateKey(preferences.resetHour);
  }, [preferences.resetHour]);
  
  // Selected date for viewing/editing (defaults to today)
  const [selectedDate, setSelectedDate] = useState(currentDateKey);
  
  // Update selectedDate when currentDateKey changes (e.g., day rolls over)
  useEffect(() => {
    if (activeView === VIEWS.TODAY) {
      setSelectedDate(currentDateKey);
    }
  }, [currentDateKey, activeView]);
  
  // Get selected day's foods
  const selectedDayFoods = useMemo(() => {
    return foodHistory[selectedDate] || [];
  }, [foodHistory, selectedDate]);

  // Load Material UI from CDN and check for first-time setup
  useEffect(() => {
    // Load Material UI CSS
    if (!document.getElementById('mui-css')) {
      const muiCss = document.createElement('link');
      muiCss.id = 'mui-css';
      muiCss.rel = 'stylesheet';
      muiCss.href = 'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap';
      document.head.appendChild(muiCss);
    }

    // Load Material Icons
    if (!document.getElementById('mui-icons')) {
      const muiIcons = document.createElement('link');
      muiIcons.id = 'mui-icons';
      muiIcons.rel = 'stylesheet';
      muiIcons.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
      document.head.appendChild(muiIcons);
    }

    setMuiLoaded(true);
  }, []);
  
  // Mark storage as loaded after a brief delay to allow global storage to initialize
  useEffect(() => {
    const timer = setTimeout(() => {
      setStorageLoaded(true);
    }, 100); // Small delay to let useGlobalStorage initialize
    
    return () => clearTimeout(timer);
  }, []);
  
  // Check for first-time setup only after storage has loaded
  useEffect(() => {
    if (!storageLoaded) return;
    
    console.log('=== NUTRITION TRACKER DEBUG ===');
    console.log('Full preferences object:', preferences);
    console.log('preferences.dailyGoal:', preferences.dailyGoal);
    console.log('Type of dailyGoal:', typeof preferences.dailyGoal);
    console.log('Is undefined?', preferences.dailyGoal === undefined);
    console.log('Is null?', preferences.dailyGoal === null);
    console.log('Keys in preferences:', Object.keys(preferences));
    console.log('================================');
    
    // Check if dailyGoal has never been set (first time)
    if (preferences.dailyGoal === undefined || preferences.dailyGoal === null) {
      console.log('🚨 SHOWING FIRST TIME SETUP MODAL');
      setShowFirstTimeSetup(true);
    } else {
      console.log('✅ dailyGoal is set, NOT showing modal');
    }
  }, [storageLoaded, preferences.dailyGoal]);

  // Auto-check for date change
  useEffect(() => {
    const checkDateChange = setInterval(() => {
      const newDateKey = getCurrentDateKey(preferences.resetHour);
      if (newDateKey !== currentDateKey) {
        // Date changed, trigger re-render by updating a dummy state
        // (currentDateKey will update via useMemo)
        window.location.reload();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkDateChange);
  }, [currentDateKey, preferences.resetHour]);

  // Date navigation handlers
  const handlePrevDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const nextDate = date.toISOString().split('T')[0];
    // Don't go beyond today
    if (nextDate <= currentDateKey) {
      setSelectedDate(nextDate);
    }
  };

  const handleToday = () => {
    setSelectedDate(currentDateKey);
  };

  // Food management handlers (work on selected date)
  const handleAddFood = (food) => {
    setFoodHistory(prev => {
      const newHistory = { ...prev };
      const dayFoods = newHistory[selectedDate] || [];
      newHistory[selectedDate] = [...dayFoods, food];
      return newHistory;
    });
  };

  const handleUpdateFood = (updatedFood) => {
    setFoodHistory(prev => {
      const newHistory = { ...prev };
      const dayFoods = newHistory[selectedDate] || [];
      newHistory[selectedDate] = dayFoods.map(f => 
        f.id === updatedFood.id ? updatedFood : f
      );
      return newHistory;
    });
  };

  const handleDeleteFood = (foodId) => {
    setFoodHistory(prev => {
      const newHistory = { ...prev };
      const dayFoods = newHistory[selectedDate] || [];
      newHistory[selectedDate] = dayFoods.filter(f => f.id !== foodId);
      return newHistory;
    });
  };

  const handleReorderFoods = (fromIndex, toIndex) => {
    setFoodHistory(prev => {
      const newHistory = { ...prev };
      const dayFoods = [...(newHistory[selectedDate] || [])];
      const [removed] = dayFoods.splice(fromIndex, 1);
      dayFoods.splice(toIndex, 0, removed);
      newHistory[selectedDate] = dayFoods;
      return newHistory;
    });
  };

  const handleSaveSettings = (newPreferences) => {
    setPreferences(newPreferences);
    setShowFirstTimeSetup(false);
  };

  const handleViewChange = (newView) => {
    setActiveView(newView);
    // When switching to TODAY view, reset to current date
    if (newView === VIEWS.TODAY) {
      setSelectedDate(currentDateKey);
    }
  };

  if (!muiLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontFamily: 'Roboto, sans-serif',
        color: '#666'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Loading...</div>
          <div style={{ fontSize: '14px' }}>Nutrition Tracker</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Roboto, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: '24px',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {activeView === VIEWS.TODAY ? (
          <>
            <Header 
              onSettingsClick={() => setShowSettings(true)}
              selectedDate={selectedDate}
              currentDateKey={currentDateKey}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onToday={handleToday}
            />
            
            <QuickEntry onAddFood={handleAddFood} />
            
            <StatsPanel
              currentDateKey={selectedDate}
              foodHistory={foodHistory}
              dailyGoal={preferences.dailyGoal || DEFAULTS.DAILY_GOAL}
              resetHour={preferences.resetHour}
              activeView={activeView}
              onViewChange={handleViewChange}
            />
            
            <DailyLog
              dateKey={selectedDate}
              foods={selectedDayFoods}
              onUpdateFood={handleUpdateFood}
              onDeleteFood={handleDeleteFood}
              onReorder={handleReorderFoods}
            />

            {/* Info Footer */}
            <div style={{
              marginTop: '20px',
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
              textAlign: 'center'
            }}>
              💡 Quick tip: Just type calories (e.g., "450") or add a description (e.g., "Chicken 450"). 
              Click any item to add detailed nutrition info.
            </div>
          </>
        ) : (
          <>
            <Header 
              onSettingsClick={() => setShowSettings(true)}
              selectedDate={currentDateKey}
              currentDateKey={currentDateKey}
              onPrevDay={handlePrevDay}
              onNextDay={handleNextDay}
              onToday={handleToday}
            />
            
            <StatsPanel
              currentDateKey={currentDateKey}
              foodHistory={foodHistory}
              dailyGoal={preferences.dailyGoal || DEFAULTS.DAILY_GOAL}
              resetHour={preferences.resetHour}
              activeView={activeView}
              onViewChange={handleViewChange}
            />
          </>
        )}
      </div>

      <SettingsModal
        isOpen={showSettings || showFirstTimeSetup}
        onClose={() => {
          setShowSettings(false);
          // Can't close first-time setup without completing it
          if (!showFirstTimeSetup) {
            setShowSettings(false);
          }
        }}
        preferences={preferences}
        onSave={handleSaveSettings}
        isFirstTime={showFirstTimeSetup}
      />
    </div>
  );
}

export default NutritionTrackerWidget;
