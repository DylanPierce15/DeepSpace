import React, { useState, useEffect, useRef, useCallback } from 'react';
import TopBar from './components/TopBar.jsx';
import DataPanel from './components/DataPanel.jsx';
import FeaturePanel from './components/FeaturePanel.jsx';
import NetworkVisualization from './components/NetworkVisualization.jsx';
import OutputPanel from './components/OutputPanel.jsx';
import HelpModal from './components/HelpModal.jsx';
import { datasets } from './utils/datasets.js';
import { applyFeatures } from './utils/features.js';
import { NeuralNetwork } from './utils/neuralNetwork.js';

function NeuralNetworkPlayground() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Central State Management
  const [state, setState] = useState({
    isPlaying: false,
    epoch: 0,
    learningRate: 0.03,
    activation: 'tanh',
    regularization: 'None',
    regularizationRate: 0,
    dataset: 'circle',
    noise: 0,
    trainTestRatio: 0.5,
    batchSize: 10,
    hiddenLayers: [4],
    enabledFeatures: {
      x1: true,
      x2: true,
      x1_squared: true,
      x2_squared: true,
      x1_x2: false,
      sin_x1: false,
      sin_x2: false
    },
    showTestData: false,
    discretizeOutput: false
  });
  
  // Data
  const [rawData, setRawData] = useState([]);
  const [trainData, setTrainData] = useState([]);
  const [testData, setTestData] = useState([]);
  
  // Network
  const [network, setNetwork] = useState(null);
  
  // Metrics
  const [trainLoss, setTrainLoss] = useState(0);
  const [testLoss, setTestLoss] = useState(0);
  const [lossHistory, setLossHistory] = useState({ train: [], test: [] });
  
  // Refs for training loop
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const batchIndexRef = useRef(0);
  const epochRef = useRef(0);
  
  // Force component updates for visualization
  const [visualUpdateTrigger, setVisualUpdateTrigger] = useState(0);
  
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);
  
  // Hover state for visualization
  const [hoveredNode, setHoveredNode] = useState(null);

  // Load Tailwind and D3
  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }

    // Load D3
    if (!document.getElementById('d3-script')) {
      const d3Script = document.createElement('script');
      d3Script.id = 'd3-script';
      d3Script.src = 'https://d3js.org/d3.v7.min.js';
      document.head.appendChild(d3Script);
    }

    document.body.style.background = darkMode ? '#0f172a' : '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, [darkMode]);

  // Generate initial data
  useEffect(() => {
    generateData();
  }, []);
  
  // Process raw data into train/test with features
  useEffect(() => {
    if (rawData.length === 0) return;
    
    const inputCount = Object.values(state.enabledFeatures).filter(Boolean).length;
    if (inputCount === 0) return;
    
    // Shuffle and split based on trainTestRatio
    const shuffled = [...rawData].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * state.trainTestRatio);
    
    const train = shuffled.slice(0, splitIndex).map(point => ({
      input: applyFeatures(point, state.enabledFeatures),
      label: point.label,
      x: point.x,
      y: point.y
    }));
    
    const test = shuffled.slice(splitIndex).map(point => ({
      input: applyFeatures(point, state.enabledFeatures),
      label: point.label,
      x: point.x,
      y: point.y
    }));
    
    setTrainData(train);
    setTestData(test);
  }, [rawData, state.enabledFeatures, state.trainTestRatio]);
  
  // Regenerate network when architecture, activation, or learning rate changes
  useEffect(() => {
    const inputCount = Object.values(state.enabledFeatures).filter(Boolean).length;
    if (inputCount > 0) {
      const layerSizes = [inputCount, ...state.hiddenLayers, 1];
      const newNetwork = new NeuralNetwork(layerSizes, state.activation, state.learningRate);
      setNetwork(newNetwork);
      
      // Reset metrics
      setState(prev => ({ ...prev, epoch: 0 }));
      setTrainLoss(0);
      setTestLoss(0);
      setLossHistory({ train: [], test: [] });
      batchIndexRef.current = 0;
      epochRef.current = 0;
    }
  }, [state.hiddenLayers, state.activation, state.enabledFeatures, state.learningRate]);
  
  // Training loop using requestAnimationFrame
  useEffect(() => {
    if (!state.isPlaying || !network || trainData.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }
    
    // Initialize epoch ref from state when training starts
    epochRef.current = state.epoch;
    
    const trainLoop = (timestamp) => {
      // Train at approximately 120 FPS (faster updates)
      if (timestamp - lastUpdateRef.current < 8) {
        animationRef.current = requestAnimationFrame(trainLoop);
        return;
      }
      
      lastUpdateRef.current = timestamp;
      
      // Create mini-batch using configured batch size
      const batch = [];
      
      for (let i = 0; i < state.batchSize && trainData.length > 0; i++) {
        batch.push(trainData[batchIndexRef.current % trainData.length]);
        batchIndexRef.current++;
      }
      
      // Train on batch with regularization
      const result = network.trainBatch(batch, state.regularization, state.regularizationRate);
      
      // Check for explosion
      if (result.exploded || network.hasExploded()) {
        console.warn('Network exploded! Resetting...');
        handleReset();
        return;
      }
      
      // Update train loss
      setTrainLoss(result.loss);
      
      // Calculate test loss every 10 epochs
      if (epochRef.current % 10 === 0 && testData.length > 0) {
        let totalTestLoss = 0;
        for (const sample of testData) {
          const pred = network.predict(sample.input);
          const error = pred - sample.label;
          totalTestLoss += error * error;
        }
        const avgTestLoss = totalTestLoss / testData.length;
        setTestLoss(avgTestLoss);
        
        // Update history
        setLossHistory(prev => ({
          train: [...prev.train.slice(-99), result.loss],
          test: [...prev.test.slice(-99), avgTestLoss]
        }));
      }
      
      // Increment epoch using ref for performance (avoid effect restart every epoch)
      epochRef.current++;
      setState(prev => ({ ...prev, epoch: epochRef.current }));
      
      // Force UI update every epoch for truly live updates
      setVisualUpdateTrigger(prev => prev + 1);
      
      // Continue loop
      animationRef.current = requestAnimationFrame(trainLoop);
    };
    
    animationRef.current = requestAnimationFrame(trainLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying, network, trainData, testData, state.regularization, state.regularizationRate, state.batchSize]);
  
  const generateData = useCallback(() => {
    const generator = datasets[state.dataset];
    const points = generator(200, state.noise / 30);
    setRawData(points);
  }, [state.dataset, state.noise]);
  
  const handleReset = () => {
    // 1. Pause simulation if running and reset epoch
    setState(prev => ({ ...prev, isPlaying: false, epoch: 0 }));
    
    // 2. Clear loss history completely - graph will be blank
    setLossHistory({ train: [], test: [] });
    setTrainLoss(0);
    setTestLoss(0);
    
    // 3. Reset batch index and epoch ref
    batchIndexRef.current = 0;
    epochRef.current = 0;
    
    // 4. Create new network with fresh random weights
    const inputCount = Object.values(state.enabledFeatures).filter(Boolean).length;
    if (inputCount > 0) {
      const layerSizes = [inputCount, ...state.hiddenLayers, 1];
      const newNetwork = new NeuralNetwork(layerSizes, state.activation, state.learningRate);
      setNetwork(newNetwork);
    }
    
    // 5. Trigger visual update
    setVisualUpdateTrigger(prev => prev + 1);
  };
  
  const handleAddLayer = () => {
    if (state.hiddenLayers.length < 4) {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        hiddenLayers: [...prev.hiddenLayers, 2]
      }));
    }
  };
  
  const handleRemoveLayer = () => {
    if (state.hiddenLayers.length > 0) {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        hiddenLayers: prev.hiddenLayers.slice(0, -1)
      }));
    }
  };
  
  const handleAddNeuron = (layerIndex) => {
    if (state.hiddenLayers[layerIndex] < 8) {
      const newLayers = [...state.hiddenLayers];
      newLayers[layerIndex]++;
      setState(prev => ({
        ...prev,
        isPlaying: false,
        hiddenLayers: newLayers
      }));
    }
  };
  
  const handleRemoveNeuron = (layerIndex) => {
    if (state.hiddenLayers[layerIndex] > 1) {
      const newLayers = [...state.hiddenLayers];
      newLayers[layerIndex]--;
      setState(prev => ({
        ...prev,
        isPlaying: false,
        hiddenLayers: newLayers
      }));
    }
  };
  
  const handleToggleFeature = (featureKey) => {
    const newFeatures = {
      ...state.enabledFeatures,
      [featureKey]: !state.enabledFeatures[featureKey]
    };
    
    // Ensure at least one feature is enabled
    if (Object.values(newFeatures).some(Boolean)) {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        enabledFeatures: newFeatures
      }));
    }
  };
  
  const handleDatasetChange = (ds) => {
    // Stop training
    setState(prev => ({ ...prev, dataset: ds, isPlaying: false, epoch: 0 }));
    
    // Clear loss history immediately
    setLossHistory({ train: [], test: [] });
    setTrainLoss(0);
    setTestLoss(0);
    
    // Reset epoch ref
    epochRef.current = 0;
    batchIndexRef.current = 0;
    
    // Generate new data
    setTimeout(() => {
      const generator = datasets[ds];
      const points = generator(200, state.noise / 30);
      setRawData(points);
      
      // After data is set, reset the network
      setTimeout(() => {
        const inputCount = Object.values(state.enabledFeatures).filter(Boolean).length;
        if (inputCount > 0) {
          const layerSizes = [inputCount, ...state.hiddenLayers, 1];
          const newNetwork = new NeuralNetwork(layerSizes, state.activation, state.learningRate);
          setNetwork(newNetwork);
          
          // Trigger visual update
          setVisualUpdateTrigger(prev => prev + 1);
        }
      }, 100);
    }, 0);
  };
  
  const handleRegenerate = () => {
    setState(prev => ({ ...prev, isPlaying: false }));
    generateData();
    handleReset();
  };

  if (!tailwindLoaded) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        color: '#9ca3af'
      }}>
        Loading Neural Network Playground...
      </div>
    );
  }

  const inputCount = Object.values(state.enabledFeatures).filter(Boolean).length;

  return (
    <div 
      className="min-h-screen"
      style={{ 
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
      }}
    >
      {/* Top Bar */}
      <TopBar
        isPlaying={state.isPlaying}
        onTogglePlay={() => setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
        onReset={handleReset}
        learningRate={state.learningRate}
        onLearningRateChange={(lr) => {
          setState(prev => ({ ...prev, learningRate: lr, isPlaying: false }));
        }}
        activation={state.activation}
        onActivationChange={(act) => {
          setState(prev => ({ ...prev, activation: act, isPlaying: false }));
        }}
        regularization={state.regularization}
        onRegularizationChange={(reg) => {
          setState(prev => ({ ...prev, regularization: reg }));
        }}
        regularizationRate={state.regularizationRate}
        onRegularizationRateChange={(rate) => {
          setState(prev => ({ ...prev, regularizationRate: rate }));
        }}
        onShowHelp={() => setShowHelp(true)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(prev => !prev)}
      />
      
      {/* Main Content - Column Layout */}
      <div className="p-6">
        <div className="flex gap-4 items-stretch" style={{ minWidth: 0 }}>
          {/* 1. Data */}
          <DataPanel
            dataset={state.dataset}
            onDatasetChange={handleDatasetChange}
            noise={state.noise}
            onNoiseChange={(n) => setState(prev => ({ ...prev, noise: n }))}
            trainTestRatio={state.trainTestRatio}
            onTrainTestRatioChange={(ratio) => setState(prev => ({ ...prev, trainTestRatio: ratio }))}
            batchSize={state.batchSize}
            onBatchSizeChange={(size) => setState(prev => ({ ...prev, batchSize: size }))}
            onRegenerate={handleRegenerate}
            darkMode={darkMode}
          />
          
          {/* 2. Features & Network - Unified Card */}
          <div className="flex-1 rounded-3xl p-6 flex flex-col" style={{ 
            minWidth: 0, 
            minHeight: '100%',
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0'
          }}>
            <div className="mb-4">
              <h3 className="text-sm font-bold tracking-tight" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
                2. Network Architecture
              </h3>
              <p className="text-xs mt-0.5 font-light" style={{ color: darkMode ? '#94a3b8' : '#6b7280' }}>
                <span className="text-indigo-400 font-medium">Blue</span> = Class 1, <span className="text-orange-400 font-medium">Orange</span> = Class 0
              </p>
            </div>
            
            <div className="flex gap-3 flex-grow" style={{ minWidth: 0, minHeight: 0 }}>
              <FeaturePanel
                enabledFeatures={state.enabledFeatures}
                onToggleFeature={handleToggleFeature}
                onHover={node => setHoveredNode(node)}
                darkMode={darkMode}
              />
              <NetworkVisualization
                hiddenLayers={state.hiddenLayers}
                onAddLayer={handleAddLayer}
                onRemoveLayer={handleRemoveLayer}
                onAddNeuron={handleAddNeuron}
                onRemoveNeuron={handleRemoveNeuron}
                inputCount={inputCount}
                network={network}
                visualUpdateTrigger={visualUpdateTrigger}
                onHover={node => setHoveredNode(node)}
                hoveredNode={hoveredNode}
                isPlaying={state.isPlaying}
                darkMode={darkMode}
              />
            </div>
          </div>
          
          {/* 4. Output */}
          <OutputPanel
            trainLoss={trainLoss}
            testLoss={testLoss}
            lossHistory={lossHistory}
            epoch={state.epoch}
            showTestData={state.showTestData}
            onToggleTestData={() => setState(prev => ({ ...prev, showTestData: !prev.showTestData }))}
            discretizeOutput={state.discretizeOutput}
            onToggleDiscretize={() => setState(prev => ({ ...prev, discretizeOutput: !prev.discretizeOutput }))}
            trainData={trainData}
            testData={testData}
            network={network}
            enabledFeatures={state.enabledFeatures}
            visualUpdateTrigger={visualUpdateTrigger}
            hoveredNode={hoveredNode}
            darkMode={darkMode}
          />
        </div>
      </div>
      
      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} darkMode={darkMode} />
    </div>
  );
}

export default NeuralNetworkPlayground;
