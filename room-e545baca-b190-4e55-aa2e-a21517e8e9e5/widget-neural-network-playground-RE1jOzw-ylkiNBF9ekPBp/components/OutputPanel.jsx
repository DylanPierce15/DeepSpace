import React, { useEffect, useRef, useCallback, useState } from 'react';
import { applyFeatures } from '../utils/features.js';

function OutputPanel({ 
  trainLoss, 
  testLoss, 
  lossHistory,
  epoch,
  showTestData,
  onToggleTestData,
  discretizeOutput,
  onToggleDiscretize,
  trainData,
  testData,
  network,
  enabledFeatures,
  visualUpdateTrigger,
  hoveredNode,
  darkMode
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState(280);
  
  // Observe container width to adjust canvas size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setCanvasSize(Math.min(280, width - 48)); // 48px for padding
      }
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Draw heatmap and data points
  const drawHeatmap = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = darkMode ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Draw decision boundary heatmap (low-res grid for performance)
    const resolution = 4;
    const range = 6;
    
    for (let i = 0; i < width; i += resolution) {
      for (let j = 0; j < height; j += resolution) {
        const x = (i / width) * (range * 2) - range;
        const y = (j / height) * (range * 2) - range;
        
        let value = 0;
        
        if (hoveredNode) {
          // Visualizing a specific node (feature or neuron)
          if (hoveredNode.type === 'feature') {
            // Calculate specific feature value
            const point = { x, y };
            // We need to apply features but extract just the one we want
            // The features util returns an array based on enabled features
            // But we want to visualize a specific feature definition regardless of if enabled or not
            // Actually, we can just calculate it directly:
            const rawFeatures = applyFeatures(point, { [hoveredNode.id]: true });
            // Since we enabled ONLY the target feature, rawFeatures[0] is our value
            value = rawFeatures[0];
            
            // Normalize for visualization (tanh-like squashing)
            value = Math.tanh(value * 0.5); // Soft squash
            
          } else if (hoveredNode.type === 'neuron' && network) {
            // Visualizing a specific neuron output
            const features = applyFeatures({ x, y }, enabledFeatures);
            if (features.length === 0) continue;
            
            // Run forward pass to get internal state
            network.forward(features);
            
            // Access specific neuron activation
            // nodeOutputs structure: [inputs, hidden1, hidden2..., output]
            // visualization layers: 0=input(features), 1=hidden1, ...
            
            // If layer is 0 (input layer in viz), it corresponds to enabled features
            if (hoveredNode.layer === 0) {
               // This refers to an enabled feature input
               // nodeOutputs[0] is the input vector
               value = network.nodeOutputs[0][hoveredNode.index];
            } else {
               // Hidden/Output layers
               // nodeOutputs indices match visualization layer indices
               if (network.nodeOutputs[hoveredNode.layer]) {
                 value = network.nodeOutputs[hoveredNode.layer][hoveredNode.index];
               }
            }
          }
        } else if (network) {
          // Default: Network Prediction
          const features = applyFeatures({ x, y }, enabledFeatures);
          if (features.length === 0) continue;
          
          const prediction = network.predict(features);
          if (isNaN(prediction)) continue;
          
          value = discretizeOutput ? (prediction > 0.5 ? 1 : -1) : (prediction - 0.5) * 2; 
          // normalize to [-1, 1] range for consistent coloring logic below
          // prediction is 0..1 (sigmoid/tanh output mapped to probability)
          // Wait, predict returns 0..1 for sigmoid output layer?
          // NeuralNetwork.js uses sigmoid for last layer: 0..1
          // So (val - 0.5) * 2 maps to -1..1
        }
        
        // Unified coloring logic: value in range roughly [-1, 1]
        // Positive (Blue) vs Negative (Orange)
        if (value > 0) {
          const intensity = Math.min(1, Math.abs(value));
          ctx.fillStyle = `rgba(99, 102, 241, ${intensity * 0.5})`; // Indigo
        } else {
          const intensity = Math.min(1, Math.abs(value));
          ctx.fillStyle = `rgba(249, 115, 22, ${intensity * 0.5})`; // Orange
        }
        
        ctx.fillRect(i, j, resolution, resolution);
      }
    }
    
    // Draw data points (only if not hovering a feature/neuron to keep it clean, OR keep them for context?)
    // Usually better to keep them for context
    const drawPoints = (data, isTrain) => {
      data.forEach(point => {
        const x = ((point.x + 6) / 12) * width;
        const y = ((point.y + 6) / 12) * height;
        
        ctx.beginPath();
        // Slightly larger points
        ctx.arc(x, y, isTrain ? 6 : 5, 0, 2 * Math.PI);
        
        // Fill based on label
        ctx.fillStyle = point.label === 1 ? '#6366f1' : '#f97316';
        ctx.fill();
        
        // Border for all points to make them pop
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = darkMode ? '#0f172a' : '#ffffff';
        ctx.stroke();
        
        // Extra border for test data
        if (!isTrain) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = darkMode ? '#94a3b8' : '#1f2937';
          ctx.stroke();
        }
      });
    };
    
    drawPoints(trainData, true);
    if (showTestData) {
      drawPoints(testData, false);
    }
  }, [network, trainData, testData, showTestData, discretizeOutput, enabledFeatures, visualUpdateTrigger, hoveredNode, darkMode]);
  
  // Trigger redraw whenever dependencies change
  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);
  
  // Draw loss chart with D3 (unchanged)
  useEffect(() => {
    if (!chartRef.current || !window.d3) return;
    
    const d3 = window.d3;
    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();
    
    // Use getBoundingClientRect for more reliable width measurement
    const rect = chartRef.current.getBoundingClientRect();
    const chartWidth = rect.width || chartRef.current.clientWidth || 280;
    const margin = { top: 10, right: 15, bottom: 28, left: 35 };
    const width = chartWidth - margin.left - margin.right;
    const height = 100 - margin.top - margin.bottom;
    
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Always show axes even with no data
    const hasData = lossHistory.train.length >= 2;
    
    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, Math.max(lossHistory.train.length - 1, 10)])
      .range([0, width]);
    
    const maxLoss = hasData ? Math.max(
      d3.max(lossHistory.train) || 1,
      d3.max(lossHistory.test) || 1,
      0.1
    ) : 1;
    
    const yScale = d3.scaleLinear()
      .domain([0, maxLoss])
      .range([height, 0]);
    
    // Draw axes first (always visible)
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(4))
      .style('font-size', '8px')
      .style('font-family', 'Inter, sans-serif')
      .style('color', '#9ca3af');
    
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .style('font-size', '8px')
      .style('font-family', 'Inter, sans-serif')
      .style('color', '#9ca3af');
    
    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(d3.axisLeft(yScale)
        .ticks(4)
        .tickSize(-width)
        .tickFormat(''));
    
    // Axis labels - properly positioned
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 23)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('font-family', 'Inter, sans-serif')
      .style('fill', '#9ca3af')
      .style('font-weight', '500')
      .text('Epochs');
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 10)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('font-family', 'Inter, sans-serif')
      .style('fill', '#9ca3af')
      .style('font-weight', '500')
      .text('Loss');
    
    // Only draw lines if we have data
    if (hasData) {
      const trainLine = d3.line()
        .x((d, i) => xScale(i))
        .y(d => yScale(d))
        .curve(d3.curveMonotoneX);
      
      const testLine = d3.line()
        .x((d, i) => xScale(i))
        .y(d => yScale(d))
        .curve(d3.curveMonotoneX);
      
      g.append('path')
        .datum(lossHistory.train)
        .attr('fill', 'none')
        .attr('stroke', '#9ca3af')
        .attr('stroke-width', 1.5)
        .attr('d', trainLine);
      
      if (lossHistory.test.length > 1) {
        g.append('path')
          .datum(lossHistory.test)
          .attr('fill', 'none')
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 1.5)
          .attr('d', testLine);
      }
    }
  }, [lossHistory, canvasSize]); // Re-render when canvas size changes to ensure proper centering
  
  return (
    <div 
      ref={containerRef}
      className="rounded-3xl p-6 flex flex-col"
      style={{ 
        minWidth: '280px',
        width: '320px',
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
        flexShrink: 1
      }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold tracking-tight" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>
          3. Results
        </h3>
        <p className="text-xs mt-0.5 font-light" style={{ color: darkMode ? '#94a3b8' : '#6b7280' }}>
          {hoveredNode ? 
            (hoveredNode.type === 'feature' ? `Visualizing feature: ${hoveredNode.id}` : `Visualizing output of Layer ${hoveredNode.layer + 1} Neuron ${hoveredNode.index + 1}`) 
            : 'See how well it learned'}
        </p>
      </div>
      
      {/* Color Legend */}
      <div className="mb-4 p-2.5 rounded-xl" style={{ 
        backgroundColor: darkMode ? '#0f172a' : '#f9fafb',
        border: darkMode ? '1px solid #1e293b' : '1px solid #e5e7eb'
      }}>
        <div className="font-semibold text-[10px] mb-1.5" style={{ color: darkMode ? '#e2e8f0' : '#111827' }}>
          Color Guide:
        </div>
        <div className="space-y-1 text-[9px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <span className="font-medium" style={{ color: darkMode ? '#cbd5e1' : '#4b5563' }}>
              Blue = Class 1
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="font-medium" style={{ color: darkMode ? '#cbd5e1' : '#4b5563' }}>
              Orange = Class 0
            </span>
          </div>
        </div>
      </div>
      
      {/* Heatmap Canvas */}
      <div className="mb-3 flex-grow flex flex-col">
        <div className="mb-2">
          <span className="text-xs font-medium" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>
            {hoveredNode ? 'Activation Map' : 'Decision Boundary'}
          </span>
        </div>
        <div className="flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={350}
            height={350}
            style={{
              width: '100%',
              maxWidth: `${canvasSize}px`,
              height: 'auto',
              borderRadius: '16px',
              border: darkMode ? '1px solid #334155' : '1px solid #f0f0f0',
              boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)'
            }}
          />
        </div>
      </div>
      
      {/* Metrics */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg p-1.5 text-center" style={{ backgroundColor: darkMode ? '#0f172a' : '#f9fafb' }}>
          <div className="text-[8px] uppercase tracking-wide mb-0.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Steps</div>
          <div className="text-xs font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>{epoch}</div>
        </div>
        <div className="rounded-lg p-1.5 text-center" style={{ backgroundColor: darkMode ? '#0f172a' : '#f9fafb' }}>
          <div className="text-[8px] uppercase tracking-wide mb-0.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Train</div>
          <div className="text-xs font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>{trainLoss.toFixed(3)}</div>
        </div>
        <div className="rounded-lg p-1.5 text-center" style={{ backgroundColor: darkMode ? '#0f172a' : '#f9fafb' }}>
          <div className="text-[8px] uppercase tracking-wide mb-0.5" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>Test</div>
          <div className="text-xs font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827' }}>{testLoss.toFixed(3)}</div>
        </div>
      </div>
      
      {/* Loss Chart */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-medium" style={{ color: darkMode ? '#cbd5e1' : '#374151' }}>Error Rate</span>
          <div className="flex gap-2 text-[9px]">
            <span className="flex items-center gap-1" style={{ color: darkMode ? '#94a3b8' : '#6b7280' }}>
              <span className="w-2 h-0.5" style={{ backgroundColor: darkMode ? '#94a3b8' : '#9ca3af' }}></span> Train
            </span>
            <span className="flex items-center gap-1" style={{ color: darkMode ? '#e2e8f0' : '#111827' }}>
              <span className="w-2 h-0.5" style={{ backgroundColor: darkMode ? '#e2e8f0' : '#1f2937' }}></span> Test
            </span>
          </div>
        </div>
        <svg 
          ref={chartRef}
          width="100%" 
          height="100"
          className="w-full"
        />
      </div>
      
      {/* Controls */}
      <div className="space-y-1.5">
        <button
          onClick={onToggleTestData}
          className="flex items-center justify-between w-full p-2 rounded-lg transition-colors"
          style={{
            border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#0f172a' : '#f9fafb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span className="text-[10px] font-medium" style={{ color: darkMode ? '#cbd5e1' : '#4b5563' }}>Show test</span>
          <div 
            className="w-9 h-4.5 flex items-center rounded-full p-0.5 transition-colors"
            style={{ backgroundColor: showTestData ? '#6366f1' : (darkMode ? '#334155' : '#e5e7eb') }}
          >
            <div 
              className="bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform"
              style={{ transform: showTestData ? 'translateX(18px)' : 'translateX(0)' }}
            ></div>
          </div>
        </button>
        
        <button
          onClick={onToggleDiscretize}
          className="flex items-center justify-between w-full p-2 rounded-lg transition-colors"
          style={{
            border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#0f172a' : '#f9fafb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <span className="text-[10px] font-medium" style={{ color: darkMode ? '#cbd5e1' : '#4b5563' }}>Discretize</span>
          <div 
            className="w-9 h-4.5 flex items-center rounded-full p-0.5 transition-colors"
            style={{ backgroundColor: discretizeOutput ? '#6366f1' : (darkMode ? '#334155' : '#e5e7eb') }}
          >
            <div 
              className="bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform"
              style={{ transform: discretizeOutput ? 'translateX(18px)' : 'translateX(0)' }}
            ></div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default OutputPanel;
