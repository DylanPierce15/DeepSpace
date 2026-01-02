import React, { useState, useEffect, useRef, useCallback } from 'react';

function AdvancedWeatherWidget() {
  // Global storage for collaborative weather tracking (synced across all users)
  // This enables true collaborative weather monitoring where all users see the same weather
  const [savedLocations, setSavedLocations] = useGlobalStorage('weather-advanced-locations', []);
  const [temperatureUnitRaw, setTemperatureUnitRaw] = useGlobalStorage('weather-advanced-unit', 'metric');
  const [currentLocation, setCurrentLocation] = useGlobalStorage('weather-advanced-current', null);
  
  // Ensure temperatureUnit is always a string (fix for storage corruption)
  const temperatureUnit = Array.isArray(temperatureUnitRaw) ? temperatureUnitRaw[0] || 'metric' : temperatureUnitRaw || 'metric';
  const setTemperatureUnit = (unit) => setTemperatureUnitRaw(typeof unit === 'string' ? unit : 'metric');
  
  // Local widget-specific state (not synced - each widget instance maintains its own)
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Modal states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Cache management
  const cache = useRef(new Map());
  const cacheTimeout = 30 * 60 * 1000; // 30 minutes
  const searchTimeoutRef = useRef(null);

  // Weather data loading
  const loadWeatherData = useCallback(async (location = currentLocation) => {
    if (!location || isLoading) return;

    const { name, country, state } = location;
    const locationQuery = state ? `${name}, ${state}, ${country}` : `${name}, ${country}`;
    const cacheKey = `weather-${name}-${country}-${temperatureUnit}`;
    const cachedData = cache.current.get(cacheKey);

    // Check cache validity
    if (cachedData && (Date.now() - cachedData.timestamp < cacheTimeout)) {
      setWeatherData(cachedData.data);
      updateBackgroundGradient(cachedData.data.current);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current weather
      const currentResponse = await miyagiAPI.post('current-weather', {
        location: locationQuery,
        units: temperatureUnit
      });

      // Get weather forecast
      const forecastResponse = await miyagiAPI.post('weather-forecast', {
        location: locationQuery,
        units: temperatureUnit
      });

      // Extract data from wrapped response { success, data: { weather/forecast } }
      const currentWeather = currentResponse?.data?.weather || currentResponse?.weather || currentResponse;
      const forecastData = forecastResponse?.data?.forecast || forecastResponse?.forecast || forecastResponse;

      // Transform data to unified format
      const transformedData = transformToOneCallFormat(currentWeather, forecastData);
      
      // Cache the data
      cache.current.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      setWeatherData(transformedData);
      updateBackgroundGradient(transformedData.current);

    } catch (error) {
      console.error('❌ Weather fetch error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, temperatureUnit, isLoading]);

  // Load weather data when currentLocation changes (from global storage)
  useEffect(() => {
    if (currentLocation) {
      loadWeatherData(currentLocation);
    }
  }, [currentLocation, loadWeatherData]);

  // Initialize with widget config if available
  useEffect(() => {
    const configLocation = window.widgetConfig?.location;
    if (configLocation && !currentLocation) {
      setCurrentLocation(configLocation);
    }
  }, [currentLocation, setCurrentLocation]);

  // Transform normalized API data to widget display format
  // currentData: { dt, temp, feels_like, humidity, pressure, visibility, description, icon, wind_speed, wind_deg, sunrise, sunset }
  // forecastData: array of { dt, temp, feels_like, humidity, description, icon }
  const transformToOneCallFormat = (currentData, forecastData) => {
    const current = {
      dt: currentData.dt,
      sunrise: currentData.sunrise,
      sunset: currentData.sunset,
      temp: currentData.temp,
      feels_like: currentData.feels_like,
      pressure: currentData.pressure || 1013,
      humidity: currentData.humidity || 50,
      uvi: 0,
      visibility: currentData.visibility || 10000,
      wind_speed: currentData.wind_speed || 0,
      wind_deg: currentData.wind_deg || 0,
      weather: [{
        description: currentData.description || 'Unknown',
        icon: currentData.icon || '01d'
      }]
    };

    // Group forecast data by day
    const dailyMap = new Map();
    const forecastItems = Array.isArray(forecastData) ? forecastData : [];
    
    forecastItems.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          dt: item.dt,
          temps: [],
          weather: { description: item.description || 'Unknown', icon: item.icon || '01d' },
          pop: 0
        });
      }
      
      const dayData = dailyMap.get(dateKey);
      if (item.temp != null) {
        dayData.temps.push(item.temp);
      }
    });

    // Convert to daily format (5 days)
    const daily = Array.from(dailyMap.values()).slice(0, 5).map(day => ({
      dt: day.dt,
      temp: {
        min: day.temps.length > 0 ? Math.min(...day.temps) : 0,
        max: day.temps.length > 0 ? Math.max(...day.temps) : 0
      },
      weather: [day.weather],
      pop: day.pop
    }));

    return { current, daily };
  };

  // City search functionality
  const searchCities = useCallback(async (query) => {
    if (searchLoading || !query.trim()) return;
    
    try {
      setSearchLoading(true);
      
      const response = await miyagiAPI.post('geocode-city', {
        query: query,
        limit: 5
      });

      // Extract locations from wrapped response { success, data: { locations } }
      const locations = response?.data?.locations || response?.locations || [];
      setSearchResults(locations);

    } catch (error) {
      console.error('❌ City search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchLoading]);

  // Handle search input with debouncing
  const handleSearchInput = useCallback((query) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length >= 2) {
      // Debounce search by 300ms
      searchTimeoutRef.current = setTimeout(() => {
        searchCities(query);
      }, 300);
    } else {
      setSearchResults([]);
    }
  }, [searchCities]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Location selection
  const selectLocation = useCallback((location) => {
    const locationData = {
      name: location.name,
      country: location.country,
      state: location.state,
      lat: location.lat,
      lon: location.lon
    };

    setCurrentLocation(locationData); // Automatically synced via global storage
    
    // Add to saved locations
    const exists = savedLocations.some(saved => 
      saved.lat === locationData.lat && saved.lon === locationData.lon
    );

    if (!exists) {
      const newSavedLocations = [locationData, ...savedLocations.slice(0, 9)];
      setSavedLocations(newSavedLocations);
    }

    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    loadWeatherData(locationData);
  }, [savedLocations, setSavedLocations, loadWeatherData]);

  // Remove saved location
  const removeSavedLocation = useCallback((index) => {
    const newSavedLocations = [...savedLocations];
    newSavedLocations.splice(index, 1);
    setSavedLocations(newSavedLocations);
  }, [savedLocations, setSavedLocations]);

  // Temperature unit change
  const changeTemperatureUnit = useCallback((unit) => {
    if (temperatureUnit !== unit) {
      setTemperatureUnit(unit);
      cache.current.clear(); // Clear cache to force refresh with new units
      if (currentLocation) {
        loadWeatherData();
      }
    }
  }, [temperatureUnit, setTemperatureUnit, currentLocation, loadWeatherData]);

  // Background gradient update
  const updateBackgroundGradient = (currentWeather) => {
    const weatherId = currentWeather.weather[0].id;
    const isNight = currentWeather.dt > currentWeather.sunset || currentWeather.dt < currentWeather.sunrise;
    
    document.body.className = '';
    
    if (isNight) {
      document.body.classList.add('bg-night');
    } else if (weatherId >= 200 && weatherId < 300) {
      document.body.classList.add('bg-rainy');
    } else if (weatherId >= 300 && weatherId < 600) {
      document.body.classList.add('bg-rainy');
    } else if (weatherId >= 600 && weatherId < 700) {
      document.body.classList.add('bg-snowy');
    } else if (weatherId >= 700 && weatherId < 800) {
      document.body.classList.add('bg-cloudy');
    } else if (weatherId === 800) {
      document.body.classList.add('bg-sunny');
    } else {
      document.body.classList.add('bg-cloudy');
    }
  };

  // Utility functions (pure functions - no need for useCallback)
  const getWeatherIcon = (weatherId, icon) => {
    const iconMap = {
      // Thunderstorm
      200: '⛈️', 201: '⛈️', 202: '⛈️', 210: '🌩️', 211: '🌩️', 212: '🌩️', 221: '🌩️', 230: '⛈️', 231: '⛈️', 232: '⛈️',
      // Drizzle
      300: '🌦️', 301: '🌦️', 302: '🌦️', 310: '🌦️', 311: '🌦️', 312: '🌦️', 313: '🌦️', 314: '🌦️', 321: '🌦️',
      // Rain
      500: '🌧️', 501: '🌧️', 502: '🌧️', 503: '🌧️', 504: '🌧️', 511: '🌧️', 520: '🌦️', 521: '🌦️', 522: '🌦️', 531: '🌦️',
      // Snow
      600: '❄️', 601: '❄️', 602: '❄️', 611: '🌨️', 612: '🌨️', 613: '🌨️', 615: '🌨️', 616: '🌨️', 620: '❄️', 621: '❄️', 622: '❄️',
      // Atmosphere
      701: '🌫️', 711: '🌫️', 721: '🌫️', 731: '🌫️', 741: '🌫️', 751: '🌫️', 761: '🌫️', 762: '🌫️', 771: '🌫️', 781: '🌪️',
      // Clear
      800: icon && icon.includes('n') ? '🌙' : '☀️',
      // Clouds
      801: '🌤️', 802: '⛅', 803: '☁️', 804: '☁️'
    };

    return iconMap[weatherId] || '🌤️';
  };

  const formatTemperature = useCallback((temp) => {
    const unit = temperatureUnit === 'metric' ? '°C' : '°F';
    return `${Math.round(temp)}${unit}`;
  }, [temperatureUnit]);

  const formatDay = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Utility function to format location display name
  const formatLocationDisplayName = useCallback((location) => {
    if (!location) return '📍 Select Location';
    return location.state 
      ? `${location.name}, ${location.state}`
      : `${location.name}, ${location.country}`;
  }, []);

  // Render current location display name
  const getLocationDisplayName = () => formatLocationDisplayName(currentLocation);

  // Render main weather content
  const renderWeatherContent = () => {
    if (isLoading) {
      return (
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading weather data...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error">
          <div style={{ marginBottom: '8px' }}>❌ Error</div>
          <div style={{ fontSize: '14px' }}>{error}</div>
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
            Please try again or select a different location.
          </div>
        </div>
      );
    }

    if (!weatherData) {
      return (
        <div className="welcome">
          <h3>🌤️ Advanced Weather</h3>
          <p>Select a location to view current conditions and 5-day forecast with precipitation details</p>
        </div>
      );
    }

    const { current, daily } = weatherData;
    const currentIcon = getWeatherIcon(current.weather[0].id, current.weather[0].icon);
    const currentTemp = formatTemperature(current.temp);
    const feelsLike = formatTemperature(current.feels_like);
    const windSpeed = Math.round((current.wind_speed || 0) * 3.6);
    const windDirection = getWindDirection(current.wind_deg || 0);
    const pressure = current.pressure;
    const humidity = current.humidity;
    const visibility = Math.round(current.visibility / 1000);

    return (
      <>
        <div className="current-weather">
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>{currentIcon}</div>
          <div className="current-temp">{currentTemp}</div>
          <div className="current-condition">{current.weather[0].description}</div>
          
          <div className="current-details">
            <div className="detail-group">
              <div className="detail-label">Feels like</div>
              <div className="detail-value">{feelsLike}</div>
            </div>
            <div className="detail-group">
              <div className="detail-label">Humidity</div>
              <div className="detail-value">{humidity}%</div>
            </div>
            <div className="detail-group">
              <div className="detail-label">Pressure</div>
              <div className="detail-value">{pressure} hPa</div>
            </div>
            <div className="detail-group">
              <div className="detail-label">Visibility</div>
              <div className="detail-value">{visibility}km</div>
            </div>
          </div>

          <div className="weather-info-grid">
            <div className="info-card">
              <span className="info-icon">💨</span>
              <div className="info-label">Wind</div>
              <div className="info-value">{windSpeed} km/h {windDirection}</div>
            </div>
            <div className="info-card">
              <span className="info-icon">🌅</span>
              <div className="info-label">Sunrise</div>
              <div className="info-value">{formatTime(current.sunrise)}</div>
            </div>
            <div className="info-card">
              <span className="info-icon">🌇</span>
              <div className="info-label">Sunset</div>
              <div className="info-value">{formatTime(current.sunset)}</div>
            </div>
            <div className="info-card">
              <span className="info-icon">🌡️</span>
              <div className="info-label">Min/Max</div>
              <div className="info-value">
                {formatTemperature(daily[0]?.temp.min || current.temp)} / {formatTemperature(daily[0]?.temp.max || current.temp)}
              </div>
            </div>
          </div>
        </div>

        <div className="forecast-section">
          <div className="forecast-title">5-Day Forecast</div>
          <div className="forecast-container">
            <div className="forecast-grid">
              {daily.map((day, index) => {
                const dayIcon = getWeatherIcon(day.weather[0].id, day.weather[0].icon);
                const highTemp = formatTemperature(day.temp.max);
                const lowTemp = formatTemperature(day.temp.min);
                const rainChance = day.pop ? Math.round(day.pop * 100) : 0;
                
                return (
                  <div key={index} className="forecast-item">
                    <div className="forecast-day">{formatDay(day.dt)}</div>
                    <span className="forecast-icon">{dayIcon}</span>
                    {rainChance > 0 && <span className="forecast-rain">{rainChance}%</span>}
                    <div className="forecast-temps">
                      <span className="forecast-high">{highTemp}</span>
                      <span className="forecast-low">{lowTemp}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="weather-widget">
      <style jsx>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .weather-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #4A90E2 0%, #357ABD 50%, #1E3A8A 100%);
          color: white;
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
        }

        /* Dynamic background gradients */
        :global(.bg-sunny) { background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF6347 100%); }
        :global(.bg-cloudy) { background: linear-gradient(135deg, #87CEEB 0%, #4682B4 50%, #2F4F4F 100%); }
        :global(.bg-rainy) { background: linear-gradient(135deg, #708090 0%, #2F4F4F 50%, #191970 100%); }
        :global(.bg-snowy) { background: linear-gradient(135deg, #F0F8FF 0%, #B0C4DE 50%, #4682B4 100%); }
        :global(.bg-night) { background: linear-gradient(135deg, #191970 0%, #000080 50%, #000000 100%); }

        .weather-container {
          padding: 16px;
          max-width: 400px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header Section */
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .location-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 8px 16px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          transition: all 0.3s ease;
          flex: 1;
          max-width: 200px;
        }

        .location-selector:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.02);
        }

        .location-name {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .settings-btn {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 18px;
          transition: all 0.3s ease;
        }

        .settings-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.1);
        }

        /* Modal Styles */
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-content {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 24px;
          width: 100%;
          max-width: 350px;
          color: #333;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .search-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 12px;
          font-size: 16px;
          margin-bottom: 16px;
          transition: border-color 0.3s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #4A90E2;
        }

        .search-results {
          max-height: 200px;
          overflow-y: auto;
        }

        .search-result-item {
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
          border-bottom: 1px solid #f0f0f0;
        }

        .search-result-item:hover {
          background: rgba(74, 144, 226, 0.1);
        }

        .search-result-item:last-child {
          border-bottom: none;
        }

        .result-name {
          font-weight: 600;
          color: #333;
        }

        .result-country {
          font-size: 14px;
          color: #666;
          margin-top: 2px;
        }

        .saved-locations {
          margin-top: 20px;
        }

        .saved-locations-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #333;
        }

        .saved-location-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .saved-location-item:hover {
          background: #e9ecef;
        }

        .delete-location {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s ease;
        }

        .delete-location:hover {
          background: rgba(220, 53, 69, 0.1);
        }

        .unit-toggle {
          display: flex;
          background: #f0f0f0;
          border-radius: 12px;
          padding: 4px;
          margin-top: 12px;
        }

        .unit-option {
          flex: 1;
          padding: 8px 16px;
          text-align: center;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .unit-option.active {
          background: #4A90E2;
          color: white;
        }

        /* Current Weather Card */
        .current-weather {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 20px 16px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          margin-bottom: 16px;
          text-align: center;
        }

        .current-temp {
          font-size: 48px;
          font-weight: 300;
          line-height: 1;
          margin: 8px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .current-condition {
          font-size: 14px;
          margin-bottom: 6px;
          opacity: 0.9;
          text-transform: capitalize;
        }

        .current-details {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 12px;
        }

        .detail-group {
          text-align: center;
        }

        .detail-label {
          opacity: 0.8;
          margin-bottom: 4px;
        }

        .detail-value {
          font-weight: 600;
        }

        /* Additional Weather Info */
        .weather-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }

        .info-card {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 10px 8px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-align: center;
        }

        .info-icon {
          font-size: 18px;
          margin-bottom: 4px;
          display: block;
        }

        .info-label {
          font-size: 10px;
          opacity: 0.8;
          margin-bottom: 2px;
        }

        .info-value {
          font-size: 12px;
          font-weight: 600;
        }

        /* Forecast Section */
        .forecast-section {
          margin-top: 16px;
        }

        .forecast-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          opacity: 0.9;
        }

        .forecast-container {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 20px;
        }

        .forecast-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .forecast-item {
          text-align: center;
          padding: 16px 8px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }

        .forecast-item:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }

        .forecast-day {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          opacity: 0.9;
        }

        .forecast-icon {
          font-size: 32px;
          margin: 8px 0;
          display: block;
        }

        .forecast-temps {
          margin-top: 8px;
        }

        .forecast-high {
          font-weight: 700;
          font-size: 14px;
          display: block;
        }

        .forecast-low {
          opacity: 0.7;
          font-size: 12px;
          margin-top: 2px;
          display: block;
        }

        .forecast-rain {
          font-size: 10px;
          opacity: 0.9;
          margin-top: 4px;
          color: #4A9EFF;
          display: block;
          font-weight: 600;
          background: rgba(74, 158, 255, 0.2);
          border-radius: 8px;
          padding: 2px 6px;
        }

        /* Loading and Error States */
        .loading {
          text-align: center;
          padding: 40px;
          opacity: 0.8;
        }

        .loading-spinner {
          display: inline-block;
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-bottom: 16px;
        }

        .error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 16px;
          border-radius: 12px;
          text-align: center;
          margin: 20px 0;
        }

        .welcome {
          text-align: center;
          padding: 40px 20px;
          opacity: 0.8;
        }

        .welcome h3 {
          font-size: 24px;
          margin-bottom: 12px;
          font-weight: 600;
        }

        .welcome p {
          font-size: 16px;
          opacity: 0.8;
          line-height: 1.5;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Responsive adjustments */
        @media (max-width: 480px) {
          .weather-container {
            padding: 16px;
          }
          
          .current-temp {
            font-size: 64px;
          }
          
          .current-details {
            flex-wrap: wrap;
            gap: 16px;
          }
          
          .detail-group {
            flex: 1;
            min-width: 80px;
          }

          .forecast-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
          }

          .forecast-item {
            padding: 12px 4px;
          }

          .forecast-icon {
            font-size: 24px;
          }

          .weather-info-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .info-card {
            padding: 12px;
          }
        }

        @media (max-width: 380px) {
          .forecast-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 4px;
          }

          .forecast-day {
            font-size: 10px;
          }

          .forecast-icon {
            font-size: 20px;
          }

          .forecast-high, .forecast-low {
            font-size: 11px;
          }
        }
      `}</style>

      <div className="weather-container">
        {/* Header */}
        <div className="header-section">
          <div className="location-selector" onClick={() => setShowSearchModal(true)}>
            <span className="location-name">{getLocationDisplayName()}</span>
          </div>
          <button className="settings-btn" onClick={() => setShowSettingsModal(true)}>
            ⚙️
          </button>
        </div>

        {/* Main Weather Display */}
        <div>
          {renderWeatherContent()}
        </div>
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="modal" onClick={(e) => e.target.className === 'modal' && setShowSearchModal(false)}>
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add Location</h3>
              <button className="close-btn" onClick={() => setShowSearchModal(false)}>×</button>
            </div>
            
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search for a city..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  searchCities(searchQuery.trim());
                }
              }}
              autoComplete="off"
            />
            
            <div className="search-results">
              {searchLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((city, index) => (
                  <div key={index} className="search-result-item" onClick={() => selectLocation(city)}>
                    <div className="result-name">{city.name}</div>
                    <div className="result-country">{city.state ? `${city.state}, ` : ''}{city.country}</div>
                  </div>
                ))
              ) : searchQuery.length >= 2 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  No cities found. Try a different search term.
                </div>
              ) : null}
            </div>
            
            <div className="saved-locations">
              <h4 className="saved-locations-title">Saved Locations</h4>
              <div>
                {savedLocations.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: '16px', fontSize: '14px' }}>
                    No saved locations yet
                  </div>
                ) : (
                  savedLocations.map((location, index) => (
                      <div key={index} className="saved-location-item">
                        <span onClick={() => selectLocation(location)} style={{ flex: 1, cursor: 'pointer' }}>
                          {formatLocationDisplayName(location)}
                        </span>
                        <button 
                          className="delete-location" 
                          onClick={() => removeSavedLocation(index)} 
                          title="Remove location"
                        >
                          🗑️
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal" onClick={(e) => e.target.className === 'modal' && setShowSettingsModal(false)}>
          <div className="modal-content" style={{ maxWidth: '300px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Settings</h3>
              <button className="close-btn" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            
            <div>
              <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Temperature Unit</label>
              <div className="unit-toggle">
                <div 
                  className={`unit-option ${temperatureUnit === 'metric' ? 'active' : ''}`}
                  onClick={() => changeTemperatureUnit('metric')}
                >
                  °C
                </div>
                <div 
                  className={`unit-option ${temperatureUnit === 'imperial' ? 'active' : ''}`}
                  onClick={() => changeTemperatureUnit('imperial')}
                >
                  °F
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedWeatherWidget;
