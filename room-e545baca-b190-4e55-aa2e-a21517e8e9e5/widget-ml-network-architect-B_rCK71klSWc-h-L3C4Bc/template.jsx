import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import NavigationBar from './components/NavigationBar.jsx';
import KMeansVisualization from './components/KMeansVisualization.jsx';
import ElbowChart from './components/ElbowChart.jsx';
import InertiaChart from './components/InertiaChart.jsx';
import LinearRegressionVisualization from './components/LinearRegressionVisualization.jsx';
import ResidualPlot from './components/ResidualPlot.jsx';
import PredictedVsActual from './components/PredictedVsActual.jsx';
import {
  initializeCentroids,
  assignPointsToClusters,
  updateCentroids,
  calculateInertia,
  calculateElbowData
} from './utils/kmeans.js';
import {
  calculateMSE,
  calculateRMSE,
  calculateMAE,
  calculateR2,
  generateRandomPoints as generateLRPoints,
  calculateOptimalLine,
  generateLinearPoints,
  gradientDescentStep
} from './utils/linearRegression.js';

function MLVisualization() {
  const [currentView, setCurrentView] = useState('home'); // 'home', 'kmeans', or 'linear-regression'
  
  // K-Means state
  const [points, setPoints] = useState([]);
  const [centroids, setCentroids] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [k, setK] = useState(3);
  const [learningRate, setLearningRate] = useState(1.0);
  const [gdSpeed, setGdSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [inertiaHistory, setInertiaHistory] = useState([]);
  const [phase, setPhase] = useState('idle'); // 'assignment', 'update', 'idle'
  const [initializationMode, setInitializationMode] = useState('random'); // 'random' or 'kmeans++'
  const [hasStartedClustering, setHasStartedClustering] = useState(false);
  
  // Elbow data
  const [elbowData, setElbowData] = useState([]);
  const [isCalculatingElbow, setIsCalculatingElbow] = useState(false);
  
  // Animation timer
  const animationTimerRef = useRef(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    document.body.style.background = '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, []);

  // Initialize with random points
  const generateRandomPoints = useCallback((count = 100) => {
    const LOGICAL_WIDTH = 800;
    const LOGICAL_HEIGHT = 600;
    
    const newPoints = [];
    for (let i = 0; i < count; i++) {
      newPoints.push([
        Math.random() * LOGICAL_WIDTH,
        Math.random() * LOGICAL_HEIGHT
      ]);
    }
    setPoints(newPoints);
    setIteration(0);
    setInertiaHistory([]);
    setPhase('idle');
    setHasStartedClustering(false);
  }, []);

  // Reset model
  const resetModel = useCallback(() => {
    if (points.length === 0) return;
    
    const newCentroids = initializeCentroids(points, k, initializationMode);
    setCentroids(newCentroids);
    const newAssignments = assignPointsToClusters(points, newCentroids);
    setAssignments(newAssignments);
    setIteration(0);
    setInertiaHistory([]);
    setPhase('idle');
    setHasStartedClustering(false);
    
    const inertia = calculateInertia(points, newAssignments, newCentroids, true); // Normalize for display
    setInertiaHistory([inertia]);
  }, [points, k, initializationMode]);

  // Step one iteration
  const step = useCallback(() => {
    if (points.length === 0 || centroids.length === 0 || isProcessingRef.current) return;
    
    setHasStartedClustering(true);
    isProcessingRef.current = true;
    
    // Assignment phase
    setPhase('assignment');
    const newAssignments = assignPointsToClusters(points, centroids);
    setAssignments(newAssignments);
    
    setTimeout(() => {
      // Update phase
      setPhase('update');
      const newCentroids = updateCentroids(points, newAssignments, centroids, learningRate);
      setCentroids(newCentroids);
      
      const inertia = calculateInertia(points, newAssignments, newCentroids, true); // Normalize for display
      setInertiaHistory(prev => [...prev, inertia]);
      setIteration(prev => prev + 1);
      setPhase('assignment');
      
      isProcessingRef.current = false;
    }, 300);
  }, [points, centroids, learningRate]);

  // Calculate elbow data - only when number of points changes
  const prevPointsLengthRef = useRef(0);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  
  useEffect(() => {
    if (points.length === 0) {
      setElbowData([]);
      prevPointsLengthRef.current = 0;
      return;
    }
    
    // Only recalculate if the number of points changed (not just positions)
    if (points.length !== prevPointsLengthRef.current) {
      prevPointsLengthRef.current = points.length;
      setIsCalculatingElbow(true);
      
      // Use setTimeout to prevent blocking UI
      setTimeout(() => {
        const data = calculateElbowData(pointsRef.current, 10);
        setElbowData(data);
        setIsCalculatingElbow(false);
      }, 100);
    }
  }, [points.length]);

  // Auto-play
  useEffect(() => {
    if (isPlaying && centroids.length > 0) {
      const delay = 1000 / gdSpeed; // Convert speed to delay in ms
      
      animationTimerRef.current = setTimeout(() => {
        if (!isProcessingRef.current) {
          step();
        }
      }, delay);
    } else {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    }
    
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [isPlaying, step, gdSpeed, centroids.length]);

  // Initialize when points or k changes
  const pointsLengthForInitRef = useRef(0);
  useEffect(() => {
    if (points.length > 0) {
      // Only reinitialize if number of points changed (not just positions)
      if (points.length !== pointsLengthForInitRef.current) {
        pointsLengthForInitRef.current = points.length;
        const newCentroids = initializeCentroids(points, k, initializationMode);
        setCentroids(newCentroids);
        const newAssignments = assignPointsToClusters(points, newCentroids);
        setAssignments(newAssignments);
        setIteration(0);
        setInertiaHistory([]);
        setPhase('idle');
        
        const inertia = calculateInertia(points, newAssignments, newCentroids, true); // Normalize for display
        setInertiaHistory([inertia]);
      }
    }
  }, [points.length, k, initializationMode]);

  // Initial random points - run once on mount
  useEffect(() => {
    if (currentView === 'kmeans' && points.length === 0) {
      generateRandomPoints(100);
    }
  }, [currentView, generateRandomPoints, points.length]);

  // Update point
  const handleUpdatePoint = useCallback((index, newPoint) => {
    setPoints(prev => {
      const updated = [...prev];
      updated[index] = newPoint;
      return updated;
    });
  }, []);

  // Calculate current metrics
  const currentInertia = centroids.length > 0 && points.length > 0
    ? calculateInertia(points, assignments, centroids, true) // Normalize for display
    : 0;
  
  const mse = currentInertia; // Already normalized, so MSE equals normalized inertia

  // Linear Regression state
  const [lrPoints, setLrPoints] = useState([]);
  const [slope, setSlope] = useState(1.0);
  const [intercept, setIntercept] = useState(0.0);
  const [lrLearningRate, setLrLearningRate] = useState(0.01);
  const [lrSpeed, setLrSpeed] = useState(1);
  const [lrIsPlaying, setLrIsPlaying] = useState(false);
  const [lrIteration, setLrIteration] = useState(0);
  const [lrLossHistory, setLrLossHistory] = useState([]);
  
  // Animation timer for linear regression
  const lrAnimationTimerRef = useRef(null);
  const lrIsProcessingRef = useRef(false);

  const handleNavigate = (path) => {
    if (path === '/') {
      setCurrentView('home');
    } else if (path === '/kmeans') {
      setCurrentView('kmeans');
    } else if (path === '/linear-regression') {
      setCurrentView('linear-regression');
    }
  };

  const currentPath = currentView === 'home' ? '/' : currentView === 'kmeans' ? '/kmeans' : '/linear-regression';

  // Initialize Linear Regression points
  useEffect(() => {
    if (currentView === 'linear-regression' && lrPoints.length === 0) {
      setLrPoints(generateLRPoints(20, 0, 10, 0, 10));
    }
  }, [currentView, lrPoints.length]);

  const handleUpdateLRPoint = useCallback((index, newPoint) => {
    setLrPoints(prev => {
      const updated = [...prev];
      updated[index] = newPoint;
      return updated;
    });
  }, []);

  // Linear Regression training step
  const lrStep = useCallback(() => {
    if (lrPoints.length === 0 || lrIsProcessingRef.current) return;
    
    lrIsProcessingRef.current = true;
    const result = gradientDescentStep(lrPoints, slope, intercept, lrLearningRate);
    
    setSlope(result.newSlope);
    setIntercept(result.newIntercept);
    setLrLossHistory(prev => [...prev, result.loss]);
    setLrIteration(prev => prev + 1);
    
    lrIsProcessingRef.current = false;
  }, [lrPoints, slope, intercept, lrLearningRate]);

  // Auto-play for linear regression
  useEffect(() => {
    if (lrIsPlaying && lrPoints.length > 0) {
      const delay = 1000 / lrSpeed;
      
      lrAnimationTimerRef.current = setTimeout(() => {
        if (!lrIsProcessingRef.current) {
          lrStep();
        }
      }, delay);
    } else {
      if (lrAnimationTimerRef.current) {
        clearTimeout(lrAnimationTimerRef.current);
      }
    }
    
    return () => {
      if (lrAnimationTimerRef.current) {
        clearTimeout(lrAnimationTimerRef.current);
      }
    };
  }, [lrIsPlaying, lrStep, lrSpeed, lrPoints.length]);

  // Calculate Linear Regression metrics
  const lrMSE = lrPoints.length > 0 ? calculateMSE(lrPoints, slope, intercept) : 0;
  const lrRMSE = lrPoints.length > 0 ? calculateRMSE(lrPoints, slope, intercept) : 0;
  const lrMAE = lrPoints.length > 0 ? calculateMAE(lrPoints, slope, intercept) : 0;
  const lrR2 = lrPoints.length > 0 ? calculateR2(lrPoints, slope, intercept) : 0;

  // Home Page View
  if (currentView === 'home') {
    const models = [
      {
        id: 'kmeans',
        name: 'K-Means Clustering',
        description: 'Partition data into K clusters by iteratively updating centroids',
        onClick: () => setCurrentView('kmeans')
      },
      {
        id: 'linear-regression',
        name: 'Linear Regression',
        description: 'Fit a linear model y = mx + b to data points',
        onClick: () => setCurrentView('linear-regression')
      }
    ];

    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#ffffff',
        paddingLeft: '220px',
        paddingTop: '60px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif'
      }}>
        <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
        <NavigationBar onNavigate={handleNavigate} />
        
        <div style={{ minHeight: 'calc(100vh - 60px)' }}>
          <div style={{ maxWidth: '950px', margin: '0 auto', padding: '40px 30px' }}>
            <h1 style={{ 
              fontSize: '2em', 
              fontWeight: 400, 
              color: '#222', 
              marginBottom: '8px' 
            }}>
              Machine Learning Visualizations
            </h1>
            <p style={{ 
              fontSize: '18px', 
              color: '#666', 
              marginBottom: '40px', 
              paddingBottom: '20px', 
              borderBottom: '1px solid #e0e0e0' 
            }}>
              Interactive, educational visualizations of machine learning algorithms
            </p>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '25px'
            }}>
              {models.map((model) => (
                <div
                  key={model.id}
                  onClick={model.onClick}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    padding: '25px 30px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, border-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fafafa';
                    e.currentTarget.style.borderColor = '#ddd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '10px',
                    margin: '0 0 10px 0'
                  }}>
                    {model.name}
                  </h3>
                  <p style={{
                    color: '#666',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {model.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Linear Regression Page View
  if (currentView === 'linear-regression') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#ffffff',
        paddingLeft: '220px',
        paddingTop: '60px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif'
      }}>
        <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
        <NavigationBar onNavigate={handleNavigate} />
        
        <div style={{ minHeight: 'calc(100vh - 60px)' }}>
          <div style={{ maxWidth: '1700px', margin: '0 auto' }}>
            {/* Page Header */}
            <div style={{
              padding: '30px 30px 20px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h1 style={{
                fontSize: '2em',
                fontWeight: 400,
                color: '#222',
                marginBottom: '8px',
                margin: '0 0 8px 0'
              }}>
                Linear Regression
              </h1>
              <p style={{
                fontSize: '16px',
                color: '#666',
                margin: 0,
                lineHeight: 1.6
              }}>
                Interactive visualization of linear regression with y = mx + b
              </p>
            </div>

            {/* Three Column Layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr 320px',
              gap: '20px',
              padding: '20px 30px',
              minHeight: 'calc(100vh - 200px)'
            }}>
              {/* Left Panel - Controls & Stats */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                overflowY: 'auto',
                minWidth: '220px'
              }}>
                {/* Controls Section */}
                <div style={{
                  padding: '25px 20px',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '20px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0',
                    margin: '0 0 20px 0'
                  }}>
                    Controls
                  </h3>
                  
                  {/* Formula Display */}
                  <div style={{
                    marginBottom: '1.5em',
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: '2px',
                    border: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      fontFamily: 'serif',
                      color: '#222',
                      fontStyle: 'italic'
                    }}>
                      y = {slope.toFixed(2)}x {intercept >= 0 ? '+' : ''}{intercept.toFixed(2)}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '1.5em' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875em',
                      color: '#202122',
                      marginBottom: '0.5em',
                      fontWeight: 500
                    }}>
                      Slope (m): {slope.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={slope}
                      onChange={(e) => setSlope(parseFloat(e.target.value))}
                      disabled={lrIsPlaying}
                      style={{
                        width: '100%',
                        height: '6px',
                        background: '#e0e0e0',
                        borderRadius: '3px',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        opacity: lrIsPlaying ? 0.6 : 1
                      }}
                    />
                  </div>
                  
                  <div style={{ marginBottom: '1.5em' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875em',
                      color: '#202122',
                      marginBottom: '0.5em',
                      fontWeight: 500
                    }}>
                      Intercept (b): {intercept.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.1"
                      value={intercept}
                      onChange={(e) => setIntercept(parseFloat(e.target.value))}
                      style={{
                        width: '100%',
                        height: '6px',
                        background: '#e0e0e0',
                        borderRadius: '3px',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        appearance: 'none'
                      }}
                    />
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75em'
                  }}>
                    <button
                      onClick={() => setLrIsPlaying(!lrIsPlaying)}
                      disabled={lrPoints.length === 0}
                      style={{
                        padding: '0.75em 1em',
                        border: 'none',
                        borderRadius: '2px',
                        fontSize: '0.875em',
                        cursor: lrPoints.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'background-color 0.2s',
                        fontWeight: 500,
                        backgroundColor: lrPoints.length > 0 ? '#36c' : '#e0e0e0',
                        color: lrPoints.length > 0 ? 'white' : '#999'
                      }}
                      onMouseEnter={(e) => {
                        if (lrPoints.length > 0) {
                          e.target.style.backgroundColor = '#2a4b8d';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (lrPoints.length > 0) {
                          e.target.style.backgroundColor = '#36c';
                        }
                      }}
                    >
                      {lrIsPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                      onClick={lrStep}
                      disabled={lrIsPlaying || lrPoints.length === 0 || lrIsProcessingRef.current}
                      style={{
                        padding: '0.75em 1em',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '0.875em',
                        cursor: (lrIsPlaying || lrPoints.length === 0 || lrIsProcessingRef.current) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: 500,
                        backgroundColor: (lrIsPlaying || lrPoints.length === 0 || lrIsProcessingRef.current) ? '#fafafa' : '#ffffff',
                        color: (lrIsPlaying || lrPoints.length === 0 || lrIsProcessingRef.current) ? '#999' : '#222',
                        opacity: (lrIsPlaying || lrPoints.length === 0 || lrIsProcessingRef.current) ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!lrIsPlaying && lrPoints.length > 0 && !lrIsProcessingRef.current) {
                          e.target.style.backgroundColor = '#f5f5f5';
                          e.target.style.borderColor = '#ccc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!lrIsPlaying && lrPoints.length > 0 && !lrIsProcessingRef.current) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#ddd';
                        }
                      }}
                    >
                      Step
                    </button>
                    <button
                      onClick={() => {
                        setLrIsPlaying(false);
                        setLrIteration(0);
                        setLrLossHistory([]);
                        // Reset to random initial values
                        setSlope((Math.random() - 0.5) * 2);
                        setIntercept((Math.random() - 0.5) * 5);
                      }}
                      disabled={lrIsPlaying}
                      style={{
                        padding: '0.75em 1em',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '0.875em',
                        cursor: lrIsPlaying ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: 500,
                        backgroundColor: lrIsPlaying ? '#fafafa' : '#ffffff',
                        color: lrIsPlaying ? '#999' : '#222',
                        opacity: lrIsPlaying ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#f5f5f5';
                          e.target.style.borderColor = '#ccc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#ddd';
                        }
                      }}
                    >
                      Reset Training
                    </button>
                    <button
                      onClick={() => {
                        // Calculate optimal line from current points
                        const optimal = calculateOptimalLine(lrPoints);
                        // Generate linear points based on optimal line
                        const linearPoints = generateLinearPoints(20, optimal.slope, optimal.intercept, 0, 10, 0.2);
                        setLrPoints(linearPoints);
                        // Set slope and intercept to optimal values
                        setSlope(optimal.slope);
                        setIntercept(optimal.intercept);
                      }}
                      disabled={lrIsPlaying}
                      style={{
                        padding: '0.75em 1em',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '0.875em',
                        cursor: lrIsPlaying ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: 500,
                        backgroundColor: lrIsPlaying ? '#fafafa' : '#ffffff',
                        color: lrIsPlaying ? '#999' : '#222',
                        opacity: lrIsPlaying ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#f5f5f5';
                          e.target.style.borderColor = '#ccc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#ddd';
                        }
                      }}
                    >
                      Optimal
                    </button>
                    <button
                      onClick={() => setLrPoints(generateLRPoints(20, 0, 10, 0, 10))}
                      disabled={lrIsPlaying}
                      style={{
                        padding: '0.75em 1em',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '0.875em',
                        cursor: lrIsPlaying ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: 500,
                        backgroundColor: lrIsPlaying ? '#fafafa' : '#ffffff',
                        color: lrIsPlaying ? '#999' : '#222',
                        opacity: lrIsPlaying ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#f5f5f5';
                          e.target.style.borderColor = '#ccc';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!lrIsPlaying) {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#ddd';
                        }
                      }}
                    >
                      Random Points
                    </button>
                  </div>
                </div>
                
                {/* Live Information Section */}
                <div style={{
                  padding: '25px 20px',
                  borderBottom: 'none'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '20px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0',
                    margin: '0 0 20px 0'
                  }}>
                    Training Info
                  </h3>
                  
                  <div style={{ marginBottom: '1.5em' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>Iteration:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrIteration}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>Current Loss:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrLossHistory.length > 0 ? lrLossHistory[lrLossHistory.length - 1].toFixed(4) : lrMSE.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '20px',
                    paddingTop: '20px',
                    paddingBottom: '10px',
                    borderTop: '1px solid #e0e0e0',
                    borderBottom: '1px solid #e0e0e0',
                    margin: '20px 0 20px 0'
                  }}>
                    Error Metrics
                  </h3>
                  
                  <div style={{ marginBottom: '1.5em' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>MSE:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrMSE.toFixed(4)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>RMSE:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrRMSE.toFixed(4)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>MAE:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrMAE.toFixed(4)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: '#666', fontWeight: 500 }}>R²:</span>
                      <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                        {lrR2.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Center Panel - Visualization */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                overflowY: 'auto',
                flex: 1,
                minWidth: 0,
                padding: '1em'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#222',
                  marginBottom: '20px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e0e0e0',
                  margin: '0 0 20px 0'
                }}>
                  Visualization
                </h3>
                <div style={{ height: '600px' }}>
                  <LinearRegressionVisualization
                    points={lrPoints}
                    slope={slope}
                    intercept={intercept}
                    onUpdatePoint={handleUpdateLRPoint}
                  />
                </div>
              </div>
              
              {/* Right Panel - Charts */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#ffffff',
                border: '1px solid #e0e0e0',
                overflowY: 'auto',
                minWidth: '320px'
              }}>
                {/* Residual Plot */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '400px',
                  padding: '25px 20px',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '1em',
                    margin: '0 0 1em 0'
                  }}>
                    Residual Plot
                  </h3>
                  <div style={{
                    flex: 1,
                    position: 'relative',
                    minHeight: '300px'
                  }}>
                    {lrPoints.length > 0 ? (
                      <ResidualPlot points={lrPoints} slope={slope} intercept={intercept} />
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '300px',
                        color: '#72777d',
                        fontSize: '0.875em'
                      }}>
                        Add points to see residual plot
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Predicted vs Actual Plot */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '400px',
                  padding: '25px 20px',
                  borderBottom: 'none'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#222',
                    marginBottom: '1em',
                    margin: '0 0 1em 0'
                  }}>
                    Predicted vs Actual
                  </h3>
                  <div style={{
                    flex: 1,
                    position: 'relative',
                    minHeight: '300px'
                  }}>
                    {lrPoints.length > 0 ? (
                      <PredictedVsActual points={lrPoints} slope={slope} intercept={intercept} />
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '300px',
                        color: '#72777d',
                        fontSize: '0.875em'
                      }}>
                        Add points to see predicted vs actual plot
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // K-Means Page View
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#ffffff',
      paddingLeft: '220px',
      paddingTop: '60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif'
    }}>
      <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
      <NavigationBar onNavigate={handleNavigate} />
      
      <div style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div style={{ maxWidth: '1700px', margin: '0 auto' }}>
          {/* Page Header */}
          <div style={{
            padding: '30px 30px 20px',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <h1 style={{
              fontSize: '2em',
              fontWeight: 400,
              color: '#222',
              marginBottom: '8px',
              margin: '0 0 8px 0'
            }}>
              K-Means Clustering
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#666',
              margin: 0,
              lineHeight: 1.6
            }}>
              Interactive visualization of the K-Means clustering algorithm
            </p>
          </div>

          {/* Three Column Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr 350px',
            gap: '20px',
            padding: '20px 30px',
            minHeight: 'calc(100vh - 200px)'
          }}>
            {/* Left Panel - Controls & Stats */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              overflowY: 'auto',
              minWidth: '220px'
            }}>
              {/* Controls Section */}
              <div style={{
                padding: '25px 20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#222',
                  marginBottom: '20px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e0e0e0',
                  margin: '0 0 20px 0'
                }}>
                  Controls
                </h3>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875em',
                    color: '#202122',
                    marginBottom: '0.5em',
                    fontWeight: 500
                  }}>
                    Number of Clusters (K): {k}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={k}
                    onChange={(e) => setK(parseInt(e.target.value))}
                    disabled={isPlaying}
                    style={{
                      width: '100%',
                      height: '6px',
                      background: '#e0e0e0',
                      borderRadius: '3px',
                      outline: 'none',
                      WebkitAppearance: 'none',
                      appearance: 'none'
                    }}
                  />
                  <style>{`
                    input[type="range"]::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 18px;
                      height: 18px;
                      background: #0066cc;
                      border-radius: 50%;
                      cursor: pointer;
                    }
                    input[type="range"]::-moz-range-thumb {
                      width: 18px;
                      height: 18px;
                      background: #0066cc;
                      border-radius: 50%;
                      cursor: pointer;
                      border: none;
                    }
                  `}</style>
                </div>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875em',
                    color: '#202122',
                    marginBottom: '0.5em',
                    fontWeight: 500
                  }}>
                    Learning Rate: {learningRate.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={learningRate}
                    onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      background: '#e0e0e0',
                      borderRadius: '3px',
                      outline: 'none',
                      WebkitAppearance: 'none',
                      appearance: 'none'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875em',
                    color: '#202122',
                    marginBottom: '0.5em',
                    fontWeight: 500
                  }}>
                    GD Speed: {gdSpeed} steps/s
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={gdSpeed}
                    onChange={(e) => setGdSpeed(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      background: '#e0e0e0',
                      borderRadius: '3px',
                      outline: 'none',
                      WebkitAppearance: 'none',
                      appearance: 'none'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875em',
                    color: '#202122',
                    marginBottom: '0.5em',
                    fontWeight: 500
                  }}>
                    Initialization:
                  </label>
                  <select
                    value={initializationMode}
                    onChange={(e) => setInitializationMode(e.target.value)}
                    disabled={isPlaying}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '14px',
                      backgroundColor: '#ffffff',
                      color: '#222',
                      cursor: 'pointer',
                      marginTop: '8px',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="random">Random</option>
                    <option value="kmeans++">K-Means++</option>
                  </select>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '6px',
                    fontStyle: 'italic',
                    lineHeight: 1.5
                  }}>
                    {initializationMode === 'random' ? (
                      <span>Random: Centroids start at random data points</span>
                    ) : (
                      <span>K-Means++: Centroids are spread apart intelligently for better results</span>
                    )}
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75em'
                }}>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={centroids.length === 0}
                    style={{
                      padding: '0.75em 1em',
                      border: 'none',
                      borderRadius: '2px',
                      fontSize: '0.875em',
                      cursor: centroids.length > 0 ? 'pointer' : 'not-allowed',
                      transition: 'background-color 0.2s',
                      fontWeight: 500,
                      backgroundColor: centroids.length > 0 ? '#36c' : '#e0e0e0',
                      color: centroids.length > 0 ? 'white' : '#999'
                    }}
                    onMouseEnter={(e) => {
                      if (centroids.length > 0) {
                        e.target.style.backgroundColor = '#2a4b8d';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (centroids.length > 0) {
                        e.target.style.backgroundColor = '#36c';
                      }
                    }}
                  >
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    onClick={step}
                    disabled={isPlaying || centroids.length === 0 || isProcessingRef.current}
                    style={{
                      padding: '0.75em 1em',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '0.875em',
                      cursor: (isPlaying || centroids.length === 0 || isProcessingRef.current) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      fontWeight: 500,
                      backgroundColor: (isPlaying || centroids.length === 0 || isProcessingRef.current) ? '#fafafa' : '#ffffff',
                      color: (isPlaying || centroids.length === 0 || isProcessingRef.current) ? '#999' : '#222',
                      opacity: (isPlaying || centroids.length === 0 || isProcessingRef.current) ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isPlaying && centroids.length > 0 && !isProcessingRef.current) {
                        e.target.style.backgroundColor = '#f5f5f5';
                        e.target.style.borderColor = '#ccc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPlaying && centroids.length > 0 && !isProcessingRef.current) {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.borderColor = '#ddd';
                      }
                    }}
                  >
                    Step
                  </button>
                  <button
                    onClick={resetModel}
                    disabled={isPlaying || points.length === 0}
                    style={{
                      padding: '0.75em 1em',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '0.875em',
                      cursor: (isPlaying || points.length === 0) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      fontWeight: 500,
                      backgroundColor: (isPlaying || points.length === 0) ? '#fafafa' : '#ffffff',
                      color: (isPlaying || points.length === 0) ? '#999' : '#222',
                      opacity: (isPlaying || points.length === 0) ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isPlaying && points.length > 0) {
                        e.target.style.backgroundColor = '#f5f5f5';
                        e.target.style.borderColor = '#ccc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPlaying && points.length > 0) {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.borderColor = '#ddd';
                      }
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => generateRandomPoints(100)}
                    disabled={isPlaying}
                    style={{
                      padding: '0.75em 1em',
                      border: '1px solid #ddd',
                      borderRadius: '2px',
                      fontSize: '0.875em',
                      cursor: isPlaying ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      fontWeight: 500,
                      backgroundColor: isPlaying ? '#fafafa' : '#ffffff',
                      color: isPlaying ? '#999' : '#222',
                      opacity: isPlaying ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isPlaying) {
                        e.target.style.backgroundColor = '#f5f5f5';
                        e.target.style.borderColor = '#ccc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPlaying) {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.borderColor = '#ddd';
                      }
                    }}
                  >
                    Random Points
                  </button>
                </div>
              </div>
              
              {/* Live Information Section */}
              <div style={{
                padding: '25px 20px',
                borderBottom: 'none'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#222',
                  marginBottom: '20px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e0e0e0',
                  margin: '0 0 20px 0'
                }}>
                  Live Information
                </h3>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Mode:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {initializationMode === 'kmeans++' ? 'K-Means++' : 'Random Init'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Iteration:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {iteration}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Data Points:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {points.length}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Phase:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {phase === 'assignment' ? 'Assignment' : phase === 'update' ? 'Update' : 'Idle'}
                    </span>
                  </div>
                </div>
                
                <div style={{ marginBottom: '1.5em' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Objective (J):</span>
                    <span style={{ color: '#222', textAlign: 'right', fontSize: '13px', fontStyle: 'italic', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      Σ ||xᵢ − μ_c(i)||²
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>Inertia:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {currentInertia.toFixed(2)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    fontSize: '14px'
                  }}>
                    <span style={{ color: '#666', fontWeight: 500 }}>MSE:</span>
                    <span style={{ color: '#222', textAlign: 'right', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Source Sans Pro", "Inter", "Helvetica Neue", Arial, sans-serif' }}>
                      {mse.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Center Panel - Visualization */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              overflowY: 'auto',
              flex: 1,
              minWidth: 0,
              padding: '1em'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 500,
                color: '#222',
                marginBottom: '20px',
                paddingBottom: '10px',
                borderBottom: '1px solid #e0e0e0',
                margin: '0 0 20px 0'
              }}>
                Visualization
              </h3>
              <div style={{ height: '600px' }}>
                <KMeansVisualization
                  points={points}
                  centroids={centroids}
                  assignments={assignments}
                  onUpdatePoint={handleUpdatePoint}
                  phase={phase}
                  hasStartedClustering={hasStartedClustering}
                />
              </div>
            </div>
            
            {/* Right Panel - Charts */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              border: '1px solid #e0e0e0',
              overflowY: 'auto',
              minWidth: '350px'
            }}>
              {/* Elbow Method Chart */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '400px',
                padding: '25px 20px',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#222',
                  marginBottom: '1em',
                  margin: '0 0 1em 0'
                }}>
                  Elbow Method
                </h3>
                <div style={{
                  flex: 1,
                  position: 'relative',
                  minHeight: '300px'
                }}>
                  {isCalculatingElbow ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '300px',
                      color: '#72777d',
                      fontSize: '0.875em'
                    }}>
                      Calculating...
                    </div>
                  ) : elbowData.length > 0 ? (
                    <ElbowChart elbowData={elbowData} />
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '300px',
                      color: '#72777d',
                      fontSize: '0.875em'
                    }}>
                      Add points to see elbow method
                    </div>
                  )}
                </div>
              </div>
              
              {/* Inertia Over Time Chart */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '400px',
                padding: '25px 20px',
                borderBottom: 'none'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: '#222',
                  marginBottom: '1em',
                  margin: '0 0 1em 0'
                }}>
                  Inertia Over Time
                </h3>
                <div style={{
                  flex: 1,
                  position: 'relative',
                  minHeight: '300px'
                }}>
                  {inertiaHistory.length > 0 ? (
                    <InertiaChart inertiaHistory={inertiaHistory} />
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '300px',
                      color: '#72777d',
                      fontSize: '0.875em'
                    }}>
                      Run iterations to see convergence
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MLVisualization;
