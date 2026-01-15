import React, { useEffect, useRef, useState } from 'react';

function NetworkVisualization({ 
  hiddenLayers, 
  onAddLayer, 
  onRemoveLayer,
  onAddNeuron,
  onRemoveNeuron,
  inputCount,
  network,
  visualUpdateTrigger,
  onHover,
  hoveredNode,
  isPlaying,
  darkMode
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 350 });
  const lastNeuronHoverKeyRef = useRef(null);
  
  // Load D3 once on mount
  useEffect(() => {
    if (!window.d3 && !document.getElementById('d3-script-network')) {
      const script = document.createElement('script');
      script.id = 'd3-script-network';
      script.src = 'https://d3js.org/d3.v7.min.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);
  
  // Observe container size and update dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Very flexible width - compress down to 300px for small screens, expand to 1200px for large
        const width = Math.max(300, Math.min(1200, rect.width - 10));
        // Height scales proportionally
        const height = Math.max(250, Math.min(500, width * 0.5));
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // While training is running, D3 redraws can destroy hovered elements before `mouseout` fires.
  // Use a lightweight pointer hit-test to clear/set neuron hover based on what's currently under the cursor.
  useEffect(() => {
    if (!isPlaying) return;

    const handlePointer = (e) => {
      if (!onHover) return;

      // Never interfere with FeaturePanel hover (or anything else).
      // Only manage clearing/setting when the current hover is a neuron.
      if (hoveredNode?.type !== 'neuron') {
        lastNeuronHoverKeyRef.current = null;
        return;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const neuronEl = el && el.closest ? el.closest('[data-nn-neuron-circle="1"]') : null;

      if (!neuronEl) {
        if (lastNeuronHoverKeyRef.current !== null) {
          lastNeuronHoverKeyRef.current = null;
          onHover(null);
        }
        return;
      }

      const layer = Number(neuronEl.getAttribute('data-layer'));
      const index = Number(neuronEl.getAttribute('data-index'));
      const key = `${layer}-${index}`;

      if (lastNeuronHoverKeyRef.current !== key) {
        lastNeuronHoverKeyRef.current = key;
        onHover({ type: 'neuron', layer, index });
      }
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    // Covers the case where the pointer doesn't move but a click happens elsewhere.
    window.addEventListener('pointerdown', handlePointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('pointerdown', handlePointer);
    };
  }, [isPlaying, onHover, hoveredNode]);

  // Redraw network whenever dependencies change
  useEffect(() => {
    if (!svgRef.current || !window.d3) {
      // Wait for D3 to load
      const checkD3 = setInterval(() => {
        if (window.d3) {
          clearInterval(checkD3);
          drawNetwork();
        }
      }, 100);
      return () => clearInterval(checkD3);
    } else {
      drawNetwork();
    }
  }, [hiddenLayers, inputCount, network, visualUpdateTrigger, dimensions, darkMode]);
  
  const drawNetwork = () => {
    if (!window.d3 || !svgRef.current) return;
    
    const d3 = window.d3;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    
    const layers = [inputCount, ...hiddenLayers, 1];
    
    const width = dimensions.width;
    const height = dimensions.height;
    const layerSpacing = width / (layers.length + 1);
    // Scale neuron radius dynamically based on width
    const neuronRadius = Math.max(10, Math.min(20, width / 45));
    
    // Calculate neuron positions
    const neurons = [];
    const connections = [];
    
    layers.forEach((count, layerIdx) => {
      const x = (layerIdx + 1) * layerSpacing;
      const availableHeight = height - 40;
      const spacing = availableHeight / (count + 1);
      
      for (let i = 0; i < count; i++) {
        const y = (i + 1) * spacing + 30;
        
        let bias = 0;
        if (layerIdx > 0 && network && network.biases && network.biases[layerIdx - 1]) {
          bias = network.biases[layerIdx - 1][i] || 0;
        }

        neurons.push({
          id: `${layerIdx}-${i}`,
          layer: layerIdx,
          index: i,
          x,
          y,
          bias,
          isInput: layerIdx === 0
        });
      }
    });
    
    // Create connections
    for (let layer = 0; layer < layers.length - 1; layer++) {
      const fromCount = layers[layer];
      const toCount = layers[layer + 1];
      
      for (let from = 0; from < fromCount; from++) {
        for (let to = 0; to < toCount; to++) {
          const fromNeuron = neurons.find(n => n.layer === layer && n.index === from);
          const toNeuron = neurons.find(n => n.layer === layer + 1 && n.index === to);
          
          let weight = 0;
          if (network && network.weights && network.weights[layer]) {
            weight = network.weights[layer][to]?.[from] || 0;
          }
          
          connections.push({
            source: fromNeuron,
            target: toNeuron,
            weight,
            layer
          });
        }
      }
    }
    
    // Create tooltip element
    let tooltip = d3.select('body').select('.network-tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body')
        .append('div')
        .attr('class', 'network-tooltip');
    }
    
    // Update tooltip styles based on dark mode
    tooltip
      .style('position', 'absolute')
      .style('padding', '8px 12px')
      .style('background', darkMode ? 'rgba(30, 41, 59, 0.98)' : 'rgba(255, 255, 255, 0.98)')
      .style('color', darkMode ? '#f1f5f9' : '#1f2937')
      .style('border-radius', '8px')
      .style('font-size', '12px')
      .style('font-family', 'Inter, sans-serif')
      .style('box-shadow', darkMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.15)')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000)
      .style('border', darkMode ? '1px solid #334155' : '1px solid #f0f0f0')
      .style('transform', 'translateY(-100%)')
      .style('margin-top', '-10px');
    
    // Draw connections
    svg.selectAll('.connection')
      .data(connections)
      .enter()
      .append('line')
      .attr('class', 'connection')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', d => d.weight > 0 ? '#6366f1' : '#f97316')
      .attr('stroke-width', d => Math.max(0.8, Math.min(5, Math.abs(d.weight) * 2)))
      .attr('opacity', d => Math.min(0.7, Math.abs(d.weight) * 0.5 + 0.15))
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-width', d => Math.max(3, Math.min(7, Math.abs(d.weight) * 2.5 + 1)))
          .attr('opacity', 1);
        
        const labelColor = darkMode ? '#94a3b8' : '#9ca3af';
        tooltip
          .style('opacity', 1)
          .html(`<div><span style="color:${labelColor}; font-size:10px;">Weight</span></div><div style="font-weight:600; font-size:14px; color:${d.weight > 0 ? '#6366f1' : '#f97316'}">${d.weight.toFixed(3)}</div>`)
          .style('left', (event.pageX) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mousemove', function(event) {
        tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke-width', d => Math.max(0.8, Math.min(5, Math.abs(d.weight) * 2)))
          .attr('opacity', d => Math.min(0.7, Math.abs(d.weight) * 0.5 + 0.15));
        tooltip.style('opacity', 0);
      });
    
    // Draw neurons
    const neuronGroups = svg.selectAll('.neuron')
      .data(neurons)
      .enter()
      .append('g')
      .attr('class', 'neuron')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'pointer'); // Changed to pointer to indicate interactivity
      
    neuronGroups.append('circle')
      .attr('data-nn-neuron-circle', '1')
      .attr('data-layer', d => d.layer)
      .attr('data-index', d => d.index)
      .attr('r', neuronRadius)
      .attr('fill', d => {
        if (d.isInput) return darkMode ? '#0f172a' : '#fff';
        // Color based on bias - stronger scaling
        const baseColor = darkMode ? '#0f172a' : '#fff';
        const intensity = Math.min(1, Math.abs(d.bias));
        if (d.bias > 0) return d3.interpolateRgb(baseColor, '#6366f1')(intensity * 0.7);
        if (d.bias < 0) return d3.interpolateRgb(baseColor, '#f97316')(intensity * 0.7);
        return baseColor;
      })
      .attr('stroke', d => {
        if (d.isInput) return darkMode ? '#475569' : '#d1d5db';
        if (d.bias > 0) return '#6366f1';
        if (d.bias < 0) return '#f97316';
        return darkMode ? '#475569' : '#d1d5db';
      })
      .attr('stroke-width', d => d.isInput ? 2 : 2.5)
      .on('mouseover', function(event, d) {
        // Trigger hover effect for OutputPanel
        lastNeuronHoverKeyRef.current = `${d.layer}-${d.index}`;
        if (onHover) {
          onHover({ type: 'neuron', layer: d.layer, index: d.index });
        }

        if (d.isInput) return;
        
        const labelColor = darkMode ? '#94a3b8' : '#9ca3af';
        tooltip
          .style('opacity', 1)
          .html(`<div><span style="color:${labelColor}; font-size:10px;">Bias</span></div><div style="font-weight:600; font-size:14px; color:${d.bias > 0 ? '#6366f1' : '#f97316'}">${d.bias.toFixed(3)}</div>`)
          .style('left', (event.pageX) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mousemove', function(event, d) {
        if (d.isInput) return;
        tooltip.style('left', (event.pageX) + 'px').style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        // Clear hover state and tooltip on mouseout
        lastNeuronHoverKeyRef.current = null;
        if (onHover) {
          onHover(null);
        }
        tooltip.style('opacity', 0);
      });
      
    neuronGroups.filter(d => !d.isInput).append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
        // Make text white if background is dark enough, otherwise colored
        const intensity = Math.min(1, Math.abs(d.bias));
        if (intensity > 0.6) return '#fff';
        return d.bias > 0 ? '#6366f1' : '#f97316';
      })
      .attr('font-size', `${Math.max(9, neuronRadius * 0.6)}px`)
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => Math.abs(d.bias) > 0.1 ? (d.bias > 0 ? '+' : '−') : '');

    // Layer labels
    const labels = [
      { layer: 0, text: 'Input' },
      ...hiddenLayers.map((_, i) => ({ layer: i + 1, text: `Hidden ${i + 1}` })),
      { layer: layers.length - 1, text: 'Output' }
    ];
    
    const labelFontSize = Math.max(10, Math.min(13, width / 70));
    
    svg.selectAll('.layer-label')
      .data(labels)
      .enter()
      .append('text')
      .attr('x', (d, i) => (i + 1) * layerSpacing)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', darkMode ? '#e2e8f0' : '#111827')
      .attr('font-size', `${labelFontSize}px`)
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', '600')
      .text(d => d.text);
  };
  
  return (
    <div className="flex-grow flex flex-col" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-end mb-2">
        <div className="flex gap-2 p-1.5 rounded-xl" style={{ backgroundColor: darkMode ? '#0f172a' : '#f9fafb' }}>
          <button
            onClick={onRemoveLayer}
            disabled={hiddenLayers.length === 0}
            className="px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{ 
              color: darkMode ? '#cbd5e1' : '#4b5563',
              cursor: hiddenLayers.length === 0 ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (hiddenLayers.length > 0) {
                e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#ffffff';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            − Layer
          </button>
          <button
            onClick={onAddLayer}
            disabled={hiddenLayers.length >= 4}
            className="px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{ 
              color: darkMode ? '#cbd5e1' : '#4b5563',
              cursor: hiddenLayers.length >= 4 ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (hiddenLayers.length < 4) {
                e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#ffffff';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            + Layer
          </button>
        </div>
      </div>
      
      <div ref={containerRef} className="flex-grow flex items-center justify-center" style={{ minHeight: '250px', overflow: 'visible' }}>
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} style={{ overflow: 'visible' }} />
      </div>
      
      {/* Neuron count controls */}
      {hiddenLayers.length > 0 && (
        <div className="mt-3">
          <div className="text-center mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: darkMode ? '#64748b' : '#6b7280' }}>
              Adjust Neurons per Layer
            </span>
          </div>
          <div className="flex gap-6 justify-center">
            {hiddenLayers.map((neurons, idx) => (
              <div key={idx} className="text-center">
                <div className="text-[9px] mb-1.5 font-medium" style={{ color: darkMode ? '#64748b' : '#9ca3af' }}>
                  Layer {idx + 1}
                </div>
                <div className="flex gap-2 items-center rounded-lg p-1.5" style={{ backgroundColor: darkMode ? '#0f172a' : '#f9fafb' }}>
                  <button
                    onClick={() => onRemoveNeuron(idx)}
                    disabled={neurons <= 1}
                    className="w-6 h-6 rounded-md text-sm transition-all flex items-center justify-center disabled:opacity-50"
                    style={{ 
                      color: darkMode ? '#94a3b8' : '#6b7280',
                      cursor: neurons <= 1 ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (neurons > 1) {
                        e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    −
                  </button>
                  <div className="w-5 text-center text-sm font-bold" style={{ color: darkMode ? '#e2e8f0' : '#374151' }}>
                    {neurons}
                  </div>
                  <button
                    onClick={() => onAddNeuron(idx)}
                    disabled={neurons >= 8}
                    className="w-6 h-6 rounded-md text-sm transition-all flex items-center justify-center disabled:opacity-50"
                    style={{ 
                      color: darkMode ? '#94a3b8' : '#6b7280',
                      cursor: neurons >= 8 ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (neurons < 8) {
                        e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkVisualization;
