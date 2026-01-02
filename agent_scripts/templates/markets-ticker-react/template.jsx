import React, { useState, useEffect, useRef, useCallback } from 'react';

function MarketsTickerWidget() {
  // State management
  const [tickers, setTickers] = useGlobalStorage('markets-ticker-symbols', ['NASDAQ:AAPL', 'NASDAQ:GOOGL', 'NASDAQ:MSFT', 'BINANCE:BTCUSD', 'BINANCE:ETHUSD', 'FX:EURUSD']);
  const [currentTicker, setCurrentTicker] = useGlobalStorage('markets-ticker-current', null);
  const [tickerInput, setTickerInput] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('NASDAQ');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs
  const searchTimeout = useRef(null);
  const searchCache = useRef(new Map());
  const suggestionsRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Popular symbols for fallback
  const popularSymbols = [
    // Stocks
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: 'stock' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock' },
    { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock' },
    { symbol: 'V', name: 'Visa Inc.', type: 'stock' },
    { symbol: 'WMT', name: 'Walmart Inc.', type: 'stock' },
    // Crypto
    { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', type: 'crypto' },
    { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', type: 'crypto' },
    { symbol: 'BNBUSD', name: 'Binance Coin / US Dollar', type: 'crypto' },
    { symbol: 'XRPUSD', name: 'Ripple / US Dollar', type: 'crypto' },
    { symbol: 'ADAUSD', name: 'Cardano / US Dollar', type: 'crypto' },
    { symbol: 'DOGEUSD', name: 'Dogecoin / US Dollar', type: 'crypto' },
    { symbol: 'SOLUSD', name: 'Solana / US Dollar', type: 'crypto' },
    // Forex
    { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'forex' },
    { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'forex' },
    { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'forex' },
    { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'forex' },
    { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'forex' },
    { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'forex' },
    // Indices
    { symbol: 'SPX', name: 'S&P 500 Index', type: 'index' },
    { symbol: 'DJI', name: 'Dow Jones Industrial Average', type: 'index' },
    { symbol: 'IXIC', name: 'NASDAQ Composite', type: 'index' },
    { symbol: 'RUT', name: 'Russell 2000', type: 'index' },
    { symbol: 'VIX', name: 'CBOE Volatility Index', type: 'index' }
  ];
  
  // Initialize current ticker if not set
  useEffect(() => {
    if (!currentTicker && tickers.length > 0) {
      setCurrentTicker(tickers[0]);
    }
  }, [currentTicker, tickers, setCurrentTicker]);
  
  // Format symbol with exchange
  const formatSymbolWithExchange = (ticker, exchange) => {
    switch (exchange) {
      case 'NASDAQ':
      case 'NYSE':
      case 'AMEX':
      case 'CBOE':
      case 'SP':
        return `${exchange}:${ticker}`;
      case 'BINANCE':
        if (ticker.endsWith('USD') || ticker.endsWith('USDT')) {
          return `BINANCE:${ticker.replace('USDT', 'USD')}`;
        } else {
          return `BINANCE:${ticker}USD`;
        }
      case 'FX':
        return `FX:${ticker}`;
      default:
        return ticker;
    }
  };
  
  // Get display symbol (remove exchange prefix)
  const getDisplaySymbol = (tradingViewSymbol) => {
    if (tradingViewSymbol.includes(':')) {
      return tradingViewSymbol.split(':')[1];
    }
    return tradingViewSymbol;
  };
  
  // Search market symbols
  const searchMarketSymbols = async (term) => {
    try {
      // Use the miyagiAPI() function that gets replaced by miyagiAPI() by the injection system
      const symbols = await miyagiAPI.post('search-market-symbols', {
        term: term
      });
      return symbols;
    } catch (error) {
      console.error('Market symbol search API error:', error);
      throw error;
    }
  };
  
  // Map symbol to TradingView format
  const mapToTradingViewSymbol = (symbol) => {
    const type = symbol.type?.toLowerCase();
    
    if (type === 'cryptocurrency') {
      return `BINANCE:${symbol.symbol}`;
    } else if (type === 'forex' || type === 'currency') {
      return `FX:${symbol.symbol}`;
    } else if (type === 'equity' || type === 'stock') {
      return `NASDAQ:${symbol.symbol}`;
    } else if (type === 'etf') {
      return `NASDAQ:${symbol.symbol}`;
    } else {
      if (symbol.symbol.includes('USD') && symbol.symbol.length >= 6) {
        if (symbol.symbol.endsWith('USD')) {
          return `BINANCE:${symbol.symbol}`;
        } else if (symbol.symbol.length === 6) {
          return `FX:${symbol.symbol}`;
        }
      }
      return null;
    }
  };
  
  // Handle search suggestions
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Clear existing timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    // Check cache first
    const cacheKey = query.trim().toUpperCase();
    if (searchCache.current.has(cacheKey)) {
      setSuggestions(searchCache.current.get(cacheKey));
      setShowSuggestions(true);
      return;
    }
    
    setIsLoading(true);
    
    // Debounce API calls
    searchTimeout.current = setTimeout(async () => {
      try {
        const symbols = await searchMarketSymbols(query.trim());
        
        if (symbols && symbols.length > 0) {
          // Cache the results
          searchCache.current.set(cacheKey, symbols);
          setSuggestions(symbols.slice(0, 10)); // Limit to top 10
        } else {
          // Fallback to local popular symbols
          const upperQuery = query.toUpperCase();
          const filtered = popularSymbols.filter(item => 
            item.symbol.includes(upperQuery) || 
            item.name.toUpperCase().includes(upperQuery)
          );
          setSuggestions(filtered.slice(0, 10));
        }
        setShowSuggestions(true);
      } catch (error) {
        console.warn('Market symbol search failed, using fallback:', error);
        // Fallback to local popular symbols on error
        const upperQuery = query.toUpperCase();
        const filtered = popularSymbols.filter(item => 
          item.symbol.includes(upperQuery) || 
          item.name.toUpperCase().includes(upperQuery)
        );
        setSuggestions(filtered.slice(0, 10));
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);
  
  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setTickerInput(value);
    handleSearch(value);
  };
  
  // Add ticker
  const addTicker = () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    
    const tradingViewSymbol = formatSymbolWithExchange(ticker, selectedExchange);
    
    // Check if already added
    if (tickers.includes(tradingViewSymbol)) {
      setTickerInput('');
      setShowSuggestions(false);
      return;
    }
    
    setTickers([...tickers, tradingViewSymbol]);
    setTickerInput('');
    setShowSuggestions(false);
  };
  
  // Remove ticker
  const removeTicker = (ticker) => {
    const newTickers = tickers.filter(t => t !== ticker);
    setTickers(newTickers);
    
    // If removed ticker was the current one, select a new current ticker
    if (currentTicker === ticker) {
      setCurrentTicker(newTickers.length > 0 ? newTickers[0] : null);
    }
  };
  
  // Select ticker
  const selectTicker = (ticker) => {
    setCurrentTicker(ticker);
  };
  
  // Handle suggestion click
  const handleSuggestionClick = (symbol) => {
    setTickerInput(symbol);
    setShowSuggestions(false);
    // Auto-add the ticker
    setTimeout(() => addTicker(), 0);
  };
  
  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addTicker();
    }
  };
  
  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Load TradingView widget
  useEffect(() => {
    if (tickers.length === 0) return;
    
    // Clear existing widget
    const widgetContainer = document.getElementById('tradingview-widget');
    if (widgetContainer) {
      widgetContainer.innerHTML = '';
      
      // Create new container
      const container = document.createElement('div');
      container.className = 'tradingview-widget-container';
      container.style.height = '100%';
      container.style.width = '100%';
      container.style.flex = '1';
      container.style.minHeight = '0';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      
      widgetContainer.appendChild(container);
      
      // Create script element
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
      script.async = true;
      
      // Configure widget - focus on current ticker but show all
      const symbolsToShow = currentTicker ? 
        [currentTicker, ...tickers.filter(t => t !== currentTicker)] : 
        tickers;

      script.innerHTML = JSON.stringify({
        "symbols": symbolsToShow.map(ticker => {
          if (ticker.includes(':')) {
            return [ticker];
          } else {
            return [`NASDAQ:${ticker}`];
          }
        }),
        "chartOnly": false,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "colorTheme": "light",
        "autosize": true,
        "showVolume": false,
        "showMA": false,
        "hideDateRanges": false,
        "hideMarketStatus": false,
        "hideSymbolLogo": false,
        "scalePosition": "right",
        "scaleMode": "Normal",
        "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
        "fontSize": "10",
        "noTimeScale": false,
        "valuesTracking": "1",
        "changeMode": "price-and-percent",
        "chartType": "area",
        "maLineColor": "#2962FF",
        "maLineWidth": 1,
        "maLength": 9,
        "lineWidth": 2,
        "lineType": 0,
        "dateRanges": [
          "1d|1",
          "1m|30",
          "3m|60",
          "12m|1D",
          "60m|1W",
          "all|1M"
        ]
      });
      
      container.appendChild(script);
    }
  }, [tickers, currentTicker]);
  
  // Prepare visible and hidden tickers
  const maxVisibleTickers = 5;
  const visibleTickers = tickers.slice(0, maxVisibleTickers);
  const hiddenTickers = tickers.slice(maxVisibleTickers);
  
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f8f9fa',
      color: '#333',
      padding: '8px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      margin: 0
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        height: '100%',
        minHeight: 0
      }}>
        {/* Header Section */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a1a1a',
            margin: '0 0 10px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>📈</span>
            <span>Markets Ticker</span>
          </h2>
        
          {/* Search Section */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '10px'
          }}>
            <select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e1e4e8',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4a9eff';
                e.target.style.boxShadow = '0 0 0 3px rgba(74, 158, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e1e4e8';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="NASDAQ">NASDAQ</option>
              <option value="NYSE">NYSE</option>
              <option value="AMEX">AMEX</option>
              <option value="BINANCE">Binance (Crypto)</option>
              <option value="FX">Forex</option>
              <option value="SP">S&P</option>
              <option value="CBOE">CBOE</option>
            </select>
            
            <div style={{ flex: 1, position: 'relative' }} ref={suggestionsRef}>
              <input
                type="text"
                value={tickerInput}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter symbol (e.g., AAPL, BTCUSD, EURUSD)"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #e1e4e8',
                  borderRadius: '6px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4a9eff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(74, 158, 255, 0.1)';
                  if (tickerInput.trim()) handleSearch(tickerInput);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e1e4e8';
                  e.target.style.boxShadow = 'none';
                }}
              />
            
            {/* Suggestions */}
            {showSuggestions && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid #e1e4e8',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                zIndex: 100
              }}>
                {isLoading ? (
                  <div style={{
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontWeight: 600, color: '#1a1a1a' }}>Searching...</span>
                    <span style={{ fontSize: '12px', color: '#718096' }}>Please wait</span>
                  </div>
                ) : (
                  suggestions.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleSuggestionClick(item.symbol)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f0f4f8'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{item.symbol}</span>
                      <span style={{ fontSize: '12px', color: '#718096' }}>{item.name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          <button
            onClick={addTicker}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#4a9eff',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#3a8eef';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(74, 158, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#4a9eff';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <span>+</span>
            <span>Add Ticker</span>
          </button>
        </div>
        
        {/* Selected Tickers */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center'
        }}>
          {visibleTickers.map((ticker) => (
            <div
              key={ticker}
              onClick={() => selectTicker(ticker)}
              className={`ticker-chip ${ticker === currentTicker ? 'selected' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: ticker === currentTicker ? '#4a9eff' : '#f0f4f8',
                border: `1px solid ${ticker === currentTicker ? '#3a8eef' : '#e1e4e8'}`,
                borderRadius: '16px',
                fontSize: '12px',
                color: ticker === currentTicker ? 'white' : '#4a5568',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (ticker !== currentTicker) {
                  e.target.style.background = '#e9eef4';
                  e.target.style.borderColor = '#cbd5e0';
                }
              }}
              onMouseLeave={(e) => {
                if (ticker !== currentTicker) {
                  e.target.style.background = '#f0f4f8';
                  e.target.style.borderColor = '#e1e4e8';
                }
              }}
            >
              <span>{getDisplaySymbol(ticker)}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTicker(ticker);
                }}
                className="remove-ticker"
                style={{
                  cursor: 'pointer',
                  color: ticker === currentTicker ? 'white' : '#718096',
                  fontSize: '14px',
                  lineHeight: 1,
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (ticker !== currentTicker) {
                    e.target.style.color = '#e53e3e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (ticker !== currentTicker) {
                    e.target.style.color = '#718096';
                  }
                }}
              >
                ×
              </span>
            </div>
          ))}
          
          {/* More Tickers Dropdown */}
          {hiddenTickers.length > 0 && (
            <div className="more-tickers-dropdown" style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
              <div
                className="more-tickers-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: '#e2e8f0',
                  border: '1px solid #cbd5e0',
                  borderRadius: '16px',
                  fontSize: '12px',
                  color: '#4a5568',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#cbd5e0';
                  e.target.style.borderColor = '#a0aec0';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#e2e8f0';
                  e.target.style.borderColor = '#cbd5e0';
                }}
              >
                <span>+{hiddenTickers.length} more</span>
                <span>▼</span>
              </div>
              
              {showDropdown && (
                <div className="dropdown-content show" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: 'white',
                  border: '1px solid #e1e4e8',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  minWidth: '200px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  display: 'block'
                }}>
                  {hiddenTickers.map((ticker, index) => (
                    <div
                      key={ticker}
                      className={`dropdown-ticker ${ticker === currentTicker ? 'selected' : ''}`}
                      onClick={() => {
                        selectTicker(ticker);
                        setShowDropdown(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: index === hiddenTickers.length - 1 ? 'none' : '1px solid #f0f0f0',
                        transition: 'background 0.2s ease',
                        background: ticker === currentTicker ? '#4a9eff' : 'transparent',
                        color: ticker === currentTicker ? 'white' : '#4a5568',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (ticker !== currentTicker) {
                          e.target.style.background = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (ticker !== currentTicker) {
                          e.target.style.background = 'transparent';
                        }
                      }}
                    >
                      <span className="dropdown-ticker-name" style={{
                        fontSize: '13px',
                        color: ticker === currentTicker ? 'white' : '#4a5568',
                        fontWeight: 500
                      }}>
                        {getDisplaySymbol(ticker)}
                      </span>
                      <span
                        className="dropdown-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTicker(ticker);
                        }}
                        style={{
                          cursor: 'pointer',
                          color: ticker === currentTicker ? 'white' : '#718096',
                          fontSize: '14px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (ticker !== currentTicker) {
                            e.target.style.color = '#e53e3e';
                            e.target.style.background = '#fed7d7';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (ticker !== currentTicker) {
                            e.target.style.color = '#718096';
                            e.target.style.background = 'transparent';
                          }
                        }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
        {/* Trading Widget Container */}
        <div className="trading-widget-container" style={{
          background: 'white',
          borderRadius: '8px',
          padding: 0,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {tickers.length === 0 ? (
            <div className="widget-loading" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#718096'
            }}>
              <p className="info-text" style={{
                fontSize: '13px',
                color: '#718096',
                textAlign: 'center',
                marginTop: '12px'
              }}>
                Add some tickers to see market data
              </p>
            </div>
          ) : (
            <div
              id="tradingview-widget"
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketsTickerWidget;
